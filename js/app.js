/*
  Wires everything together: filters, sorting, density, keyboard navigation
  and shortcuts, the census strip, the sync indicator, demo controls and
  the night mode toggle.
*/
(function () {
  const SH = (window.SH = window.SH || {});
  const store = SH.store;
  const { agoLabel, currentShift } = SH.fmt;

  const $ = (sel) => document.querySelector(sel);
  const rosterEl = $("#roster");
  const countEl = $("#result-count");
  const clearBtn = $("#clear-filters");
  const filtersForm = $("#filters");

  let loading = true;
  let hasRendered = false;
  let visibleIds = [];
  let activeRowId = null; // the one row in the Tab order (roving tabindex)

  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* not critical */ } },
  };

  /* ---------- Filters and sort ---------- */

  const DEFAULT_SORT = "priority";

  function readFilters() {
    const data = new FormData(filtersForm);
    return {
      acuity: data.getAll("acuity").map(Number),
      attention: data.has("attention"),
      tasks: data.get("tasks") || "any",
      sort: data.get("sort") || DEFAULT_SORT,
    };
  }

  const TASK_LABELS = { open: "Has open tasks", overdue: "Has overdue tasks", clear: "All tasks done" };

  /* Plain-language list of what's currently filtering the board. */
  function describeFilters(f) {
    const out = [];
    if (f.acuity.length) {
      const names = f.acuity.sort((a, b) => b - a).map((n) => SH.fmt.ACUITY[n]);
      out.push(`${names.join(" or ")} acuity`);
    }
    if (f.attention) out.push("Needs attention");
    if (f.tasks !== "any") out.push(TASK_LABELS[f.tasks]);
    return out;
  }

  const isFiltered = (f) => f.acuity.length > 0 || f.attention || f.tasks !== "any";

  function matches(p, f, now) {
    if (f.acuity.length && !f.acuity.includes(p.acuity)) return false;
    if (f.attention && !store.needsAttention(p, now)) return false;
    const open = store.openTasks(p).length;
    if (f.tasks === "open" && !open) return false;
    if (f.tasks === "overdue" && !store.overdueTasks(p, now).length) return false;
    if (f.tasks === "clear" && open) return false;
    return true;
  }

  const byRoom = (a, b) => a.room.localeCompare(b.room, undefined, { numeric: true });

  const SORTS = {
    // Needs attention first, then sickest first, then room order.
    priority: (a, b, now) =>
      store.needsAttention(b, now) - store.needsAttention(a, now) || b.acuity - a.acuity || byRoom(a, b),
    room: (a, b) => byRoom(a, b),
    tasks: (a, b) => store.openTasks(b).length - store.openTasks(a).length || byRoom(a, b),
    // Who hasn't anyone looked at in a while?
    stale: (a, b) => a.updatedAt - b.updatedAt,
  };

  const sorted = (list, f, now = Date.now()) => list.slice().sort((a, b) => SORTS[f.sort](a, b, now));

  /* Board order for the palette and for drawer next/previous. */
  const boardOrder = () => visibleIds.slice();
  function navOrder(id) {
    // A patient opened from search may be filtered out of the board: then walk the whole unit.
    if (visibleIds.includes(id)) return visibleIds.slice();
    return sorted(store.patients(), readFilters()).map((p) => p.id);
  }

  /* ---------- Rendering ---------- */

  function renderCensus(patients, now) {
    const attention = patients.filter((p) => store.needsAttention(p, now)).length;
    const open = patients.reduce((n, p) => n + store.openTasks(p).length, 0);
    const overdue = patients.reduce((n, p) => n + store.overdueTasks(p, now).length, 0);

    setCount($("#census-patients"), patients.length);
    setCount($("#census-attention"), attention);
    setCount($("#census-open"), open);
    setCount($("#census-overdue"), overdue);
    $("#census-attention").closest(".census__item").classList.toggle("is-alert", attention > 0);
    $("#census-overdue").closest(".census__item").classList.toggle("is-caution", overdue > 0);
  }

  /* Update a number, and nudge it if it changed while someone was looking. */
  function setCount(el, value) {
    const next = String(value);
    if (el.textContent === next) return;
    el.textContent = next;
    if (!loading && hasRendered) SH.motion.bump(el);
  }

  function renderChipCounts(patients, now) {
    for (const level of [1, 2, 3]) {
      $(`[data-count="acuity-${level}"]`).textContent = patients.filter((p) => p.acuity === level).length;
    }
    $('[data-count="attention"]').textContent = patients.filter((p) => store.needsAttention(p, now)).length;
  }

  function render() {
    const now = Date.now();
    const all = store.patients();
    const f = readFilters();

    renderCensus(all, now);
    renderChipCounts(all, now);
    clearBtn.hidden = !isFiltered(f);
    filtersForm.toggleAttribute("inert", loading || all.length === 0);
    $("#census").classList.toggle("is-loading", loading);

    if (loading) {
      visibleIds = [];
      rosterEl.setAttribute("aria-busy", "true");
      rosterEl.innerHTML = SH.board.loading();
      countEl.textContent = "Loading patients";
      return;
    }
    rosterEl.removeAttribute("aria-busy");

    if (!all.length) {
      visibleIds = [];
      rosterEl.innerHTML = SH.board.emptyUnit();
      countEl.textContent = "No patients assigned";
      SH.motion.fadeUp(rosterEl.querySelector(".empty"));
      return;
    }

    const shown = sorted(all.filter((p) => matches(p, f, now)), f, now);
    visibleIds = shown.map((p) => p.id);
    countEl.textContent = shown.length === all.length
      ? `Showing all ${all.length} patients`
      : `Showing ${shown.length} of ${all.length} patients`;

    // If a row had focus, it gets it back after the re-render (or the nearest row does).
    const focusedId = document.activeElement?.closest?.("#roster .row")?.dataset.id;

    // FLIP: measure rows, swap the markup, then let rows glide to their new spots.
    const before = SH.motion.snapshot(rosterEl, ".row[data-id]");
    const hadNoMatches = Boolean(rosterEl.querySelector(".empty"));
    rosterEl.innerHTML = shown.length ? SH.board.table(shown) : SH.board.noMatches(describeFilters(f));
    if (shown.length) SH.motion.flip(rosterEl, ".row[data-id]", before);
    else if (!hadNoMatches) SH.motion.fadeUp(rosterEl.querySelector(".empty"));
    hasRendered = true;

    applyRoving();
    if (focusedId) {
      if (visibleIds.includes(focusedId)) focusRow(focusedId);
      else (rowButtons()[0] || $("#roster-title")).focus();
    }
  }

  /* ---------- Roving focus in the list ---------- */

  const rowButtons = () => [...rosterEl.querySelectorAll(".who__name")];

  /* Only one row is in the Tab order. Arrow keys move between rows from there. */
  function applyRoving() {
    const buttons = rowButtons();
    if (!buttons.length) return;
    if (!visibleIds.includes(activeRowId)) activeRowId = visibleIds[0];
    buttons.forEach((b) => (b.tabIndex = b.dataset.open === activeRowId ? 0 : -1));
  }

  function focusRow(id) {
    const btn = rosterEl.querySelector(`[data-open="${id}"]`);
    if (btn) {
      activeRowId = id;
      applyRoving();
      btn.focus();
    } else {
      $("#roster-title").focus();
    }
  }

  function moveRow(from, to) {
    const buttons = rowButtons();
    if (!buttons.length) return;
    const i = buttons.findIndex((b) => b.dataset.open === from);
    const target = to === "first" ? 0 : to === "last" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, i + to));
    focusRow(buttons[target].dataset.open);
    buttons[target].closest(".row").scrollIntoView({ block: "nearest" });
  }

  const ROW_KEYS = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1, Home: "first", End: "last" };

  function onRosterKey(e) {
    if (!e.target.matches(".who__name") || e.ctrlKey || e.metaKey || e.altKey) return;
    const move = ROW_KEYS[e.key];
    if (move === undefined) return;
    e.preventDefault();
    moveRow(e.target.dataset.open, move);
  }

  /* ---------- Density ---------- */

  function setDensity(value, { animate = true } = {}) {
    const before = animate ? SH.motion.snapshot(rosterEl, ".row[data-id]") : new Map();
    document.documentElement.dataset.density = value;
    const radio = $(`input[name="density"][value="${value}"]`);
    if (radio) radio.checked = true;
    placeThumbs();
    storage.set("steadyhand:density", value);
    if (animate) SH.motion.flip(rosterEl, ".row[data-id]", before);
  }

  const toggleDensity = () =>
    setDensity(document.documentElement.dataset.density === "compact" ? "comfortable" : "compact");

  /* ---------- Global shortcuts ---------- */

  function onGlobalKey(e) {
    if (e.defaultPrevented || document.querySelector("dialog[open]")) return;
    const typing = e.target.closest("input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable]");

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      return SH.palette.open();
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || loading) return;

    switch (e.key) {
      case "/":
        e.preventDefault();
        return SH.palette.open();
      case "?":
        e.preventDefault();
        return SH.modal.open($("#shortcuts"), { focus: "[data-close-modal]" });
      case "a":
        e.preventDefault();
        return filtersForm.querySelector('input[name="attention"]').click();
      case "d":
        e.preventDefault();
        return toggleDensity();
      case "j":
      case "k":
        // From anywhere on the page, J/K drop you into the list.
        if (!e.target.matches(".who__name") && visibleIds.length) {
          e.preventDefault();
          focusRow(activeRowId || visibleIds[0]);
        }
    }
  }

  /* ---------- Sync indicator ---------- */

  const syncEl = $("#sync-status");
  let pending = 0;

  SH.sync = {
    track(promise) {
      pending++;
      syncEl.dataset.state = "saving";
      syncEl.querySelector("[data-slot]").textContent = "Saving";
      promise.finally(() => {
        if (--pending === 0) {
          syncEl.dataset.state = "saved";
          syncEl.querySelector("[data-slot]").textContent = "All changes saved";
          SH.motion.animate(syncEl.querySelector(".sync__dot"), [{ transform: "scale(1.9)" }, { transform: "none" }]);
        }
      });
      return promise;
    },
  };

  /* ---------- Loading (simulated fetch) ---------- */

  function simulateLoad(ms = 550) {
    loading = true;
    render();
    setTimeout(() => {
      loading = false;
      render();
    }, ms);
  }

  /* ---------- Theme ---------- */

  function initTheme() {
    const btn = $("#theme-toggle");
    const sync = () => {
      const dark = document.documentElement.dataset.theme === "dark";
      btn.setAttribute("aria-pressed", String(dark));
      btn.querySelector("use").setAttribute("href", dark ? "#i-sun" : "#i-moon");
    };
    btn.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      storage.set("steadyhand:theme", next);
      sync();
      SH.motion.animate(btn.querySelector("svg"), [{ transform: "rotate(-90deg) scale(0.6)", opacity: 0 }, { transform: "none", opacity: 1 }]);
    });
    sync();
  }

  /* ---------- Segmented control thumbs ---------- */

  const segmentedControls = [...document.querySelectorAll(".segmented")];

  function placeThumb(seg) {
    const face = seg.querySelector("input:checked + span");
    const thumb = seg.querySelector(".segmented__thumb");
    if (!face || !thumb) return;
    const track = seg.getBoundingClientRect();
    const rect = face.getBoundingClientRect();
    thumb.style.width = `${rect.width}px`;
    thumb.style.transform = `translateX(${rect.left - track.left - seg.clientLeft}px)`;
  }
  const placeThumbs = () => segmentedControls.forEach(placeThumb);

  function initThumbs() {
    placeThumbs();
    // Only animate once in place, so the first paint doesn't slide in from the left.
    requestAnimationFrame(() => segmentedControls.forEach((s) => s.querySelector(".segmented__thumb")?.classList.add("is-ready")));
    const ro = new ResizeObserver(placeThumbs);
    segmentedControls.forEach((s) => ro.observe(s));
    document.fonts?.ready.then(placeThumbs);
  }

  /* ---------- Events ---------- */

  function clearFilters() {
    filtersForm.querySelectorAll('input[type="checkbox"]').forEach((el) => (el.checked = false));
    filtersForm.querySelector('input[name="tasks"][value="any"]').checked = true;
    filtersForm.querySelector("#sort").value = DEFAULT_SORT;
    placeThumbs();
    render();
  }

  function init() {
    store.load();
    SH.drawer.init();
    SH.palette.init();
    SH.modal.wire($("#shortcuts"));

    const shift = currentShift();
    $("#shift-label").textContent = `${shift.name} shift`;
    $("#shift-since").textContent = `since ${shift.start}`;
    $("#shift-icon").setAttribute("href", shift.name === "Day" ? "#i-sun" : "#i-moon");
    initTheme();
    setDensity(storage.get("steadyhand:density") === "compact" ? "compact" : "comfortable", { animate: false });
    initThumbs();

    // "input" fires on every checkbox, radio and select change: the list updates instantly.
    filtersForm.addEventListener("input", (e) => {
      if (e.target.name === "tasks") placeThumbs();
      render();
    });
    filtersForm.addEventListener("submit", (e) => e.preventDefault());
    $("#density").addEventListener("change", (e) => setDensity(e.target.value));

    clearBtn.addEventListener("click", () => {
      clearFilters();
      $("#roster-title").focus();
    });

    $("#open-palette").addEventListener("click", () => SH.palette.open());
    $("#open-shortcuts").addEventListener("click", () => SH.modal.open($("#shortcuts"), { focus: "[data-close-modal]" }));

    rosterEl.addEventListener("keydown", onRosterKey);
    rosterEl.addEventListener("focusin", (e) => {
      if (e.target.matches(".who__name") && e.target.dataset.open !== activeRowId) {
        activeRowId = e.target.dataset.open;
        applyRoving();
      }
    });
    rosterEl.addEventListener("click", (e) => {
      const opener = e.target.closest("[data-open]");
      if (opener) {
        activeRowId = opener.dataset.open;
        applyRoving();
        return SH.drawer.open(opener.dataset.open);
      }
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (action === "clear-filters") {
        clearFilters();
        $("#roster-title").focus();
      }
      if (action === "load-sample") {
        store.setEmpty(false);
        simulateLoad();
        $("#roster-title").focus();
      }
    });
    document.addEventListener("keydown", onGlobalKey);

    $("#demo-controls").addEventListener("click", (e) => {
      const action = e.target.closest("[data-demo]")?.dataset.demo;
      if (action === "loading") simulateLoad(1600);
      if (action === "empty") store.setEmpty(true);
      if (action === "reset") {
        store.reset();
        clearFilters();
        simulateLoad();
      }
    });

    // Any change to the data repaints the board behind the drawer.
    store.subscribe(render);

    // Keep relative times honest without re-rendering (and stealing focus from) anything.
    setInterval(() => {
      document.querySelectorAll("time[data-ago]").forEach((t) => {
        t.textContent = agoLabel(Number(t.dataset.ago), t.dataset.prefix);
      });
    }, 30000);

    // Deep link for screenshots: ?state=empty or ?state=loading
    const preview = new URLSearchParams(location.search).get("state");
    if (preview === "empty") {
      store.setEmpty(true);
      loading = false;
      render();
    } else if (preview === "loading") {
      loading = true;
      render();
    } else {
      if (store.isEmpty()) store.setEmpty(false);
      simulateLoad();
    }
  }

  SH.app = { focusRow, boardOrder, navOrder };
  init();
})();
