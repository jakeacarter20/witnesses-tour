// Tests for the traveler details form, run with `npm test`.
// Uses a fake Stripe client held in memory, so nothing touches a real account.

import test from "node:test";
import assert from "node:assert/strict";
import { loadDetails, saveDetails, ageOnTour, DetailsError } from "../api/_lib/travelers.js";
import { TOUR } from "../api/_lib/config.js";

const SESSION = "cs_live_a1B2c3D4e5F6g7H8";

function fakeStripe({ room = "triple", quantity = 3, kind = "deposit", status = "complete", tour = TOUR, metadata = {} } = {}) {
  const customer = { id: "cus_1", metadata: { ...metadata } };
  return {
    customer,
    checkout: {
      sessions: {
        async retrieve(id) {
          if (id !== SESSION) throw new Error("No such checkout.session");
          return {
            id, status, customer: "cus_1",
            metadata: { tour, kind, room },
            customer_details: { name: "Pat Lee", email: "pat@example.com", phone: "+15555550100" },
            custom_fields: [
              { key: "dob", text: { value: "04/19/1980" } },
              { key: "emergency_name", text: { value: "Sam Lee" } },
              { key: "emergency_phone", text: { value: "555-555-0199" } },
            ],
          };
        },
        async listLineItems() {
          return { data: [{ quantity }] };
        },
      },
    },
    customers: {
      async retrieve() {
        return customer;
      },
      async update(id, { metadata: changes }) {
        for (const [k, v] of Object.entries(changes)) {
          if (v === "") delete customer.metadata[k];
          else customer.metadata[k] = v;
        }
        return customer;
      },
    },
  };
}

const traveler = (n, extra = {}) => ({ name: `Traveler ${n}`, dob: "1990-06-01", email: "", phone: "", ...extra });
const form = (travelers, extra = {}) => ({
  session_id: SESSION,
  travelers,
  emergency: { name: "Sam Lee", phone: "555-555-0199" },
  ...extra,
});
const first = { email: "pat@example.com", phone: "555-555-0100" };

test("age is counted on the first day of the tour", () => {
  assert.equal(ageOnTour("2011-04-19"), 16);
  assert.equal(ageOnTour("2011-04-20"), 15);
});

test("the form asks about one traveler per seat and prefills what checkout collected", async () => {
  const details = await loadDetails(fakeStripe(), SESSION);
  assert.equal(details.count, 3);
  assert.equal(details.askRoommate, false);
  assert.deepEqual(details.travelers[0], { name: "Pat Lee", dob: "1980-04-19", email: "pat@example.com", phone: "+15555550100" });
  assert.deepEqual(details.travelers[1], { name: "", dob: "", email: "", phone: "" });
  assert.deepEqual(details.emergency, { name: "Sam Lee", phone: "555-555-0199" });
});

test("a solo Double booking is asked about a roommate", async () => {
  const details = await loadDetails(fakeStripe({ room: "double", quantity: 1 }), SESSION);
  assert.equal(details.askRoommate, true);
});

test("answers are saved onto the customer, one value per key", async () => {
  const stripe = fakeStripe();
  await saveDetails(stripe, form([traveler(1, first), traveler(2), traveler(3, { phone: "555 555 0123" })]), { now: new Date("2026-11-01T00:00:00Z") });
  const m = stripe.customer.metadata;
  assert.equal(m.traveler_1_name, "Traveler 1");
  assert.equal(m.traveler_1_dob, "1990-06-01");
  assert.equal(m.traveler_1_email, "pat@example.com");
  assert.equal(m.traveler_3_phone, "555 555 0123");
  assert.equal(m.traveler_2_email, undefined);
  assert.equal(m.emergency_name, "Sam Lee");
  assert.equal(m.details_travelers, "3");
  assert.equal(m.details_saved_at, "2026-11-01T00:00:00.000Z");
  assert.equal(m.roommate, undefined);
});

test("saving again replaces the earlier answers", async () => {
  const stripe = fakeStripe({ metadata: { traveler_4_name: "Old entry", traveler_1_name: "Typo" } });
  await saveDetails(stripe, form([traveler(1, first), traveler(2), traveler(3)]));
  assert.equal(stripe.customer.metadata.traveler_1_name, "Traveler 1");
  assert.equal(stripe.customer.metadata.traveler_4_name, undefined);
  const again = await loadDetails(stripe, SESSION);
  assert.equal(again.travelers[0].name, "Traveler 1");
});

test("a solo Double saves the roommate choice", async () => {
  const stripe = fakeStripe({ room: "double", quantity: 1 });
  await saveDetails(stripe, form([traveler(1, first)], { roommate: { choice: "pair" } }));
  assert.equal(stripe.customer.metadata.roommate, "Pair me with another traveler");
  await saveDetails(stripe, form([traveler(1, first)], { roommate: { choice: "named", name: "Alex Kim" } }));
  assert.equal(stripe.customer.metadata.roommate, "Alex Kim");
  await assert.rejects(saveDetails(stripe, form([traveler(1, first)], { roommate: { choice: "named", name: "" } })), /rooming/);
});

test("missing or wrong answers are refused with a plain message", async () => {
  const stripe = fakeStripe();
  await assert.rejects(saveDetails(stripe, form([traveler(1, first), traveler(2)])), /all 3 travelers/);
  await assert.rejects(saveDetails(stripe, form([traveler(1, first), traveler(2, { name: " " }), traveler(3)])), /full name for traveler 2/);
  await assert.rejects(saveDetails(stripe, form([traveler(1, first), traveler(2, { dob: "2011-05-01" }), traveler(3)])), /16 or older/);
  await assert.rejects(saveDetails(stripe, form([traveler(1, first), traveler(2, { dob: "1990-02-30" }), traveler(3)])), /date of birth/);
  await assert.rejects(saveDetails(stripe, form([traveler(1), traveler(2), traveler(3)])), /email and phone for traveler 1/);
  await assert.rejects(saveDetails(stripe, form([traveler(1, first), traveler(2), traveler(3)], { emergency: { name: "Sam", phone: "" } })), /emergency contact/);
  assert.deepEqual(stripe.customer.metadata, {});
});

test("only completed booking checkouts for this tour can be used", async () => {
  await assert.rejects(loadDetails(fakeStripe(), "not-a-session"), DetailsError);
  await assert.rejects(loadDetails(fakeStripe(), "cs_live_somebodyelses123"), /couldn't find/);
  await assert.rejects(loadDetails(fakeStripe({ kind: "balance" }), SESSION), /couldn't find/);
  await assert.rejects(loadDetails(fakeStripe({ status: "open" }), SESSION), /couldn't find/);
  await assert.rejects(loadDetails(fakeStripe({ tour: "another-trip" }), SESSION), /couldn't find/);
});
