// Tests for "Pay off your trip", run with `npm test`.
// Uses a fake Stripe client held in memory, so nothing touches a real account.

import test from "node:test";
import assert from "node:assert/strict";
import { loadBalance, payOff } from "../api/_lib/payoff.js";
import { TOUR } from "../api/_lib/config.js";

const SESSION = "cs_live_payoffTest1234567890";

function fakeStripe({ kind = "deposit", declined = false, drafts = 4, perCharge = 77500, extra = [] } = {}) {
  const invoices = [];
  for (let i = 1; i <= drafts; i++) {
    invoices.push({
      id: `in_${i}`, customer: "cus_1", status: "draft", auto_advance: true, currency: "usd",
      amount_due: perCharge, default_payment_method: "pm_saved", payment_settings: { default_mandate: null },
      automatically_finalizes_at: Date.UTC(2027, 0, i * 20) / 1000,
      metadata: { tour: TOUR, kind: "auto-plan", installment: String(i), source_session: SESSION, created_by: "witnesses-webhook" },
    });
  }
  invoices.push(...extra);
  const deleted = [];
  const voided = [];
  let n = 0;
  return {
    invoices: {
      _all: invoices, deleted, voided,
      async list({ customer, status }) { return { data: invoices.filter((i) => i.customer === customer && (!status || i.status === status)) }; },
      async create(params) {
        const inv = { id: `in_new${++n}`, status: "draft", total: 0, amount_due: 0, ...params };
        invoices.push(inv);
        return inv;
      },
      async finalizeInvoice(id) { const inv = invoices.find((i) => i.id === id); inv.status = "open"; return inv; },
      async pay(id) {
        const inv = invoices.find((i) => i.id === id);
        if (declined) throw new Error("Your card was declined.");
        inv.status = "paid";
        return inv;
      },
      async voidInvoice(id) { const inv = invoices.find((i) => i.id === id); inv.status = "void"; voided.push(id); return inv; },
      async del(id) {
        const i = invoices.findIndex((inv) => inv.id === id);
        assert.equal(invoices[i].status, "draft");
        deleted.push(id);
        invoices.splice(i, 1);
        return { id, deleted: true };
      },
    },
    invoiceItems: {
      async create(params) {
        const inv = invoices.find((i) => i.id === params.invoice);
        inv.total += params.amount;
        inv.amount_due += params.amount;
        inv.item = params;
        return { id: "ii_1" };
      },
    },
    checkout: {
      sessions: {
        async retrieve(id) {
          if (id !== SESSION) throw new Error("No such checkout.session");
          return { id, status: "complete", customer: "cus_1", metadata: { tour: TOUR, kind, room: "double" }, customer_details: { name: "Pat Lee", email: "pat@example.com" } };
        },
        async listLineItems() { return { data: [{ quantity: 2 }] }; },
      },
    },
  };
}

const run = (stripe) => {
  const alerts = [];
  return payOff(stripe, SESSION, { notify: async (subject, details) => alerts.push({ subject, details }) })
    .then((result) => ({ result, alerts }), (error) => ({ error, alerts }));
};

test("the pay-off page shows what's left on the plan", async () => {
  const balance = await loadBalance(fakeStripe(), SESSION);
  assert.equal(balance.remaining, 3100);
  assert.equal(balance.paidInFull, false);
  assert.deepEqual(balance.charges.map((c) => c.installment), ["1", "2", "3", "4"]);
});

test("after the first plan payment, only the rest is due", async () => {
  const stripe = fakeStripe({ drafts: 4 });
  stripe.invoices._all[0].status = "paid"; // January 1 already charged
  const balance = await loadBalance(stripe, SESSION);
  assert.equal(balance.remaining, 2325);
  assert.deepEqual(balance.charges.map((c) => c.installment), ["2", "3", "4"]);
});

test("paying off charges one invoice for the rest, then removes the scheduled charges", async () => {
  const stripe = fakeStripe();
  stripe.invoices._all[0].status = "paid";
  const { result, alerts } = await run(stripe);
  assert.deepEqual(result, { paid: 2325, processing: false });
  const payoff = stripe.invoices._all.find((i) => i.metadata?.kind === "payoff");
  assert.equal(payoff.status, "paid");
  assert.equal(payoff.item.amount, 232500);
  assert.equal(payoff.default_payment_method, "pm_saved");
  assert.deepEqual(stripe.invoices.deleted, ["in_2", "in_3", "in_4"]);
  assert.match(alerts[0].subject, /paid off early/);
});

test("a declined payment changes nothing and voids the pay-off invoice", async () => {
  const stripe = fakeStripe({ declined: true });
  const { error, alerts } = await run(stripe);
  assert.match(error.message, /didn't go through/);
  assert.equal(error.status, 402);
  assert.deepEqual(stripe.invoices.deleted, []);
  assert.equal(stripe.invoices.voided.length, 1);
  assert.equal(stripe.invoices._all.filter((i) => i.status === "draft").length, 4);
  assert.match(alerts[0].subject, /payment failed/);
});

test("Black Friday discounts already taken off the scheduled charges carry through", async () => {
  const stripe = fakeStripe({ perCharge: 77500 - 9000 });
  const balance = await loadBalance(stripe, SESSION);
  assert.equal(balance.remaining, 2740);
});

test("charges that were switched off by hand aren't counted or charged", async () => {
  const stripe = fakeStripe();
  stripe.invoices._all.forEach((i) => { i.auto_advance = false; });
  assert.equal((await loadBalance(stripe, SESSION)).paidInFull, true);
  const { error } = await run(stripe);
  assert.match(error.message, /nothing left/);
});

test("a paid-in-full booking has nothing to pay off", async () => {
  const stripe = fakeStripe({ kind: "full", drafts: 0 });
  assert.equal((await loadBalance(stripe, SESSION)).paidInFull, true);
  const { error } = await run(stripe);
  assert.match(error.message, /already paid in full/);
});

test("only this booking's scheduled charges are touched", async () => {
  const other = { id: "in_other", customer: "cus_1", status: "draft", auto_advance: true, amount_due: 50000, metadata: { tour: TOUR, kind: "auto-plan", installment: "1", source_session: "cs_live_someoneElse0000000", created_by: "witnesses-webhook" } };
  const stripe = fakeStripe({ extra: [other] });
  await run(stripe);
  assert.ok(stripe.invoices._all.some((i) => i.id === "in_other"));
  assert.ok(!stripe.invoices.deleted.includes("in_other"));
});

test("a bad link is refused", async () => {
  await assert.rejects(loadBalance(fakeStripe(), "nonsense"), /isn't valid/);
  await assert.rejects(loadBalance(fakeStripe(), "cs_live_unknownSession000000"), /couldn't find/);
});
