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

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

function cors(headers: HeadersInit = {}): HeadersInit {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
    ...headers,
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors({ "content-type": "application/json" }),
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
  "filed_date", "served_date", "other_info",
] as const;

const LAWYER_FIELDS = [
  "name", "firm", "email", "phone", "bar_admissions", "federal_districts",
  "experience", "denaturalization_description", "capacity",
  "venue_limitations", "languages",
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
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to, subject, text }),
  }).catch(() => {});
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
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  // Honeypot: real users never fill this hidden field.
  if (clean(payload["company"])) return json(200, { ok: true }); // silently accept + drop

  const ip = req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const token = clean(payload["cf-turnstile-response"]) ?? "";
  if (!token || !(await verifyTurnstile(token, ip))) {
    return json(400, { error: "Verification failed. Please complete the challenge and try again." });
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
      return json(400, { error: "Missing required fields." });
    }

    const { error } = await supabase.from("citizen_intakes").insert(row);
    if (error) return json(500, { error: "Could not save your submission. Please try again." });

    if (staffEmail) {
      await sendEmail(
        staffEmail,
        "New citizen intake received",
        "A new citizen intake was submitted to the Clearinghouse. " +
        "Log in to the Supabase dashboard to review the details. " +
        "(No case details are included in this email for privacy.)",
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

    return json(200, { ok: true });
  }

  if (formType === "lawyer") {
    const row: Record<string, unknown> = {};
    for (const f of LAWYER_FIELDS) row[f] = clean(payload[f]);
    row["willing_training"] = bool(payload["willing_training"]);
    row["ack"] = bool(payload["ack"]);

    if (!row["name"] || !row["email"] || !row["phone"] || !row["bar_admissions"] ||
        !row["federal_districts"] || !row["experience"] || !row["ack"]) {
      return json(400, { error: "Missing required fields." });
    }

    const { error } = await supabase.from("lawyer_signups").insert(row);
    if (error) return json(500, { error: "Could not save your submission. Please try again." });

    if (staffEmail) {
      await sendEmail(
        staffEmail,
        "New lawyer volunteer sign-up",
        "A new lawyer volunteer sign-up was submitted. Log in to the Supabase dashboard to review.",
      );
    }
    await sendEmail(
      row["email"] as string,
      "Thank you for volunteering — Denaturalization Defense Clearinghouse",
      "Thank you for offering to volunteer with the Denaturalization Defense Clearinghouse. " +
      "We have received your sign-up and will contact you when a potential match arises. " +
      "Signing up does not obligate the Clearinghouse to refer any case to you.",
    );

    return json(200, { ok: true });
  }

  return json(400, { error: "Unknown form type." });
});
