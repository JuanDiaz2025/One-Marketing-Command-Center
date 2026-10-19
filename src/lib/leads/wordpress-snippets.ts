// What to add to WordPress so each form sends where the visitor came from.

// Contact Form 7 hidden fields; the tracking snippet fills them in.
export const TRACKING_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gbraid",
  "wbraid",
  "gad_source",
  "fbclid",
  "msclkid",
  "landing_page",
  "referrer",
]

export const CF7_HIDDEN_FIELDS = TRACKING_FIELDS.map((name) => `[hidden ${name}]`).join("\n")

// Remembers the UTM tags and ad click id from the address the visitor arrived on (the latest
// visit with tags wins), plus the landing page and referring site (www. or not, the site itself
// isn't one), and puts them into any form
// field with the same name, including after Contact Form 7 resets the form.
export const TRACKING_SNIPPET = `<script>
(function () {
  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid", "gad_source", "fbclid", "msclkid"];
  var STORE = "thb_lead_tracking";
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) {}
  var params = new URLSearchParams(location.search), fresh = {};
  KEYS.forEach(function (k) { var v = params.get(k); if (v) fresh[k] = v; });
  if (fresh.gbraid || fresh.wbraid) fresh.gclid = fresh.gclid || fresh.gbraid || fresh.wbraid;
  var bare = function (u) { try { return new URL(u).hostname.replace(/^www\\./, ""); } catch (e) { return ""; } };
  var external = Boolean(document.referrer) && bare(document.referrer) !== location.hostname.replace(/^www\\./, "");
  var tagged = KEYS.some(function (k) { return saved[k]; });
  // A new visit with tags replaces the old; one from another site (Google, Facebook...) fills in
  // a visit that so far had nothing to say where it came from.
  if (Object.keys(fresh).length || !saved.landing_page || (external && !tagged && !saved.referrer)) {
    saved = Object.keys(fresh).length ? fresh : saved;
    saved.landing_page = location.href;
    saved.referrer = external ? document.referrer : (saved.referrer || "");
    try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch (e) {}
  }
  function fill() {
    Object.keys(saved).forEach(function (k) {
      document.querySelectorAll('input[name="' + k + '"]').forEach(function (input) {
        if (!input.value) input.value = saved[k];
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill); else fill();
  document.addEventListener("wpcf7mailsent", function () { setTimeout(fill, 0); });
  document.addEventListener("wpcf7submit", function () { setTimeout(fill, 0); });
})();
</script>`
