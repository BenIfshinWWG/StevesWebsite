# Backend setup — connecting the forms to secure storage

The front-end (on GitHub Pages) is already built. This guide connects the two
forms to a **Supabase** database via a small serverless **Edge Function**, with
**Cloudflare Turnstile** for bot protection and **Resend** for email. All three
services are free at this project's volume.

Until you finish this and fill in `config.js`, the live forms stay **inert**
(they show a "not connected" notice and send nothing), which is safe.

You'll create three free accounts, run a few commands, then paste two public
values into `config.js`. Estimated time: about 30 minutes.

---

## 1. Supabase (database + storage)

1. Sign up at <https://supabase.com> and create a new **project**. Pick a strong
   database password and save it. Note your **Project Ref** (the string in your
   project URL, `https://app.supabase.com/project/<PROJECT_REF>`).
2. Create the tables: open the project's **SQL Editor**, paste the entire
   contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
   and run it. (Or use the CLI in step 4.)
3. Find your keys under **Project Settings → API**:
   - **Project URL** (e.g. `https://<PROJECT_REF>.supabase.co`)
   - **service_role key** (secret — used only by the Edge Function, never in the site)

## 2. Cloudflare Turnstile (bot protection)

1. In the Cloudflare dashboard, go to **Turnstile** and **Add a widget**.
2. Add your site domain: `benifshinwwg.github.io` (and `localhost` for testing).
3. Copy the two keys it gives you:
   - **Site key** (public — goes in `config.js`)
   - **Secret key** (secret — goes in the Edge Function)

## 3. Resend (email)

1. Sign up at <https://resend.com> and create an **API key** (secret).
2. **Sender address (`FROM_EMAIL`)**: to email *citizens* from your own domain,
   you must **verify a domain** in Resend and use an address at that domain
   (e.g. `no-reply@yourdomain.org`). Without a verified domain, Resend only lets
   you send test emails to your own address. The alert email to Steve works
   either way. Email is best-effort: if it fails, the submission is still saved.

---

## 4. Deploy the Edge Function

From the project root, using the Supabase CLI via `npx` (no install needed):

```bash
# Log in and link this repo to your Supabase project
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

# (Optional) push the database migration instead of pasting SQL in step 1.2
npx supabase db push

# Set the function's secrets (server-side only — never committed)
npx supabase secrets set \
  TURNSTILE_SECRET="your_turnstile_secret_key" \
  RESEND_API_KEY="your_resend_api_key" \
  STAFF_EMAIL="steve@example.org" \
  FROM_EMAIL="no-reply@yourdomain.org" \
  ALLOWED_ORIGIN="https://benifshinwwg.github.io"

# Deploy. --no-verify-jwt makes it a public endpoint (the forms are anonymous;
# they're protected by Turnstile + server-side validation, not a login token).
npx supabase functions deploy submit --no-verify-jwt
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function
automatically — you do **not** set those.

Your function URL will be:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/submit`

## 5. Turn the forms on

Edit [`config.js`](config.js) and fill in the two **public** values:

```js
window.CLEARINGHOUSE_CONFIG = {
  functionUrl: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/submit",
  turnstileSiteKey: "your_turnstile_SITE_key",
};
```

Then commit and push:

```bash
git add config.js && git commit -m "Enable forms" && git push
```

GitHub Pages redeploys in a minute or two and the forms go live.

## 6. Test it

1. Open the intake form, complete the Turnstile checkbox, and submit a test entry.
2. Confirm the row appears in Supabase (**Table Editor → citizen_intakes**).
3. Confirm Steve got the alert email and the test address got the confirmation.
4. Repeat for the lawyer sign-up form.

---

## Who can read submissions

Submissions are read in the **Supabase dashboard** (Table Editor), which is
behind your Supabase login. To let an approved volunteer read them, invite them
to the Supabase **project** (Project Settings → Team) — need-to-know only. The
tables have Row-Level Security enabled with no public policies, so nothing is
readable through the website or the anonymous API.

## Still outstanding (from the original Section 6)

- **Malware scanning + PDF uploads** — deferred for v1 (we collect the case
  number instead). Revisit if you decide to accept document uploads.
- **Retention/deletion** — the Privacy Policy states the retention approach;
  confirm the process with counsel and decide how deletion requests are handled.
- **Legal review** of the Privacy Policy and disclaimers.
