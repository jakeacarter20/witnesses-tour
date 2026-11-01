// The traveler details form on the thank-you page.
//   GET  ?session_id=cs_...  -> how many travelers to ask about, with known answers prefilled
//   POST { session_id, travelers, emergency, roommate } -> saves the answers onto the booking's Customer in Stripe
// Needs STRIPE_SECRET_KEY with Checkout Sessions: Read and Customers: Write.

import Stripe from "stripe";
import { loadDetails, saveDetails, DetailsError } from "./_lib/travelers.js";
import { notify } from "./_lib/notify.js";

const noStore = { "Cache-Control": "no-store" };

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new DetailsError("Not configured", 500);
  return new Stripe(key);
}

function failure(err) {
  if (err instanceof DetailsError) return Response.json({ error: err.message }, { status: err.status, headers: noStore });
  console.error("[traveler-details]", err);
  return Response.json({ error: "Something went wrong saving your details. Please try again, or email us." }, { status: 500, headers: noStore });
}

export async function GET(request) {
  try {
    const sessionId = new URL(request.url).searchParams.get("session_id");
    return Response.json(await loadDetails(stripeClient(), sessionId), { headers: noStore });
  } catch (err) {
    return failure(err);
  }
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      throw new DetailsError("That form submission wasn't readable.");
    }
    const result = await saveDetails(stripeClient(), body);
    await notify(`Traveler details saved (${result.room}, ${result.count} traveler${result.count === 1 ? "" : "s"})`, { session: body.session_id });
    return Response.json(result, { headers: noStore });
  } catch (err) {
    return failure(err);
  }
}
