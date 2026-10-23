// Alerts for anything the automation can't handle on its own.
// Always logged (visible in Vercel's function logs). Also emailed when
// RESEND_API_KEY and ALERT_EMAIL are set in the Vercel project.

export async function notify(subject, details) {
  const text = typeof details === "string" ? details : JSON.stringify(details, null, 2);
  console.error(`[witnesses-webhook] ${subject}\n${text}`);

  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  if (!key || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.ALERT_FROM || "Witnesses Tour <onboarding@resend.dev>",
        to: [to],
        subject: `Witnesses Tour payments: ${subject}`,
        text,
      }),
    });
  } catch (err) {
    console.error("[witnesses-webhook] alert email failed", err);
  }
}
