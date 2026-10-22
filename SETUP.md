# Parley Street Travel Co. website: setup and launch guide

Launch date: **November 2, 2026**

The site is plain HTML. Booking runs through **Stripe Payment Links**, so there is no server, database, or plugin to maintain. Traveler details are collected on Stripe's checkout page and show up in your Stripe dashboard with each payment.

## What's in the folder

| File | What it is |
|---|---|
| `index.html` | The tour page: title over a vintage engraving, about, what's included, itinerary, meals, hosts, where we'll meet, room choice and booking, FAQ |
| `thank-you.html` | Where Stripe sends people after they pay |
| `terms.html` | Terms and cancellation policy. **Draft outline only, replace before launch** |
| `booking-config.js` | **The only file you edit to open or close booking.** Paste your Stripe links here |
| `styles.css` | Brand colors and fonts from the brand guide |
| `assets/` | Logo and favicon (from the Final Logo Kit SVGs), header engraving, itinerary and meeting-place photos, host photo, share image. Photo credits are in the page footer |

Until a room's links are pasted into `booking-config.js`, its button reads "Booking opens soon", so you can put the site live before November 2 and switch booking on that morning.

## 1. Set up Stripe

1. Create the Stripe account **in the LLC's name**, with the LLC's EIN and business bank account.
2. Turn on bank payments: **Settings → Payment methods → ACH Direct Debit (US bank account)**. Bank transfers cost 0.8%, capped at $5, against about $52 for a card payment on $1,800.
3. Build and test everything in **Test mode** first, then repeat in live mode.

## 2. Create 8 Payment Links

Go to **Payment Links → New**. Each room type needs two links, one for the deposit and one for paying in full.

| Link | Price per traveler | Quantity |
|---|---|---|
| Double, deposit (50%) | $900 | Adjustable, 1 to 2 |
| Double, full | $1,800 | Adjustable, 1 to 2 |
| Single, deposit (50%) | $1,125 | Fixed at 1 |
| Single, full | $2,250 | Fixed at 1 |
| Triple, deposit (50%) | $850 | Fixed at 3 |
| Triple, full | $1,700 | Fixed at 3 |
| Quad, deposit (50%) | $825 | Fixed at 4 |
| Quad, full | $1,650 | Fixed at 4 |

Deposits are 50% of the room price, set by `depositPercent` in `booking-config.js`. If you ever change that number, change the deposit link prices in Stripe to match, because the site only displays the amount; Stripe charges what the link says.

Name each product clearly, for example "The Witnesses Tour, Double Room, Deposit", so payments are easy to sort.

**On every link, set:**

- **Collect:** customer name, email, and phone number.
- **Custom fields** (Stripe allows 3, all text fields, all required):
  1. "Full names of every traveler in this booking"
  2. "Who are you sharing a room with? Name(s), or write Pair me". Use this one on Double, Triple and Quad. For Single, use "Date of birth for each traveler (must be 16+)" instead, or another field you need.
  3. "Emergency contact name and phone"
- **After payment:** "Don't show confirmation page", redirect to `https://parleystreettravel.com/thank-you.html`.
- **Payment methods:** card and US bank account.
- **Terms:** if Stripe offers "Require customers to accept your terms of service", turn it on and point it to `https://parleystreettravel.com/terms.html`.

Then paste each link's URL into the matching spot in `booking-config.js`.

## 3. Keep to 50 seats

Stripe can't share one seat limit across 8 links, so:

- Check the seat count in Stripe as bookings come in. Each Payment Link's payments page shows its quantity sold.
- As a backstop, if your Payment Links show an option to **limit the number of payments**, set a cap on each link.
- When a room type or the tour fills, set `soldOut: true` for that room, or `tourSoldOut: true`, in `booking-config.js` and re-upload. Also deactivate the links in Stripe.

## 4. Collect balances

For each traveler who paid a deposit, send a **Stripe Invoice** for the remaining balance, due February 18, 2027 (the other 50%: Double $900, Single $1,125, Triple $850, Quad $825 per person). Allow card and bank payment on the invoice.

## 5. Put the site online

1. Buy `parleystreettravel.com` (and `parleystreettours.com` to forward to it).
2. Host the folder for free on **Netlify** (drag and drop the folder at app.netlify.com/drop) or **Cloudflare Pages**.
3. Connect the domain in the host's domain settings.
4. Set up the email address `hello@parleystreettravel.com`, or replace it in `index.html`, `thank-you.html` and `terms.html`.

## Before November 2: checklist

- [ ] LLC approved, EIN issued, business bank account open
- [ ] Insurance in place: general liability and errors and omissions
- [ ] Seller-of-travel registration in California, Florida, Washington and Hawaii, or a plan not to sell to residents of those states yet
- [ ] `terms.html` replaced with attorney-approved terms
- [x] Real logo files swapped into `assets/` (SVG or transparent PNG, cream version for the olive header and footer)
- [ ] Higher-resolution host photo from Travis and Christian swapped into `assets/hosts.jpg`
- [ ] Day 5 ending confirmed: the site says the tour concludes at Carthage Jail in the early afternoon. Add return transportation details if the coach goes back to Kansas City.
- [ ] Group reservations requested at the Independence Visitors' Center and the Nauvoo and Carthage sites
- [ ] All 8 Payment Links made in live mode and pasted into `booking-config.js`
- [ ] One real test booking made and refunded
- [ ] The Eventbrite draft left unpublished, or deleted
