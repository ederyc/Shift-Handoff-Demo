/*
  Jump to patient. A combobox (ARIA 1.2 pattern): focus stays in the text
  field, arrow keys move a highlighted option via aria-activedescendant,
  Enter opens that patient's drawer.

  Matches on name or room. Name matches that start a word rank above ones
  buried mid-word, so "bri" finds Brisco before "Sabrina".
*/
(function () {
  const SH = (window.SH = window.SH || {});
  const { esc, icon, ACUITY } = SH.fmt;
  const store = SH.store;

  let dlg, input, list, empty, status;
  let results = [];
  let active = 0;

  function score(p, q) {
    if (!q) return 1;
    const name = p.name.toLowerCase();
    if (p.room.startsWith(q)) return 4;
    if (name.startsWith(q)) return 3;
    if (name.split(/\s+/).some((w) => w.startsWith(q))) return 2;
    if (name.includes(q)) return 1;
    return 0;
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return esc(text);
    return `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`;
  }

  function option(p, i, q) {
    const attention = store.needsAttention(p);
    const open = store.openTasks(p).length;
    return `
      <li role="option" id="opt-${p.id}" class="opt${i === active ? " is-active" : ""}" data-id="${p.id}" aria-selected="${i === active}">
        <span class="opt__room">${highlight(p.room, q)}</span>
        <span class="opt__main">
          <span class="opt__name">${highlight(p.name, q)}</span>
          <span class="opt__meta">${ACUITY[p.acuity]} acuity, ${open ? `${open} open ${open === 1 ? "task" : "tasks"}` : "all tasks done"}</span>
        </span>
        ${attention ? `<span class="opt__attn">${icon("alert")}<span class="opt__attn-label">Needs attention</span></span>` : ""}
      </li>`;
  }

  function update() {
    const q = input.value.trim().toLowerCase();
    const order = SH.app.boardOrder();
    results = store
      .patients()
      .map((p) => ({ p, s: score(p, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || order.indexOf(a.p.id) - order.indexOf(b.p.id))
      .map((r) => r.p);
    active = Math.min(active, Math.max(results.length - 1, 0));

    list.innerHTML = results.map((p, i) => option(p, i, q)).join("");
    empty.hidden = results.length > 0;
    empty.textContent = `No patient matches "${input.value.trim()}".`;
    input.setAttribute("aria-activedescendant", results.length ? `opt-${results[active].id}` : "");
    status.textContent = results.length === 1 ? "1 patient" : `${results.length} patients`;
  }

  function setActive(i) {
    if (!results.length) return;
    active = (i + results.length) % results.length;
    list.querySelectorAll(".opt").forEach((el, n) => {
      el.classList.toggle("is-active", n === active);
      el.setAttribute("aria-selected", String(n === active));
    });
    const el = list.children[active];
    input.setAttribute("aria-activedescendant", el.id);
    el.scrollIntoView({ block: "nearest" });
  }

  function choose(id) {
    if (!id) return;
    SH.modal.close(dlg, { restore: false });
    SH.drawer.open(id);
  }

  function onKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Home" && e.ctrlKey) { e.preventDefault(); setActive(0); }
    else if (e.key === "End" && e.ctrlKey) { e.preventDefault(); setActive(results.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[active]?.id); }
  }

  function open() {
    if (!store.patients().length) return;
    input.value = "";
    active = 0;
    update();
    SH.modal.open(dlg, { focus: "#palette-input" });
  }

  function init() {
    dlg = document.getElementById("palette");
    input = document.getElementById("palette-input");
    list = document.getElementById("palette-list");
    empty = dlg.querySelector(".palette__empty");
    status = document.getElementById("palette-status");
    SH.modal.wire(dlg);

    input.addEventListener("input", () => { active = 0; update(); });
    input.addEventListener("keydown", onKey);
    list.addEventListener("click", (e) => choose(e.target.closest(".opt")?.dataset.id));
    list.addEventListener("mousemove", (e) => {
      const el = e.target.closest(".opt");
      if (el) setActive([...list.children].indexOf(el));
    });
  }

  SH.palette = { init, open };
})();
