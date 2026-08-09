# Denaturalization Defense Clearinghouse — website

A simple, text-only, no-graphics static website for the Denaturalization Defense
Clearinghouse ("the Clearinghouse"). Its purpose is to connect naturalized U.S. citizens facing
denaturalization with volunteer lawyers willing to consider representing them pro bono.

**The Clearinghouse is not a law firm and does not provide legal advice.** This repository is the
website only.

## Stack

Plain static HTML + CSS, with a small progressive-enhancement JavaScript file. No frameworks, no
build step. Open `index.html` in a browser, or serve the folder with any static server:

```bash
# from the project root
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Pages

| File | Page |
|---|---|
| `index.html` | Home |
| `for-citizens.html` | For Citizens Facing Denaturalization |
| `intake.html` | Citizen Intake Form |
| `intake-confirmation.html` | Post-submission confirmation (citizen) |
| `for-lawyers.html` | For Lawyers / Volunteer |
| `lawyer-signup.html` | Lawyer Sign-Up Form |
| `lawyer-confirmation.html` | Post-submission confirmation (lawyer) |
| `about.html` | About & Disclaimer |
| `contact.html` | Contact |
| `privacy.html` | Privacy Policy |
| `styles.css` | Shared styles (text-only, WCAG 2.1 AA target) |
| `forms.js` | Conditional fields, char counters, submit guard |

## What is built

- All content pages with plain-language copy and defined legal terms (denaturalization, civil
  denaturalization, pro bono) on first use.
- The **exact** required disclaimer, repeated verbatim on the Home, For Citizens, Intake (above
  the submit button), and About pages.
- Both forms with full field sets, semantic labels, and conditional fields:
  - Citizen intake shows threat-specific or lawsuit-specific fields based on case status; the
    lawsuit branch includes a searchable list of all 94 federal judicial districts.
  - Lawyer sign-up shows a description field when prior denaturalization experience is selected.
- Client-side niceties: live character counters, conditional `required` handling, keyboard
  focus styles, skip link, dark-mode support.
- Accessibility: semantic HTML, associated labels, `aria-*` on grouped controls, high contrast.

## Backend

The forms submit to a **Supabase Edge Function** (`supabase/functions/submit`) that verifies a
Cloudflare Turnstile token, writes to Postgres (`supabase/migrations/0001_init.sql`, RLS locked
down), emails Steve a low-detail alert, and emails the submitter a confirmation. See
**[SETUP.md](SETUP.md)** for the full wiring steps.

Until the two public values in [`config.js`](config.js) are filled in, the forms stay **inert**
(they show a "not connected" notice and send nothing), so the public preview never collects data.

**Deferred / outstanding:**

- [ ] PDF/document upload + malware scanning (deferred for v1 — case number collected instead).
- [ ] Verified Resend sending domain (needed to email confirmations to citizens).
- [ ] Legal review of the Privacy Policy, disclaimers, and the retention/deletion process.
- [ ] Fill in remaining `[Placeholder ...]` contact/org details in `about.html`, `contact.html`.

## Notes

The repository is named `StevesWebsite` for historical reasons; the site itself is the
Denaturalization Defense Clearinghouse. Rename freely.
