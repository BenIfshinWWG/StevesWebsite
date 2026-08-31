# Backend setup — connecting the forms to secure storage

The front-end (on GitHub Pages) is already built. This guide connects the two
forms to a **Supabase** database via a small serverless **Edge Function**, with
**Cloudflare Turnstile** for bot protection and **Resend** for email. All three
services are free at this project's volume.

Until you finish this and fill in `config.js`, the live forms stay **inert**
(they show a "not connected" notice and send nothing), which is safe.

You'll create three free accounts, run a few commands, then paste two public
values into `config.js`. Estimated time: about 30 minutes.

The site's public address is **`https://denatzprobono.com`** (see step 0).

---

## 0. Domain (denatzprobono.com, registered at Squarespace)

The repo already contains a [`CNAME`](CNAME) file with `denatzprobono.com`, which
tells GitHub Pages to serve the site at that domain. Two things still have to be
done by hand — once each:

**a. Point the DNS at GitHub.** In the Squarespace **Domains** dashboard, open
`denatzprobono.com` → **DNS Settings** and set:

| Type | Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `benifshinwwg.github.io` |

Remove any Squarespace parking/forwarding records for `@` and `www` that
conflict. DNS changes can take anywhere from a few minutes to a few hours.

**b. Confirm it in GitHub.** In the repo → **Settings → Pages**, the custom
domain should read `denatzprobono.com` (the `CNAME` file sets this on push).
Once DNS resolves, tick **Enforce HTTPS**. GitHub issues the certificate
automatically; it can take up to an hour after DNS propagates.

**The `.org` redirect** can wait. When you want it, point `denatzprobono.org` at
Squarespace's domain forwarding to `https://denatzprobono.com` — do *not* add it
as a second GitHub Pages domain (Pages supports only one). Nothing in this repo
needs to change for that.

## 1. Supabase (database + storage)

1. Sign up at <https://supabase.com> and create a new **project**. Pick a strong
   database password and save it. Note your **Project Ref** (the string in your
   project URL, `https://app.supabase.com/project/<PROJECT_REF>`).
2. Create the tables: open the project's **SQL Editor** and run the migrations in
   order — first [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
   then [`supabase/migrations/0002_citizen_representation.sql`](supabase/migrations/0002_citizen_representation.sql).
   Paste the entire contents of each and run. (Or use the CLI in step 4.)
3. Find your keys under **Project Settings → API**:
   - **Project URL** (e.g. `https://<PROJECT_REF>.supabase.co`)
   - **service_role key** (secret — used only by the Edge Function, never in the site)

## 2. Cloudflare Turnstile (bot protection)

1. In the Cloudflare dashboard, go to **Turnstile** and **Add a widget**.
2. Add your site domains: `denatzprobono.com` and `www.denatzprobono.com` (and
   `localhost` for testing).
3. Copy the two keys it gives you:
   - **Site key** (public — goes in `config.js`)
   - **Secret key** (secret — goes in the Edge Function)

## 3. Resend (email)

1. Sign up at <https://resend.com> and create an **API key** (secret).
2. **Sender address (`FROM_EMAIL`)**: to email *citizens* from your own domain,
   you must **verify `denatzprobono.com`** in Resend (it gives you DKIM/SPF
   records to add in Squarespace DNS alongside the records from step 0) and send
   from an address at that domain, e.g. `no-reply@denatzprobono.com`. Without a
   verified domain, Resend only lets you send test emails to your own address.
   The alert email to Steve works either way. Email is best-effort: if it fails,
   the submission is still saved.

---

## 4. Deploy the Edge Function

From the project root, using the Supabase CLI via `npx` (no install needed):

```bash
# Log in and link this repo to your Supabase project
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

# (Optional) push the database migrations instead of pasting SQL in step 1.2
npx supabase db push

# Set the function's secrets (server-side only — never committed).
# ALLOWED_ORIGIN is a comma-separated allowlist — include both hosts the site
# answers on, with no trailing slashes.
npx supabase secrets set \
  TURNSTILE_SECRET="your_turnstile_secret_key" \
  RESEND_API_KEY="your_resend_api_key" \
  STAFF_EMAIL="steve@example.org" \
  FROM_EMAIL="no-reply@denatzprobono.com" \
  ALLOWED_ORIGIN="https://denatzprobono.com,https://www.denatzprobono.com"

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

## 7. Open the site to search engines

The site is deliberately hidden from search engines while it's a draft:
[`robots.txt`](robots.txt) disallows everything and every page carries a
`<meta name="robots" content="noindex, nofollow">` tag. **Do this only once the
forms are tested and working**, since indexing a site whose forms silently fail
is worse than not being found at all. To open it up, replace `robots.txt` with

```
User-agent: *
Allow: /
```

and delete the `noindex` meta tag from all eleven `.html` files.

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
