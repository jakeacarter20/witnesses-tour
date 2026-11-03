// Email sign-ups from the site's "we'll reach out" box, footer and chat.
// Emails each one to hello@ (needs RESEND_API_KEY) and, when RESEND_CONTACTS_KEY
// (a Resend key with full access) is set, adds the address to the Resend contact
// list used for campaigns.

import { handleSignup, SignupError } from "./_lib/signup.js";
import { WELCOME_FROM, WELCOME_REPLY_TO } from "./_lib/config.js";

const noStore = { "Cache-Control": "no-store" };

async function resend(path, apiKey, body, idempotencyKey) {
  const response = await fetch(`https://api.resend.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    // Signing up twice is fine: the address is already on the list
    if (path === "/contacts" && /already exists/i.test(detail)) return {};
    throw new Error(`Resend ${response.status}: ${detail}`);
  }
  return response.json();
}

export async function POST(request) {
  const sendKey = process.env.RESEND_API_KEY;
  if (!sendKey) return Response.json({ error: "Sign-ups aren't set up yet. Please email hello@parleystreettravel.com." }, { status: 503, headers: noStore });
  const contactsKey = process.env.RESEND_CONTACTS_KEY;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That form submission wasn't readable." }, { status: 400, headers: noStore });
  }

  try {
    const result = await handleSignup(body, {
      notifyTo: WELCOME_REPLY_TO,
      addContact: contactsKey ? (email) => resend("/contacts", contactsKey, { email, unsubscribed: false }) : null,
      send: ({ to, replyTo, subject, html, text, idempotencyKey }) =>
        resend("/emails", sendKey, { from: WELCOME_FROM, to: [to], reply_to: replyTo, subject, html, text }, idempotencyKey),
    });
    return Response.json(result, { headers: noStore });
  } catch (err) {
    if (err instanceof SignupError) return Response.json(err.status === 202 ? { ok: true } : { error: err.message }, { status: err.status === 202 ? 200 : err.status, headers: noStore });
    console.error("[signup]", err);
    return Response.json({ error: "Something went wrong. Please email hello@parleystreettravel.com." }, { status: 500, headers: noStore });
  }
}
