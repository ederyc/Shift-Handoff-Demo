/*
  Wires everything together: filters, sorting, the census strip, the
  sync indicator, demo controls and the night mode toggle.
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
      rosterEl.setAttribute("aria-busy", "true");
      rosterEl.innerHTML = SH.board.loading();
      countEl.textContent = "Loading patients";
      return;
    }
    rosterEl.removeAttribute("aria-busy");

    if (!all.length) {
      rosterEl.innerHTML = SH.board.emptyUnit();
      countEl.textContent = "No patients assigned";
      SH.motion.fadeUp(rosterEl.querySelector(".empty"));
      return;
    }

    const shown = all.filter((p) => matches(p, f, now)).sort((a, b) => SORTS[f.sort](a, b, now));
    countEl.textContent = shown.length === all.length
      ? `Showing all ${all.length} patients`
      : `Showing ${shown.length} of ${all.length} patients`;

    // FLIP: measure rows, swap the markup, then let rows glide to their new spots.
    const before = SH.motion.snapshot(rosterEl, ".row[data-id]");
    const hadNoMatches = Boolean(rosterEl.querySelector(".empty"));
    rosterEl.innerHTML = shown.length ? SH.board.table(shown) : SH.board.noMatches(describeFilters(f));
    if (shown.length) SH.motion.flip(rosterEl, ".row[data-id]", before);
    else if (!hadNoMatches) SH.motion.fadeUp(rosterEl.querySelector(".empty"));
    hasRendered = true;
  }

  /* After the drawer closes, put focus back on that patient's row if it's still listed. */
  function focusRow(id) {
    const btn = rosterEl.querySelector(`[data-open="${id}"]`);
    (btn || $("#roster-title")).focus();
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
      try {
        localStorage.setItem("steadyhand:theme", next);
      } catch (e) {}
      sync();
      SH.motion.animate(btn.querySelector("svg"), [{ transform: "rotate(-90deg) scale(0.6)", opacity: 0 }, { transform: "none", opacity: 1 }]);
    });
    sync();
  }

  /* ---------- Segmented control thumb ---------- */

  const segmented = $(".segmented");
  const thumb = segmented.querySelector(".segmented__thumb");

  function placeThumb() {
    const face = segmented.querySelector("input:checked + span");
    if (!face) return;
    const track = segmented.getBoundingClientRect();
    const rect = face.getBoundingClientRect();
    thumb.style.width = `${rect.width}px`;
    thumb.style.transform = `translateX(${rect.left - track.left - segmented.clientLeft}px)`;
  }

  function initThumb() {
    placeThumb();
    // Only animate once it's in place, so the first paint doesn't slide in from the left.
    requestAnimationFrame(() => thumb.classList.add("is-ready"));
    new ResizeObserver(placeThumb).observe(segmented);
    document.fonts?.ready.then(placeThumb);
  }

  /* ---------- Events ---------- */

  function clearFilters() {
    filtersForm.querySelectorAll('input[type="checkbox"]').forEach((el) => (el.checked = false));
    filtersForm.querySelector('input[name="tasks"][value="any"]').checked = true;
    filtersForm.querySelector("#sort").value = DEFAULT_SORT;
    placeThumb();
    render();
  }

  function init() {
    store.load();
    SH.drawer.init();
    const shift = currentShift();
    $("#shift-label").textContent = `${shift.name} shift`;
    $("#shift-since").textContent = `since ${shift.start}`;
    $("#shift-icon").setAttribute("href", shift.name === "Day" ? "#i-sun" : "#i-moon");
    initTheme();

    initThumb();

    // "input" fires on every checkbox, radio and select change: the list updates instantly.
    filtersForm.addEventListener("input", (e) => {
      if (e.target.name === "tasks") placeThumb();
      render();
    });
    filtersForm.addEventListener("submit", (e) => e.preventDefault());

    clearBtn.addEventListener("click", () => {
      clearFilters();
      $("#roster-title").focus();
    });

    rosterEl.addEventListener("click", (e) => {
      const opener = e.target.closest("[data-open]");
      if (opener) return SH.drawer.open(opener.dataset.open);
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

  SH.app = { focusRow };
  init();
})();
