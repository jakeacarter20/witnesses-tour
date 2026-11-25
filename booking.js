/*
  Parley Street Travel Co. — "Book online with 3 simple steps"
  One question at a time, sliding from step to step:
    1. How many travelers (1 to 4)
    2. Which rooms (only the options that fit that many travelers, with prices and any sale savings)
    3. Deposit + payment plan, or pay in full
  Then it opens the Stripe checkout. A choice with more than one room (for example a
  Double and a Single) checks out one room at a time; the thank-you page picks up
  the next room (see thank-you.html), using localStorage key "parleyRooms".
  Prices, seats and Stripe links come from booking-config.js.
*/
(function () {
  var root = document.getElementById("booker");
  var cfg = window.PARLEY_BOOKING;
  if (!root || !cfg) return;

  var rooms = cfg.rooms || {};
  var deposit = cfg.depositPerPerson || 250;
  var sale = cfg.sale && cfg.sale.ends && Date.now() < new Date(cfg.sale.ends).getTime() ? cfg.sale : null;
  var money = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  var cents = function (n) { return n % 1 ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : money(n); };
  var esc = function (s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Room options for each number of travelers, in the order they're shown
  var OPTIONS = {
    1: [
      { rooms: ["single"], title: "A room to yourself" },
      { rooms: ["shared"], title: "Share a room", note: "We pair you with another solo traveler of the same gender. If we can't, you have the room to yourself at the same price." }
    ],
    2: [
      { rooms: ["single", "single"], title: "Two private rooms", note: "Each of you has a room to yourself." },
      { rooms: ["double"], title: "Share one room" }
    ],
    3: [
      { rooms: ["single", "single", "single"], title: "Each in your own room" },
      { rooms: ["double", "single"], title: "One shared room and one Single", note: "Two of you share a room; one has a room to themselves." },
      { rooms: ["triple"], title: "All three in one room" }
    ],
    4: [
      { rooms: ["quad"], title: "All four in one room" },
      { rooms: ["single", "triple"], title: "One Single and three sharing", note: "Three of you share a room; one has a room to themselves." },
      { rooms: ["double", "double"], title: "Two shared rooms", note: "Two to a room." },
      { rooms: ["double", "single", "single"], title: "One shared room and two Singles", note: "Two of you share a room; two have rooms to themselves." },
      { rooms: ["single", "single", "single", "single"], title: "Each in your own room" }
    ]
  };

  var state = { travelers: 0, option: null, mode: null };

  var steps = [].slice.call(root.querySelectorAll(".bk-step"));
  var viewport = root.querySelector(".bk-viewport");
  var bars = [].slice.call(root.querySelectorAll(".bk-progress span"));
  var current = 0;

  function total(option) {
    return option.rooms.reduce(function (n, key) { var r = rooms[key]; return n + r.price * r.seats; }, 0);
  }
  function savings(option) { return sale ? total(option) * sale.percentOff / 100 : 0; }
  function closed(option) {
    return cfg.tourSoldOut || option.rooms.some(function (key) { var r = rooms[key]; return !r || r.soldOut || !r.deposit || !r.full; });
  }
  function describe(option) {
    // "Double $1,800 per person · Single $2,250" (each room type once)
    var seen = {};
    return option.rooms.filter(function (k) { return seen[k] ? false : (seen[k] = true); }).map(function (k) {
      return rooms[k].name + " " + money(rooms[k].price) + (rooms[k].seats > 1 || k === "shared" ? " per person" : "");
    }).join(" · ");
  }

  // Slide to step i (0-based). Steps before it slide out to the left, steps after wait on the right.
  function goTo(i, focus) {
    current = i;
    steps.forEach(function (s, n) {
      s.classList.toggle("is-current", n === i);
      s.classList.toggle("is-past", n < i);
      if (n === i) s.removeAttribute("inert"); else s.setAttribute("inert", "");
      s.setAttribute("aria-hidden", n === i ? "false" : "true");
    });
    bars.forEach(function (b, n) { b.classList.toggle("is-done", n <= Math.min(i, 2)); });
    fitHeight();
    if (focus !== false) {
      var heading = steps[i].querySelector("h3");
      if (heading) heading.focus({ preventScroll: true });
      var top = root.getBoundingClientRect().top;
      var header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header")) || 76;
      if (top < header || top > window.innerHeight * 0.5) root.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  }
  function fitHeight() { viewport.style.height = steps[current].offsetHeight + "px"; }
  window.addEventListener("resize", fitHeight);

  // Step 1: number of travelers
  var select = root.querySelector("#bk-travelers");
  var next1 = root.querySelector("[data-next='1']");
  select.addEventListener("change", function () {
    state.travelers = Number(select.value) || 0;
    next1.disabled = !state.travelers;
    if (state.travelers) { renderOptions(); setTimeout(function () { goTo(1); }, reduceMotion ? 0 : 180); }
  });
  next1.addEventListener("click", function () { if (state.travelers) { renderOptions(); goTo(1); } });

  // Step 2: rooms that fit that many travelers
  var list = root.querySelector(".bk-options");
  function renderOptions() {
    var n = state.travelers;
    root.querySelector("[data-travelers-label]").textContent = n === 1 ? "1 traveler" : n + " travelers";
    list.innerHTML = "";
    OPTIONS[n].forEach(function (option) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "bk-option";
      var isClosed = closed(option);
      b.disabled = isClosed;
      var save = savings(option);
      b.innerHTML =
        '<span class="bk-option-main"><strong>' + esc(option.title) + "</strong>" +
        '<span class="bk-option-rooms">' + esc(describe(option)) + "</span>" +
        (option.note ? '<span class="bk-option-note">' + esc(option.note) + "</span>" : "") + "</span>" +
        '<span class="bk-option-price">' + (isClosed ? "<b>Sold out</b>" :
          "<b>" + money(total(option)) + "</b><span>total</span>" +
          (save ? '<span class="bk-save">Save ' + money(save) + "</span>" : "")) + "</span>";
      b.addEventListener("click", function () {
        state.option = option;
        renderPayment();
        goTo(2);
      });
      list.appendChild(b);
    });
  }

  // Step 3: deposit + payment plan, or pay in full
  var payInputs = [].slice.call(root.querySelectorAll("input[name='bk-pay']"));
  var ack = root.querySelector("#bk-ack");
  var ackWrap = root.querySelector(".bk-ack");
  var go = root.querySelector("[data-checkout]");
  function renderPayment() {
    var o = state.option, n = state.travelers, t = total(o), save = savings(o);
    var today = deposit * n, rest = t - today;
    root.querySelector("[data-summary]").textContent = (n === 1 ? "1 traveler" : n + " travelers") + " · " + o.title + " · " + money(t) + " total";
    root.querySelector("[data-deposit-today]").textContent = money(today);
    root.querySelector("[data-deposit-rest]").textContent =
      "The rest, " + money(rest) + ", is charged automatically in 4 payments of " + cents(rest / 4) +
      " on " + (cfg.autoPlanDates || "January 1, January 27, February 21 and March 19, 2027") + ". You can pay it off any time before " + (cfg.finalPaymentDate || "March 19, 2027") + ".";
    root.querySelector("[data-full-today]").innerHTML = save ? money(t - save) + ' <s>' + money(t) + "</s>" : money(t);
    root.querySelectorAll("[data-sale-deposit]").forEach(function (el) { el.hidden = !save; el.textContent = save ? "Black Friday: we'll take " + money(save) + " off your remaining payments." : ""; });
    root.querySelectorAll("[data-sale-full]").forEach(function (el) { el.hidden = !save; el.textContent = save ? "Black Friday: you save " + money(save) + ", taken off at checkout." : ""; });
    syncPay();
  }
  function syncPay() {
    var picked = payInputs.filter(function (i) { return i.checked; })[0];
    state.mode = picked ? picked.value : null;
    ackWrap.hidden = state.mode !== "deposit";
    var ready = state.mode === "full" || (state.mode === "deposit" && ack.checked);
    go.disabled = !ready;
    var count = state.option ? state.option.rooms.length : 1;
    go.textContent = count > 1 ? "Continue to checkout (" + count + " rooms)" : "Continue to checkout";
    fitHeight();
  }
  payInputs.forEach(function (i) { i.addEventListener("change", syncPay); });
  ack.addEventListener("change", syncPay);

  function linkFor(key, mode) {
    var link = rooms[key][mode];
    if (mode === "full" && sale && sale.promoCode) link += (link.indexOf("?") < 0 ? "?" : "&") + "prefilled_promo_code=" + encodeURIComponent(sale.promoCode);
    return link;
  }

  // Checkout: straight to Stripe for one room, otherwise one checkout per room
  var roomList = root.querySelector(".bk-rooms");
  go.addEventListener("click", function () {
    var o = state.option;
    if (!o || go.disabled) return;
    if (o.rooms.length === 1) {
      try { localStorage.removeItem("parleyRooms"); } catch (e) {}
      window.location.href = linkFor(o.rooms[0], state.mode);
      return;
    }
    var plan = { mode: state.mode, rooms: o.rooms, done: [], current: -1, title: o.title, at: Date.now() };
    try { localStorage.setItem("parleyRooms", JSON.stringify(plan)); } catch (e) {}
    renderRooms(plan);
    goTo(3);
  });
  function renderRooms(plan) {
    roomList.innerHTML = "";
    plan.rooms.forEach(function (key, i) {
      var r = rooms[key];
      var li = document.createElement("li");
      var due = plan.mode === "deposit" ? deposit * r.seats : r.price * r.seats * (sale ? (100 - sale.percentOff) / 100 : 1);
      li.innerHTML = '<span><strong>Room ' + (i + 1) + " of " + plan.rooms.length + ": " + esc(r.name) + "</strong>" +
        '<span class="bk-room-who">' + (r.seats === 1 ? "1 traveler" : r.seats + " travelers") + " · " + money(due) + " today</span></span>";
      var a = document.createElement("a");
      a.className = "btn btn-dark";
      a.href = linkFor(key, plan.mode);
      a.textContent = "Check out room " + (i + 1);
      a.addEventListener("click", function () {
        plan.current = i;
        try { localStorage.setItem("parleyRooms", JSON.stringify(plan)); } catch (e) {}
      });
      li.appendChild(a);
      roomList.appendChild(li);
    });
  }

  root.querySelectorAll("[data-back]").forEach(function (b) {
    b.addEventListener("click", function () { goTo(Math.max(0, current - 1)); });
  });

  if (cfg.tourSoldOut) root.hidden = true;
  root.classList.add("is-ready");
  goTo(0, false);
})();
