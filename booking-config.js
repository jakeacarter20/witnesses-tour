/*
  PARLEY STREET TRAVEL CO. — BOOKING SETTINGS
  This is the only file you need to edit to open, update or close booking.

  1. Create the 8 Stripe Payment Links described in SETUP.md.
  2. Paste each link between the quotes below.
  3. Upload the site. Any room whose link is still empty shows "Booking opens soon".

  To close a room type when it fills, set its soldOut to true.
  To close the whole tour, set tourSoldOut to true.
*/
window.PARLEY_BOOKING = {
  depositPercent: 50,                    // percent of the room price, per traveler
  balanceDueDate: "February 18, 2027",   // the rest is due by this date; send balance invoices before it
  tourSoldOut: false,

  rooms: {
    double: { deposit: "", full: "", soldOut: false },
    single: { deposit: "", full: "", soldOut: false },
    triple: { deposit: "", full: "", soldOut: false },
    quad:   { deposit: "", full: "", soldOut: false }
  }
};
