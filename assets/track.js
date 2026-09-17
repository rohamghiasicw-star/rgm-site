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
  /* OFF on purpose. He is running Facebook, not Google, so loading gtag would
     be a third-party request for nothing. The account's real tag ID is
     AW-17959289121 (account 935-967-8835, read live 2026-09-16) - paste it back
     in if a Google campaign ever points here. */
  ADS_ID: "",

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

  /* META PIXEL, the one that matters here because the campaign is Facebook,
     not Google. Looks like a 15 or 16 digit number. Events Manager > Data
     sources > your pixel, the ID sits under the name. With this set the
     pixel loads and reports PageView plus Lead automatically. */
  META_PIXEL_ID: "835961859444225",   /* pixel named "RG", Events Manager, 2026-09-16 */

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
    log("no Google IDs configured");
  }

  /* ---- Meta pixel ------------------------------------------------------ */
  var hasMeta = /^\d{10,20}$/.test(C.META_PIXEL_ID);
  if (hasMeta) {
    /* Meta's standard loader, unmodified except for being guarded. */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0";
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", C.META_PIXEL_ID);
    fbq("track", "PageView");
    log("meta pixel booted", C.META_PIXEL_ID);
  }

  if (!hasGA4 && !hasAds && !hasMeta) { log("no IDs configured, tracking is inert"); }

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

    /* Meta: map our event names onto its standard events, so the campaign can
       optimise for Lead rather than a custom event nothing is trained on. */
    if (hasMeta) {
      var META = {
        generate_lead: "Lead",
        booking_complete: "Schedule",
        whatsapp_click: "Contact",
        phone_click: "Contact",
        email_click: "Contact"
      };
      var std = META[name];
      if (std) { fbq("track", std, { content_name: name }); }
      else { fbq("trackCustom", name, p); }
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

  /* ---- the booking, and where Schedule actually fires -----------------

     Schedule is the event the whole Facebook campaign is optimised on, so this
     is the most load-bearing code in the file. Read before changing.

     THE SHAPE: the embed page catches Calendly's postMessage, marks the
     session as booked, and hands off to /booked. Schedule then fires ON PAGE
     LOAD there. A page-load fire cannot be raced by an unload the way a fire
     immediately followed by a navigation can.

     WHY WE NAVIGATE OURSELVES INSTEAD OF USING CALENDLY'S REDIRECT SETTING:
     Calendly's redirect is configured in their dashboard, invisible from this
     repo, and for an inline embed it is not obvious whether it moves the top
     window or just the iframe. Doing it here means it is readable, testable,
     and definitely the top window. It also means the Calendly event type can
     stay on "Display confirmation page" and nobody has to sequence a settings
     change against a deploy.

     WHY THE FIRE IS GATED ON A FLAG: /booked is also reachable from a plain
     link on book-a-call.html. Firing on every load of that page would invent a
     conversion every time somebody browsed to it. It only fires for a session
     that actually completed a booking.

     The once-guard survives a refresh and the back button, so neither can
     double count.

     WHY "/booked.html" AND NOT THE PRETTY "/booked": the extensionless form
     only resolves because the host rewrites it. GitHub Pages does today and
     the local preview server does not, which is how this was caught. The
     single most important conversion path on the site is not going to depend
     on a URL rewrite. The file always resolves; the canonical tag on the page
     still declares /booked, so nothing about indexing changes.             */

  var BOOKED_FLAG = "rgm_booked";
  var FIRED_FLAG  = "rgm_sched_fired";
  var onBookedPage = /\/booked(\.html)?$/.test(location.pathname);

  /* sessionStorage throws in private mode and with site data blocked. If it is
     unavailable we must still not lose the booking, hence the fallbacks. */
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (err) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); return true; } catch (err) { return false; } }

  function fireSchedule(where) {
    if (ssGet(FIRED_FLAG) === "1") { log("schedule already fired, skipping", where); return; }
    ssSet(FIRED_FLAG, "1");
    RGM.track("booking_complete", "booking", { method: "calendly", fired_on: where });
  }

  if (onBookedPage && ssGet(BOOKED_FLAG) === "1") { fireSchedule("booked_page"); }

  window.addEventListener("message", function (e) {
    if (!e.data || typeof e.data !== "object") { return; }
    if (e.data.event !== "calendly.event_scheduled") { return; }

    var marked = ssSet(BOOKED_FLAG, "1");
    if (onBookedPage) { fireSchedule("booked_page"); return; }

    /* No sessionStorage means the flag will not survive the hop, so /booked
       could never fire. Fire here instead and give the beacon room to leave. */
    if (!marked) { fireSchedule("no_storage"); setTimeout(function () { location.href = "/booked.html"; }, 1200); return; }

    setTimeout(function () { location.href = "/booked.html"; }, 150);
    /* If that navigation never happens, do not lose the conversion. Harmless
       when it does happen: the page is gone long before this runs. */
    setTimeout(function () { fireSchedule("embed_fallback"); }, 5000);
  });

  /* ---- the intake form ------------------------------------------------
     free-analysis.html calls RGM.track("generate_lead", "lead", ...) itself
     at the point the submission actually succeeds, rather than on click, so
     an abandoned or failed submit is never counted as a lead.            */
})();
