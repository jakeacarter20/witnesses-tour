/*
  PARLEY STREET TRAVEL CO. — BOOKING SETTINGS
  This is the only file you need to edit to open, update or close booking.

  1. Create the 16 Stripe Payment Links described in SETUP.md (deposit, full, balance and plan for each room).
  2. Paste each link between the quotes below.
  3. Upload the site. Any room whose link is still empty shows "Booking opens soon".

  THE LINKS BELOW ARE STRIPE TEST-MODE LINKS (buy.stripe.com/test_...). They take only
  Stripe test cards, never real money. Replace all 16 with live-mode links before launch.

  As seats sell, update seatsSold so the banner's tally stays current.
  To close a room type when it fills, set its soldOut to true.
  To close the whole tour, set tourSoldOut to true.
*/
window.PARLEY_BOOKING = {
  depositPerPerson: 250,                 // dollars, per traveler, nonrefundable
  paymentDeadline: "January 1, 2027",    // pay in full or start the 4-payment plan by this date
  finalPaymentDate: "March 19, 2027",    // last plan payment, one month before the April 19 departure
  autoPlanDates: "January 1, January 27, February 21 and March 19, 2027", // charge dates if the plan starts automatically

  seatsSold: 0,                          // fallback seat count for the banner; on Vercel the live count from Stripe is used instead
  freeBookSeats: 25,                     // the first this-many seats get a free customizable Book of Mormon

  tourSoldOut: false,

  rooms: {
    double: {
      deposit: "https://buy.stripe.com/test_dRmeVfaVT4tN5h4aAp2go0c",
      full:    "https://buy.stripe.com/test_7sY3cx2pnd0jcJwbEt2go01",
      balance: "https://buy.stripe.com/test_6oUeVfbZX2lFbFsdMB2go0k",
      plan:    "https://buy.stripe.com/test_8x23cx1ljbWf10OcIx2go0g",
      soldOut: false
    },
    single: {
      deposit: "https://buy.stripe.com/test_7sYfZj0hfd0j7pcgYN2go0d",
      full:    "https://buy.stripe.com/test_4gMcN7d41bWf10OaAp2go03",
      balance: "https://buy.stripe.com/test_00w9AV3trd0j6l8fUJ2go0l",
      plan:    "https://buy.stripe.com/test_4gMcN74xv3pJ5h4dMB2go0h",
      soldOut: false
    },
    triple: {
      deposit: "https://buy.stripe.com/test_7sYdRbggd8K324SdMB2go0e",
      full:    "https://buy.stripe.com/test_cNi3cx8NLd0j8tgbEt2go05",
      balance: "https://buy.stripe.com/test_dRm3cxggdd0j9xk5g52go0m",
      plan:    "https://buy.stripe.com/test_28EdRb3tr5xRbFs7od2go0i",
      soldOut: false
    },
    quad: {
      deposit: "https://buy.stripe.com/test_bJe5kFggd9O76l8fUJ2go0f",
      full:    "https://buy.stripe.com/test_28E7sN6FD7FZ24SeQF2go07",
      balance: "https://buy.stripe.com/test_14A5kF8NLbWfbFs5g52go0n",
      plan:    "https://buy.stripe.com/test_bJe9AV0hf6BVgZM7od2go0j",
      soldOut: false
    }
  }
};
