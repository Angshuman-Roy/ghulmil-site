/*
 * Bubli and Sahib on the home page.
 *
 * Each character is one <img> whose picture is swapped between drawn poses
 * (mascots/<who>-<pose>.webp). All poses of a character share one canvas with
 * the head in the same spot, so a swap reads as a change of expression.
 *
 * Three things live here:
 *   1. The intro (scene 00), once, on a first visit. index.html puts "intro"
 *      on <html> before the page paints; this file plays it and removes it.
 *   2. The scenes (01 to 07). Each section's ol.lines is played line by line
 *      in a speech bubble when the section scrolls into view.
 *   3. The guided tour ("Show me around"): the same scenes, in order, with
 *      the page scrolling itself and a bar of controls.
 *
 * Nothing here is needed to read or use the page. With reduced motion the
 * lines stay on the page as text and none of this moves.
 */
(() => {
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id) => document.getElementById(id);

  const POSES = {
    sahib: {
      idle: "01-idle-open", blink: "02-idle-blink", call: "03-calling-bubli", talkSide: "04-talking-to-bubli",
      wave: "06-waving", point: "07-pointing-side", curious: "08-curious",
      phew: "10-relieved", cheer: "11-cheering-fists",
      thumbs: "12-thumbs-up", phone: "13-phone", wow: "14-delighted",
    },
    bubli: {
      idle: "01-idle-open", blink: "02-idle-blink", talk: "03-talking-to-visitor", talkSide: "04-talking-to-sahib",
      point: "06-pointing-side", down: "07-gesture-down", serious: "08-warm-serious",
      laugh: "09-laughing-closed-eyes", wave: "10-waving", cheer: "11-cheering-fists",
    },
    // Their friends: Dipa (glasses, green jacket) and Bumba (yellow hoodie).
    dipa: { idle: "01-idle-open", blink: "02-idle-blink", wave: "03-waving", talkSide: "04-talking-side", cheer: "05-cheering-fists" },
    bumba: { idle: "01-idle-open", blink: "02-idle-blink", wave: "03-waving", talkSide: "04-talking-side", cheer: "05-cheering-fists" },
  };
  const url = (who, pose) => `mascots/${who}-${POSES[who][pose]}.webp`;

  // Fetch a pose ahead of time, so the swap never shows a half-loaded picture.
  const loaded = {};
  const preload = (who, pose) => (loaded[who + pose] ||= new Promise((done) => {
    const img = new Image();
    img.onload = img.onerror = done;
    img.src = url(who, pose);
  }));

  class Mascot {
    constructor(el) {
      this.el = el;
      this.who = el.dataset.who;
      this.img = el.querySelector("img");
      this.pose = "idle";
    }
    /** Change expression. `pop` gives the small squash that sells the change. */
    async set(pose, pop = true) {
      if (!POSES[this.who][pose]) pose = "idle";
      const changed = this.pose !== pose;
      this.pose = pose;
      await preload(this.who, pose);
      if (this.pose !== pose) return;          // a later change won the race
      this.img.src = url(this.who, pose);
      if (!pop || !changed || reduced) return;
      this.el.classList.remove("pop");
      void this.el.offsetWidth;                // restart the animation
      this.el.classList.add("pop");
    }
    enter() { this.el.classList.add("in"); }
    leave() { this.el.classList.remove("in"); }
  }

  // =====================================================================
  // 1. Scene 00: the intro
  // =====================================================================
  const cast = $("cast");
  if (!cast) return;
  const bubli = new Mascot(cast.querySelector('[data-who="bubli"]'));
  const sahib = new Mascot(cast.querySelector('[data-who="sahib"]'));
  const friends = ["bumba", "dipa"].map((w) => new Mascot(cast.querySelector(`[data-who="${w}"]`)));
  const everyone = [bubli, sahib, ...friends];
  const bubble = $("bubble");

  const say = (who, text) => {
    bubble.classList.remove("on");
    // Let the old bubble shrink before the new one pops, when the speaker changes.
    setTimeout(() => {
      bubble.dataset.who = who;
      bubble.dataset.side = who === "bubli" ? "left" : "right";
      bubble.textContent = text;
      bubble.classList.add("on");
    }, bubble.textContent && !reduced ? 140 : 0);
  };
  const hush = () => bubble.classList.remove("on");

  // [milliseconds from the start, what happens]
  const INTRO = [
    [0,    () => { sahib.set("idle", false); sahib.enter(); }],                       // slides in, looks at you
    [1000, () => { sahib.set("call"); say("sahib", "Arre Bubli! Jaldi aa, koi aaya hai!"); }],
    [2500, () => { bubli.set("talkSide", false); bubli.enter(); sahib.set("thumbs");  // she overshoots and bounces back
                   say("bubli", "Oiii Sahib! Coming, coming!"); }],
    [3500, () => friends.forEach((m) => { m.set("idle", false); m.enter(); })],              // the others pop up between them
    [4200, () => { everyone.forEach((m) => m.set("wave")); say("bubli", "Heyyy! Welcome to ghulmil!"); }],
    [5500, () => { root.classList.add("intro-copy"); }],                              // the headline rises in
    [7400, () => finish()],
  ];
  const INTRO_POSES = [[sahib, "idle"], [sahib, "call"], [sahib, "thumbs"], [sahib, "wave"], [bubli, "talkSide"], [bubli, "wave"], [bubli, "idle"], ...friends.flatMap((m) => [[m, "idle"], [m, "wave"]])];

  let introTimers = [];
  const clearIntro = () => { introTimers.forEach(clearTimeout); introTimers = []; };

  /** Everyone on stage, quiet, headline showing. Where the intro ends, and where a skip lands. */
  function finish() {
    clearIntro();
    hush();
    everyone.forEach((m) => m.set("idle", false));
    root.classList.remove("intro", "intro-copy");
    try { localStorage.setItem("ghulmil-intro", "1"); } catch (e) {}
  }

  async function playIntro() {
    clearIntro();
    hush();
    everyone.forEach((m) => m.leave());
    root.classList.remove("intro-copy");
    root.classList.add("intro");
    // Wait for the pictures, but never hold the page for more than a moment.
    await Promise.race([
      Promise.all(INTRO_POSES.map(([m, pose]) => preload(m.who, pose))),
      new Promise((done) => setTimeout(done, 1500)),
    ]);
    if (!root.classList.contains("intro")) return;   // skipped while loading
    INTRO.forEach(([at, beat]) => introTimers.push(setTimeout(beat, at)));
  }

  // A returning visitor gets no intro: the page is there at once, and the pair just say hello.
  // A different pair of lines each time; once per browser session, so reloads stay quiet.
  const WELCOME_BACK = [
    ["Arre, aap phir aa gaye!", "Chalo, aaj kya plan hai?", "wow"],
    ["Welcome back!", "Aaj kuch naya try karein?", "thumbs"],
    ["Oho, wapas aa gaye!", "Bubli, inhe kuch achha dikhao!", "talkSide"],
  ];
  async function welcomeBack() {
    try {
      if (sessionStorage.getItem("ghulmil-hello")) return;
      sessionStorage.setItem("ghulmil-hello", "1");
    } catch (e) {}
    const [hers, his, hisPose] = WELCOME_BACK[Math.floor(Math.random() * WELCOME_BACK.length)];
    await Promise.all([preload("bubli", "wave"), preload("sahib", hisPose), preload("bubli", "laugh")]);
    clearIntro();
    introTimers.push(
      setTimeout(() => { bubli.set("wave"); friends.forEach((m) => m.set("wave")); say("bubli", hers); }, 900),
      setTimeout(() => { bubli.set("laugh"); friends.forEach((m) => m.set("idle")); sahib.set(hisPose); say("sahib", his); }, 3600),
      setTimeout(finish, 6600),
    );
  }

  $("intro-skip").addEventListener("click", finish);
  $("intro-replay").addEventListener("click", () => {
    if (reduced) return;
    if (tour.active) exitTour();
    cast.scrollIntoView({ block: "nearest" });
    playIntro();
  });

  // Idle: an occasional blink. Stops with the page's "Pause animations" button.
  const blink = (m) => {
    if (m.pose !== "idle") return;
    m.set("blink", false);
    setTimeout(() => { if (m.pose === "blink") m.set("idle", false); }, 170);
  };
  if (!reduced) {
    everyone.forEach((m) => preload(m.who, "blink"));
    const loop = (m, first) => setTimeout(() => {
      if (!document.hidden && !root.classList.contains("paused") && !root.classList.contains("intro")) blink(m);
      loop(m, 2600 + Math.random() * 3200);
    }, first);
    loop(sahib, 2200);
    loop(bubli, 3600);
    loop(friends[0], 2900);
    loop(friends[1], 4300);
  }

  // =====================================================================
  // 2. Scenes 01 to 07
  // =====================================================================
  class Scene {
    constructor(el) {
      this.el = el;
      this.name = el.dataset.scene;
      this.duo = el.querySelector(".duo");
      this.swap = this.duo.classList.contains("swap");   // Sahib stands on the left here
      this.bubli = new Mascot(this.duo.querySelector('[data-who="bubli"]'));
      this.sahib = new Mascot(this.duo.querySelector('[data-who="sahib"]'));
      this.friends = [...this.duo.querySelectorAll('[data-who="dipa"], [data-who="bumba"]')].map((el) => new Mascot(el));
      this.lines = [...el.querySelectorAll(".lines li")];
      this.shots = [...el.querySelectorAll(".device-screen img")];
      this.marks = [...el.querySelectorAll(".chips li, .cards li")];
      this.fx = [...new Set(this.lines.map((li) => li.dataset.fx).filter(Boolean))];
      this.done = false;
      this.bubble = document.createElement("p");
      this.bubble.className = "bubble";
      this.duo.append(this.bubble);
    }
    preload() {
      this.lines.forEach((li) => {
        preload("bubli", li.dataset.b || "idle");
        preload("sahib", li.dataset.s || "idle");
        this.friends.forEach((m) => preload(m.who, li.dataset[m.who] || li.dataset.f || "idle"));
      });
    }
    /** How long a line stays up: long enough to read it. */
    dur(k) { return 1700 + this.lines[k].textContent.length * 55; }
    side(who) {
      if (who === "both") return "both";
      if (who === "bumba") return "midleft";
      if (who === "dipa") return "midright";
      return (who === "bubli") !== this.swap ? "left" : "right";
    }
    /** Put line k on: poses, bubble, and whatever it points at. */
    show(k) {
      const li = this.lines[k], who = li.dataset.who;
      if (k === 0) this.fx.forEach((f) => this.el.classList.remove("fx-" + f));
      this.bubli.set(li.dataset.b || "idle");
      this.sahib.set(li.dataset.s || "idle");
      const all = who === "both";
      this.bubli.el.classList.toggle("speaking", all || who === "bubli");
      this.sahib.el.classList.toggle("speaking", all || who === "sahib");
      this.friends.forEach((m) => {
        m.set(li.dataset[m.who] || li.dataset.f || "idle");
        m.el.classList.toggle("speaking", all || who === m.who);
      });
      this.duo.classList.add("live");
      const b = this.bubble;
      b.classList.remove("on");
      void b.offsetWidth;
      b.dataset.who = all ? "bubli" : who;
      b.dataset.side = this.side(who);
      b.textContent = li.textContent;
      b.classList.add("on");
      if (li.dataset.shot) this.shots.forEach((img, i) => img.classList.toggle("on", i === +li.dataset.shot));
      const hl = (li.dataset.hl || "").split(",").filter(Boolean).map(Number);
      this.marks.forEach((m, i) => m.classList.toggle("on", hl.includes(i)));
      if (li.dataset.fx) this.el.classList.add("fx-" + li.dataset.fx);
    }
    /** Back to a quiet, smiling pair. Effects that have happened stay as they are. */
    rest() {
      this.duo.classList.remove("live");
      this.bubble.classList.remove("on");
      this.bubli.set("idle", false);
      this.sahib.set("idle", false);
      this.bubli.el.classList.remove("speaking");
      this.sahib.el.classList.remove("speaking");
      this.friends.forEach((m) => { m.set("idle", false); m.el.classList.remove("speaking"); });
      this.marks.forEach((m) => m.classList.remove("on"));
    }
  }

  const tour = { active: false, paused: false, i: 0 };
  let scenes = [];
  let exitTour = () => {};

  if (reduced) {
    // No movement: the greeting, standing still; each scene's lines stay on the page as text.
    root.classList.add("still");
    $("intro-replay").hidden = true;
    bubli.set("talk", false);
    bubble.classList.add("on");
    window.ghulmilStory = { playIntro, finish };
    return;
  }

  root.classList.add("talk");
  scenes = [...document.querySelectorAll("[data-scene]")].map((el) => new Scene(el));

  // The drifting row of activity kinds: a second copy makes the loop seamless.
  document.querySelectorAll(".kinds-row").forEach((row) => {
    [...row.children].forEach((li) => {
      const copy = li.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      copy.querySelector("img").alt = "";
      row.append(copy);
    });
    row.classList.add("loop");
  });

  // One scene talks at a time. `cur` is the line on screen; `next` is what happens when its time is up
  // (kept, not run, while the tour is paused, so Play picks up exactly there).
  let cur = null, timer = null, next = null;
  const schedule = (fn, ms) => {
    clearTimeout(timer);
    next = fn;
    if (!(tour.active && tour.paused)) timer = setTimeout(() => { next = null; fn(); }, ms);
  };
  const stop = () => { clearTimeout(timer); next = null; if (cur) cur.scene.rest(); cur = null; };

  function play(scene, k, onEnd) {
    if (cur && cur.scene !== scene) cur.scene.rest();
    if (k >= scene.lines.length) {
      clearTimeout(timer); next = null;
      scene.rest();
      scene.done = true;
      cur = null;
      if (onEnd) onEnd();
      return;
    }
    cur = { scene, k, onEnd };
    scene.show(k);
    schedule(() => play(scene, k + 1, onEnd), scene.dur(k));
  }

  // Browsing by hand: a scene plays once, when its pair scrolls into view.
  const inView = new Set();
  const playVisible = () => {
    if (tour.active || cur) return;
    const scene = scenes.find((s) => inView.has(s) && !s.done);
    if (scene) play(scene, 0, playVisible);
  };
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const scene = scenes.find((s) => s.duo === e.target);
      if (e.isIntersecting) inView.add(scene); else inView.delete(scene);
    });
    playVisible();
  }, { threshold: 0.7 });
  const near = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    scenes.find((s) => s.el === e.target).preload();
    near.unobserve(e.target);
  }), { rootMargin: "900px 0px" });
  scenes.forEach((s) => { seen.observe(s.duo); near.observe(s.el); });

  // =====================================================================
  // 3. The guided tour
  // =====================================================================
  const bar = $("tour"), where = $("tour-where"), pauseBtn = $("tour-pause");

  const bring = (scene) => {
    // Start of the section's words under the header; but if the pair would then be off the bottom
    // (short screens, phones), go far enough down that they and their bubble clear the tour bar.
    const top = scene.el.querySelector(".scene-copy").getBoundingClientRect().top + scrollY - 96;
    const duoBottom = scene.duo.getBoundingClientRect().bottom + scrollY - (innerHeight - 84);
    scrollTo({ top: Math.max(top, duoBottom), behavior: "smooth" });
  };

  function setPaused(p) {
    tour.paused = p;
    pauseBtn.textContent = p ? "Play" : "Pause";
    pauseBtn.setAttribute("aria-pressed", String(p));
    if (p) { clearTimeout(timer); return; }
    bring(scenes[tour.i]);
    const fn = next;
    if (fn) schedule(fn, 700);
  }

  function go(i) {
    if (i >= scenes.length) return exitTour();
    tour.i = i = Math.max(0, i);
    const scene = scenes[i];
    stop();
    where.textContent = `${i + 1} / ${scenes.length} · ${scene.name}`;
    scene.preload();
    bring(scene);
    // Give the scroll a moment to arrive, then talk; a pause after the last line, then the next section.
    schedule(() => play(scene, 0, () => schedule(() => go(i + 1), 1100)), 900);
  }

  function startTour() {
    finish();   // ends the intro, or a welcome-back greeting, if one is playing
    tour.active = true;
    setPausedLabel(false);
    root.classList.add("touring");
    bar.hidden = false;
    $("tour-next").focus({ preventScroll: true });
    go(0);
  }
  const setPausedLabel = (p) => { tour.paused = p; pauseBtn.textContent = p ? "Play" : "Pause"; pauseBtn.setAttribute("aria-pressed", String(p)); };

  exitTour = () => {
    if (!tour.active) return;
    stop();
    tour.active = false;
    setPausedLabel(false);
    root.classList.remove("touring");
    bar.hidden = true;
    scenes.forEach((s) => { s.done = true; });   // seen (or skipped) on the tour: don't replay on scroll
  };

  document.querySelectorAll("[data-tour]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    startTour();
  }));
  $("tour-next").addEventListener("click", () => { cur ? play(cur.scene, cur.k + 1, cur.onEnd) : go(tour.i + 1); });
  $("tour-back").addEventListener("click", () => { cur && cur.k > 0 ? play(cur.scene, cur.k - 1, cur.onEnd) : go(tour.i - 1); });
  $("tour-skip").addEventListener("click", () => go(tour.i + 1));
  $("tour-exit").addEventListener("click", exitTour);
  pauseBtn.addEventListener("click", () => setPaused(!tour.paused));

  // The visitor takes over (scrolls, or clicks something on the page): stop moving the page, keep the place.
  const takeOver = (e) => {
    if (!tour.active || tour.paused) return;
    if (e.target instanceof Element && e.target.closest(".tour, [data-tour]")) return;
    setPaused(true);
  };
  addEventListener("wheel", takeOver, { passive: true });
  addEventListener("touchmove", takeOver, { passive: true });
  addEventListener("pointerdown", takeOver);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (root.classList.contains("intro")) finish();
      else exitTour();
    } else if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) takeOver(e);
  });

  // ---- Start -----------------------------------------------------------
  window.ghulmilStory = { playIntro, finish, startTour, exitTour };
  if (root.classList.contains("intro")) playIntro();
  else welcomeBack();
})();
