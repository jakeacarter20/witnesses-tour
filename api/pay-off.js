// The "Pay off your trip" page (pay.html).
//   GET  ?session_id=cs_...        -> what's left on the payment plan for that booking
//   POST { session_id, confirm }   -> charges it all now on the saved card or bank account
// Needs STRIPE_SECRET_KEY with Checkout Sessions: Read, Customers: Write, Invoices and Invoice items: Write.

import Stripe from "stripe";
import { loadBalance, payOff } from "./_lib/payoff.js";
import { DetailsError } from "./_lib/travelers.js";
import { notify } from "./_lib/notify.js";

const noStore = { "Cache-Control": "no-store" };

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new DetailsError("Not configured", 500);
  return new Stripe(key);
}

function failure(err) {
  if (err instanceof DetailsError) return Response.json({ error: err.message }, { status: err.status, headers: noStore });
  console.error("[pay-off]", err);
  return Response.json({ error: "Something went wrong. Nothing was charged; please call or email us." }, { status: 500, headers: noStore });
}

export async function GET(request) {
  try {
    const sessionId = new URL(request.url).searchParams.get("session_id");
    return Response.json(await loadBalance(stripeClient(), sessionId), { headers: noStore });
  } catch (err) {
    return failure(err);
  }
}

export async function POST(request) {
  try {
    let body;
    try { body = await request.json(); } catch { throw new DetailsError("That request wasn't readable."); }
    if (body?.confirm !== true) throw new DetailsError("Please confirm the payment.");
    return Response.json(await payOff(stripeClient(), body.session_id, { notify }), { headers: noStore });
  } catch (err) {
    return failure(err);
  }
}
