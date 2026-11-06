// Seats booked so far. The tour page no longer shows this count (the free Book of
// Mormon offer is now date-based), but it's handy for checking sales: /api/seats.
// Counts paid deposit and pay-in-full checkouts for this tour (one seat per traveler),
// except any listed in NOT_COUNTED in config.js.
// Cached for two minutes so page views don't each call Stripe.

import Stripe from "stripe";
import { TOUR, NOT_COUNTED } from "./_lib/config.js";

export async function GET() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: "not configured" }, { status: 500 });
  const stripe = new Stripe(key);

  let seatsSold = 0;
  for await (const session of stripe.checkout.sessions.list({ status: "complete", limit: 100 })) {
    const m = session.metadata || {};
    if (m.tour !== TOUR || (m.kind !== "deposit" && m.kind !== "full")) continue;
    if (session.payment_status !== "paid") continue;
    if (NOT_COUNTED.includes(session.id)) continue;
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });
    seatsSold += items.data.reduce((n, item) => n + (item.quantity || 0), 0);
  }

  return Response.json(
    { seatsSold, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
  );
}
