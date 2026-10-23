# Parley Street Travel Co. website: setup and launch guide

Launch date: **November 2, 2026**

The site is plain HTML, hosted on **Vercel** from the GitHub repository. Booking runs through **Stripe Payment Links**; traveler details are collected on Stripe's checkout page and show up in your Stripe dashboard with each payment. Two small Vercel functions in `api/` do the rest: one schedules payment plan charges after every checkout, the other counts seats for the free Book of Mormon banner. There is no database or plugin to maintain.

## What's in the folder

| File | What it is |
|---|---|
| `index.html` | The tour page: title over a vintage engraving, about, what's included, itinerary, meals, hosts, where we'll meet, room choice and booking, FAQ |
| `thank-you.html` | Where Stripe sends people after they pay |
| `terms.html` | Terms and cancellation policy. **Draft outline only, replace before launch** |
| `booking-config.js` | **The only file you edit to open or close booking.** Paste your Stripe links here |
| `styles.css` | Brand colors and fonts from the brand guide |
| `api/` | The Vercel functions: `stripe-webhook.js` (schedules plan charges), `seats.js` (banner seat count), and `_lib/` (the plan rules and dates in `_lib/config.js`) |
| `test/` | Automated checks for the plan rules. Run `npm test` |
| `assets/` | Logo and favicon (from the Final Logo Kit SVGs), header engraving, itinerary and meeting-place photos, host photo, share image. Photo credits are in the page footer |

Until a room's links are pasted into `booking-config.js`, its button reads "Booking opens soon", so you can put the site live before November 2 and switch booking on that morning.

## 1. Set up Stripe

1. Create the Stripe account **in the LLC's name**, with the LLC's EIN and business bank account.
2. Turn on bank payments: **Settings → Payment methods → ACH Direct Debit (US bank account)**. Bank transfers cost 0.8%, capped at $5, against about $52 for a card payment on $1,800.
3. Build and test everything in **Test mode** first, then repeat in live mode.

## 2. Payment Links (16)

**Test mode is built.** On October 23, 2026 the products, prices and links below were created in the Stripe sandbox "Parley Street Travel Co sandbox", and their test URLs are in `booking-config.js`. They take only Stripe test cards. Before launch, recreate them in live mode with the same settings and paste the live URLs into `booking-config.js`.

Each room has one product ("The Witnesses Tour, Double Room" and so on) with four prices: the $250 nonrefundable deposit, the full price, the rest after the deposit ("balance"), and one plan installment. (The deposit was $150 at first; on October 23, 2026 it changed to $250, so new deposit and plan prices and links were made and the $150 ones were deactivated.)

| Link | Price per traveler | Quantity |
|---|---|---|
| Double: deposit / full / balance / plan | $250 / $1,800 / $1,550 / $387.50 | Adjustable, 1 to 2 |
| Single: deposit / full / balance / plan | $250 / $2,250 / $2,000 / $500 | Fixed at 1 |
| Triple: deposit / full / balance / plan | $250 / $1,700 / $1,450 / $362.50 | Fixed at 3 |
| Quad: deposit / full / balance / plan | $250 / $1,650 / $1,400 / $350 | Fixed at 4 |

Deposits are set by `depositPerPerson` in `booking-config.js`. If you change that number, change the deposit prices in Stripe to match: the site only displays the amount, and Stripe charges what the link says.

**Every link:**

- Collects name, email and phone, creates a Stripe customer, and emails a receipt invoice.
- Accepts card and US bank account.
- Redirects to the thank-you page after payment (the GitHub Pages address for now; switch it to `https://parleystreettravel.com/thank-you.html` once the domain is connected).
- Shows a note above the Pay button: deposit links say the deposit is nonrefundable and give the January 1, 2027 deadline.

**Custom fields:** Double asks for every traveler's full name, who they're sharing a room with (or "Pair me"), and an emergency contact. Single, Triple and Quad ask for the travelers' full names, each traveler's date of birth (must be 16 or older), and an emergency contact. Plan links ask only for the name on the deposit booking.

**Terms checkbox:** not turned on yet. It needs a terms URL in Stripe's public business settings, and `terms.html` is still a draft. Turn it on once the attorney-approved terms are live.

**Deposit links save the payment method and require consent.** Each deposit checkout saves the card or bank account and shows a required checkbox: the traveler agrees that if they haven't paid the rest in full or started the plan by January 1, 2027, the plan starts automatically and the rest is charged in 4 equal payments on January 1, January 27, February 21 and March 19, 2027. The checkbox links to `terms.html`. The tour page also has its own acknowledgement box that must be checked before the deposit buttons work. Balance links ("pay the rest in full") are on the tour page under "Already paid your deposit?".

## 2b. How the payment plan works

Every checkout sends Stripe a webhook to `https://parleystreettravel.com/api/stripe-webhook`, and the function schedules or cancels charges on its own:

| Checkout | What the automation does |
|---|---|
| Deposit | Schedules the automatic plan on the saved card or bank account: 4 charges of the room's plan installment (same quantity as the deposit) on January 1, January 27, February 21 and March 19, 2027 |
| Start the plan (plan link) | Charges payment 1 at checkout. Deletes that traveler's 4 automatic-plan charges, and schedules payments 2 to 4 evenly from today to March 19, 2027 |
| Pay the rest in full (balance link) | Deletes every scheduled plan charge for that traveler's email |
| Pay in full | Nothing to schedule |

The scheduled charges are Stripe invoices in the **Invoices** tab, as drafts with a scheduled charge date, until the day they're charged. Bank payments take a few days to clear; the automation waits until the money arrives.

**Alerts.** Anything it can't settle on its own is written to the Vercel function log and, if you set up email alerts (step 5), emailed to you:

- A bank payment failed.
- A deposit was paid after January 1, 2027, so no automatic plan was scheduled.
- A plan was started too close to March 19 to space 3 more payments.
- A balance was paid but no scheduled charges were found for that email (for example, the traveler used a different email), or it was paid after the plan had started, so plan payment 1 may need refunding.
- The card wasn't saved, or anything else went wrong. Stripe retries a failed webhook for up to 3 days, and the scheduling is safe to repeat.

The rules and dates live in `api/_lib/config.js` and `api/_lib/plan.js`; `npm test` checks them against a fake Stripe account.

**To schedule charges by hand** (an alert asked you to, or the automation isn't set up yet), in the Stripe Dashboard:

1. Open the traveler's payment and click through to the customer (it has the saved card).
2. Create an invoice for that customer with the room's **payment plan installment** price and the same quantity as their payment.
3. Set it to **charge the customer's payment method on file automatically**, pick the saved card or bank account, and turn on **Schedule charge date** for the payment date.
4. Repeat for the other payments. You can also ask Claude to do this through the Stripe connector.

This was tested in test mode on October 23, 2026, first by hand in the Stripe sandbox (a $250 Double deposit, then a plan started the same day with payments 2 to 4 of $387.50 scheduled for December 11, 2026, January 29, 2027 and March 19, 2027; and a Triple deposit through the consent checkbox with its 4 automatic charges of $1,087.50), then with the automated checks in `test/`. The deployed webhook still needs a test booking in the sandbox (step 5).

Two things to know: each checkout creates its own Stripe customer, so one traveler's deposit and plan show up under two customer records with the same email (the automation matches them by email). And Stripe may offer Klarna at checkout through Link even though the links only list card and bank account; turn Klarna off under Settings, Payment methods if you don't want it.

## 3. Keep to 50 seats

Stripe can't share one seat limit across the links, so:

- The free Book of Mormon banner counts itself: `api/seats.js` adds up paid deposit and pay-in-full seats in Stripe, refreshed every 2 minutes. It doesn't subtract refunds; if you refund a seat, tell Claude to adjust the count. `seatsSold` in `booking-config.js` is only the fallback for when that count can't be reached.
- Check the seat count in Stripe as bookings come in. Each Payment Link's payments page shows its quantity sold.
- As a backstop, if your Payment Links show an option to **limit the number of payments**, set a cap on each link.
- When a room type or the tour fills, set `soldOut: true` for that room, or `tourSoldOut: true`, in `booking-config.js` and re-upload. Also deactivate the links in Stripe.

## 4. Collect balances

Travelers who paid the $250 deposit must, by **January 1, 2027**, either pay the rest in full or start a payment plan of 4 installments. The rest per person is Double $1,550, Single $2,000, Triple $1,450, Quad $1,400. The plan splits the rest into 4 equal payments (Double $387.50, Single $500, Triple $362.50, Quad $350 per person), spaced evenly from the day the traveler starts the plan to March 19, 2027, one month before departure, and charged automatically to their saved card or bank account. Allow card and bank payment.

## 5. Put the site online (Vercel)

The domain was bought through Vercel. Vercel hosts the site straight from the GitHub repository and redeploys whenever a change is pushed.

1. **Import the repository.** In Vercel: **Add New → Project**, pick `jakeacarter20/witnesses-tour`, leave every build setting at its default (Framework Preset "Other", no build command), and deploy.
2. **Connect the domain.** In the project: **Settings → Domains**, add `parleystreettravel.com` (and `www.parleystreettravel.com`, set to redirect to it). Because Vercel sold the domain, the DNS is set up for you.
3. **Make a restricted Stripe key.** In Stripe, start in the **sandbox**: **Developers → API keys → Create restricted key**, named "Witnesses Tour website". Give it **Read** on Checkout Sessions, PaymentIntents, Charges, Customers and Prices, and **Write** on Invoices and Invoice items. Leave everything else at None.
4. **Add the webhook.** In Stripe, still in the sandbox: **Developers → Webhooks → Add destination**. Endpoint URL `https://parleystreettravel.com/api/stripe-webhook`; events `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`. After saving, reveal its **Signing secret** (starts with `whsec_`).
5. **Paste the secrets into Vercel**, never into the code or a chat: **Settings → Environment Variables**, for Production:
   - `STRIPE_SECRET_KEY`: the restricted key (starts with `rk_test_` in the sandbox, `rk_live_` in live mode)
   - `STRIPE_WEBHOOK_SECRET`: the signing secret
   - Optional email alerts: `RESEND_API_KEY` (from a free resend.com account) and `ALERT_EMAIL` (where alerts go). Without these, alerts are only in Vercel's **Logs** tab.

   Then **Deployments → Redeploy** so the function picks them up.
6. **Test it.** Make a test deposit on the live site with Stripe's test card 4242 4242 4242 4242. Within a minute the sandbox customer should have 4 scheduled invoices, and the banner should read "2 of 25 claimed" (or however many seats you booked). Then try a balance link and check the 4 are deleted.
7. **Go live.** Repeat steps 3 and 4 in live mode, replace both values in Vercel with the live ones, redeploy, paste the live Payment Links into `booking-config.js`, and switch every link's thank-you redirect to `https://parleystreettravel.com/thank-you.html`.
8. **Turn off GitHub Pages** (repository **Settings → Pages → Source: None**) so there's only one copy of the site. The automation and live banner only run on Vercel.
9. Set up the email address `hello@parleystreettravel.com`, or replace it in `index.html`, `thank-you.html` and `terms.html`.

## Before November 2: checklist

- [ ] LLC approved, EIN issued, business bank account open
- [ ] Insurance in place: general liability and errors and omissions
- [ ] Seller-of-travel registration in California, Florida, Washington and Hawaii, or a plan not to sell to residents of those states yet
- [ ] `terms.html` replaced with attorney-approved terms
- [x] Real logo files swapped into `assets/` (SVG or transparent PNG, cream version for the olive header and footer)
- [ ] Higher-resolution host photo from Travis and Christian swapped into `assets/hosts.jpg`
- [ ] Day 5 ending confirmed: the site says the tour concludes at Carthage Jail in the early afternoon. Add return transportation details if the coach goes back to Kansas City.
- [ ] Group reservations requested at the Independence Visitors' Center and the Nauvoo and Carthage sites
- [ ] Site on Vercel at parleystreettravel.com, with the Stripe webhook and secrets set up and a sandbox test booking checked
- [ ] All 16 Payment Links made in live mode and pasted into `booking-config.js`, and the webhook switched to live mode
- [ ] One real test booking made and refunded
- [ ] The Eventbrite draft left unpublished, or deleted
