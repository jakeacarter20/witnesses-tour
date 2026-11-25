/*
  Parley Street Travel Co. — "Pay off your trip" page (pay.html)
  Reached from the link in a traveler's welcome email (?session_id=<their deposit
  checkout>; the page takes it out of the address before analytics loads). Shows what's
  left on the payment plan and charges it all now through /api/pay-off.
*/
(function () {
  var box = document.getElementById("payoff");
  if (!box) return;
  var sessionId = window.parleyBookingSession || new URLSearchParams(location.search).get("session_id");
  if (!sessionId) { try { sessionId = sessionStorage.getItem("parleyBookingSession"); } catch (e) {} }

  var money = function (n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  var esc = function (s) { var d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; };
  var day = function (ymd) {
    if (!ymd) return "";
    var p = ymd.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  };
  function show(html) { box.innerHTML = html; }

  if (!sessionId) {
    show('<p class="payoff-status">Open this page from the "Pay off your trip" link in your welcome email, or call or email us and we\'ll help.</p>');
    return;
  }

  function render(data) {
    if (data.paidInFull) {
      show('<h2>You\'re all paid up</h2><p>There\'s nothing left to pay on this booking. Thank you!</p>');
      return;
    }
    var rows = data.charges.map(function (c) {
      return "<li><span>Payment " + esc(c.installment) + " of 4" + (c.date ? ", " + esc(day(c.date)) : "") + "</span><b>" + money(c.amount) + "</b></li>";
    }).join("");
    show(
      "<h2>" + (data.name ? esc(data.name.split(" ")[0]) + ", here's" : "Here's") + " what's left</h2>" +
      '<ul class="payoff-list">' + rows + "</ul>" +
      '<p class="payoff-total">Remaining balance <b>' + money(data.remaining) + "</b></p>" +
      '<label class="payoff-confirm"><input type="checkbox" id="payoff-ok"> <span>Charge ' + money(data.remaining) + " now to the card or bank account I booked with. My scheduled payments above will be canceled.</span></label>" +
      '<button type="button" class="btn btn-dark payoff-go" disabled>Pay ' + money(data.remaining) + " now</button>" +
      '<p class="payoff-status" role="status"></p>'
    );
    var ok = document.getElementById("payoff-ok");
    var go = box.querySelector(".payoff-go");
    var status = box.querySelector(".payoff-status");
    ok.addEventListener("change", function () { go.disabled = !ok.checked; });
    go.addEventListener("click", function () {
      go.disabled = true;
      ok.disabled = true;
      status.textContent = "Processing your payment…";
      fetch("/api/pay-off", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId, confirm: true }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); })
        .then(function (res) {
          if (res.ok) {
            show("<h2>Thank you, your trip is paid off</h2><p>" + money(res.body.paid) + (res.body.processing ? " is on its way from your bank account; bank payments take a few business days to clear." : " was charged.") + " Your scheduled payments have been canceled.</p>");
          } else {
            status.textContent = res.body.error || "Your payment didn't go through. Nothing was charged.";
            status.className = "payoff-status is-error";
            if (res.status !== 402) { ok.disabled = false; go.disabled = !ok.checked; }
          }
        })
        .catch(function () {
          status.textContent = "We couldn't reach the server, so we can't confirm the payment. Please check your email for a receipt before trying again, or call us.";
          status.className = "payoff-status is-error";
        });
    });
  }

  fetch("/api/pay-off?session_id=" + encodeURIComponent(sessionId))
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
    .then(function (res) {
      if (res.ok) render(res.body);
      else show('<p class="payoff-status is-error">' + esc((res.body && res.body.error) || "We couldn't find that booking.") + " Please call or email us and we'll help.</p>");
    })
    .catch(function () { show('<p class="payoff-status is-error">We couldn\'t load your booking. Please try again, or call or email us.</p>'); });
})();
