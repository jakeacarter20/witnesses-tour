// Email sign-ups from the site ("Have questions? Enter your email and we'll reach out").
// Each sign-up is emailed to hello@ so someone can reply personally, and added to
// the Resend contact list for later campaigns (Broadcasts) when RESEND_CONTACTS_KEY is set.
// Kept separate from the HTTP handler so it can be tested (see test/signup.test.js).

const SOURCES = { slidein: "the pop-up box", footer: "the footer sign-up", chat: "the Questions? chat" };

export class SignupError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function cleanSignup(body) {
  const email = String(body?.email ?? "").trim().toLowerCase();
  const question = String(body?.question ?? "").replace(/\r\n?/g, "\n").trim();
  const source = SOURCES[body?.source] ? body.source : "slidein";
  if (body?.website) throw new SignupError("ignored", 202); // the hidden field only bots fill in
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) throw new SignupError("Please enter a valid email address.");
  if (question.length > 1000) throw new SignupError("Please keep your question under 1,000 characters.");
  return { email, question, source };
}

// addContact(email) adds to the Resend list (or is null when not set up yet).
// send({ to, replyTo, subject, html, text, idempotencyKey }) emails hello@.
export async function handleSignup(body, { addContact, send, notifyTo, now = new Date() }) {
  const signup = cleanSignup(body);
  let listed = false;
  let listError = null;
  if (addContact) {
    try {
      await addContact(signup.email);
      listed = true;
    } catch (err) {
      listError = err.message;
    }
  }

  const where = SOURCES[signup.source];
  const lines = [
    `${signup.email} signed up on parleystreettravel.com through ${where}.`,
    "",
    signup.question ? `Their question:\n${signup.question}` : "They didn't ask a question.",
    "",
    "Reply to this email to answer them directly.",
    "",
    listed ? "They've been added to the Resend contact list for trip updates."
      : addContact ? `They could not be added to the Resend contact list (${listError}). Add them by hand.`
      : "The Resend contact list isn't connected yet (RESEND_CONTACTS_KEY), so add them by hand if you're collecting a list.",
  ];
  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#2A2E1A;">${lines
    .map((l) => (l ? `<p style="margin:0 0 10px;">${esc(l).replace(/\n/g, "<br>")}</p>` : "")).join("")}</div>`;

  await send({
    to: notifyTo,
    replyTo: signup.email,
    subject: signup.question ? `Question from ${signup.email}` : `New sign-up: ${signup.email}`,
    html,
    text,
    idempotencyKey: `signup-${signup.email}-${now.toISOString().slice(0, 16)}`,
  });
  return { ok: true, listed };
}
