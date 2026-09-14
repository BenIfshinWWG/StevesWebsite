// @ts-nocheck — This runs on Deno (Supabase Edge Functions), not Node. The
// `Deno` global and remote `https://esm.sh/...` import resolve at deploy time
// in the Deno runtime; the repo's Node/TypeScript checker doesn't know about
// them, so its errors here are false positives. Deployment is unaffected.
/// <reference lib="deno.ns" />

// Denaturalization Defense Clearinghouse — form submission Edge Function
//
// Receives POSTs from the citizen intake and lawyer sign-up forms, verifies the
// Cloudflare Turnstile anti-bot token, writes the submission to Postgres using
// the service role (bypasses RLS), then:
//   - emails Steve a low-detail "new submission" alert (no sensitive case data)
//   - emails the submitter a confirmation restating the disclaimer
//
// Secrets are read from environment variables (set via `supabase secrets set`):
//   TURNSTILE_SECRET, RESEND_API_KEY, STAFF_EMAIL, FROM_EMAIL, ALLOWED_ORIGIN
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ALLOWED_ORIGIN is a comma-separated allowlist, so the apex domain, the www
// host, and the .org redirect domain can all be permitted at once, e.g.
//   "https://denatzprobono.com,https://www.denatzprobono.com"
// Unset means "*" (any origin) — fine before launch, but set it in production.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGIN") ?? "*")
  .split(",").map((o) => o.trim()).filter(Boolean);

// Echo back the caller's own origin when it is on the allowlist; browsers
// reject a comma-joined list in Access-Control-Allow-Origin.
function allowOrigin(req: Request): string {
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function cors(req: Request, headers: HeadersInit = {}): HeadersInit {
  return {
    "Access-Control-Allow-Origin": allowOrigin(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
    ...headers,
  };
}

function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(req, { "content-type": "application/json" }),
  });
}

// Trim strings; turn "" into null; leave everything else alone.
function clean(v: unknown): string | null {
  if (typeof v !== "string") return v == null ? null : String(v);
  const t = v.trim();
  return t === "" ? null : t;
}
function bool(v: unknown): boolean {
  return v === true || v === "yes" || v === "on" || v === "true";
}

// Field whitelists — anything not listed is ignored.
const CITIZEN_FIELDS = [
  "full_name", "email", "phone", "location", "preferred_language",
  "contact_method", "case_status", "threat_date", "threat_how",
  "threat_how_other", "threat_desc", "district", "case_number",
  "filed_date", "served_date", "represented", "represented_reason",
  "other_info",
] as const;

const LAWYER_FIELDS = [
  "name", "firm", "email", "phone", "bar_admissions", "federal_districts",
  "experience", "denaturalization_description", "malpractice_insurance",
  "capacity", "venue_limitations", "languages",
] as const;

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  const data = await res.json().catch(() => ({ success: false }));
  return data.success === true;
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FROM_EMAIL");
  if (!key || !from) return; // email is best-effort; never block a submission
  // `to` may be a comma-separated list, so STAFF_EMAIL can notify several
  // people (e.g. a shared mailbox plus an individual) without a code change.
  const recipients = to.split(",").map((a) => a.trim()).filter(Boolean);
  if (!recipients.length) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: recipients, subject, text }),
  }).catch(() => {});
}

// Human-readable labels for the staff notification emails. Order here is the
// order they appear in the email, which is roughly the order of the form.
const CITIZEN_LABELS: Array<[string, string]> = [
  ["full_name", "Name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["location", "City and state"],
  ["preferred_language", "Preferred language"],
  ["contact_method", "Preferred contact method"],
  ["case_status", "Case status"],
  ["threat_date", "Date of threat"],
  ["threat_how", "How the threat was received"],
  ["threat_how_other", "How the threat was received (other)"],
  ["threat_desc", "Description of the threat"],
  ["district", "Federal district"],
  ["case_number", "Case number"],
  ["filed_date", "Date filed"],
  ["served_date", "Date served"],
  ["represented", "Already represented by a lawyer"],
  ["represented_reason", "Why they are seeking a lawyer anyway"],
  ["other_info", "Anything else"],
];

const LAWYER_LABELS: Array<[string, string]> = [
  ["name", "Name"],
  ["firm", "Firm / organization"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["bar_admissions", "Bar admissions"],
  ["federal_districts", "Federal districts"],
  ["experience", "Experience track"],
  ["denaturalization_description", "Denaturalization experience"],
  ["malpractice_insurance", "Malpractice insurance"],
  ["capacity", "Capacity"],
  ["venue_limitations", "Venue limitations"],
  ["languages", "Languages"],
];

// Render "Label: value" lines, skipping anything the submitter left blank so
// the email stays short and scannable rather than a wall of empty fields.
function summarize(row: Record<string, unknown>, labels: Array<[string, string]>): string {
  return labels
    .filter(([field]) => row[field] !== null && row[field] !== undefined && row[field] !== "")
    .map(([field, label]) => `${label}: ${row[field]}`)
    .join("\n");
}

const DISCLAIMER =
  "The Denaturalization Defense Clearinghouse is not a law firm and is not " +
  "engaged in the practice of law. The Clearinghouse does not provide legal " +
  "advice and does not represent you. Submitting your form does not create an " +
  "attorney-client relationship with the Clearinghouse or with any lawyer. The " +
  "Clearinghouse will make its best efforts to identify a volunteer lawyer who " +
  "may be willing to consider representing you on a pro bono basis, but it " +
  "cannot guarantee that a lawyer will be found or that any lawyer will agree " +
  "to take your case. If you have an urgent deadline (such as a response date " +
  "in a court case), you should seek legal help immediately and should not rely " +
  "solely on this Clearinghouse.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(req, 400, { error: "Invalid JSON" });
  }

  // Honeypot: real users never fill this hidden field.
  if (clean(payload["company"])) return json(req, 200, { ok: true }); // silently accept + drop

  const ip = req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const token = clean(payload["cf-turnstile-response"]) ?? "";
  if (!token || !(await verifyTurnstile(token, ip))) {
    return json(req, 400, { error: "Verification failed. Please complete the challenge and try again." });
  }

  const formType = clean(payload["form_type"]);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const staffEmail = Deno.env.get("STAFF_EMAIL");

  if (formType === "citizen") {
    const row: Record<string, unknown> = {};
    for (const f of CITIZEN_FIELDS) row[f] = clean(payload[f]);
    row["ack_disclaimer"] = bool(payload["ack_disclaimer"]);
    row["ack_consent"] = bool(payload["ack_consent"]);

    if (!row["full_name"] || !row["email"] || !row["phone"] || !row["location"] ||
        !row["case_status"] || !row["ack_disclaimer"] || !row["ack_consent"]) {
      return json(req, 400, { error: "Missing required fields." });
    }

    const { error } = await supabase.from("citizen_intakes").insert(row);
    if (error) {
      // Log the real cause for debugging; the submitter gets a generic message.
      // Never log `row` itself — it holds the person's case details.
      console.error("citizen_intakes insert failed", {
        code: error.code, message: error.message,
        details: error.details, hint: error.hint,
      });
      return json(req, 500, { error: "Could not save your submission. Please try again." });
    }

    if (staffEmail) {
      const urgent = row["case_status"] === "sued";
      await sendEmail(
        staffEmail,
        urgent
          ? "New citizen intake — LAWSUIT FILED (time-sensitive)"
          : "New citizen intake — threat of denaturalization",
        "A new citizen intake was submitted to the Clearinghouse.\n\n" +
        summarize(row, CITIZEN_LABELS) +
        (urgent
          ? "\n\nThis person reports that a denaturalization case has already been " +
            "filed against them, which means there is likely a court deadline. " +
            "Treat this as time-sensitive."
          : "") +
        "\n\nThis email contains the full submission so it can be acted on " +
        "without logging in. It is confidential: it concerns a specific person's " +
        "citizenship case. Do not forward it outside the Clearinghouse. The " +
        "authoritative record is in the Clearinghouse database.",
      );
    }
    await sendEmail(
      row["email"] as string,
      "We received your request — Denaturalization Defense Clearinghouse",
      "Thank you for contacting the Denaturalization Defense Clearinghouse. We have " +
      "received your intake and will attempt to identify a volunteer lawyer who may be " +
      "willing to consider your case on a pro bono basis. A response is not guaranteed.\n\n" +
      "If you have an urgent deadline, please seek legal help immediately and do not rely " +
      "solely on this Clearinghouse.\n\n" + DISCLAIMER,
    );

    return json(req, 200, { ok: true });
  }

  if (formType === "lawyer") {
    const row: Record<string, unknown> = {};
    for (const f of LAWYER_FIELDS) row[f] = clean(payload[f]);
    row["willing_training"] = bool(payload["willing_training"]);
    row["ack"] = bool(payload["ack"]);

    if (!row["name"] || !row["email"] || !row["phone"] || !row["bar_admissions"] ||
        !row["federal_districts"] || !row["experience"] || !row["ack"]) {
      return json(req, 400, { error: "Missing required fields." });
    }

    const { error } = await supabase.from("lawyer_signups").insert(row);
    if (error) {
      console.error("lawyer_signups insert failed", {
        code: error.code, message: error.message,
        details: error.details, hint: error.hint,
      });
      return json(req, 500, { error: "Could not save your submission. Please try again." });
    }

    if (staffEmail) {
      await sendEmail(
        staffEmail,
        "New lawyer volunteer sign-up",
        "A new lawyer volunteer sign-up was submitted.\n\n" +
        summarize(row, LAWYER_LABELS) +
        (row["willing_training"] ? "\nWilling to attend training: yes" : "") +
        "\n\nThe authoritative record is in the Clearinghouse database.",
      );
    }
    await sendEmail(
      row["email"] as string,
      "Thank you for volunteering — Denaturalization Defense Clearinghouse",
      "Thank you for offering to volunteer with the Denaturalization Defense Clearinghouse. " +
      "We have received your sign-up and will contact you when a potential match arises. " +
      "Signing up does not obligate the Clearinghouse to refer any case to you.",
    );

    return json(req, 200, { ok: true });
  }

  return json(req, 400, { error: "Unknown form type." });
});
