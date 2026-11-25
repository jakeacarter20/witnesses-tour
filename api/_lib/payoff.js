// "Pay off your trip": a traveler on the payment plan pays everything that's left in
// one go, any time before the last plan payment. Linked from their welcome email
// (pay.html?session_id=<their deposit checkout>).
//
// Safe by design: it charges one new invoice for the total of the scheduled plan
// charges still waiting, and only deletes those scheduled charges once that payment
// goes through. If the payment fails, the new invoice is voided and the schedule is
// left exactly as it was. Kept separate from the HTTP handler so it can be tested
// with a fake Stripe client (see test/payoff.test.js).

import { TOUR, CREATED_BY, NOT_COUNTED } from "./config.js";
import { findBooking, DetailsError } from "./travelers.js";

const PLAN_KINDS = ["plan", "auto-plan"];
const ymd = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10);
const idOf = (v) => (typeof v === "string" ? v : v?.id || null);

// The scheduled plan charges (drafts set to charge on their date) still waiting for this booking
async function scheduledCharges(stripe, customerId, sessionId) {
  const drafts = await stripe.invoices.list({ customer: customerId, status: "draft", limit: 100 });
  return drafts.data
    .filter((inv) => {
      const m = inv.metadata || {};
      return m.tour === TOUR && m.created_by === CREATED_BY && PLAN_KINDS.includes(m.kind)
        && m.source_session === sessionId && inv.auto_advance !== false;
    })
    .sort((a, b) => (a.automatically_finalizes_at || 0) - (b.automatically_finalizes_at || 0));
}

async function lookup(stripe, sessionId) {
  const booking = await findBooking(stripe, sessionId);
  if (NOT_COUNTED.includes(booking.session.id)) throw new DetailsError("We couldn't find that booking.", 404);
  return booking;
}

// What the pay-off page shows
export async function loadBalance(stripe, sessionId) {
  const { session, room, count, customerId } = await lookup(stripe, sessionId);
  const kind = session.metadata.kind;
  const charges = kind === "deposit" ? await scheduledCharges(stripe, customerId, session.id) : [];
  const remaining = charges.reduce((n, inv) => n + (inv.amount_due || 0), 0);
  return {
    name: session.customer_details?.name || "",
    room,
    travelers: count,
    paidInFull: remaining === 0,
    remaining: remaining / 100,
    charges: charges.map((inv) => ({
      installment: inv.metadata.installment,
      date: inv.automatically_finalizes_at ? ymd(inv.automatically_finalizes_at) : null,
      amount: (inv.amount_due || 0) / 100,
    })),
  };
}

// Charges the whole remaining balance now and removes the scheduled charges it replaces
export async function payOff(stripe, sessionId, { notify }) {
  const { session, room, customerId } = await lookup(stripe, sessionId);
  if (session.metadata.kind !== "deposit") throw new DetailsError("This booking is already paid in full.", 409);
  const charges = await scheduledCharges(stripe, customerId, session.id);
  const amount = charges.reduce((n, inv) => n + (inv.amount_due || 0), 0);
  if (!charges.length || amount <= 0) throw new DetailsError("There's nothing left to pay on this booking.", 409);

  const first = charges[0];
  const paymentMethod = idOf(first.default_payment_method);
  const mandate = first.payment_settings?.default_mandate || null;
  const key = `payoff-${session.id}-${charges.map((c) => c.id).join("-")}`;
  const who = { session: session.id, customer: customerId, email: session.customer_details?.email, room, amount: amount / 100 };

  let invoice = await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: "charge_automatically",
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      ...(paymentMethod ? { default_payment_method: paymentMethod } : {}),
      ...(mandate ? { payment_settings: { default_mandate: mandate } } : {}),
      description: "The Witnesses Tour: the rest of your trip, paid off early.",
      metadata: { tour: TOUR, kind: "payoff", room, source_session: session.id, created_by: CREATED_BY, replaces: charges.map((c) => c.id).join(",").slice(0, 490) },
    },
    { idempotencyKey: `${key}-invoice` },
  );
  if (!invoice.total) {
    await stripe.invoiceItems.create(
      {
        customer: customerId,
        invoice: invoice.id,
        amount,
        currency: first.currency || "usd",
        description: `The Witnesses Tour, rest of the trip: plan payment${charges.length === 1 ? "" : "s"} ${charges.map((c) => c.metadata.installment).join(", ")} of 4, paid early`,
      },
      { idempotencyKey: `${key}-item` },
    );
  }

  try {
    if (invoice.status === "draft") invoice = await stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: false });
    if (invoice.status !== "paid") invoice = await stripe.invoices.pay(invoice.id);
  } catch (err) {
    // The schedule stays as it was; void the payoff invoice so nothing is left owing twice
    try { await stripe.invoices.voidInvoice(invoice.id); } catch {}
    await notify("A traveler tried to pay off their trip but the payment failed; their scheduled plan payments are unchanged", { ...who, error: err.message });
    throw new DetailsError("Your payment didn't go through, so nothing was charged and your payment schedule is unchanged. Please call or email us and we'll help.", 402);
  }

  // Paid (or, for a bank account, on its way): remove the scheduled charges it replaces
  for (const inv of charges) {
    try { await stripe.invoices.del(inv.id); } catch (err) {
      await notify("A trip was paid off but a scheduled plan charge couldn't be deleted; delete it by hand so they aren't charged twice", { ...who, invoice: inv.id, error: err.message });
    }
  }
  const processing = invoice.status !== "paid";
  await notify(`Trip paid off early (${room}): $${(amount / 100).toFixed(2)}${processing ? ", bank payment processing" : ""}`, who);
  return { paid: amount / 100, processing };
}
