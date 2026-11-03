/*
  Parley Street Travel Co. — email sign-ups (tour page)
  "Have questions? Enter your email and we'll reach out."
  - A small box slides in after about 30 seconds or a third of the way down the page,
    once per visitor (closing it or signing up keeps it away).
  - The footer has the same sign-up, and the Questions? chat can show it too
    (window.parleySignupForm).
  Sign-ups go to /api/signup, which emails hello@ and adds them to the Resend list.
*/
(function () {
  var SEEN = "parleySignupSeen";
  var remember = function () { try { localStorage.setItem(SEEN, "1"); } catch (e) {} };
  var seen = function () { try { return localStorage.getItem(SEEN) === "1"; } catch (e) { return false; } };

  var formHtml = function (id, withQuestion) {
    return '<form class="su-form" novalidate data-clarity-mask="True">' +
      '<label class="su-sr" for="' + id + '-email">Email</label>' +
      '<input id="' + id + '-email" class="su-email" type="email" name="email" placeholder="Your email" autocomplete="email" required maxlength="254">' +
      (withQuestion ? '<label class="su-sr" for="' + id + '-q">What would you like to know? (optional)</label>' +
        '<textarea id="' + id + '-q" class="su-question" name="question" rows="2" maxlength="1000" placeholder="What would you like to know? (optional)"></textarea>' : "") +
      '<input class="su-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<button type="submit" class="su-send">Send</button>' +
      '<p class="su-consent">' + (withQuestion ? "We'll answer your question and send occasional trip updates." : "We'll send occasional trip updates.") + ' Unsubscribe anytime. <a href="privacy.html">Privacy policy</a></p>' +
      '<p class="su-status" role="status" aria-live="polite"></p>' +
      "</form>";
  };

  function wire(container, source, onDone) {
    var form = container.querySelector(".su-form");
    var status = form.querySelector(".su-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.querySelector(".su-email").value.trim();
      var q = form.querySelector(".su-question");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        status.textContent = "Please enter a valid email address.";
        status.className = "su-status is-error";
        return;
      }
      var button = form.querySelector(".su-send");
      button.disabled = true;
      status.textContent = "Sending…";
      status.className = "su-status";
      fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, question: q ? q.value : "", source: source, website: form.website.value })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.body.error || "error");
          remember();
          form.innerHTML = '<p class="su-done">Thanks! We\'ll be in touch soon.</p>';
          if (window.gtag) window.gtag("event", "sign_up", { method: source });
          if (onDone) onDone();
        })
        .catch(function (err) {
          button.disabled = false;
          status.textContent = err.message && err.message !== "error" ? err.message : "That didn't go through. Please email hello@parleystreettravel.com.";
          status.className = "su-status is-error";
        });
    });
  }

  // Lets the chat (or anything else) drop a sign-up form into an element
  window.parleySignupForm = function (container, source) {
    container.innerHTML = formHtml("su-" + source + "-" + Math.random().toString(36).slice(2, 7), true);
    wire(container, source);
  };

  // Footer sign-up
  var footer = document.getElementById("footer-signup");
  if (footer) {
    footer.insertAdjacentHTML("beforeend", formHtml("su-footer", false));
    wire(footer, "footer");
  }

  // The slide-in box
  if (seen()) return;
  var box = document.createElement("aside");
  box.className = "su-box";
  box.setAttribute("aria-label", "Ask a question");
  box.hidden = true;
  box.innerHTML = '<button type="button" class="su-close" aria-label="Close">&times;</button>' +
    '<p class="su-title">Have questions?</p><p class="su-lead">Enter your email and we\'ll reach out.</p>' + formHtml("su-box", true);
  document.body.appendChild(box);
  var closeTimer;
  wire(box, "slidein", function () { closeTimer = setTimeout(hide, 4000); });

  function show() {
    if (seen() || !box.hidden || document.body.classList.contains("chat-open")) return;
    box.hidden = false;
    setTimeout(function () { box.classList.add("is-open"); }, 20);
    window.removeEventListener("scroll", onScroll);
    clearTimeout(timer);
  }
  function hide() {
    clearTimeout(closeTimer);
    box.classList.remove("is-open");
    setTimeout(function () { box.hidden = true; }, 250);
    remember();
  }
  box.querySelector(".su-close").addEventListener("click", hide);
  box.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });

  function onScroll() {
    var max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0 && scrollY / max > 0.33) show();
  }
  var timer = setTimeout(show, 30000);
  window.addEventListener("scroll", onScroll, { passive: true });
})();
