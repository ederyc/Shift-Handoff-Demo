/*
  Desktop shell behavior. The window is a presentation layer only: the app
  inside works the same with or without it, and nothing here is needed to
  use the app (the drag is a flourish; the keyboard never touches it).

  1. Keyboard scrolling: in windowed mode the page doesn't scroll, the window
     body does, so Page Down / Space / Home / End are forwarded to it when
     nothing is focused.
  2. Engagement: the window tilts at rest and lies flat while in use.
  3. Dragging: the title bar moves the window, with a springy landing.
*/
(function () {
  const SH = (window.SH = window.SH || {});

  const win = document.getElementById("app-window");
  const handle = document.getElementById("window-handle");
  const body = document.getElementById("window-body");

  /* Windowed mode is decided by CSS alone (css/shell.css), so ask the CSS. */
  const windowed = () => getComputedStyle(handle).display !== "none";

  let drag = null; // { id, grabX, grabY } while a pointer holds the title bar

  /* ---------- 1. Keyboard scrolling ---------- */

  const SCROLL_KEYS = {
    PageDown: (h) => h * 0.9,
    PageUp: (h) => -h * 0.9,
    " ": (h, e) => (e.shiftKey ? -h * 0.9 : h * 0.9),
    ArrowDown: () => 48,
    ArrowUp: () => -48,
    Home: () => -Infinity,
    End: () => Infinity,
  };

  document.addEventListener("keydown", (e) => {
    const step = SCROLL_KEYS[e.key];
    if (!step || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.activeElement !== document.body || document.querySelector("dialog[open]") || !windowed()) return;
    e.preventDefault();
    const delta = step(body.clientHeight, e);
    const top = delta === Infinity ? body.scrollHeight : delta === -Infinity ? 0 : body.scrollTop + delta;
    body.scrollTo({ top, behavior: SH.motion.reduced() ? "auto" : "smooth" });
  });

  /* ---------- 2. Engagement ----------
    The window lies flat while someone is working in it (text on a tilted
    layer renders softer). It starts flattening when the pointer comes within
    40px, so the (at most 8px) shift is over before the pointer reaches a
    target. Leaving needs the pointer clearly away (72px past the edge for a
    quarter second), because flattening changes the window's footprint
    slightly and a pointer parked on the edge would otherwise flip it back
    and forth. A drag holds it flat throughout. */

  const ENTER_MARGIN = 40;
  const LEAVE_MARGIN = 72;
  const LEAVE_DELAY = 250;
  let engaged = false;
  let leaveTimer = null;

  function setEngaged(on) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
    if (engaged === on) return;
    engaged = on;
    win.classList.toggle("is-engaged", on);
  }

  function scheduleLeave() {
    if (engaged && !leaveTimer && !drag) leaveTimer = setTimeout(() => setEngaged(false), LEAVE_DELAY);
  }

  function track(e) {
    if (!windowed() || drag) return;
    const r = win.getBoundingClientRect();
    const m = engaged ? LEAVE_MARGIN : ENTER_MARGIN;
    const inside = e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m;
    if (inside) setEngaged(true);
    else scheduleLeave();
  }

  document.addEventListener("pointermove", track, { passive: true });
  document.addEventListener("pointerdown", track, { passive: true });
  document.documentElement.addEventListener("pointerleave", scheduleLeave);

  /* ---------- 3. Dragging ----------
    Pointer Events, so mouse, pen and touch share one path. The window
    tracks the pointer 1:1 (its translate is never transitioned), so the
    physical feel lives in scale alone:
    - pick up: a jelly wobble (squash wide, stretch tall, settle) into the lift
    - put down: a plop (drop, squash on impact, one rebound, settle), and at
      the moment of impact, rings ripple out from under the window like water.
    Jelly, not a shake: a side-to-side shake is the usual "that was wrong"
    signal, which is the wrong message for picking something up.
    With reduced motion none of it plays; the window just moves. */

  const KEEP_VISIBLE = 160; // px of title bar that always stays on screen to grab again
  const EDGE = 16; // the tilt at rest pushes the near edges out a few px; this absorbs it
  let offset = { x: 0, y: 0 };
  let landTimer = null;

  /* The window's untransformed box. The desk is fixed to the viewport, so
     these offsets are already viewport coordinates. */
  function bounds() {
    const keep = Math.min(KEEP_VISIBLE, win.offsetWidth) + EDGE;
    return {
      minX: keep - win.offsetLeft - win.offsetWidth,
      maxX: innerWidth - keep - win.offsetLeft,
      minY: EDGE - win.offsetTop,
      maxY: innerHeight - handle.offsetHeight - EDGE - win.offsetTop,
    };
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function moveTo(x, y) {
    const b = bounds();
    offset = { x: clamp(x, b.minX, b.maxX), y: clamp(y, b.minY, b.maxY) };
    // Set translate directly, not through a custom property: custom properties
    // inherit, so changing one restyles the entire app inside the window on
    // every pointer move. translate touches only the window, and below the
    // breakpoint the window has no box (display: contents), so it's ignored.
    win.style.translate = `${offset.x}px ${offset.y}px`;
  }

  const lift = () => parseFloat(SH.motion.token("--lift-scale")) || 1;
  let bodyAnim = null; // the jelly or plop currently playing on the window

  function playOnWindow(frames, durToken) {
    bodyAnim?.cancel();
    bodyAnim = SH.motion.reduced() ? null : win.animate(frames, { duration: SH.motion.ms(durToken) });
  }

  /* Damped squash and stretch, ending exactly on the lifted scale that CSS holds while dragging. */
  function jelly() {
    const l = lift();
    playOnWindow([
      { transform: "scale(1, 1)", easing: "ease-out" },
      { transform: `scale(${l * 1.018}, ${l * 0.984})`, offset: 0.26, easing: "ease-in-out" },
      { transform: `scale(${l * 0.992}, ${l * 1.01})`, offset: 0.52, easing: "ease-in-out" },
      { transform: `scale(${l * 1.004}, ${l * 0.997})`, offset: 0.78, easing: "ease-in-out" },
      { transform: `scale(${l}, ${l})` },
    ], "--dur-jelly");
  }

  /* Drop (accelerating), squash on impact, rebound, settle at rest. */
  const IMPACT = 0.32; // fraction of the plop where it hits the desk
  function plop() {
    const l = lift();
    playOnWindow([
      { transform: `scale(${l}, ${l})`, easing: "cubic-bezier(0.5, 0, 0.9, 0.5)" },
      { transform: "scale(1.012, 0.984)", offset: IMPACT, easing: "ease-out" },
      { transform: "scale(0.995, 1.006)", offset: 0.6, easing: "ease-in-out" },
      { transform: "scale(1.002, 0.999)", offset: 0.82, easing: "ease-in-out" },
      { transform: "scale(1, 1)" },
    ], "--dur-plop");
    ripple(SH.motion.ms("--dur-plop") * IMPACT);
  }

  /* Rings spreading out from under the window: [start delay, reach px, opacity, duration share]. */
  const RINGS = [
    [0, 70, 0.9, 0.8],
    [140, 116, 0.6, 0.95],
    [280, 160, 0.35, 1.1],
  ];

  function ripple(delay = 0) {
    if (SH.motion.reduced()) return;
    const x = win.offsetLeft + offset.x;
    const y = win.offsetTop + offset.y;
    const w = win.offsetWidth;
    const h = win.offsetHeight;
    const radius = parseFloat(getComputedStyle(win).borderTopLeftRadius) || 0;
    const box = (grow) => ({
      left: `${x - grow}px`,
      top: `${y - grow}px`,
      width: `${w + grow * 2}px`,
      height: `${h + grow * 2}px`,
      borderRadius: `${radius + grow}px`,
    });
    const dur = SH.motion.ms("--dur-ripple");
    for (const [stagger, reach, alpha, share] of RINGS) {
      const ring = document.createElement("span");
      ring.className = "window-ripple";
      ring.setAttribute("aria-hidden", "true");
      Object.assign(ring.style, box(0));
      win.before(ring); // under the window, on the backdrop
      const anim = ring.animate(
        [
          { ...box(0), opacity: alpha },
          { ...box(reach), opacity: 0 },
        ],
        { duration: dur * share, delay: delay + stagger, easing: SH.motion.token("--ease-settle"), fill: "both" }
      );
      anim.onfinish = anim.oncancel = () => ring.remove();
    }
  }

  function land() {
    win.classList.remove("is-dragging");
    win.classList.add("is-landing");
    plop();
    clearTimeout(landTimer);
    landTimer = setTimeout(() => win.classList.remove("is-landing"), SH.motion.ms("--dur-plop") + 50);
  }

  handle.addEventListener("pointerdown", (e) => {
    if (!windowed() || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault(); // no text selection, no focus change
    handle.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, grabX: e.clientX - offset.x, grabY: e.clientY - offset.y };
    clearTimeout(landTimer);
    win.classList.remove("is-landing");
    win.classList.add("is-dragging");
    setEngaged(true);
    jelly();
  });

  handle.addEventListener("pointermove", (e) => {
    if (drag && e.pointerId === drag.id) moveTo(e.clientX - drag.grabX, e.clientY - drag.grabY);
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    land();
  }
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
  handle.addEventListener("lostpointercapture", endDrag);

  /* Double-click the title bar to send the window home on the spring curve,
     with a ripple when it arrives. */
  handle.addEventListener("dblclick", () => {
    if (!windowed() || (offset.x === 0 && offset.y === 0)) return;
    const from = `${offset.x}px ${offset.y}px`;
    moveTo(0, 0);
    SH.motion.animate(win, [{ translate: from }, { translate: "0px 0px" }], { dur: "--dur-land", ease: "--ease-spring" });
    ripple(SH.motion.ms("--dur-land") * 0.55);
  });

  /* A smaller viewport could strand the title bar: pull it back in bounds.
     If the window steps aside entirely, any ripple still spreading goes too. */
  addEventListener("resize", () => {
    if (windowed()) moveTo(offset.x, offset.y);
    else document.querySelectorAll(".window-ripple").forEach((r) => r.getAnimations().forEach((a) => a.cancel()));
  });

  SH.shell = { windowed, isEngaged: () => engaged, offset: () => ({ ...offset }) };
})();
