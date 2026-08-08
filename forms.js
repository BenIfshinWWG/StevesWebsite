/* ---------------------------------------------------------------------------
   Progressive-enhancement form behavior.
   The forms are fully usable without JavaScript; this only improves UX:
   - shows/hides conditional field groups based on radio selection
   - live character counter for length-limited textareas
   - blocks submission with a visible notice, because the forms are NOT yet
     connected to a secure backend (see README, Section "Backend & security").
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  // --- Conditional field groups (data-show-when="<radioName>:<value>") ---
  function wireConditionals() {
    var groups = document.querySelectorAll("[data-show-when]");
    if (!groups.length) return;

    function update() {
      groups.forEach(function (group) {
        var spec = group.getAttribute("data-show-when").split(":");
        var name = spec[0];
        var value = spec[1];
        var checked = document.querySelector(
          'input[name="' + name + '"]:checked'
        );
        var show = checked && checked.value === value;
        group.hidden = !show;
        // Don't submit hidden required fields; toggle the required flag.
        group.querySelectorAll("[data-cond-required]").forEach(function (el) {
          if (show) {
            el.required = true;
          } else {
            el.required = false;
          }
        });
      });
    }

    document
      .querySelectorAll("[data-show-when]")
      .forEach(function () {}); // no-op, keeps linter calm

    var radios = new Set();
    groups.forEach(function (group) {
      radios.add(group.getAttribute("data-show-when").split(":")[0]);
    });
    radios.forEach(function (name) {
      document
        .querySelectorAll('input[name="' + name + '"]')
        .forEach(function (radio) {
          radio.addEventListener("change", update);
        });
    });
    update();
  }

  // --- Character counters ---
  function wireCharCounters() {
    document
      .querySelectorAll("textarea[maxlength]")
      .forEach(function (ta) {
        var counterId = ta.getAttribute("aria-describedby");
        var counter = counterId ? document.getElementById(counterId) : null;
        if (!counter) return;
        var max = ta.getAttribute("maxlength");
        function render() {
          counter.textContent = ta.value.length + " / " + max + " characters";
        }
        ta.addEventListener("input", render);
        render();
      });
  }

  // --- Submission guard (no secure backend yet) ---
  function wireSubmitGuard() {
    document.querySelectorAll("form[data-guard]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var notice = form.querySelector(".form-note");
        if (notice) {
          notice.setAttribute("role", "alert");
          notice.textContent =
            "This form is not yet connected to a secure system, so it cannot " +
            "be submitted. Please use the contact email on the Contact page in " +
            "the meantime. (Developer note: wire up a secure backend before launch.)";
          notice.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireConditionals();
    wireCharCounters();
    wireSubmitGuard();
  });
})();
