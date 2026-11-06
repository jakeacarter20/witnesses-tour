/*
  Parley Street Travel Co. — The Holy Rebellion's Instagram videos (the section above the FAQ)
  To add or remove a video, edit REELS: each entry is the code from the reel's link,
  instagram.com/reel/THIS_PART/. Each video loads from Instagram only as it comes
  near the screen, so the page stays fast.
*/
(function () {
  var REELS = [
    "DZqDhh2yjay", "DTycLjGEuw3", "DSYiQ09ERfx", "DTBsESjAHzD",
    "DRZzlHPjm6b", "Deu2RDBugsE", "DefJOhcvSjx", "DTqa2iNjz4x",
    "DO1ANuzAMUD", "DR72-BVEgZk", "DNGLqOYsj5f", "DN9FqzFkl90",
    "DNMUvsSy5CX", "DN1LSJ75Coi", "DMOAjE8uU1k", "DGnxXeFJEJ0"
  ];

  var root = document.getElementById("host-reels");
  if (!root) return;
  var track = root.querySelector(".reels-track");
  var prev = root.querySelector(".reels-prev");
  var next = root.querySelector(".reels-next");

  REELS.forEach(function (id, i) {
    var card = document.createElement("div");
    card.className = "reel";
    card.dataset.reel = id;
    card.dataset.title = "The Holy Rebellion on Instagram, video " + (i + 1) + " of " + REELS.length;
    var link = document.createElement("a");
    link.className = "reel-link";
    link.href = "https://www.instagram.com/reel/" + id + "/";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Watch on Instagram";
    card.appendChild(link);
    track.appendChild(card);
  });

  function load(card) {
    if (card.dataset.loaded) return;
    card.dataset.loaded = "1";
    var frame = document.createElement("iframe");
    frame.src = "https://www.instagram.com/reel/" + card.dataset.reel + "/embed/";
    frame.title = card.dataset.title;
    frame.loading = "lazy";
    frame.allow = "encrypted-media; picture-in-picture; fullscreen";
    frame.setAttribute("scrolling", "no");
    card.appendChild(frame);
  }

  var cards = Array.prototype.slice.call(track.children);
  if ("IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { load(e.target); seen.unobserve(e.target); }
      });
    }, { root: track, rootMargin: "0px 320px" });
    // Only start watching once the section itself is close to the screen
    var near = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        near.disconnect();
        cards.forEach(function (c) { seen.observe(c); });
      }
    }, { rootMargin: "400px 0px" });
    near.observe(root);
  } else {
    cards.forEach(load);
  }

  // One video at a time. Instagram's embeds can't be paused from the page or report
  // that they're playing, so the page stops a video by reloading its embed, which
  // sends it back to its cover. A click into an embed shows up as the page's focus
  // moving to that iframe, which is how we know which video someone is on.
  var active = null;
  var touch = window.matchMedia("(pointer: coarse)").matches; // taps don't always move focus on phones
  function stop(card) {
    var frame = card.querySelector("iframe");
    if (!frame) return;
    if (document.activeElement === frame) frame.blur();
    frame.src = frame.src;
  }
  setInterval(function () {
    var el = document.activeElement;
    if (!el || el.tagName !== "IFRAME" || !el.parentNode.classList.contains("reel")) return;
    if (el.parentNode !== active) {
      if (active) stop(active);
      active = el.parentNode;
    }
  }, 250);

  // A video also stops when it scrolls out of view. On phones we can't tell which one
  // is playing, so any video that was on screen is stopped as it leaves.
  function left(card) {
    if (card === active) {
      stop(card);
      active = null;
    } else if (touch && card.dataset.onscreen) {
      stop(card);
    }
    delete card.dataset.onscreen;
  }
  if ("IntersectionObserver" in window) {
    var visible = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) e.target.dataset.onscreen = "1";
        else if (e.target.dataset.onscreen) left(e.target);
      });
    }, { root: track });
    cards.forEach(function (c) { visible.observe(c); });
    // Scrolling the whole carousel off the page stops it too
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) return;
      cards.forEach(function (c) { if (c.dataset.onscreen) { left(c); c.dataset.onscreen = "1"; } });
    }).observe(root);
  }

  function step() { return cards[0].getBoundingClientRect().width + 16; }
  function sync() {
    var max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
  }
  prev.addEventListener("click", function () { track.scrollBy({ left: -step(), behavior: "smooth" }); });
  next.addEventListener("click", function () { track.scrollBy({ left: step(), behavior: "smooth" }); });
  track.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  sync();
})();
