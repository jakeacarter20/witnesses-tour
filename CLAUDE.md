# Parley Street Travel Co. website

Static website for Parley Street Travel Co., LLC, selling seats on its first tour, **The Witnesses Tour**. It launches **November 2, 2026** at parleystreettravel.com.

## How the site works

- Plain HTML, CSS and a little vanilla JS. There is no build step, framework or server. Host the folder as-is (Netlify or Cloudflare Pages).
- `index.html` is the single tour page. `thank-you.html` is where Stripe redirects after payment. `terms.html` is a **draft outline** and must be replaced with attorney-approved terms before launch.
- Booking runs on **Stripe Payment Links**: 8 links, a deposit link and a pay-in-full link for each of 4 room types. Traveler details are collected by custom fields in Stripe checkout, not by the site.
- `booking-config.js` is the only file to edit to open or close booking. It holds the deposit percentage, the balance due date, the 8 link URLs and the sold-out flags. A room with an empty link shows "Booking opens soon".
- `SETUP.md` is the owner's step-by-step guide for Stripe, hosting and launch. Keep it in sync with any changes.

## Brand (from the brand guide; do not deviate)

- Colors: Olive `#4A5530` (main and backgrounds), Cream `#EFE9DA` (light backgrounds and text on olive), Dark Olive `#33391F` (text and line work on cream), Burnt Orange `#D98A52` (the sun, on olive only), Rust `#B4592B` (the sun and small accents, on cream). Olive and cream do most of the work; keep the oranges to the sun and small details.
- Type: Cormorant Garamond semibold for the name and headlines; Jost medium and regular for labels and body text. Small labels are set in capitals with wide letter spacing. Both fonts load from Google Fonts.
- Logo: the cream logo goes on olive and the dark logo on cream. Never stretch, recolor or redraw it. `assets/logo-horizontal-cream.svg` is file 08 (horizontal, reversed) and `assets/favicon.svg` is file 11 (icon on olive) from the owner's Final Logo Kit, with only the empty margin trimmed from the viewBox. `assets/apple-touch-icon.png` is rendered from the favicon.
- Itinerary photos: `assets/itinerary/` holds one 800×1000 (4:5) photo per day, shown in an arch frame. All come from Wikimedia Commons under public domain, CC0 or CC BY-SA 4.0. The CC BY-SA photos (Days 2 and 4) legally require the credit line under the itinerary, so keep `.photo-credits` in step with any photo you swap. Only use replacements whose license allows commercial use.

## Tour facts (keep the copy consistent with these)

- Dates: April 19 to 23, 2027. It begins at 1:30 PM on April 19 at the Independence Visitors' Center, 937 W Walnut St, Independence, MO 64050, and ends in the early afternoon of April 23 after Carthage Jail. Return transportation to Kansas City is still to be confirmed.
- Hosts: The Holy Rebellion (Christian Williams and Travis Lish, @the.holy.rebellion). Only use facts the owner has confirmed or that appear on their Instagram. Do not invent backstory.
- Capacity: 50 seats on one coach. The site cannot enforce this across Stripe links; the owner tracks it and sets the sold-out flags.
- Prices per person: Double $1,800 (base), Single $2,250, Triple $1,700, Quad $1,650. Deposit 50% of the room price per person (Double $900, Single $1,125, Triple $850, Quad $825), with the other 50% due February 18, 2027. Paying in full up front is also offered. Triples and quads book the whole room in one order. Solo travelers booking a Double are paired with a roommate.
- Included: motorcoach, 4 nights' hotel, 4 breakfasts, 2 group dinners and a picnic lunch, site visits with the hosts. Not included: travel to and from the tour, other meals, the driver tip and travel insurance. Travelers must be 16 or older.
- Theme: the Book of Mormon witnesses, the men (graves of 10 of the 11 witnesses) and the women who witnessed it too (Mary Whitmer, Amanda Barnes Smith, Emma Smith, the Relief Society founders, and others).

## Business context

- Owner and planner: Jaime, the majority owner. Travis and Christian each own 10%.
- Business terms, the full itinerary with times and the cost estimates are in the owner's Word document "Counter_Offer_and_Witnesses_Tour.docx". It is not part of this site.

## Open items before launch

- A higher-resolution host photo, and the contact email hello@parleystreettravel.com set up.
- Attorney-approved terms in `terms.html`.
- The LLC, EIN, a Stripe account in the LLC's name, insurance, and seller-of-travel registration in California, Florida, Washington and Hawaii.
- All 8 live Payment Links pasted into `booking-config.js`, and a test booking made and refunded.
