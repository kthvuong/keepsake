var whyDenied = require("./_auth");

module.exports = async (req, res) => {
  var denied = await whyDenied(req);
  if (denied) {
    res.status(401).json({ error: "Sign in first", reason: denied });
    return;
  }
  // Search text and tokens are short strings; anything else is dropped before it reaches Google.
  var input = String(req.query.input || "").trim().slice(0, 120);
  var sessionToken = String(req.query.sessiontoken || "").slice(0, 64);
  if (input.length < 3) {
    res.status(200).json({ suggestions: [] });
    return;
  }
  var apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server not configured" });
    return;
  }
  try {
    var r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat"
      },
      body: JSON.stringify({ input: input, sessionToken: sessionToken })
    });
    var data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: (data && data.error && data.error.message) || "Autocomplete request failed" });
      return;
    }
    var suggestions = (data.suggestions || [])
      .filter(function (s) { return s.placePrediction; })
      .map(function (s) {
        var p = s.placePrediction;
        var main = (p.structuredFormat && p.structuredFormat.mainText && p.structuredFormat.mainText.text) || (p.text && p.text.text) || "";
        var secondary = (p.structuredFormat && p.structuredFormat.secondaryText && p.structuredFormat.secondaryText.text) || "";
        return { placeId: p.placeId, mainText: main, secondaryText: secondary };
      });
    res.status(200).json({ suggestions: suggestions });
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
};
