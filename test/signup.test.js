// Tests for the email sign-ups, run with `npm test`. Nothing is sent.

import test from "node:test";
import assert from "node:assert/strict";
import { handleSignup, SignupError } from "../api/_lib/signup.js";

function run(body, { contacts = true, contactFails = false } = {}) {
  const sent = [];
  const listed = [];
  return handleSignup(body, {
    notifyTo: "hello@parleystreettravel.com",
    addContact: contacts ? async (email) => { if (contactFails) throw new Error("rate limited"); listed.push(email); } : null,
    send: async (email) => sent.push(email),
    now: new Date("2026-11-02T18:00:00Z"),
  }).then((result) => ({ result, sent, listed }));
}

test("a sign-up is added to the list and emailed to hello@ with the question", async () => {
  const { result, sent, listed } = await run({ email: " Pat@Example.com ", question: "Is there a discount for families?", source: "slidein" });
  assert.deepEqual(result, { ok: true, listed: true });
  assert.deepEqual(listed, ["pat@example.com"]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "hello@parleystreettravel.com");
  assert.equal(sent[0].replyTo, "pat@example.com");
  assert.equal(sent[0].subject, "Question from pat@example.com");
  assert.match(sent[0].text, /Is there a discount for families\?/);
  assert.match(sent[0].text, /added to the Resend contact list/);
});

test("without a question the email says it's a sign-up", async () => {
  const { sent } = await run({ email: "pat@example.com", source: "footer" });
  assert.equal(sent[0].subject, "New sign-up: pat@example.com");
  assert.match(sent[0].text, /through the footer sign-up/);
});

test("hello@ still hears about it when the list isn't connected or fails", async () => {
  const notConnected = await run({ email: "pat@example.com" }, { contacts: false });
  assert.equal(notConnected.result.listed, false);
  assert.match(notConnected.sent[0].text, /isn't connected yet/);

  const failed = await run({ email: "pat@example.com" }, { contactFails: true });
  assert.equal(failed.result.listed, false);
  assert.match(failed.sent[0].text, /could not be added .*rate limited/);
});

test("bad input is refused and bots are quietly ignored", async () => {
  await assert.rejects(run({ email: "not-an-email" }), /valid email/);
  await assert.rejects(run({ email: "pat@example.com", question: "x".repeat(1001) }), /1,000 characters/);
  const bot = run({ email: "pat@example.com", website: "http://spam.example" });
  await assert.rejects(bot, (err) => err instanceof SignupError && err.status === 202);
});

test("the question is escaped in the email's HTML", async () => {
  const { sent } = await run({ email: "pat@example.com", question: "<script>alert(1)</script>" });
  assert.doesNotMatch(sent[0].html, /<script>/);
});
