// Tests for the welcome emails, run with `npm test`.
// Uses a fake Stripe client and a fake email sender, so nothing is sent.

import test from "node:test";
import assert from "node:assert/strict";
import { sendWelcomes, buildWelcome } from "../api/_lib/welcome.js";
import { TOUR } from "../api/_lib/config.js";

const DAY = 86400;
const NOW = Date.UTC(2026, 10, 10, 16) / 1000; // November 10, 2026

function booking(id, { daysAgo = 3, kind = "deposit", room = "triple", paid = true, email = "pat@example.com", tour = TOUR } = {}) {
  return {
    id, status: "complete", created: NOW - daysAgo * DAY, customer: `cus_${id}`,
    payment_status: paid ? "paid" : "unpaid",
    metadata: { tour, kind, room },
    customer_details: { name: "Pat Lee", email },
  };
}

function fakeStripe(sessions) {
  return {
    checkout: {
      sessions: {
        list({ created }) {
          const due = sessions.filter((s) => s.created >= created.gte && s.created <= created.lte);
          return (async function* () { yield* due; })();
        },
      },
    },
  };
}

function withCustomers(stripe, customers) {
  stripe.customers = {
    async retrieve(id) { return { id, metadata: (customers[id] = customers[id] || {}) }; },
    async update(id, { metadata }) { Object.assign((customers[id] = customers[id] || {}), metadata); return { id }; },
  };
  return stripe;
}

function run(sessions, customers = {}, { failFor } = {}) {
  const sent = [];
  const alerts = [];
  const stripe = withCustomers(fakeStripe(sessions), customers);
  const send = async (email) => {
    if (failFor && email.to === failFor) throw new Error("mailbox unavailable");
    sent.push(email);
  };
  const notify = async (subject, details) => alerts.push({ subject, details });
  return sendWelcomes(stripe, { now: NOW, send, notify }).then((results) => ({ results, sent, alerts, customers }));
}

test("a booking gets its welcome email two days after purchase, not before", async () => {
  const { sent } = await run([booking("cs_new", { daysAgo: 1 }), booking("cs_old", { daysAgo: 2 })]);
  assert.deepEqual(sent.map((e) => e.idempotencyKey), ["welcome-cs_old-pat@example.com"]);
});

test("every traveler with an email gets one, and nobody gets two", async () => {
  const customers = { cus_cs_1: {
    details_saved_at: "2026-11-05", traveler_1_name: "Pat Lee", traveler_1_email: "PAT@example.com",
    traveler_2_name: "Jordan Lee", traveler_2_email: "jordan@example.com", traveler_3_name: "Casey Lee",
  } };
  const first = await run([booking("cs_1")], customers);
  assert.deepEqual(first.sent.map((e) => e.to), ["pat@example.com", "jordan@example.com"]);
  assert.match(first.sent[0].text, /Triple room for 3 travelers: Pat Lee, Jordan Lee, Casey Lee/);
  assert.ok(customers.cus_cs_1.welcome_sent_at);

  const again = await run([booking("cs_1")], customers);
  assert.equal(again.sent.length, 0);
});

test("only the booker gets the traveler details link, and only if details are missing", async () => {
  const customers = { cus_cs_2: { traveler_1_name: "Pat Lee", traveler_2_email: "jordan@example.com", traveler_2_name: "Jordan Lee" } };
  const { sent } = await run([booking("cs_2")], customers);
  assert.match(sent[0].text, /thank-you\.html\?session_id=cs_2/);
  assert.doesNotMatch(sent[1].text, /session_id/);

  const done = await run([booking("cs_3")], { cus_cs_3: { details_saved_at: "2026-11-05" } });
  assert.doesNotMatch(done.sent[0].text, /session_id/);
});

test("a failed send is retried the next day without resending to the others", async () => {
  const customers = { cus_cs_4: { details_saved_at: "x", traveler_2_name: "Jordan Lee", traveler_2_email: "jordan@example.com" } };
  const first = await run([booking("cs_4")], customers, { failFor: "jordan@example.com" });
  assert.deepEqual(first.sent.map((e) => e.to), ["pat@example.com"]);
  assert.equal(first.alerts.length, 1);
  assert.equal(customers.cus_cs_4.welcome_sent_at, undefined);

  const second = await run([booking("cs_4")], customers);
  assert.deepEqual(second.sent.map((e) => e.to), ["jordan@example.com"]);
  assert.ok(customers.cus_cs_4.welcome_sent_at);
});

test("unpaid, balance, plan and other trips' checkouts get no welcome email", async () => {
  const { sent } = await run([
    booking("cs_a", { paid: false }),
    booking("cs_b", { kind: "balance" }),
    booking("cs_c", { kind: "plan" }),
    booking("cs_d", { tour: "other-trip" }),
  ]);
  assert.equal(sent.length, 0);
});

test("the letter covers the deposit deadline only for deposits", () => {
  const deposit = buildWelcome({ name: "Pat Lee", room: "double", kind: "deposit", travelers: ["Pat Lee"] });
  const full = buildWelcome({ name: "Pat Lee", room: "double", kind: "full", travelers: ["Pat Lee"] });
  assert.match(deposit.text, /January 1, 2027/);
  assert.doesNotMatch(full.text, /Pay the rest by/);
  assert.match(deposit.text, /^Hi Pat,/);
  assert.match(deposit.html, /Welcome to The Witnesses Tour/);
  assert.match(deposit.text, /See you in Independence,\nThe Parley Street Travel Co\. team/);
});

test("the waiver is promised with the traveler packet, not in this email", () => {
  const { text } = buildWelcome({ name: "Pat", room: "single", kind: "full", travelers: ["Pat"] });
  assert.match(text, /traveler packet .* along with the traveler waiver/);
  assert.doesNotMatch(text, /Sign your waiver/);
});

test("names are escaped in the HTML", () => {
  const { html } = buildWelcome({ name: "<b>Pat</b>", room: "single", kind: "full", travelers: ["<b>Pat</b>"] });
  assert.doesNotMatch(html, /<b>Pat<\/b>/);
});
