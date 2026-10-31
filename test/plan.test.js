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
