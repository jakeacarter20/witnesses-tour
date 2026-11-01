/*
  Parley Street Travel Co. — FAQ chat
  A chat bubble that answers from this page's own FAQ and sections, so the
  answers change whenever the page does. It never makes anything up: when it
  can't match a question, it offers to email a person.

  To teach it a new question, add an entry to TOPICS below. "strong" words
  point straight at that answer; "weak" words only help break ties.
*/
(function () {
  var EMAIL = "hello@parleystreettravel.com";
  var mailLink = document.querySelector('a[href^="mailto:"]');
  if (mailLink) EMAIL = mailLink.getAttribute("href").replace("mailto:", "").split("?")[0];

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var text = function (el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; };
  var esc = function (s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; };

  // The answer to an FAQ entry, found by the start of its question
  function faq(startsWith) {
    var hit = $$("#faq details").filter(function (d) { return text($("summary", d)).indexOf(startsWith) === 0; })[0];
    return hit ? $$("p", hit).map(function (p) { return "<p>" + p.innerHTML + "</p>"; }).join("") : "";
  }
  function list(sel) {
    var items = $$(sel + " li").map(function (li) { return "<li>" + esc(text(li)) + "</li>"; });
    return items.length ? "<ul>" + items.join("") + "</ul>" : "";
  }
  function more(id, label) { return $("#" + id) ? '<p><a href="#' + id + '" data-chat-jump>' + label + " &rarr;</a></p>" : ""; }

  var TOPICS = [
    { q: "What's included?", strong: ["included", "include", "includes", "covered", "hotel", "hotels", "coach", "motorcoach", "bus"], weak: ["breakfast", "nights", "extra", "extras", "excluded", "not"],
      a: function () { return list("#included") ? "<p>Your trip price includes:</p>" + list("#included") + (list("#not-included") ? "<p>Not included:</p>" + list("#not-included") : "") : ""; } },
    { q: "How much does it cost?", strong: ["cost", "price", "prices", "much", "expensive", "rate"], weak: ["double", "triple", "quad", "room", "total"],
      a: function () {
        var rooms = $$("#book .room").map(function (r) {
          return "<li><strong>" + esc(text($("h3", r))) + "</strong>: " + esc(text($(".price", r))) + " " + esc(text($(".per", r))) + "</li>";
        });
        return rooms.length ? "<p>Prices are per person and include everything listed under What's included.</p><ul>" + rooms.join("") + "</ul>" + more("book", "See rooms and prices") : "";
      } },
    { q: "How does the deposit work?", strong: ["deposit", "reserve", "hold"], weak: ["seat", "spot", "nonrefundable"], a: function () { return faq("How does the deposit work"); } },
    { q: "Is there a payment plan?", strong: ["plan", "installment", "installments", "monthly"], weak: ["payments", "spread"], a: function () { return faq("Is there a payment plan"); } },
    { q: "What happens if I don't choose by January 1?", strong: ["january", "deadline", "automatic", "automatically"], weak: ["choose", "decide", "miss"], a: function () { return faq("What happens if I don"); } },
    { q: "I'm traveling alone. Do I need a single?", strong: ["alone", "solo", "roommate", "pair", "myself"], weak: ["single", "share"], a: function () { return faq("I'm traveling alone"); } },
    { q: "How do I book a Triple or Quad?", strong: ["triple", "quad", "family", "friends"], weak: ["three", "four", "together", "group"], a: function () { return faq("How do I book a Triple"); } },
    { q: "How do I pay?", strong: ["card", "credit", "debit", "bank", "ach", "stripe", "venmo", "paypal", "check"], weak: ["pay", "paying", "payment", "method"], a: function () { return faq("How do I pay"); } },
    { q: "Can I get a refund if I cancel?", strong: ["refund", "refunds", "cancel", "cancellation", "canceling", "cancelling", "back"], weak: ["money", "policy", "terms"], a: function () { return faq("Can I get a refund"); } },
    { q: "Is there an age requirement?", strong: ["age", "old", "kids", "children", "child", "teen", "teens", "minor", "16"], weak: ["young", "bring"], a: function () { return faq("Is there an age"); } },
    { q: "How does the free Book of Mormon work?", strong: ["mormon", "free", "customizable", "scriptures", "bom"], weak: ["book", "gift"], a: function () { return faq("How does the free Book"); } },
    { q: "When is the tour?", strong: ["when", "dates", "date", "april", "long", "days"], weak: ["start", "begin", "end"],
      a: function () { return $$("#itinerary .bookends p").map(function (p) { return "<p>" + esc(text(p)) + "</p>"; }).join("") + more("itinerary", "See the full itinerary"); } },
    { q: "Where do we meet?", strong: ["meet", "meeting", "airport", "fly", "flight", "flights", "mci", "address", "home", "rideshare"], weak: ["where", "arrive", "kansas", "leave", "return", "carthage", "location", "get"],
      a: function () { var place = $("#meet .meet-place"); return place ? "<p><strong>" + esc(text($("strong", place))) + "</strong><br>" + esc(text(place).replace(text($("strong", place)), "")) + "</p>" + $$("#meet > p:not(.meet-place)").map(function (p) { return "<p>" + p.innerHTML + "</p>"; }).join("") : ""; } },
    { q: "What meals are included?", strong: ["meal", "meals", "food", "eat", "lunch", "lunches", "dinner", "dinners", "dietary"], weak: ["breakfast", "restaurant"],
      a: function () { var cols = $$("#meals h3, #meals h4").map(function (h) { var ul = h.nextElementSibling; while (ul && ul.tagName !== "UL") ul = ul.nextElementSibling; return "<p><strong>" + esc(text(h)) + "</strong></p>" + (ul ? "<ul>" + $$("li", ul).map(function (li) { return "<li>" + esc(text(li)) + "</li>"; }).join("") + "</ul>" : ""); }); return cols.join("") + more("meals", "See meals"); } },
    { q: "What will we see?", strong: ["itinerary", "schedule", "stops", "sites", "see", "visit", "places"], weak: ["day", "nauvoo", "liberty", "independence"],
      a: function () { var days = $$("#itinerary .day").map(function (d) { return "<li><strong>" + esc(text($(".day-num", d))) + "</strong>: " + esc(text($("h3", d))) + "</li>"; }); return days.length ? "<ul>" + days.join("") + "</ul>" + more("itinerary", "See the full itinerary") : ""; } },
    { q: "Who are the hosts?", strong: ["host", "hosts", "guide", "guides", "travis", "christian", "rebellion", "lead", "leads"], weak: ["who"],
      a: function () { var name = $("#hosts h3"), role = $("#hosts .host-role"), bio = $("#hosts .host-bio p"); return name ? "<p><strong>" + esc(text(name)) + "</strong><br>" + (role ? role.innerHTML : "") + "</p>" + (bio ? "<p>" + bio.innerHTML + "</p>" : "") : ""; } },
    { q: "How much walking is there?", strong: ["walk", "walking", "wheelchair", "accessible", "accessibility", "stairs", "elevator", "mobility", "fitness"], weak: ["hard", "physical"],
      a: function () { var f = $$("#details .fact").filter(function (x) { return /walk/i.test(text($("h3", x))); })[0]; return f ? "<p>" + esc(text($("p", f))) + "</p>" : ""; } },
    { q: "Do I need travel insurance?", strong: ["insurance", "insure", "insured", "squaremouth", "protection"], weak: ["sick", "illness", "protect"],
      a: function () { var ans = faq("Should I get travel insurance"); if (ans) return ans; var f = $$("#details .fact").filter(function (x) { return /insurance/i.test(text($("h3", x))); })[0]; return f ? "<p>" + $("p", f).innerHTML + "</p>" : ""; } },
    { q: "How big is the group?", strong: ["seats", "size", "spots", "available", "left", "people", "travelers"], weak: ["many", "group", "full"],
      a: function () { var p = $("#about p"); return p ? "<p>" + esc(text(p)) + "</p>" : ""; } }
  ];
  var HELLO = ["hi", "hello", "hey", "howdy"];
  var THANKS = ["thanks", "thank", "thx"];
  var HUMAN = ["human", "person", "someone", "somebody", "talk", "speak", "contact", "email", "phone", "call", "agent", "representative", "real"];
  var STARTERS = ["How much does it cost?", "How does the deposit work?", "Is there a payment plan?", "I'm traveling alone. Do I need a single?", "Where do we meet?", "Can I get a refund if I cancel?"];

  function words(s) { return s.toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9]+/).filter(Boolean); }
  function hits(ws, list) {
    return list.reduce(function (n, k) {
      return n + (ws.some(function (w) { return w === k || w === k + "s" || (k.length >= 5 && w.indexOf(k) === 0); }) ? 1 : 0);
    }, 0);
  }
  function match(question) {
    var ws = words(question);
    if (hits(ws, HUMAN) && ws.length <= 8) return "human";
    if (ws.length && ws.length <= 4 && hits(ws, THANKS)) return "thanks";
    if (ws.length && ws.length <= 3 && hits(ws, HELLO)) return "hello";
    var best = null, bestScore = 0;
    TOPICS.forEach(function (t) {
      var score = hits(ws, t.strong) * 3 + hits(ws, t.weak) + hits(ws, words(t.q)) * 0.5;
      if (score > bestScore) { best = t; bestScore = score; }
    });
    return bestScore >= 3 ? best : null;
  }

  // Build the widget
  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "chat-launcher";
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "chat-panel");
  launcher.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span>Questions?</span>';

  var panel = document.createElement("section");
  panel.className = "chat-panel";
  panel.id = "chat-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Questions about The Witnesses Tour");
  panel.innerHTML =
    '<header class="chat-head"><div><strong>Questions about the tour</strong><span>Answers from this page</span></div>' +
    '<button type="button" class="chat-close" aria-label="Close chat">&times;</button></header>' +
    '<div class="chat-log" role="log" aria-live="polite"></div>' +
    '<form class="chat-form"><label class="chat-sr" for="chat-input">Ask a question</label>' +
    '<input id="chat-input" type="text" autocomplete="off" maxlength="300" placeholder="Ask a question">' +
    '<button type="submit">Send</button></form>' +
    '<p class="chat-foot">Prefer a person? <a href="mailto:' + EMAIL + '">' + EMAIL + "</a></p>";

  document.body.appendChild(panel);
  document.body.appendChild(launcher);

  var log = $(".chat-log", panel), form = $(".chat-form", panel), input = $("#chat-input", panel);
  var lastQuestion = "";

  function mailto(question) {
    var subject = "Question about The Witnesses Tour";
    var body = question ? "My question: " + question + "\n\n" : "";
    return "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject) + (body ? "&body=" + encodeURIComponent(body) : "");
  }
  function say(html, who) {
    var msg = document.createElement("div");
    msg.className = "chat-msg chat-" + who;
    if (who === "you") msg.textContent = html; else msg.innerHTML = html;
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
  }
  function chips(questions, withEmail) {
    var row = document.createElement("div");
    row.className = "chat-chips";
    questions.forEach(function (q) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = q;
      b.addEventListener("click", function () { ask(q); });
      row.appendChild(b);
    });
    if (withEmail) {
      var a = document.createElement("a");
      a.className = "chat-email";
      a.href = mailto(lastQuestion);
      a.textContent = "Email a person";
      row.appendChild(a);
    }
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }
  function ask(question) {
    question = question.trim();
    if (!question) return;
    lastQuestion = question;
    var mine = say(question, "you");
    setTimeout(function () { log.scrollTop = mine.offsetTop - 12; }, 0);
    var topic = match(question);
    if (topic === "human") {
      say("<p>Happy to put you in touch. Email us at <a href=\"" + mailto("") + "\">" + EMAIL + "</a> and a person will write back.</p>", "bot");
      chips([], true);
      return;
    }
    if (topic === "thanks") {
      say("<p>You're welcome! Anything else, just ask.</p>", "bot");
      return;
    }
    if (topic === "hello") {
      say("<p>Hi there! What would you like to know about the tour?</p>", "bot");
      chips(STARTERS, false);
      return;
    }
    var answer = topic && topic.a();
    if (answer) {
      say(answer, "bot");
      chips(related(topic), true);
    } else {
      say("<p>I'm not sure about that one. Email us and a person will answer, or pick one of these:</p>", "bot");
      chips(STARTERS.slice(0, 4), true);
    }
  }
  function related(topic) {
    var i = TOPICS.indexOf(topic);
    return [TOPICS[(i + 1) % TOPICS.length].q, TOPICS[(i + 2) % TOPICS.length].q];
  }

  var started = false;
  function open() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    document.body.classList.add("chat-open");
    if (!started) {
      started = true;
      say("<p>Hi! Ask anything about The Witnesses Tour, or tap a question below. If I can't help, you can email a person.</p>", "bot");
      chips(STARTERS, false);
    }
    input.focus();
  }
  function close() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    document.body.classList.remove("chat-open");
    launcher.focus();
  }

  launcher.addEventListener("click", function () { panel.hidden ? open() : close(); });
  $(".chat-close", panel).addEventListener("click", close);
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ask(input.value);
    input.value = "";
  });
  // Links to a section of the page close the chat on phones so the section is visible
  log.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a && window.matchMedia("(max-width: 560px)").matches) close();
  });
})();
