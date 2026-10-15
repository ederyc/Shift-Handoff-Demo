/* Small formatting and markup helpers shared by the board and the drawer. */
(function () {
  const SH = (window.SH = window.SH || {});

  const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ENTITIES[c]);

  const clockFmt = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const clock = (ts) => clockFmt.format(ts);

  function ago(ts, now = Date.now()) {
    const m = Math.round((now - ts) / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? "Yesterday" : `${d} days ago`;
  }

  function minutesUntil(ts, now = Date.now()) {
    return Math.round((ts - now) / 60000);
  }

  /* "Just now" on its own, "Updated just now" after a prefix. */
  const agoLabel = (ts, prefix = "") => (prefix ? prefix + ago(ts).replace(/^Just/, "just") : ago(ts));

  /* A <time> that app.js keeps fresh every 30 seconds. */
  const timeAgo = (ts, prefix = "") =>
    `<time datetime="${new Date(ts).toISOString()}" data-ago="${ts}" data-prefix="${esc(prefix)}" title="${clock(ts)}">${agoLabel(ts, prefix)}</time>`;

  /* Two 12-hour shifts, 07:00 and 19:00, based on the viewer's clock. */
  function currentShift(now = new Date()) {
    const h = now.getHours();
    return h >= 7 && h < 19 ? { name: "Day", start: "07:00" } : { name: "Night", start: "19:00" };
  }

  const icon = (name, cls = "icon") =>
    `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;

  const ACUITY = { 1: "Low", 2: "Medium", 3: "High" };

  /* Acuity reads by text first, bar count second. Color stays neutral on purpose. */
  function acuity(level) {
    const bars = [1, 2, 3]
      .map((n) => `<rect x="${(n - 1) * 5}" y="${12 - n * 4}" width="3" height="${n * 4}" rx="1" class="${n <= level ? "on" : "off"}"/>`)
      .join("");
    return `<span class="acuity acuity--${level}"><svg class="acuity__bars" viewBox="0 0 13 12" aria-hidden="true" focusable="false">${bars}</svg>${ACUITY[level]}<span class="vh"> acuity</span></span>`;
  }

  function vital(p, key) {
    const def = SH.store.VITALS[key];
    const off = def.check(p.vitals);
    const flag = off
      ? `<span class="vital__flag" aria-hidden="true">${off === "high" ? "↑" : "↓"}</span><span class="vh">, ${off}</span>`
      : "";
    return { def, off, flag, value: def.value(p.vitals) };
  }

  SH.fmt = { esc, clock, ago, agoLabel, currentShift, minutesUntil, timeAgo, icon, acuity, vital, ACUITY };
})();
