/* Small shared UI behaviour. Deliberately NOT in track.js: that file is the
   Meta pixel and conversion wiring, and a UI bug in here must never be able to
   take tracking down with it.

   THE LOGO BELT GOES COLOUR WHEN IT SCROLLS INTO VIEW.
   Roham 2026-10-06: "add the colour when i scroll on it".
   site.css already had `.marq:hover .marq-item img{filter:none}`, but hover is
   the wrong trigger here: it never fires on a phone, and on a desktop it only
   fires if the cursor happens to be sitting over the belt. Scrolling to the
   logos and seeing them stay grey is what he actually hit. The hover rule
   stays, this just adds the one he asked for. */
(function () {
  "use strict";

  var belts = document.querySelectorAll(".marq-wrap");
  if (!belts.length) { return; }

  /* No IntersectionObserver, or the visitor asked for reduced motion: show the
     logos in colour immediately rather than leaving them permanently grey.
     Failing to the visible state matters more than the reveal. */
  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  if (!("IntersectionObserver" in window) || reduced) {
    Array.prototype.forEach.call(belts, function (b) { b.classList.add("marq-on"); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("marq-on");
        io.unobserve(entry.target);   /* once it is coloured it stays coloured */
      }
    });
  }, { threshold: 0.35 });

  Array.prototype.forEach.call(belts, function (b) { io.observe(b); });
})();
