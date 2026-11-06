// Sends welcome emails two days after each booking. Vercel runs this once a day
// (see "crons" in vercel.json). It does nothing until these are set in Vercel:
//   RESEND_API_KEY  from resend.com, with parleystreettravel.com verified there
//   CRON_SECRET     any long random string; Vercel sends it so nobody else can trigger this
// BOOK_COUPON_CODE is the free Book of Mormon code included for bookings made before Thanksgiving.
// Optional: WELCOME_TEST_TO  an email address. While it's set, every run also sends a
// sample welcome email there (subject starts with [Test]). Remove it after testing.
// Needs STRIPE_SECRET_KEY with Checkout Sessions: Read and Customers: Write.

import Stripe from "stripe";
import { sendWelcomes, resendSender, buildWelcome } from "./_lib/welcome.js";
import { notify } from "./_lib/notify.js";
import { WELCOME_FROM, WELCOME_REPLY_TO } from "./_lib/config.js";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  const apiKey = process.env.RESEND_API_KEY;
  if (!key || !apiKey) return Response.json({ skipped: "STRIPE_SECRET_KEY or RESEND_API_KEY is not set" });

  try {
    const send = resendSender({ apiKey, from: WELCOME_FROM, replyTo: WELCOME_REPLY_TO });
    const couponCode = process.env.BOOK_COUPON_CODE;
    const testTo = process.env.WELCOME_TEST_TO;
    if (testTo) {
      const sample = buildWelcome({ name: "Pat Lee", room: "triple", kind: "deposit", travelers: ["Pat Lee", "Jordan Lee", "Casey Lee"], coupon: couponCode ? { code: couponCode, books: 3 } : null, seats: 3 });
      await send({ to: testTo, ...sample, subject: `[Test] ${sample.subject}`, idempotencyKey: `welcome-test-${Date.now()}` });
      console.log("[send-welcomes] sent a test email to WELCOME_TEST_TO");
    }
    const results = await sendWelcomes(new Stripe(key), {
      now: Math.floor(Date.now() / 1000),
      send,
      notify,
      couponCode,
    });
    console.log("[send-welcomes]", JSON.stringify(results));
    return Response.json({ results });
  } catch (err) {
    await notify("Welcome email job failed", { error: err.message });
    return new Response("Welcome email job failed", { status: 500 });
  }
}
