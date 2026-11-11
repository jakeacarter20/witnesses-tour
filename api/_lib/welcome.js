// Welcome emails, sent once a day by api/send-welcomes.js (a Vercel cron job).
// Every paid booking (deposit or pay in full) gets a welcome email two days after
// purchase: one to the person who booked, and one to each traveler who gave an
// email on the traveler details form. What was sent is recorded on the booking's
// Customer in Stripe (welcome_sent_to, welcome_sent_at), so nobody gets it twice.
// Kept separate from the HTTP handler so it can be tested (see test/welcome.test.js).

import { TOUR, NOT_COUNTED, WELCOME_DELAY_DAYS, WELCOME_START, COUPON_ENDS, WELCOME_VIDEO, WELCOME_VIDEO_IMAGE, WELCOME_FORM } from "./config.js";

const DAY = 86400;
const SITE = "https://parleystreettravel.com";
const ROOMS = { double: "Double", shared: "Shared Double", single: "Single", triple: "Triple", quad: "Quad" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

// The letter itself. Returns { subject, html, text }.
export function buildWelcome({ name, room, kind, travelers, detailsUrl, coupon, seats = 1 }) {
  const roomName = ROOMS[room] || room;
  const subject = "Welcome to The Witnesses Tour";
  const steps = [];
  if (detailsUrl) {
    steps.push({ title: "Add your traveler details", text: "We still need each traveler's name, date of birth and contact details for hotel rooms, the coach list and emergencies.", link: detailsUrl, label: "Add traveler details" });
  }
  const aboutYou = "Help us plan a trip that fits you: allergies, accessibility needs, your favorite road trip snack and drink, and more. It only takes a couple of minutes.";
  steps.push(seats > 1
    ? { title: "Tell us about you", text: `${aboutYou} Everyone in your booking fills this out separately. If someone in your group didn't get this email, send them this link:`, link: WELCOME_FORM, label: "Tell us about you", showLink: true }
    : { title: "Tell us about you", text: aboutYou, link: WELCOME_FORM, label: "Tell us about you" });
  steps.push({ title: "Get travel insurance", text: "We strongly recommend it. Buy within 14 days of your first payment to keep coverage for pre-existing conditions and the option to cancel for any reason.", link: "https://www.squaremouth.com/", label: "Compare plans on Squaremouth" });
  if (kind === "deposit") {
    steps.push({ title: "Pay the rest by January 1, 2027", text: "Pay the rest in full or start your 4-payment plan by January 1, 2027. If you haven't by then, your plan starts automatically on January 1, charged to the payment method you booked with.", link: `${SITE}/#plan`, label: "Pay the rest or start the plan" });
  }
  if (coupon) {
    const offer = coupon.books === 1
      ? `Because you booked before Thanksgiving, your booking includes a free customizable Book of Mormon from The Holy Rebellion. Use code ${coupon.code} at custombookofmormon.com.`
      : `Because you booked before Thanksgiving, your booking includes ${coupon.books} free customizable Books of Mormon from The Holy Rebellion, one per traveler. Use code ${coupon.code} at custombookofmormon.com. Everyone in your booking uses the same code.`;
    steps.push({ title: "Get your free Book of Mormon", text: offer, link: "https://custombookofmormon.com", label: "Customize your book" });
  }

  const who = travelers && travelers.length ? travelers : [name];
  const intro = `Welcome to The Witnesses Tour! We're so glad you're coming with us April 19–23, 2027, to stand where the witnesses of the Book of Mormon lived, testified and are buried.`;
  const video = "Travis from The Holy Rebellion has a quick thank-you for you:";
  const booking = `Your booking: ${roomName} room for ${who.length} traveler${who.length === 1 ? "" : "s"}: ${who.join(", ")}.`;
  const travel = "Fly into Kansas City International (MCI) by late morning on Monday, April 19. We gather at 1:30 PM at the Independence Visitors' Center, 937 W Walnut St, Independence, MO 64050. The tour ends after the closing devotional at Carthage Jail, about 12:30 PM on Friday, April 23. Ride the coach back to Kansas City (arriving at MCI about 6:15 PM), or leave from Carthage on your own. We'll ask which you prefer before the trip.";
  const next = "About a month before the trip, you'll get your traveler packet with final times, hotels and roommate details, along with the traveler waiver for each traveler to sign.";

  const text = [
    `Hi ${firstName(name)},`, "", intro, "", video, WELCOME_VIDEO, "", booking, "", "WHAT TO DO NOW", "",
    ...steps.flatMap((s, i) => [`${i + 1}. ${s.title}`, `   ${s.text}`, ...(s.link ? [`   ${s.link}`] : []), ""]),
    "PLAN YOUR TRAVEL", "", travel, "", next, "",
    "Questions? Just reply to this email.", "",
    "See you in Independence,", "The Parley Street Travel Co. team", "",
    `Terms and cancellation policy: ${SITE}/terms.html`,
  ].join("\n");

  const p = (t, extra = "") => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#2A2E1A;${extra}">${t}</p>`;
  const h = (t) => `<h2 style="margin:28px 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:#33391F;">${t}</h2>`;
  const stepHtml = steps.map((s, i) => `
    <tr><td style="padding:0 0 18px;vertical-align:top;width:34px;font-family:Georgia,serif;font-size:22px;font-weight:600;color:#B4592B;">${i + 1}</td>
    <td style="padding:0 0 18px;vertical-align:top;">
      <div style="font-size:16px;font-weight:600;color:#2A2E1A;margin-bottom:4px;">${esc(s.title)}</div>
      <div style="font-size:15px;line-height:1.55;color:#5B5F48;">${esc(s.text)}</div>
      ${s.showLink ? `<div style="font-size:15px;line-height:1.55;margin-top:4px;"><a href="${esc(s.link)}" style="color:#B4592B;">${esc(s.link.replace("https://", ""))}</a></div>` : ""}
      ${s.link ? `<a href="${esc(s.link)}" style="display:inline-block;margin-top:10px;padding:10px 18px;background:#33391F;color:#EFE9DA;text-decoration:none;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:0.04em;">${esc(s.label)}</a>` : ""}
    </td></tr>`).join("");

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#EFE9DA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE9DA;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#F7F3E9;border:1px solid #D6CDB6;border-radius:6px;font-family:'Helvetica Neue',Arial,sans-serif;">
<tr><td style="background:#4A5530;padding:22px 28px;border-radius:6px 6px 0 0;">
  <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:0.3em;color:#EFE9DA;">PARLEY STREET TRAVEL CO.</div>
  <div style="font-family:Georgia,serif;font-size:28px;color:#EFE9DA;margin-top:6px;">Welcome to The Witnesses Tour</div>
</td></tr>
<tr><td style="padding:28px;">
  ${p(`Hi ${esc(firstName(name))},`)}
  ${p(esc(intro))}
  ${p(esc(video), "margin-bottom:10px;")}
  <a href="${WELCOME_VIDEO}" style="display:block;margin:0 0 10px;"><img src="${WELCOME_VIDEO_IMAGE}" alt="Watch the thank-you video from Travis of The Holy Rebellion" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:0;border-radius:4px;"></a>
  <a href="${WELCOME_VIDEO}" style="display:inline-block;margin:0 0 20px;padding:10px 18px;background:#33391F;color:#EFE9DA;text-decoration:none;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:0.04em;">Watch the video</a>
  ${p(esc(booking), "padding:14px 16px;background:#ffffff;border:1px solid #D6CDB6;border-radius:4px;")}
  ${h("What to do now")}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stepHtml}</table>
  ${h("Plan your travel")}
  ${p(esc(travel))}
  ${p(esc(next))}
  ${p("Questions? Just reply to this email.")}
  ${p("See you in Independence,<br>The Parley Street Travel Co. team")}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #D6CDB6;font-size:12px;line-height:1.5;color:#5B5F48;">
  Parley Street Travel Co. · <a href="${SITE}" style="color:#B4592B;">parleystreettravel.com</a> · <a href="${SITE}/terms.html" style="color:#B4592B;">Terms &amp; cancellation policy</a> · <a href="${SITE}/privacy.html" style="color:#B4592B;">Privacy policy</a>
</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, html, text };
}

function startOf(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 1000;
}

// Sends any welcome emails that are due, including to travelers whose emails were added
// after the first send. `send({ to, subject, html, text, idempotencyKey })` does the actual
// sending. Returns what happened, for the logs.
export async function sendWelcomes(stripe, { now, send, notify, couponCode }) {
  const results = [];
  const sessions = stripe.checkout.sessions.list({
    status: "complete",
    created: { gte: startOf(WELCOME_START), lte: now - WELCOME_DELAY_DAYS * DAY },
    limit: 100,
  });
  for await (const session of sessions) {
    const m = session.metadata || {};
    if (m.tour !== TOUR || (m.kind !== "deposit" && m.kind !== "full")) continue;
    if (session.payment_status !== "paid" || NOT_COUNTED.includes(session.id) || !session.customer) continue;

    const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
    const customer = await stripe.customers.retrieve(customerId);
    const saved = customer.metadata || {};

    const buyer = session.customer_details || {};
    const names = [];
    const recipients = [];
    if (buyer.email) recipients.push({ email: buyer.email, name: buyer.name, isBuyer: true });
    for (let n = 1; n <= 4; n++) {
      const name = saved[`traveler_${n}_name`];
      const email = saved[`traveler_${n}_email`];
      if (name) names.push(name);
      if (email) recipients.push({ email, name, isBuyer: false });
    }
    if (!names.length && buyer.name) names.push(buyer.name);

    // One email per address, the booker's version first
    const seen = new Set((saved.welcome_sent_to || "").split(",").filter(Boolean));
    const unique = [];
    for (const r of recipients) {
      const key = r.email.trim().toLowerCase();
      if (unique.some((u) => u.key === key)) continue;
      unique.push({ ...r, key });
    }
    if (!unique.length) {
      await notify("Booking has no email address for a welcome email; send it by hand", { session: session.id });
      continue;
    }

    const toSend = unique.filter((r) => !seen.has(r.key));
    if (saved.welcome_sent_at) {
      // Already welcomed: only send to travelers added since. Stripe caps welcome_sent_to at
      // 500 characters, so a nearly full list may have lost an address; don't risk a repeat.
      if (!toSend.length || (saved.welcome_sent_to || "").length >= 450) continue;
    }

    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });
    const seats = Math.max(1, items.data.reduce((n, item) => n + (item.quantity || 0), 0));

    // Bookings made before Thanksgiving get the free book coupon, one book per seat
    let coupon = null;
    if (session.created * 1000 < new Date(COUPON_ENDS).getTime()) {
      if (couponCode) {
        coupon = { code: couponCode, books: seats };
      } else {
        await notify("BOOK_COUPON_CODE isn't set, so this welcome email went out without the free book coupon; send it by hand", { session: session.id });
      }
    }

    const detailsUrl = saved.details_saved_at ? null : `${SITE}/thank-you.html?session_id=${session.id}`;
    const sentTo = [];
    let failed = false;
    for (const r of toSend) {
      const letter = buildWelcome({
        name: r.name || buyer.name,
        room: m.share ? "shared" : m.room, // solo travelers sharing a room book 1 seat in a Double
        kind: m.kind,
        travelers: names,
        detailsUrl: r.isBuyer ? detailsUrl : null, // the details link opens everyone's details, so only the booker gets it
        coupon,
        seats,
      });
      try {
        await send({ to: r.email, ...letter, idempotencyKey: `welcome-${session.id}-${r.key}` });
        seen.add(r.key);
        sentTo.push(r.key);
        await stripe.customers.update(customerId, { metadata: { welcome_sent_to: [...seen].join(",").slice(0, 500) } });
      } catch (err) {
        failed = true;
        await notify("Welcome email failed to send; it will be retried tomorrow", { session: session.id, to: r.email, error: err.message });
      }
    }
    if (!failed && !saved.welcome_sent_at) {
      await stripe.customers.update(customerId, { metadata: { welcome_sent_at: new Date(now * 1000).toISOString() } });
    }
    results.push({ session: session.id, sentTo, complete: !failed });
  }
  return results;
}

// Sends one email through Resend (https://resend.com).
export function resendSender({ apiKey, from, replyTo }) {
  return async ({ to, subject, html, text, idempotencyKey }) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, html, text }),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
    return response.json();
  };
}
