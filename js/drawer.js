/*
  Patient detail drawer. Built on a native modal <dialog>, which gives us
  inert background content and Escape handling for free. On top of that:
  an explicit Tab wrap, an animated open/close, and focus returned to the
  row that opened it.

  Task check-offs patch the drawer DOM in place instead of re-rendering,
  so the check animation is never interrupted by a repaint.
*/
(function () {
  const SH = (window.SH = window.SH || {});
  const { esc, clock, timeAgo, icon, acuity, vital, flagTag } = SH.fmt;
  const store = SH.store;

  const NOTE_MAX = 280;

  let dialog, panel;
  let currentId = null;
  let closing = false;
  let savedTimer = null;

  /* ---------- Markup ---------- */

  function attentionBanner(p) {
    const reasons = store.attentionReasons(p);
    if (!reasons.length) return "";
    return `
      <div class="banner">
        ${icon("alert", "icon banner__icon")}
        <div>
          <p class="banner__title">Needs attention</p>
          <ul class="banner__list">${reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
        </div>
      </div>`;
  }

  function vitalsSection(p) {
    const items = store.VITAL_ORDER.map((key) => {
      const v = vital(p, key);
      const state = v.off ? `<span class="vital__state">${v.off === "high" ? "↑ High" : "↓ Low"}</span>` : "";
      return `
        <div class="vital${v.off ? " is-off" : ""}">
          <dt>${icon(v.def.icon, "icon vital__icon")}${v.def.long}</dt>
          <dd><span class="vital__value">${v.value}</span><span class="vital__unit">${v.def.unit}</span>${state}</dd>
        </div>`;
    }).join("");

    return `
      <section class="dsec" aria-labelledby="d-vitals">
        <div class="dsec__head">
          <h3 id="d-vitals">${icon("activity")}Vitals</h3>
          <p class="dsec__meta">${timeAgo(p.vitals.takenAt, "Taken ")}</p>
        </div>
        <dl class="vitals">${items}</dl>
      </section>`;
  }

  function flagsSection(p) {
    const body = p.flags.length
      ? `<ul class="tags tags--roomy">${p.flags.map(flagTag).join("")}</ul>`
      : `<p class="muted">No flags on this patient.</p>`;
    return `
      <section class="dsec" aria-labelledby="d-flags">
        <h3 id="d-flags">${icon("flag")}Flags</h3>
        ${body}
      </section>`;
  }

  function taskMeta(t) {
    if (t.done) {
      const by = t.doneBy === SH.SEED.currentUser ? " by you" : "";
      return { cls: "", html: `${icon("check-circle")}<span>Done ${clock(t.doneAt)}${by}</span>` };
    }
    if (t.dueAt < Date.now()) {
      return { cls: " is-overdue", html: `${icon("clock")}<span><strong>Overdue</strong>, was due ${clock(t.dueAt)}</span>` };
    }
    return { cls: "", html: `${icon("clock")}<span>Due ${clock(t.dueAt)}</span>` };
  }

  function taskItem(t) {
    const meta = taskMeta(t);
    return `
      <li class="task${t.done ? " is-done" : ""}${meta.cls}" data-task="${t.id}">
        <label class="task__hit">
          <input type="checkbox" class="task__input" ${t.done ? "checked" : ""} aria-describedby="${t.id}-meta">
          <span class="task__box" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false"><path d="M5.5 12.5l4.25 4.25L18.5 8" pathLength="1"/></svg>
          </span>
          <span class="task__text">
            <span class="task__name">${esc(t.label)}</span>
            <span class="task__meta" id="${t.id}-meta">${meta.html}</span>
          </span>
        </label>
      </li>`;
  }

  function progressText(p) {
    const done = p.tasks.length - store.openTasks(p).length;
    return `${done} of ${p.tasks.length} done`;
  }

  function tasksSection(p) {
    // Open tasks by due time first, finished ones underneath. Order is fixed
    // while the drawer is open so nothing jumps out from under the cursor.
    const ordered = [
      ...store.openTasks(p).sort((a, b) => a.dueAt - b.dueAt),
      ...p.tasks.filter((t) => t.done).sort((a, b) => b.doneAt - a.doneAt),
    ];
    const done = p.tasks.length - store.openTasks(p).length;
    const pct = p.tasks.length ? done / p.tasks.length : 0;

    return `
      <section class="dsec" aria-labelledby="d-tasks">
        <div class="dsec__head">
          <h3 id="d-tasks">${icon("list-check")}Tasks</h3>
          <p class="dsec__meta" data-slot="progress-text">${progressText(p)}</p>
        </div>
        <div class="progress" aria-hidden="true"><span class="progress__fill" style="--p:${pct}"></span></div>
        ${ordered.length ? `<ul class="tasks">${ordered.map(taskItem).join("")}</ul>` : `<p class="muted">No tasks for this patient.</p>`}
      </section>`;
  }

  function noteItem(n, isNew = false) {
    return `
      <li class="note${isNew ? " is-new" : ""}">
        <p class="note__text">${esc(n.text)}</p>
        <p class="note__meta">
          <span class="note__author">${esc(n.author)}</span>
          <span class="shift">${esc(n.shift)}</span>
          ${timeAgo(n.createdAt)}
          ${isNew ? `<span class="note__new">New</span>` : ""}
        </p>
      </li>`;
  }

  function notesSection(p) {
    const list = p.notes.length
      ? p.notes.map((n) => noteItem(n)).join("")
      : `<li class="note note--empty">No notes yet. Anything the next shift should know goes here.</li>`;

    return `
      <section class="dsec" aria-labelledby="d-notes">
        <h3 id="d-notes">${icon("note")}Handoff notes</h3>
        <form class="note-form" novalidate>
          <label for="note-text" class="note-form__label">Note for the next shift</label>
          <textarea id="note-text" name="note" rows="3" maxlength="${NOTE_MAX}"
            aria-describedby="note-hint note-count note-error"
            placeholder="Keep it short. What would you want to know walking in?"></textarea>
          <p class="note-form__error" id="note-error" hidden>Write something first, then save.</p>
          <div class="note-form__foot">
            <p class="note-form__hint" id="note-hint">Shows on the board as the latest note. <kbd>Ctrl</kbd> + <kbd>Enter</kbd> saves.</p>
            <p class="note-form__count" id="note-count"><span data-slot="count">0</span> / ${NOTE_MAX}</p>
            <button type="submit" class="btn btn--primary note-form__submit">
              <span class="spinner" aria-hidden="true"></span>${icon("check", "icon note-form__done")}<span data-slot="submit-label">Save note</span>
            </button>
          </div>
          <p class="vh" role="status" data-slot="note-status"></p>
        </form>
        <ol class="notes" aria-label="Note history, newest first">${list}</ol>
      </section>`;
  }

  function render(p) {
    panel.innerHTML = `
      <header class="dh">
        <div class="dh__top">
          <p class="dh__eyebrow"><span class="room-badge">Room ${esc(p.room)}</span><span class="dh__age"><span class="vh">Age </span>${p.age} yrs</span></p>
          <button type="button" class="icon-btn" data-close aria-label="Close patient details">${icon("close")}</button>
        </div>
        <h2 id="drawer-title" class="dh__name" tabindex="-1">${esc(p.name)}</h2>
        <div class="dh__meta">${acuity(p.acuity)}<span class="dh__updated" data-slot="updated">${timeAgo(p.updatedAt, "Updated ")}</span></div>
      </header>
      <div class="drawer__body">
        <div data-slot="attention">${attentionBanner(p)}</div>
        ${vitalsSection(p)}
        ${flagsSection(p)}
        ${tasksSection(p)}
        ${notesSection(p)}
      </div>`;
  }

  /* ---------- In-place updates ---------- */

  function refreshSummary(p) {
    panel.querySelector('[data-slot="attention"]').innerHTML = attentionBanner(p);
    panel.querySelector('[data-slot="progress-text"]').textContent = progressText(p);
    panel.querySelector('[data-slot="updated"]').innerHTML = timeAgo(p.updatedAt, "Updated ");
    const done = p.tasks.length - store.openTasks(p).length;
    const fill = panel.querySelector(".progress__fill");
    if (fill) fill.style.setProperty("--p", p.tasks.length ? done / p.tasks.length : 0);
  }

  function onTaskChange(input) {
    const li = input.closest(".task");
    const p = store.patient(currentId);
    const done = input.checked;

    SH.sync.track(store.toggleTask(currentId, li.dataset.task, done));

    const t = p.tasks.find((x) => x.id === li.dataset.task);
    const meta = taskMeta(t);
    li.classList.toggle("is-done", done);
    li.classList.toggle("is-overdue", meta.cls !== "");
    li.querySelector(".task__meta").innerHTML = meta.html;

    // The one celebratory beat: a class that only exists for the length of the animation.
    if (done && !SH.motion.reduced()) {
      li.classList.remove("just-done");
      void li.offsetWidth;
      li.classList.add("just-done");
      setTimeout(() => li.classList.remove("just-done"), 400);
    }

    refreshSummary(p);
  }

  async function onNoteSubmit(form) {
    if (form.classList.contains("is-saving")) return;
    clearTimeout(savedTimer);
    form.classList.remove("is-saved");

    const field = form.querySelector("textarea");
    const error = form.querySelector(".note-form__error");
    const status = form.querySelector('[data-slot="note-status"]');
    const text = field.value.trim();

    if (!text) {
      field.setAttribute("aria-invalid", "true");
      error.hidden = false;
      field.focus();
      return;
    }

    const pid = currentId;
    const button = form.querySelector(".note-form__submit");
    form.classList.add("is-saving");
    field.readOnly = true;
    button.setAttribute("aria-disabled", "true");
    form.querySelector('[data-slot="submit-label"]').textContent = "Saving";
    status.textContent = "Saving note";

    const note = await SH.sync.track(store.addNote(pid, text));

    // The drawer may have been closed, or switched to another patient, mid-save.
    if (currentId !== pid || !panel.contains(form)) return;

    const list = panel.querySelector(".notes");
    list.querySelector(".note--empty")?.remove();
    list.querySelectorAll(".note.is-new").forEach((n) => {
      n.classList.remove("is-new");
      n.querySelector(".note__new")?.remove();
    });
    list.insertAdjacentHTML("afterbegin", noteItem(note, true));
    SH.motion.fadeUp(list.firstElementChild, 0, -6);

    field.value = "";
    field.readOnly = false;
    form.classList.remove("is-saving");
    button.removeAttribute("aria-disabled");
    form.querySelector('[data-slot="count"]').textContent = "0";
    status.textContent = "Note saved. It's now the latest note on the board.";
    refreshSummary(store.patient(pid));

    // Brief confirmation on the button itself, where the person is already looking.
    const label = form.querySelector('[data-slot="submit-label"]');
    form.classList.add("is-saved");
    label.textContent = "Saved";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      form.classList.remove("is-saved");
      label.textContent = "Save note";
    }, 1600);
  }

  function onNoteInput(field) {
    const form = field.form;
    const count = form.querySelector('[data-slot="count"]');
    count.textContent = field.value.length;
    form.querySelector(".note-form__count").classList.toggle("is-near", field.value.length > NOTE_MAX - 30);
    if (field.value.trim()) {
      field.removeAttribute("aria-invalid");
      form.querySelector(".note-form__error").hidden = true;
    }
  }

  /* ---------- Focus handling ---------- */

  const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trapTab(e) {
    if (e.key !== "Tab") return;
    const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialog.contains(active) || active.id === "drawer-title")) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ---------- Open / close ---------- */

  function open(id) {
    const p = store.patient(id);
    if (!p || closing) return;
    currentId = id;
    render(p);
    dialog.showModal();
    void dialog.offsetWidth; // commit the starting position so the slide-in runs
    dialog.classList.add("is-open");
    panel.querySelector("#drawer-title").focus();

    // Content follows the panel in, one section at a time, so the eye lands top first.
    [...panel.querySelectorAll(".drawer__body > :not(:empty)")].forEach((el, i) => SH.motion.fadeUp(el, 60 + i * 35));
  }

  function close() {
    if (!dialog.open || closing) return;
    closing = true;
    const id = currentId;
    dialog.classList.remove("is-open");
    const ms = SH.motion.ms("--dur-base");
    setTimeout(() => {
      dialog.close();
      closing = false;
      currentId = null;
      SH.app.focusRow(id);
    }, ms);
  }

  function init() {
    dialog = document.getElementById("drawer");
    panel = document.getElementById("drawer-panel");

    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });
    dialog.addEventListener("keydown", trapTab);

    // Clicks that land on the dialog itself (not the panel) are backdrop clicks.
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.closest("[data-close]")) close();
    });

    panel.addEventListener("change", (e) => {
      if (e.target.matches(".task__input")) onTaskChange(e.target);
    });
    panel.addEventListener("input", (e) => {
      if (e.target.matches("#note-text")) onNoteInput(e.target);
    });
    panel.addEventListener("submit", (e) => {
      e.preventDefault();
      onNoteSubmit(e.target);
    });
    panel.addEventListener("keydown", (e) => {
      if (e.target.matches("#note-text") && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onNoteSubmit(e.target.form);
      }
    });
  }

  SH.drawer = { init, open, close, isOpen: () => Boolean(currentId) };
})();
