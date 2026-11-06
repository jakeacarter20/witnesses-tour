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
// seat count at /api/seats), such as the owners' own bookings. Add a Checkout
// Session ID (cs_live_...) from Stripe to leave another one out.
export const NOT_COUNTED = [
  "cs_live_a14BHM12ZbXi6qi3EBbHeNK3rjzgU2d9giqB4a5IZFNwk9TyahAuUsf5SU", // Jaime's Double deposit, Oct 31, 2026
];

// Welcome emails (api/send-welcomes.js runs once a day). Each booking's travelers
// get one welcome email this many days after purchase, sent through Resend.
export const WELCOME_DELAY_DAYS = 2;
export const WELCOME_FROM = "Parley Street Travel Co. <hello@parleystreettravel.com>";
export const WELCOME_REPLY_TO = "hello@parleystreettravel.com";
// Bookings made before this date never get the automatic welcome email.
export const WELCOME_START = "2026-11-01";
