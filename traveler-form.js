/*
  Parley Street Travel Co. — traveler details form (thank-you page)
  Stripe checkout only allows three questions, so after a booking the
  thank-you page asks for each traveler's details here, one answer per box.
  Stripe sends travelers back with ?session_id=cs_... in the address (thank-you.html
  takes it out of the address at once, so analytics never sees it); the answers are
  saved to that booking in Stripe by /api/traveler-details.
*/
(function () {
  var section = document.getElementById("traveler-details");
  // thank-you.html moves the booking ID out of the address before analytics loads
  var sessionId = window.parleyBookingSession || new URLSearchParams(location.search).get("session_id");
  if (!sessionId) { try { sessionId = sessionStorage.getItem("parleyBookingSession"); } catch (e) {} }
  if (!section || !sessionId) return;

  var form = section.querySelector("form");
  var status = section.querySelector(".td-status");
  var esc = function (s) { var d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; };

  // Latest date of birth allowed: 16 on April 19, 2027
  var latestBirthday = "2011-04-19";

  function input(id, label, type, value, opts) {
    opts = opts || {};
    return '<div class="td-field"><label for="' + id + '">' + esc(label) + (opts.optional ? ' <span>(optional)</span>' : "") + "</label>" +
      '<input id="' + id + '" name="' + id + '" type="' + type + '" value="' + esc(value) + '"' +
      (opts.optional ? "" : " required") + (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : "") +
      (opts.max ? ' max="' + opts.max + '"' : "") + (opts.maxlength ? ' maxlength="' + opts.maxlength + '"' : "") + ">" +
      (opts.hint ? '<p class="td-hint">' + esc(opts.hint) + "</p>" : "") + "</div>";
  }

  function render(data) {
    var html = "";
    data.travelers.forEach(function (t, i) {
      var n = i + 1, me = n === 1;
      html += '<fieldset class="td-group"><legend>' + (data.count === 1 ? "Traveler" : "Traveler " + n + (me ? " (you)" : "")) + "</legend>" +
        input("t" + n + "-name", "Full name", "text", t.name, { autocomplete: me ? "name" : "off", maxlength: 100 }) +
        input("t" + n + "-dob", "Date of birth", "date", t.dob, { max: latestBirthday, autocomplete: me ? "bday" : "off" }) +
        input("t" + n + "-email", "Email", "email", t.email, { autocomplete: me ? "email" : "off", maxlength: 254, hint: me ? "" : "We'll send trip updates here. If they don't have one, enter yours." }) +
        input("t" + n + "-phone", "Phone", "tel", t.phone, { optional: !me, autocomplete: me ? "tel" : "off", maxlength: 30 }) +
        "</fieldset>";
    });
    html += '<fieldset class="td-group"><legend>Emergency contact</legend>' +
      '<p class="td-hint">Someone at home we can call if something happens on the trip.</p>' +
      input("em-name", "Name", "text", data.emergency.name, { maxlength: 100 }) +
      input("em-phone", "Phone", "tel", data.emergency.phone, { maxlength: 30 }) +
      "</fieldset>";
    if (data.askRoommate) {
      var pair = data.roommate === "Pair me with another traveler";
      var named = data.roommate && !pair;
      html += '<fieldset class="td-group"><legend>Your roommate</legend>' +
        '<label class="td-choice"><input type="radio" name="roommate" value="pair"' + (pair ? " checked" : "") + ' required> Pair me with another traveler</label>' +
        '<label class="td-choice"><input type="radio" name="roommate" value="named"' + (named ? " checked" : "") + "> I'm rooming with someone who booked separately</label>" +
        '<div class="td-mate"' + (named ? "" : " hidden") + ">" + input("mate-name", "Roommate's full name", "text", named ? data.roommate : "", { maxlength: 100 }) + "</div>" +
        "</fieldset>";
    }
    html += '<button type="submit" class="btn btn-dark td-save">Save traveler details</button>';
    form.innerHTML = html;
    section.hidden = false;

    var mate = form.querySelector(".td-mate");
    if (mate) {
      var mateInput = mate.querySelector("input");
      var syncMate = function () {
        var on = form.querySelector('input[name="roommate"]:checked');
        mate.hidden = !(on && on.value === "named");
        mateInput.required = !mate.hidden;
      };
      form.querySelectorAll('input[name="roommate"]').forEach(function (r) { r.addEventListener("change", syncMate); });
      syncMate();
    }
    if (data.savedAt) {
      say("Your traveler details are saved. To change anything later, email hello@parleystreettravel.com.", "ok");
      showAboutYou(data.count);
    }
  }

  // Once details are saved, point everyone to the "Tell us about you" form
  function showAboutYou(count) {
    var box = document.getElementById("about-you");
    if (!box) return;
    box.querySelector(".td-share").hidden = count < 2;
    box.hidden = false;
  }

  function say(message, kind) {
    status.textContent = message;
    status.className = "td-status" + (kind ? " is-" + kind : "");
  }

  function val(id) { var el = form.querySelector("#" + id); return el ? el.value.trim() : ""; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var count = form.querySelectorAll('[id$="-name"][id^="t"]').length;
    var travelers = [];
    for (var n = 1; n <= count; n++) {
      travelers.push({ name: val("t" + n + "-name"), dob: val("t" + n + "-dob"), email: val("t" + n + "-email"), phone: val("t" + n + "-phone") });
    }
    var choice = form.querySelector('input[name="roommate"]:checked');
    var body = {
      session_id: sessionId,
      travelers: travelers,
      emergency: { name: val("em-name"), phone: val("em-phone") },
      roommate: choice ? { choice: choice.value, name: val("mate-name") } : null
    };
    var button = form.querySelector(".td-save");
    button.disabled = true;
    say("Saving…");
    fetch("/api/traveler-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (res.ok) {
          say("Saved. Thank you! To change anything later, email hello@parleystreettravel.com.", "ok");
          showAboutYou(count);
        } else say(res.body.error || "We couldn't save your details. Please try again.", "error");
      })
      .catch(function () { say("We couldn't reach the server. Please check your connection and try again.", "error"); })
      .then(function () { button.disabled = false; });
  });

  fetch("/api/traveler-details?session_id=" + encodeURIComponent(sessionId))
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
    .then(function (res) {
      if (res.ok) return render(res.body);
      section.hidden = false;
      say((res.body && res.body.error ? res.body.error + " " : "") + "Please email each traveler's details to hello@parleystreettravel.com.", "error");
    })
    .catch(function () {
      section.hidden = false;
      say("We couldn't load your booking. Please email each traveler's details to hello@parleystreettravel.com.", "error");
    });
})();
