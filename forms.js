/* ---------------------------------------------------------------------------
   Form behavior for the Clearinghouse.
   - Conditional field groups (show/hide by radio selection)
   - Live character counters
   - Submission:
       * "live mode"  (config.functionUrl + turnstileSiteKey are set):
         validates, renders a Cloudflare Turnstile widget, POSTs JSON to the
         Edge Function, then redirects to the confirmation page.
       * "inert mode" (config not set): shows a "not connected yet" notice and
         sends nothing, so the public preview can never collect real data.
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  var CONFIG = window.CLEARINGHOUSE_CONFIG || {};
  var LIVE = Boolean(CONFIG.functionUrl && CONFIG.turnstileSiteKey);

  // --- Conditional field groups (data-show-when="<radioName>:<value>") ---
  function wireConditionals() {
    var groups = document.querySelectorAll("[data-show-when]");
    if (!groups.length) return;

    function update() {
      groups.forEach(function (group) {
        var spec = group.getAttribute("data-show-when").split(":");
        var checked = document.querySelector('input[name="' + spec[0] + '"]:checked');
        var show = checked && checked.value === spec[1];
        group.hidden = !show;
        group.querySelectorAll("[data-cond-required]").forEach(function (el) {
          el.required = !!show;
        });
      });
    }

    var radios = new Set();
    groups.forEach(function (g) { radios.add(g.getAttribute("data-show-when").split(":")[0]); });
    radios.forEach(function (name) {
      document.querySelectorAll('input[name="' + name + '"]').forEach(function (radio) {
        radio.addEventListener("change", update);
      });
    });
    update();
  }

  // --- Character counters ---
  function wireCharCounters() {
    document.querySelectorAll("textarea[maxlength]").forEach(function (ta) {
      var counter = document.getElementById(ta.getAttribute("aria-describedby") || "");
      // aria-describedby may list multiple ids; find the one ending in -count
      if (!counter) {
        var ids = (ta.getAttribute("aria-describedby") || "").split(/\s+/);
        for (var i = 0; i < ids.length; i++) {
          if (/count$/.test(ids[i])) { counter = document.getElementById(ids[i]); break; }
        }
      }
      if (!counter) return;
      var max = ta.getAttribute("maxlength");
      function render() { counter.textContent = ta.value.length + " / " + max + " characters"; }
      ta.addEventListener("input", render);
      render();
    });
  }

  // --- Turnstile (only loaded in live mode) ---
  var turnstileReady = false;
  var widgetIds = new WeakMap();

  window.__onTurnstileLoad = function () {
    turnstileReady = true;
    document.querySelectorAll(".turnstile-slot").forEach(function (slot) {
      var id = window.turnstile.render(slot, { sitekey: CONFIG.turnstileSiteKey });
      widgetIds.set(slot, id);
    });
  };

  function loadTurnstile() {
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstileLoad";
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  function setNote(form, message, isError) {
    var note = form.querySelector(".form-note");
    if (!note) return;
    note.textContent = message;
    note.setAttribute("role", isError ? "alert" : "status");
  }

  // --- Submission ---
  function wireSubmit() {
    document.querySelectorAll("form[data-guard]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();

        if (!LIVE) {
          setNote(form,
            "This form is not yet connected to a secure system, so it cannot be " +
            "submitted. Please use the Contact page in the meantime.", true);
          var n = form.querySelector(".form-note");
          if (n) n.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }

        // Native validation (forms use novalidate so we trigger it explicitly).
        if (!form.checkValidity()) { form.reportValidity(); return; }

        var slot = form.querySelector(".turnstile-slot");
        var token = "";
        if (slot && turnstileReady && window.turnstile) {
          token = window.turnstile.getResponse(widgetIds.get(slot)) || "";
        }
        if (!token) { setNote(form, "Please complete the verification checkbox, then submit again.", true); return; }

        var fd = new FormData(form);
        var payload = {};
        fd.forEach(function (value, key) { payload[key] = value; });
        payload["cf-turnstile-response"] = token;

        var btn = form.querySelector('button[type="submit"]');
        var original = btn ? btn.textContent : "";
        if (btn) { btn.disabled = true; btn.textContent = "Submitting..."; }
        setNote(form, "Submitting your information securely...", false);

        fetch(CONFIG.functionUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(function (res) { return res.json().then(function (b) { return { ok: res.ok, body: b }; }); })
          .then(function (r) {
            if (r.ok && r.body && r.body.ok) {
              window.location.href = form.getAttribute("data-success") || "index.html";
            } else {
              throw new Error((r.body && r.body.error) || "Submission failed.");
            }
          })
          .catch(function (err) {
            setNote(form, (err && err.message) || "Something went wrong. Please try again.", true);
            if (btn) { btn.disabled = false; btn.textContent = original; }
            if (window.turnstile && slot) window.turnstile.reset(widgetIds.get(slot));
          });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireConditionals();
    wireCharCounters();
    wireSubmit();
    if (LIVE && document.querySelector(".turnstile-slot")) loadTurnstile();
  });
})();
