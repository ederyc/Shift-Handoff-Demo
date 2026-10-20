/*
  Motion helpers. JS-driven animations read their duration and easing from
  the same CSS tokens as everything else, so a row sliding into place feels
  like the check-off and the drawer, not like a separate system.

  Every helper is a no-op under prefers-reduced-motion: the end state
  still happens, just instantly.
*/
(function () {
  const SH = (window.SH = window.SH || {});
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => mq.matches;

  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ms = (name) => parseFloat(token(name)) || 0;

  function animate(el, keyframes, { dur = "--dur-slow", ease = "--ease-settle", delay = 0 } = {}) {
    if (reduced() || !el || !el.animate) return null;
    return el.animate(keyframes, { duration: ms(dur), easing: token(ease), delay, fill: "backwards" });
  }

  /*
    Position in layout space (summed offsets). Unlike getBoundingClientRect it
    ignores ancestor transforms, so FLIP stays exact inside the tilted desktop
    window. The element's own in-flight translate is added back, so a reorder
    that interrupts another one redirects smoothly instead of jumping.
  */
  function layoutPos(el) {
    let left = 0;
    let top = 0;
    for (let n = el; n; n = n.offsetParent) {
      left += n.offsetLeft;
      top += n.offsetTop;
    }
    const t = getComputedStyle(el).transform;
    if (t && t !== "none") {
      const m = new DOMMatrixReadOnly(t);
      left += m.e;
      top += m.f;
    }
    return { left, top };
  }

  /* FLIP, step one: remember where every keyed element is right now. */
  function snapshot(container, selector) {
    const rects = new Map();
    if (reduced()) return rects;
    container.querySelectorAll(selector).forEach((el) => rects.set(el.dataset.id, layoutPos(el)));
    return rects;
  }

  /*
    FLIP, step two (after the DOM changed): elements that existed before slide
    from their old spot to the new one, new ones fade up into place. On a
    first reveal (nothing before) new rows come in with a short stagger.
  */
  function flip(container, selector, before) {
    if (reduced()) return;
    const firstReveal = before.size === 0;
    let entering = 0;
    container.querySelectorAll(selector).forEach((el) => {
      const prev = before.get(el.dataset.id);
      if (prev) {
        const now = layoutPos(el);
        const dx = prev.left - now.left;
        const dy = prev.top - now.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        animate(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }]);
      } else {
        animate(el, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
          dur: "--dur-slow",
          delay: firstReveal ? Math.min(entering++, 8) * 24 : 0,
        });
      }
    });
  }

  /* A small nudge for a value that just changed, like a census count. */
  const bump = (el) =>
    animate(el, [{ transform: "translateY(-0.3em)", opacity: 0.35 }, { transform: "none", opacity: 1 }], { dur: "--dur-base" });

  const fadeUp = (el, delay = 0, distance = 8) =>
    animate(el, [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: "none" }], { delay });

  SH.motion = { reduced, token, ms, animate, snapshot, flip, bump, fadeUp };
})();
