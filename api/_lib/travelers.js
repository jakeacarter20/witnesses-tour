// Traveler details collected on the thank-you page after a booking checkout.
// Stripe checkout only allows three questions, so each traveler's name, date of
// birth, email and phone are asked here instead, one answer per box, and saved
// onto the booking's Customer in Stripe (Customers > the buyer > Metadata).
// Kept separate from the HTTP handler so it can be tested with a fake Stripe client
// (see test/travelers.test.js).

import { TOUR, TOUR_START, MIN_AGE } from "./config.js";

const SESSION_ID = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;
const BOOKING_KINDS = ["deposit", "full"];
const MAX = { name: 100, email: 254, phone: 30 };

export class DetailsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function field(session, key) {
  const f = (session.custom_fields || []).find((x) => x.key === key);
  return (f && (f.text?.value || f.numeric?.value || f.dropdown?.value)) || "";
}

// "MM/DD/YYYY" (what checkout asks for) to "YYYY-MM-DD" (what a date input uses)
function isoDate(text) {
  const m = String(text).trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return "";
  const iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return validDate(iso) ? iso : "";
}

function validDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Age on the first day of the tour
export function ageOnTour(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = TOUR_START.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

// Looks up a completed booking checkout for this tour, or throws.
export async function findBooking(stripe, sessionId) {
  if (!SESSION_ID.test(String(sessionId || ""))) throw new DetailsError("That booking link isn't valid.");
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    throw new DetailsError("We couldn't find that booking.", 404);
  }
  const m = session.metadata || {};
  if (m.tour !== TOUR || !BOOKING_KINDS.includes(m.kind) || session.status !== "complete") {
    throw new DetailsError("We couldn't find that booking.", 404);
  }
  if (!session.customer) throw new DetailsError("This booking has no customer record; email us your traveler details.", 409);
  const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });
  const count = Math.max(1, items.data.reduce((n, item) => n + (item.quantity || 0), 0));
  return { session, room: m.room, count, customerId: typeof session.customer === "string" ? session.customer : session.customer.id };
}

// What the form needs: how many travelers, and anything we already know to prefill.
export async function loadDetails(stripe, sessionId) {
  const { session, room, count, customerId } = await findBooking(stripe, sessionId);
  const customer = await stripe.customers.retrieve(customerId);
  const saved = customer.metadata || {};
  const buyer = session.customer_details || {};
  const travelers = [];
  for (let i = 1; i <= count; i++) {
    travelers.push({
      name: saved[`traveler_${i}_name`] || (i === 1 ? buyer.name || "" : ""),
      dob: saved[`traveler_${i}_dob`] || (i === 1 ? isoDate(field(session, "dob")) : ""),
      email: saved[`traveler_${i}_email`] || (i === 1 ? buyer.email || "" : ""),
      phone: saved[`traveler_${i}_phone`] || (i === 1 ? buyer.phone || "" : ""),
    });
  }
  return {
    room,
    count,
    askRoommate: room === "double" && count === 1,
    travelers,
    emergency: {
      name: saved.emergency_name || field(session, "emergency_name"),
      phone: saved.emergency_phone || field(session, "emergency_phone"),
    },
    roommate: saved.roommate || "",
    savedAt: saved.details_saved_at || "",
  };
}

function clean(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length > max) throw new DetailsError("One of the answers is too long.");
  return text;
}

// Checks the form answers and saves them onto the booking's Customer.
export async function saveDetails(stripe, body, { now = new Date() } = {}) {
  const { session, room, count, customerId } = await findBooking(stripe, body?.session_id);
  const list = Array.isArray(body?.travelers) ? body.travelers : [];
  if (list.length !== count) throw new DetailsError(`Please fill in all ${count} travelers.`);

  const metadata = {};
  list.forEach((t, index) => {
    const n = index + 1;
    const who = count === 1 ? "the traveler" : `traveler ${n}`;
    const name = clean(t?.name, MAX.name);
    const dob = clean(t?.dob, 10);
    const email = clean(t?.email, MAX.email);
    const phone = clean(t?.phone, MAX.phone);
    if (!name) throw new DetailsError(`Please enter a full name for ${who}.`);
    if (!validDate(dob)) throw new DetailsError(`Please enter a date of birth for ${who}.`);
    if (ageOnTour(dob) < MIN_AGE) throw new DetailsError(`Travelers must be ${MIN_AGE} or older by April 19, 2027 (${who}).`);
    if (ageOnTour(dob) > 110) throw new DetailsError(`Please check the date of birth for ${who}.`);
    if (n === 1 && (!email || !phone)) throw new DetailsError("Please enter an email and phone for traveler 1.");
    if (!email) throw new DetailsError(`Please enter an email for ${who}. If they don't have one, enter yours.`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DetailsError(`Please check the email for ${who}.`);
    if (phone && (phone.match(/\d/g) || []).length < 7) throw new DetailsError(`Please check the phone number for ${who}.`);
    Object.assign(metadata, {
      [`traveler_${n}_name`]: name,
      [`traveler_${n}_dob`]: dob,
      [`traveler_${n}_email`]: email,
      [`traveler_${n}_phone`]: phone,
    });
  });
  // Clear travelers left over from an earlier, larger save (an empty value deletes the key)
  for (let n = count + 1; n <= 4; n++) {
    for (const k of ["name", "dob", "email", "phone"]) metadata[`traveler_${n}_${k}`] = "";
  }

  const emergencyName = clean(body?.emergency?.name, MAX.name);
  const emergencyPhone = clean(body?.emergency?.phone, MAX.phone);
  if (!emergencyName || (emergencyPhone.match(/\d/g) || []).length < 7) {
    throw new DetailsError("Please enter an emergency contact name and phone number.");
  }
  metadata.emergency_name = emergencyName;
  metadata.emergency_phone = emergencyPhone;

  if (room === "double" && count === 1) {
    const choice = body?.roommate?.choice;
    const mate = clean(body?.roommate?.name, MAX.name);
    if (choice === "pair") metadata.roommate = "Pair me with another traveler";
    else if (choice === "named" && mate) metadata.roommate = mate;
    else throw new DetailsError("Please tell us who you're rooming with, or choose to be paired.");
  } else {
    metadata.roommate = "";
  }

  metadata.details_room = room;
  metadata.details_travelers = String(count);
  metadata.details_session = session.id;
  metadata.details_saved_at = now.toISOString();

  await stripe.customers.update(customerId, { metadata });
  return { saved: true, count, room };
}
