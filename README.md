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
    lawsuit branch includes a searchable list of all 94 federal judicial districts and a
    PDF-only upload control.
  - Lawyer sign-up shows a description field when prior denaturalization experience is selected.
- Client-side niceties: live character counters, conditional `required` handling, keyboard
  focus styles, skip link, dark-mode support.
- Accessibility: semantic HTML, associated labels, `aria-*` on grouped controls, high contrast.

## Backend & security — NOT YET DONE (required before launch)

The forms are intentionally **not connected to any submission backend.** Submitting currently
shows a notice and does nothing. This is deliberate: the intake form collects sensitive personal
and litigation data (immigration/citizenship status, active federal case numbers, uploaded court
documents), and Section 6 of the requirements calls for real safeguards that must be built and
reviewed, not stubbed. Before this site collects real data it needs:

- [ ] A secure submission endpoint over HTTPS/TLS.
- [ ] Encrypted-at-rest, access-controlled storage (a real database, **not** plain email).
- [ ] Need-to-know access limits for Clearinghouse staff/volunteers.
- [ ] PDF-only upload enforcement **server-side** + malware scanning + access-controlled storage.
- [ ] Spam/bot protection (accessible CAPTCHA or equivalent) on both forms.
- [ ] Automated confirmation emails restating the disclaimer, and wiring the confirmation pages.
- [ ] Legal review of the Privacy Policy and the retention/deletion process.
- [ ] Fill in the placeholders marked `[Placeholder ...]` in `about.html`, `contact.html`,
      and `privacy.html` (organization info, contact emails, retention periods).

Deciding *how* to host and process submissions (e.g., a serverless form handler + managed
database + object storage + email provider, all with encryption and access control) is the next
step and should be chosen with the Clearinghouse's security/legal review in mind.

## Notes

The repository is named `StevesWebsite` for historical reasons; the site itself is the
Denaturalization Defense Clearinghouse. Rename freely.
