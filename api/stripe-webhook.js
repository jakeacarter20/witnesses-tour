// Stripe calls this after every checkout (Developers > Webhooks in Stripe).
// It checks the request really came from Stripe, then hands the event to plan.js.
// Needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in the Vercel project settings.

import Stripe from "stripe";
import { handleEvent } from "./_lib/plan.js";
import { notify } from "./_lib/notify.js";

export async function POST(request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) {
    console.error("[witnesses-webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  const stripe = new Stripe(key);
  const body = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature"), secret);
  } catch (err) {
    return new Response(`Invalid signature: ${err.message}`, { status: 400 });
  }

  try {
    const result = await handleEvent(stripe, event, { now: Math.floor(Date.now() / 1000), notify });
    console.log("[witnesses-webhook]", event.type, event.id, JSON.stringify(result));
    return Response.json({ received: true, result });
  } catch (err) {
    // A 500 makes Stripe retry the event; the scheduling code is safe to repeat.
    await notify(`Error handling ${event.type}`, { event: event.id, error: err.message });
    return new Response("Error handling event", { status: 500 });
  }
}
