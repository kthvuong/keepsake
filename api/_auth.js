var crypto = require("crypto");

// Only the shared keepsake account may use these functions. This checks the sign-in token the app sends
// against Google's public keys, so no secret is needed here.
var PROJECT_ID = "plateandpin";
var PASSCODE_EMAIL = "keepsake@example.com";
var CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

var certs = null, certsExpire = 0;
async function loadCerts() {
  if (certs && Date.now() < certsExpire) return certs;
  var r = await fetch(CERTS_URL);
  if (!r.ok) throw new Error("certs unavailable");
  var maxAge = /max-age=(\d+)/.exec(r.headers.get("cache-control") || "");
  certs = await r.json();
  certsExpire = Date.now() + (maxAge ? Math.min(parseInt(maxAge[1], 10), 21600) : 3600) * 1000;
  return certs;
}

function decode(part) { return JSON.parse(Buffer.from(part, "base64url").toString("utf8")); }

// Returns "" when the request comes from the shared account, otherwise a short reason the app can show.
async function whyDenied(req) {
  try {
    var m = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(req.headers.authorization || ""));
    if (!m) return "no sign-in sent";
    var header = decode(m[1]), claims = decode(m[2]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return "unreadable sign-in";
    var all = await loadCerts();
    if (!Object.prototype.hasOwnProperty.call(all, header.kid)) return "unknown signing key";
    var good = crypto.createVerify("RSA-SHA256").update(m[1] + "." + m[2]).verify(all[header.kid], Buffer.from(m[3], "base64url"));
    if (!good) return "signature didn't match";
    var now = Math.floor(Date.now() / 1000);
    if (claims.aud !== PROJECT_ID || claims.iss !== "https://securetoken.google.com/" + PROJECT_ID) return "wrong project";
    if (typeof claims.sub !== "string" || claims.sub === "") return "unreadable sign-in";
    if (typeof claims.exp !== "number" || claims.exp <= now) return "sign-in expired";
    if (typeof claims.iat !== "number" || claims.iat > now + 300) return "sign-in dated in the future";
    if (claims.email !== PASSCODE_EMAIL || !claims.firebase || claims.firebase.sign_in_provider !== "password") return "not the passcode account";
    return "";
  } catch (err) {
    return "check failed";
  }
}

module.exports = whyDenied;
