/*
  PARLEY STREET TRAVEL CO. — BOOKING SETTINGS
  This is the only file you need to edit to open, update or close booking.

  1. Create the 20 Stripe Payment Links described in SETUP.md (deposit, full, balance and plan for each room, plus Shared).
  2. Paste each link between the quotes below.
  3. Upload the site. Any room whose link is still empty shows "Booking opens soon".

  THE LINKS BELOW ARE LIVE STRIPE LINKS. They take real payments into the
  Parley Street Travel Co account (acct_1UTTLNBGUzBPtYtu).

  To close a room type when it fills, set its soldOut to true.
  To close the whole tour, set tourSoldOut to true.
*/
window.PARLEY_BOOKING = {
  depositPerPerson: 250,                 // dollars, per traveler, nonrefundable
  paymentDeadline: "January 1, 2027",    // pay in full or start the 4-payment plan by this date
  finalPaymentDate: "March 19, 2027",    // last plan payment, one month before the April 19 departure
  autoPlanDates: "January 1, January 27, February 21 and March 19, 2027", // charge dates if the plan starts automatically

  promoEnds: "2026-11-28T23:59:59-07:00", // free Book of Mormon offer, now part of Black Friday: its FAQ entry disappears at this time (Saturday 11:59 PM Mountain, same as sale.ends)

  totalSeats: 50,                        // seats on the coach; the banner shows totalSeats minus seats sold (from /api/seats) minus seatsPledged
  seatsPledged: 29,                      // seats promised but not yet paid on the site (set Nov 24, 2026 so the banner shows 19 available: 50 - 2 paid online - 29).
                                         // When a pledged traveler books on the site, lower this by their seats so they aren't counted twice.
  phone: "385-312-0685",                 // Google Voice number in the call bar at the top of the page

  // Black Friday: 10% off, shown on the site until saleEnds. Pay-in-full checkouts get the
  // Stripe promotion code below applied automatically; deposits booked by then get 10% off
  // the rest of their trip, applied by hand in Stripe (see "Before January 1.md").
  sale: {
    ends: "2026-11-28T23:59:59-07:00",   // Saturday 11:59 PM Mountain
    percentOff: 10,
    promoCode: "BLACKFRIDAY"
  },

  tourSoldOut: false,

  // Each room type: price per person, how many seats one checkout books, and its 4 Stripe links.
  // The booking flow (booking.js) builds every room option for 1 to 4 travelers from these.
  rooms: {
    double: {
      // per person; seats = travelers this link books
      price: 1800, seats: 2, name: "Double",
      deposit: "https://buy.stripe.com/28E9AS66s3L9bi62rX8g00b",
      full:    "https://buy.stripe.com/4gMeVc52oepN0Ds1nT8g00d",
      balance: "https://buy.stripe.com/bJecN47aw2H5gCq1nT8g002",
      plan:    "https://buy.stripe.com/8x200ifH23L94TI6Id8g005",
      soldOut: false
    },
    // Solo travelers who share a room: 1 seat in a Double, paired by us (Stripe metadata room "double", share "1")
    shared: {
      // per person; seats = travelers this link books
      price: 1800, seats: 1, name: "Shared room",
      deposit: "https://buy.stripe.com/bJe4gy2UgftR1Hw4A58g00g",
      full:    "https://buy.stripe.com/14AfZgcuQ3L93PEd6B8g00h",
      balance: "https://buy.stripe.com/aFa9AS52odlJ4TI9Up8g00i",
      plan:    "https://buy.stripe.com/5kQdR8dyU0yXcmafeJ8g00j",
      soldOut: false
    },
    single: {
      // per person; seats = travelers this link books
      price: 2250, seats: 1, name: "Single",
      deposit: "https://buy.stripe.com/28E8wOamIftRdqefeJ8g00a",
      full:    "https://buy.stripe.com/6oU3cudyU1D1ae26Id8g00e",
      balance: "https://buy.stripe.com/3cI9AS52ogxVae23w18g001",
      plan:    "https://buy.stripe.com/6oU7sKamI4Pd4TIgiN8g006",
      soldOut: false
    },
    triple: {
      // per person; seats = travelers this link books
      price: 1700, seats: 3, name: "Triple",
      deposit: "https://buy.stripe.com/bJe9ASeCY2H52LA9Up8g008",
      full:    "https://buy.stripe.com/dRm6oG9iE0yXbi63w18g00f",
      balance: "https://buy.stripe.com/dRm9AS2UgdlJ0Dsc2x8g003",
      plan:    "https://buy.stripe.com/28EeVc8eA3L985U7Mh8g009",
      soldOut: false
    },
    quad: {
      // per person; seats = travelers this link books
      price: 1650, seats: 4, name: "Quad",
      deposit: "https://buy.stripe.com/00wbJ0dyUftReui2rX8g004",
      full:    "https://buy.stripe.com/28E9ASgL681p2LA0jP8g00c",
      balance: "https://buy.stripe.com/28E14m1Qc4PdcmafeJ8g000",
      plan:    "https://buy.stripe.com/14AbJ052o95tgCqgiN8g007",
      soldOut: false
    }
  }
};
