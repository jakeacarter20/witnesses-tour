// Tests for the payment plan automation, run with `npm test`.
// Uses a fake Stripe client held in memory, so nothing touches a real account.

import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { handleEvent, planChargeTimes, chargeTime } from "../api/_lib/plan.js";
import { TOUR, AUTO_PLAN_DATES } from "../api/_lib/config.js";

const NOW = Date.UTC(2026, 9, 23, 18) / 1000; // October 23, 2026
const ymd = (s) => new Date(s * 1000).toISOString().slice(0, 10);

function fakeStripe({ customers = [{ id: "cus_1", email: "pat@example.com" }], quantity = 2, saved = true, bank = false } = {}) {
  const invoices = [];
  let n = 0;
  const seenKeys = new Map();
  const once = (opts, make) => {
    const key = opts?.idempotencyKey;
    if (key && seenKeys.has(key)) return seenKeys.get(key);
    const result = make();
    if (key) seenKeys.set(key, result);
    return result;
  };
  return {
    invoices: {
      _all: invoices,
      async list({ customer, status }) {
        return { data: invoices.filter((i) => i.customer === customer && (!status || i.status === status)) };
      },
      async create(params, opts) {
        return once(opts, () => {
          const inv = { id: `in_${++n}`, status: "draft", total: 0, items: [], ...params };
          invoices.push(inv);
          return inv;
        });
      },
      async update(id, params) {
        const inv = invoices.find((i) => i.id === id);
        Object.assign(inv, params);
        return inv;
      },
      async del(id) {
        const i = invoices.findIndex((inv) => inv.id === id);
        assert.equal(invoices[i].status, "draft", "only drafts can be deleted");
        invoices.splice(i, 1);
        return { id, deleted: true };
      },
    },
    invoiceItems: {
      async create(params, opts) {
        return once(opts, () => {
          const inv = invoices.find((i) => i.id === params.invoice);
          inv.items.push(params);
          inv.total += 108750 * params.quantity;
          return { id: `ii_${++n}` };
        });
      },
    },
    customers: {
      async list({ email }) {
        return { data: customers.filter((c) => c.email === email) };
      },
    },
    checkout: {
      sessions: {
        async listLineItems() {
          return { data: [{ quantity }] };
        },
      },
    },
    paymentIntents: {
      async retrieve() {
        return {
          payment_method: "pm_1",
          setup_future_usage: saved ? "off_session" : null,
          latest_charge: bank ? { payment_method_details: { us_bank_account: { mandate: "mandate_1" } } } : {},
        };
      },
    },
    prices: {
      async search({ query }) {
        const room = query.match(/\['room'\]:'(\w+)'/)[1];
        // Two identical copies, as when products are copied from the sandbox
        return { data: [
          { id: `price_installment_${room}`, unit_amount: 36250, created: 2 },
          { id: `price_installment_${room}_copy`, unit_amount: 36250, created: 1 },
        ] };
      },
    },
  };
}

function checkout(kind, { type = "checkout.session.completed", id = `cs_${kind}`, paid = true, room = "triple", tour = TOUR } = {}) {
  return {
    id: `evt_${id}`,
    type,
    data: {
      object: {
        id,
        customer: "cus_1",
        payment_intent: "pi_1",
        payment_status: paid ? "paid" : "unpaid",
        customer_details: { email: "pat@example.com", name: "Pat" },
        metadata: { tour, kind, room },
      },
    },
  };
}

function run(stripe, event, now = NOW) {
  const alerts = [];
  const notify = async (subject, details) => alerts.push({ subject, details });
  return handleEvent(stripe, event, { now, notify }).then((result) => ({ result, alerts }));
}

test("plan payments 2 to 4 are evenly spaced to March 19, 2027", () => {
  assert.deepEqual(planChargeTimes(NOW).map(ymd), ["2026-12-11", "2027-01-29", "2027-03-19"]);
});

test("a deposit schedules the automatic plan on the saved card", async () => {
  const stripe = fakeStripe();
  const { result, alerts } = await run(stripe, checkout("deposit"));
  assert.equal(alerts.length, 0);
  assert.equal(result.scheduled.length, 4);
  const all = stripe.invoices._all;
  assert.deepEqual(all.map((i) => i.automatically_finalizes_at), AUTO_PLAN_DATES.map(chargeTime));
  for (const inv of all) {
    assert.equal(inv.auto_advance, true);
    assert.equal(inv.collection_method, "charge_automatically");
    assert.equal(inv.default_payment_method, "pm_1");
    assert.equal(inv.metadata.kind, "auto-plan");
    assert.deepEqual(inv.items.map((it) => [it.pricing.price, it.quantity]), [["price_installment_triple", 2]]);
  }
});

test("Stripe sending the same deposit twice does not double charge", async () => {
  const stripe = fakeStripe();
  await run(stripe, checkout("deposit"));
  await run(stripe, checkout("deposit"));
  assert.equal(stripe.invoices._all.length, 4);
  assert.ok(stripe.invoices._all.every((i) => i.items.length === 1));
});

test("a bank deposit waits until the money arrives, and keeps the bank mandate", async () => {
  const stripe = fakeStripe({ bank: true });
  const pending = await run(stripe, checkout("deposit", { paid: false }));
  assert.deepEqual(pending.result, { waiting: "payment not settled yet" });
  assert.equal(stripe.invoices._all.length, 0);

  await run(stripe, checkout("deposit", { type: "checkout.session.async_payment_succeeded" }));
  assert.equal(stripe.invoices._all.length, 4);
  assert.equal(stripe.invoices._all[0].payment_settings.default_mandate, "mandate_1");
});

test("a failed bank payment sends an alert", async () => {
  const { alerts } = await run(fakeStripe(), checkout("deposit", { type: "checkout.session.async_payment_failed", paid: false }));
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].subject, /Bank payment failed/);
});

test("starting the plan cancels the automatic plan and schedules payments 2 to 4", async () => {
  const stripe = fakeStripe();
  await run(stripe, checkout("deposit"));
  const { result, alerts } = await run(stripe, checkout("plan"));
  assert.equal(alerts.length, 0);
  assert.equal(result.removedAutoPlan, 4);
  const all = stripe.invoices._all;
  assert.deepEqual(all.map((i) => i.metadata.installment), ["2", "3", "4"]);
  assert.deepEqual(all.map((i) => ymd(i.automatically_finalizes_at)), ["2026-12-11", "2027-01-29", "2027-03-19"]);
  assert.ok(all.every((i) => i.metadata.kind === "plan"));
});

test("paying the rest cancels every scheduled plan charge", async () => {
  const stripe = fakeStripe();
  await run(stripe, checkout("deposit"));
  const { result, alerts } = await run(stripe, checkout("balance"));
  assert.equal(result.removed, 4);
  assert.equal(alerts.length, 0);
  assert.equal(stripe.invoices._all.length, 0);
});

test("paying the rest after the plan started alerts about a possible refund", async () => {
  const stripe = fakeStripe();
  await run(stripe, checkout("deposit"));
  await run(stripe, checkout("plan"));
  const { alerts } = await run(stripe, checkout("balance"));
  assert.equal(stripe.invoices._all.length, 0);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].subject, /refund/);
});

test("paying the rest with no scheduled charges found alerts", async () => {
  const { alerts } = await run(fakeStripe(), checkout("balance"));
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].subject, /no scheduled plan charges/);
});

test("finds the customer even when the email was typed with capitals", async () => {
  const stripe = fakeStripe();
  await run(stripe, checkout("deposit"));
  const event = checkout("balance");
  event.data.object.customer_details.email = "Pat@Example.com";
  const { result } = await run(stripe, event);
  assert.equal(result.removed, 4);
});

test("never deletes invoices the automation didn't create", async () => {
  const stripe = fakeStripe();
  stripe.invoices._all.push({ id: "in_manual", customer: "cus_1", status: "draft", metadata: { tour: TOUR, kind: "auto-plan" } });
  await run(stripe, checkout("balance"));
  assert.deepEqual(stripe.invoices._all.map((i) => i.id), ["in_manual"]);
});

test("pay in full schedules nothing", async () => {
  const stripe = fakeStripe();
  const { result } = await run(stripe, checkout("full"));
  assert.match(result.done, /nothing to schedule/);
  assert.equal(stripe.invoices._all.length, 0);
});

test("a deposit after January 1 alerts instead of scheduling", async () => {
  const stripe = fakeStripe();
  const { alerts } = await run(stripe, checkout("deposit"), chargeTime("2027-01-02"));
  assert.equal(stripe.invoices._all.length, 0);
  assert.match(alerts[0].subject, /after the plan deadline/);
});

test("a plan started days before the final date alerts instead of scheduling", async () => {
  const stripe = fakeStripe();
  const { alerts } = await run(stripe, checkout("plan"), chargeTime("2027-03-18"));
  assert.equal(stripe.invoices._all.length, 0);
  assert.match(alerts[0].subject, /too close/);
});

test("a card that wasn't saved alerts instead of scheduling", async () => {
  const stripe = fakeStripe({ saved: false });
  const { alerts } = await run(stripe, checkout("deposit"));
  assert.equal(stripe.invoices._all.length, 0);
  assert.match(alerts[0].subject, /not saved/);
});

test("checkouts for anything else are ignored", async () => {
  const stripe = fakeStripe();
  const { result } = await run(stripe, checkout("deposit", { tour: "some-other-trip" }));
  assert.deepEqual(result, { ignored: "not a tour checkout" });
});

test("the webhook rejects requests that aren't signed by Stripe", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";
  const { POST } = await import("../api/stripe-webhook.js");
  const payload = JSON.stringify(checkout("deposit", { tour: "some-other-trip" }));
  const post = (signature) =>
    POST(new Request("https://example.test/api/stripe-webhook", {
      method: "POST", body: payload, headers: { "stripe-signature": signature },
    }));

  const forged = await post("t=1,v1=nope");
  assert.equal(forged.status, 400);

  const header = new Stripe("sk_test_fake").webhooks.generateTestHeaderString({
    payload, secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const signed = await post(header);
  assert.equal(signed.status, 200);
  assert.deepEqual((await signed.json()).result, { ignored: "not a tour checkout" });
});

// --- A plan charge paid with a new card or bank account ---------------------

const SOURCE = "cs_deposit";
const planInvoice = (id, installment, { pm = "pm_old", mandate = null, status = "draft", kind = "auto-plan", source = SOURCE, createdBy = "witnesses-webhook" } = {}) => ({
  id, status, customer: "cus_1", customer_email: "pat@example.com",
  default_payment_method: pm,
  payment_settings: { default_mandate: mandate },
  metadata: { tour: TOUR, kind, room: "double", installment, source_session: source, created_by: createdBy },
});

function cardChangeStripe({ invoices, paidWith = "pm_new", bankMandate = null, attached = ["pm_old", "pm_new"] }) {
  const updates = [];
  return {
    updates,
    invoicePayments: {
      async list({ invoice }) {
        return { data: [{ invoice, status: "paid", payment: { type: "payment_intent", payment_intent: `pi_${invoice}` } }] };
      },
    },
    paymentIntents: {
      async retrieve() {
        return {
          payment_method: paidWith,
          latest_charge: bankMandate ? { payment_method_details: { us_bank_account: { mandate: bankMandate } } } : { payment_method_details: { card: {} } },
        };
      },
    },
    invoices: {
      async list({ customer, status }) {
        return { data: invoices.filter((i) => i.customer === customer && (!status || i.status === status)) };
      },
      async update(id, params) {
        if (params.default_payment_method && !attached.includes(params.default_payment_method)) {
          throw new Error(`The payment method ${params.default_payment_method} does not belong to this customer`);
        }
        const inv = invoices.find((i) => i.id === id);
        inv.default_payment_method = params.default_payment_method;
        if (params.payment_settings) inv.payment_settings = { ...inv.payment_settings, ...params.payment_settings };
        updates.push({ id, ...params });
        return inv;
      },
    },
  };
}

const paid = (invoice) => ({ id: `evt_${invoice.id}`, type: "invoice.paid", data: { object: invoice } });

test("paying a plan charge with a new card moves the rest of that booking's charges to it", async () => {
  const invoices = [
    planInvoice("in_1", "1", { status: "paid" }),
    planInvoice("in_2", "2"), planInvoice("in_3", "3"), planInvoice("in_4", "4"),
    planInvoice("in_other", "2", { source: "cs_someone_else" }),
    planInvoice("in_manual", "2", { createdBy: "a-person" }),
  ];
  const stripe = cardChangeStripe({ invoices });
  const { result, alerts } = await run(stripe, paid(invoices[0]));
  assert.deepEqual(result.moved.map((m) => m.id), ["in_2", "in_3", "in_4"]);
  assert.equal(alerts.length, 0);
  assert.deepEqual(invoices.map((i) => i.default_payment_method), ["pm_old", "pm_new", "pm_new", "pm_new", "pm_old", "pm_old"]);
  assert.ok(stripe.updates.every((u) => !u.payment_settings), "a card-to-card move leaves the mandate alone");

  const again = await run(stripe, paid(invoices[0]));
  assert.deepEqual(again.result.moved, [], "a repeated event changes nothing");
});

test("moving from a bank account to a card clears the old bank mandate", async () => {
  const invoices = [planInvoice("in_1", "1", { status: "paid", pm: "pm_bank", mandate: "mandate_1" }), planInvoice("in_2", "2", { pm: "pm_bank", mandate: "mandate_1" })];
  const stripe = cardChangeStripe({ invoices, attached: ["pm_bank", "pm_new"] });
  await run(stripe, paid(invoices[0]));
  assert.equal(invoices[1].default_payment_method, "pm_new");
  assert.equal(invoices[1].payment_settings.default_mandate, "");
});

test("moving to a new bank account carries its mandate", async () => {
  const invoices = [planInvoice("in_1", "1", { status: "paid" }), planInvoice("in_2", "2")];
  const stripe = cardChangeStripe({ invoices, paidWith: "pm_bank2", bankMandate: "mandate_2", attached: ["pm_old", "pm_bank2"] });
  await run(stripe, paid(invoices[0]));
  assert.equal(invoices[1].default_payment_method, "pm_bank2");
  assert.equal(invoices[1].payment_settings.default_mandate, "mandate_2");
});

test("a new card that wasn't saved alerts instead of moving anything", async () => {
  const invoices = [planInvoice("in_1", "1", { status: "paid" }), planInvoice("in_2", "2"), planInvoice("in_3", "3")];
  const stripe = cardChangeStripe({ invoices, attached: ["pm_old"] });
  const { result, alerts } = await run(stripe, paid(invoices[0]));
  assert.equal(result.alerted, "new payment method not saved");
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].subject, /wasn't saved/);
  assert.deepEqual(alerts[0].details.notMoved, ["in_2", "in_3"]);
  assert.deepEqual(invoices.map((i) => i.default_payment_method), ["pm_old", "pm_old", "pm_old"]);
});

test("a charge paid with the card it was scheduled on changes nothing", async () => {
  const invoices = [planInvoice("in_1", "1", { status: "paid" }), planInvoice("in_2", "2")];
  const stripe = cardChangeStripe({ invoices, paidWith: "pm_old" });
  const { result } = await run(stripe, paid(invoices[0]));
  assert.match(result.unchanged, /scheduled payment method/);
  assert.equal(stripe.updates.length, 0);
});

test("paid invoices that aren't scheduled plan charges are ignored", async () => {
  const receipt = { id: "in_receipt", customer: "cus_1", metadata: {} };
  const { result } = await run(cardChangeStripe({ invoices: [] }), paid(receipt));
  assert.deepEqual(result, { ignored: "not a scheduled plan charge" });
});
