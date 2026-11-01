// Tour payment rules used by the Stripe automation. Keep these in step with
// booking-config.js, terms.html and the wording on the Stripe deposit links.

export const TOUR = "witnesses-2027";

// If a depositor hasn't paid in full or started the plan by the deadline,
// the plan starts automatically and is charged on these four dates.
export const PLAN_DEADLINE = "2027-01-01";
export const AUTO_PLAN_DATES = ["2027-01-01", "2027-01-27", "2027-02-21", "2027-03-19"];

// The last plan payment, one month before the April 19 departure.
export const FINAL_PAYMENT = "2027-03-19";

// Scheduled charges run at 16:00 UTC (10 AM Central) on their date.
export const CHARGE_HOUR_UTC = 16;

// Every object the automation creates in Stripe carries this in its metadata,
// so it can be found, checked for duplicates, and undone.
export const CREATED_BY = "witnesses-webhook";

// Travelers must be this old on the first day of the tour (traveler details form).
export const TOUR_START = "2027-04-19";
export const MIN_AGE = 16;

// Checkouts left out of the "seats sold" count on the banner (and so out of the
// free Book of Mormon tally), such as the owners' own bookings. Add a Checkout
// Session ID (cs_live_...) from Stripe to leave another one out.
export const NOT_COUNTED = [
  "cs_live_a14BHM12ZbXi6qi3EBbHeNK3rjzgU2d9giqB4a5IZFNwk9TyahAuUsf5SU", // Jaime's Double deposit, Oct 31, 2026
];
