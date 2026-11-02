// What to do in Stripe after each tour payment. Kept separate from the HTTP
// handler so it can be tested with a fake Stripe client (see test/plan.test.js).
//
//   deposit  -> schedule the automatic plan (4 charges from January 1) on the saved card
//   plan     -> cancel the automatic plan; schedule payments 2 to 4 evenly to the final date
//   balance  -> cancel any scheduled plan charges; the trip is paid in full
//   full     -> nothing to schedule
//
// Also, when a scheduled plan charge is paid with a different card or bank account
// (say the traveler replaced an expired card on Stripe's payment page), the rest
// of that booking's scheduled charges are moved to the new one (invoice.paid).

import { TOUR, PLAN_DEADLINE, AUTO_PLAN_DATES, FINAL_PAYMENT, CHARGE_HOUR_UTC, CREATED_BY } from "./config.js";

const DAY = 86400;

// 16:00 UTC on a YYYY-MM-DD date, as a Unix timestamp
export function chargeTime(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d, CHARGE_HOUR_UTC) / 1000;
}

function ymdOf(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

// Charge times for plan payments 2, 3 and 4: evenly spaced from the day the
// plan starts to the final payment date.
export function planChargeTimes(startSeconds) {
  const startDay = chargeTime(ymdOf(startSeconds));
  const final = chargeTime(FINAL_PAYMENT);
  const gapDays = (final - startDay) / DAY / 3;
  return [1, 2, 3].map((i) => startDay + Math.round(gapDays * i) * DAY);
}

export async function handleEvent(stripe, event, { now, notify }) {
  const type = event.type;
  if (type === "invoice.paid") return moveRemainingCharges(stripe, event.data.object, notify);
  const session = event.data.object;
  if (!type.startsWith("checkout.session.")) return { ignored: type };
  if (session.metadata?.tour !== TOUR) return { ignored: "not a tour checkout" };

  const kind = session.metadata.kind;
  const room = session.metadata.room;
  const email = session.customer_details?.email || session.customer_email || null;
  const who = { email, name: session.customer_details?.name, session: session.id, room, kind };

  if (type === "checkout.session.async_payment_failed") {
    await notify(`Bank payment failed (${kind}, ${room})`, who);
    return { alerted: "async payment failed" };
  }
  if (type !== "checkout.session.completed" && type !== "checkout.session.async_payment_succeeded") {
    return { ignored: type };
  }
  // Bank payments complete the checkout before the money arrives; act when it does.
  if (session.payment_status !== "paid") return { waiting: "payment not settled yet" };

  if (kind === "full") return { done: "paid in full, nothing to schedule" };

  if (kind === "deposit") {
    if (now >= chargeTime(PLAN_DEADLINE)) {
      await notify("Deposit taken after the plan deadline; nothing scheduled, follow up by hand", who);
      return { alerted: "deposit after deadline" };
    }
    const quantity = await sessionQuantity(stripe, session);
    const payment = await savedPaymentMethod(stripe, session, notify, who);
    if (!payment) return { alerted: "no saved payment method" };
    const invoices = await scheduleCharges(stripe, {
      session, room, quantity, payment, kind: "auto-plan",
      times: AUTO_PLAN_DATES.map(chargeTime), firstInstallment: 1, now,
    });
    return { scheduled: invoices };
  }

  if (kind === "plan") {
    const times = planChargeTimes(now);
    if (times.some((t) => t <= now + 3600) || new Set(times).size !== times.length) {
      await notify("Plan started too close to the final payment date to space 3 more payments; follow up by hand", who);
      return { alerted: "plan too late" };
    }
    const quantity = await sessionQuantity(stripe, session);
    const payment = await savedPaymentMethod(stripe, session, notify, who);
    if (!payment) return { alerted: "no saved payment method" };
    const removed = await deleteScheduled(stripe, email, ["auto-plan"]);
    const invoices = await scheduleCharges(stripe, {
      session, room, quantity, payment, kind: "plan", times, firstInstallment: 2, now,
    });
    return { removedAutoPlan: removed.length, scheduled: invoices };
  }

  if (kind === "balance") {
    const removed = await deleteScheduled(stripe, email, ["auto-plan", "plan"]);
    if (removed.length === 0) {
      await notify("Rest paid in full, but no scheduled plan charges were found for this email; check by hand", who);
    } else if (removed.some((inv) => inv.kind === "plan")) {
      await notify("Rest paid in full after the plan had started; plan payment 1 may need a refund", { ...who, removed });
    }
    return { removed: removed.length };
  }

  await notify(`Unknown checkout kind "${kind}"`, who);
  return { alerted: "unknown kind" };
}

async function sessionQuantity(stripe, session) {
  const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });
  return items.data.reduce((n, item) => n + (item.quantity || 0), 0);
}

// The card or bank account saved at checkout (setup_future_usage=off_session)
async function savedPaymentMethod(stripe, session, notify, who) {
  const intent = await stripe.paymentIntents.retrieve(session.payment_intent, { expand: ["latest_charge"] });
  const paymentMethod = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
  if (!paymentMethod || intent.setup_future_usage !== "off_session") {
    await notify("Payment method was not saved for later charges; schedule the plan by hand", who);
    return null;
  }
  const bank = intent.latest_charge?.payment_method_details?.us_bank_account;
  return { customer: session.customer, paymentMethod, mandate: bank?.mandate || null };
}

const priceCache = new Map();
async function installmentPrice(stripe, room) {
  if (priceCache.has(room)) return priceCache.get(room);
  const found = await stripe.prices.search({
    query: `active:'true' AND metadata['kind']:'installment' AND metadata['room']:'${room}'`,
  });
  // Copying products from the sandbox can leave identical duplicate prices;
  // any of them charges the same amount, but different amounts mean a mistake.
  const amounts = new Set(found.data.map((price) => price.unit_amount));
  if (found.data.length === 0 || amounts.size !== 1) {
    throw new Error(`Expected one active installment price amount for ${room}, found ${found.data.length} prices with ${amounts.size} amounts`);
  }
  const price = [...found.data].sort((x, y) => (y.created || 0) - (x.created || 0))[0].id;
  priceCache.set(room, price);
  return price;
}

// Creates one scheduled invoice per charge time. Safe to run twice for the same
// checkout: each invoice is tagged with the checkout and installment number, an
// existing one is reused, and an invoice is only switched on to charge once its
// line item is in place.
async function scheduleCharges(stripe, { session, room, quantity, payment, kind, times, firstInstallment }) {
  const price = await installmentPrice(stripe, room);
  const existing = await stripe.invoices.list({ customer: payment.customer, limit: 100 });
  const results = [];

  for (let i = 0; i < times.length; i++) {
    const installment = String(firstInstallment + i);
    let invoice = existing.data.find(
      (inv) => inv.metadata?.source_session === session.id && inv.metadata?.installment === installment,
    );
    if (invoice && invoice.status !== "draft") {
      results.push({ id: invoice.id, installment, status: invoice.status });
      continue;
    }
    const label = kind === "auto-plan" ? "payment plan (started automatically)" : "payment plan";
    if (!invoice) {
      invoice = await stripe.invoices.create(
        {
          customer: payment.customer,
          collection_method: "charge_automatically",
          default_payment_method: payment.paymentMethod,
          ...(payment.mandate ? { payment_settings: { default_mandate: payment.mandate } } : {}),
          auto_advance: false,
          pending_invoice_items_behavior: "exclude",
          description: `The Witnesses Tour ${label}, payment ${installment} of 4. Charged to your saved payment method as agreed at booking.`,
          metadata: {
            tour: TOUR, kind, room, installment, source_session: session.id, created_by: CREATED_BY,
          },
        },
        { idempotencyKey: `${session.id}-${kind}-${installment}-invoice` },
      );
    }
    if (!invoice.total) {
      await stripe.invoiceItems.create(
        {
          customer: payment.customer,
          invoice: invoice.id,
          pricing: { price },
          quantity,
          description: `The Witnesses Tour, ${room[0].toUpperCase() + room.slice(1)} Room: payment plan, payment ${installment} of 4`,
        },
        { idempotencyKey: `${session.id}-${kind}-${installment}-item` },
      );
    }
    await stripe.invoices.update(invoice.id, { auto_advance: true, automatically_finalizes_at: times[i] });
    results.push({ id: invoice.id, installment, chargesOn: ymdOf(times[i]) });
  }
  return results;
}

const PLAN_KINDS = ["plan", "auto-plan"];

// A plan charge was paid. If it was paid with a different payment method than the
// one it was scheduled on, move the booking's other scheduled charges to the new one.
// Safe to run twice: charges already on the new payment method are left alone.
async function moveRemainingCharges(stripe, invoice, notify) {
  const m = invoice.metadata || {};
  if (m.tour !== TOUR || m.created_by !== CREATED_BY || !PLAN_KINDS.includes(m.kind)) {
    return { ignored: "not a scheduled plan charge" };
  }
  const oldMethod = idOf(invoice.default_payment_method);
  const used = await paymentUsed(stripe, invoice.id);
  if (!used) {
    await notify("A plan charge was paid but its payment method couldn't be found; check the remaining charges by hand", { invoice: invoice.id });
    return { alerted: "payment method not found" };
  }
  if (used.paymentMethod === oldMethod) return { unchanged: "paid with the scheduled payment method" };

  const customer = idOf(invoice.customer);
  const drafts = await stripe.invoices.list({ customer, status: "draft", limit: 100 });
  const remaining = drafts.data.filter((inv) => {
    const dm = inv.metadata || {};
    return dm.tour === TOUR && dm.created_by === CREATED_BY && PLAN_KINDS.includes(dm.kind)
      && dm.source_session === m.source_session && idOf(inv.default_payment_method) !== used.paymentMethod;
  });
  const who = { invoice: invoice.id, customer, email: invoice.customer_email, installment: m.installment };

  const moved = [];
  for (const inv of remaining) {
    // A bank account needs its own mandate; a card needs the old bank mandate cleared
    const hadMandate = Boolean(inv.payment_settings?.default_mandate);
    const update = { default_payment_method: used.paymentMethod };
    if (used.mandate) update.payment_settings = { default_mandate: used.mandate };
    else if (hadMandate) update.payment_settings = { default_mandate: "" };
    try {
      await stripe.invoices.update(inv.id, update);
    } catch (err) {
      // Stripe only allows a payment method saved to this customer. If the traveler
      // didn't save the new one, the rest stay on the old one until fixed by hand.
      await notify("A traveler paid a plan charge with a new payment method that wasn't saved; their remaining plan charges are still on the old one, so follow up by hand", { ...who, error: err.message, notMoved: remaining.slice(moved.length).map((r) => r.id) });
      return { alerted: "new payment method not saved", moved };
    }
    moved.push({ id: inv.id, installment: inv.metadata.installment });
  }
  return { moved };
}

// The payment method (and bank mandate, if any) that actually paid an invoice
async function paymentUsed(stripe, invoiceId) {
  const payments = await stripe.invoicePayments.list({ invoice: invoiceId, status: "paid", limit: 10 });
  const intentId = payments.data.map((p) => idOf(p.payment?.payment_intent)).find(Boolean);
  if (!intentId) return null;
  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
  const paymentMethod = idOf(intent.payment_method);
  if (!paymentMethod) return null;
  const mandate = intent.latest_charge?.payment_method_details?.us_bank_account?.mandate || null;
  return { paymentMethod, mandate };
}

function idOf(value) {
  return typeof value === "string" ? value : value?.id || null;
}

// Deletes this tour's scheduled (still draft) plan charges for every Stripe
// customer with this email. Only touches invoices the automation created.
async function deleteScheduled(stripe, email, kinds) {
  if (!email) return [];
  const emails = [...new Set([email, email.toLowerCase()])];
  const removed = [];
  for (const address of emails) {
    const customers = await stripe.customers.list({ email: address, limit: 100 });
    for (const customer of customers.data) {
      const drafts = await stripe.invoices.list({ customer: customer.id, status: "draft", limit: 100 });
      for (const inv of drafts.data) {
        const m = inv.metadata || {};
        if (m.tour === TOUR && m.created_by === CREATED_BY && kinds.includes(m.kind)) {
          await stripe.invoices.del(inv.id);
          removed.push({ id: inv.id, kind: m.kind, installment: m.installment });
        }
      }
    }
  }
  return removed;
}
