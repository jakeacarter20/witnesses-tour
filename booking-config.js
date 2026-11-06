/*
  PARLEY STREET TRAVEL CO. — BOOKING SETTINGS
  This is the only file you need to edit to open, update or close booking.

  1. Create the 16 Stripe Payment Links described in SETUP.md (deposit, full, balance and plan for each room).
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

  promoEnds: "2026-11-26T00:00:00-06:00", // free Book of Mormon offer: the banner and FAQ entry disappear at this time (start of Thanksgiving, Central)

  tourSoldOut: false,

  rooms: {
    double: {
      deposit: "https://buy.stripe.com/28E9AS66s3L9bi62rX8g00b",
      full:    "https://buy.stripe.com/4gMeVc52oepN0Ds1nT8g00d",
      balance: "https://buy.stripe.com/bJecN47aw2H5gCq1nT8g002",
      plan:    "https://buy.stripe.com/8x200ifH23L94TI6Id8g005",
      soldOut: false
    },
    single: {
      deposit: "https://buy.stripe.com/28E8wOamIftRdqefeJ8g00a",
      full:    "https://buy.stripe.com/6oU3cudyU1D1ae26Id8g00e",
      balance: "https://buy.stripe.com/3cI9AS52ogxVae23w18g001",
      plan:    "https://buy.stripe.com/6oU7sKamI4Pd4TIgiN8g006",
      soldOut: false
    },
    triple: {
      deposit: "https://buy.stripe.com/bJe9ASeCY2H52LA9Up8g008",
      full:    "https://buy.stripe.com/dRm6oG9iE0yXbi63w18g00f",
      balance: "https://buy.stripe.com/dRm9AS2UgdlJ0Dsc2x8g003",
      plan:    "https://buy.stripe.com/28EeVc8eA3L985U7Mh8g009",
      soldOut: false
    },
    quad: {
      deposit: "https://buy.stripe.com/00wbJ0dyUftReui2rX8g004",
      full:    "https://buy.stripe.com/28E9ASgL681p2LA0jP8g00c",
      balance: "https://buy.stripe.com/28E14m1Qc4PdcmafeJ8g000",
      plan:    "https://buy.stripe.com/14AbJ052o95tgCqgiN8g007",
      soldOut: false
    }
  }
};
