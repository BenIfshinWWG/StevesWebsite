/* ---------------------------------------------------------------------------
   Public front-end configuration. These two values are SAFE to expose in a
   public repo and in the browser:
     - the Edge Function URL is just a public endpoint (protected by Turnstile
       + server-side validation)
     - the Turnstile SITE key is designed to be public (the SECRET key stays
       on the server, never here)

   Until BOTH values are filled in, the forms stay inert: submitting shows a
   "not connected yet" notice and sends nothing. Blank them out to take the
   forms offline without deploying any other change.
--------------------------------------------------------------------------- */
window.CLEARINGHOUSE_CONFIG = {
  // Deployed Supabase Edge Function URL.
  functionUrl: "https://retewbijfzkwpistzkpl.supabase.co/functions/v1/submit",

  // Cloudflare Turnstile SITE key (public).
  turnstileSiteKey: "0x4AAAAAAEjQAK379tHdny5T",
};
