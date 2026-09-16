/* ============================================================================
   RG Marketing - lead tracking

   ONE place where every lead event on this site is defined. Loaded by every
   page. Safe to ship with empty IDs: with nothing configured it does nothing
   at all, no errors, no network calls, and the site behaves exactly as it did
   before. Fill the three values below and every event starts reporting.

   WHY THIS EXISTS: ads were about to run against a site with no measurement
   of any kind. Google cannot optimise a campaign it gets no conversion signal
   from, and you cannot tell a keyword that books calls from one that burns
   budget. This is the difference between spending money and buying data.
   ========================================================================= */

window.RGM = window.RGM || {};

RGM.CONFIG = {
  /* GA4, looks like "G-XXXXXXXXXX". Admin > Data streams > your web stream. */
  GA4_ID: "",

  /* Google Ads conversion ID, looks like "AW-123456789".
     Google Ads > Goals > Conversions > Google tag. */
  /* Read live from Google Ads account 935-967-8835 on 2026-09-16. If the UK
     campaign runs from a DIFFERENT Ads account, replace this with that
     account's tag ID or nothing will report. */
  ADS_ID: "AW-17959289121",

  /* Conversion LABELS, one per action, from each conversion action's tag
     snippet. The value in send_to looks like "AW-123456789/AbC-D_efGh12".
     Paste ONLY the part after the slash here. Leave a label empty and that
     one action simply is not reported to Ads; GA4 still records it. */
  ADS_LABELS: {
    lead: "",      /* free analysis form completed - the primary conversion */
    booking: "",   /* a call booked through Calendly */
    whatsapp: "",  /* tapped through to WhatsApp */
    call: ""       /* tapped the phone number */
  },

  /* Set true to print every event to the console instead of guessing whether
     it fired. Turn off once you have seen what you need. */
  DEBUG: false
};

(function () {
  "use strict";

  var C = RGM.CONFIG;
  var hasGA4 = /^G-/.test(C.GA4_ID);
  var hasAds = /^AW-/.test(C.ADS_ID);

  function log() {
    if (C.DEBUG && window.console) {
      console.log.apply(console, ["[RGM]"].concat([].slice.call(arguments)));
    }
  }

  /* ---- load gtag once, for whichever of the two is configured ---------- */
  if (hasGA4 || hasAds) {
    var boot = hasGA4 ? C.GA4_ID : C.ADS_ID;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(boot);
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag("js", new Date());
    if (hasGA4) { gtag("config", C.GA4_ID); }
    if (hasAds) { gtag("config", C.ADS_ID); }
    log("gtag booted", { ga4: C.GA4_ID || null, ads: C.ADS_ID || null });
  } else {
    log("no IDs configured, tracking is inert");
  }

  /* ---- one entry point for every lead event --------------------------- */
  /* name  : the GA4 event name
     kind  : which ADS_LABELS key to report to Google Ads, or null
     params: anything extra worth having in GA4                            */
  RGM.track = function (name, kind, params) {
    var p = params || {};
    p.page_path = location.pathname;
    log("event", name, kind, p);

    if (hasGA4) { gtag("event", name, p); }

    var label = kind && C.ADS_LABELS[kind];
    if (hasAds && label) {
      gtag("event", "conversion", { send_to: C.ADS_ID + "/" + label });
    }
  };

  /* ---- auto-wire the taps that are leads ------------------------------
     Delegated from the document, so it covers links added later and links
     inside any page without every page having to know about this file.   */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) { return; }
    var href = a.getAttribute("href") || "";

    if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)/i.test(href)) {
      RGM.track("whatsapp_click", "whatsapp", { link_url: href });
    } else if (/^tel:/i.test(href)) {
      RGM.track("phone_click", "call", { link_url: href });
    } else if (/^mailto:/i.test(href)) {
      RGM.track("email_click", null, { link_url: href });
    }
  }, true);

  /* ---- Calendly posts a message when a booking completes --------------
     Only book-a-call.html embeds it, but listening here costs nothing on
     the pages that do not.                                               */
  window.addEventListener("message", function (e) {
    if (!e.data || typeof e.data !== "object") { return; }
    if (e.data.event === "calendly.event_scheduled") {
      RGM.track("booking_complete", "booking", { method: "calendly" });
    }
  });

  /* ---- the intake form ------------------------------------------------
     free-analysis.html calls RGM.track("generate_lead", "lead", ...) itself
     at the point the submission actually succeeds, rather than on click, so
     an abandoned or failed submit is never counted as a lead.            */
})();
