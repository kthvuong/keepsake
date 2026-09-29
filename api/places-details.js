module.exports = async (req, res) => {
  var placeId = req.query.placeId;
  var sessionToken = req.query.sessiontoken || "";
  if (!placeId) {
    res.status(400).json({ error: "Missing placeId" });
    return;
  }
  var apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server not configured" });
    return;
  }
  try {
    var url = "https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId) +
      (sessionToken ? "?sessionToken=" + encodeURIComponent(sessionToken) : "");
    var r = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "formattedAddress,location,addressComponents,types"
      }
    });
    var data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: (data && data.error && data.error.message) || "Details request failed" });
      return;
    }
    var comps = data.addressComponents || [];
    function findType(types) {
      for (var i = 0; i < types.length; i++) {
        for (var j = 0; j < comps.length; j++) {
          if (comps[j].types && comps[j].types.indexOf(types[i]) >= 0) return comps[j].longText;
        }
      }
      return "";
    }
    var placeTypes = data.types || [];
    res.status(200).json({
      isEstablishment: placeTypes.indexOf("establishment") >= 0 || placeTypes.indexOf("point_of_interest") >= 0,
      address: data.formattedAddress || "",
      lat: data.location ? data.location.latitude : null,
      lng: data.location ? data.location.longitude : null,
      city: findType(["locality", "postal_town", "administrative_area_level_2", "administrative_area_level_1"]),
      neighborhood: findType(["neighborhood", "sublocality_level_1", "sublocality", "administrative_area_level_3"])
    });
  } catch (err) {
    res.status(500).json({ error: "Details lookup failed" });
  }
};
