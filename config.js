/* ---------------------------------------------------------------------------
   Public front-end configuration. These two values are SAFE to expose in a
   public repo and in the browser:
     - the Edge Function URL is just a public endpoint (protected by Turnstile
       + server-side validation)
     - the Turnstile SITE key is designed to be public (the SECRET key stays
       on the server, never here)

   Until BOTH values are filled in, the forms stay inert: submitting shows a
   "not connected yet" notice and sends nothing. Fill these in after you
   complete SETUP.md, then commit + push.

   Both values for this project are already known and recorded in SETUP.md
   step 5. They are left blank here ON PURPOSE until the Edge Function is
   deployed and its secrets are set: filling them in first would give visitors
   forms that render and then fail on submit, which is worse than the honest
   "not connected" notice.
--------------------------------------------------------------------------- */
window.CLEARINGHOUSE_CONFIG = {
  // Your deployed Supabase Edge Function URL, e.g.
  //   https://YOUR-PROJECT-REF.supabase.co/functions/v1/submit
  functionUrl: "",

  // Your Cloudflare Turnstile SITE key (public).
  turnstileSiteKey: "",
};
