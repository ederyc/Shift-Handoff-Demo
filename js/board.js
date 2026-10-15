/*
  The roster board. Renders one of four states into #roster:
  loading, empty unit, no filter matches, or the patient table.
*/
(function () {
  const SH = (window.SH = window.SH || {});
  const { esc, clock, timeAgo, icon, acuity, vital } = SH.fmt;
  const store = () => SH.store;

  const SHORT_UNIT = { spo2: "%", temp: "°" };

  function keyVitalsCell(p) {
    const vitals = store()
      .keyVitals(p)
      .map((key) => {
        const v = vital(p, key);
        return `<span class="kv${v.off ? " is-off" : ""}"><span class="kv__label">${v.def.label}</span> <span class="kv__value">${v.value}${SHORT_UNIT[key] || ""}${v.flag}</span></span>`;
      })
      .join("");

    const shown = p.flags.slice(0, 2).map((f) => `<li class="tag">${esc(f)}</li>`);
    if (p.flags.length > 2) shown.push(`<li class="tag tag--more">+${p.flags.length - 2}<span class="vh"> more</span></li>`);
    const flags = shown.length ? `<ul class="tags" aria-label="Flags">${shown.join("")}</ul>` : "";

    return `<div class="kvs">${vitals}</div>${flags}`;
  }

  function tasksCell(p) {
    const open = store().openTasks(p);
    if (!open.length) {
      return `<span class="tcell tcell--clear">${icon("check-circle")}All done</span>`;
    }
    const overdue = store().overdueTasks(p).length;
    const second = overdue
      ? `<span class="tcell__overdue">${icon("clock")}${overdue} overdue</span>`
      : `<span class="tcell__next">Next due ${clock(Math.min(...open.map((t) => t.dueAt)))}</span>`;
    return `<span class="tcell__count">${open.length} open</span>${second}`;
  }

  function row(p) {
    const reasons = store().attentionReasons(p);
    const latest = p.notes[0];

    const attention = reasons.length
      ? `<p class="attn">${icon("alert", "icon attn__icon")}<strong class="attn__label">Needs attention</strong><span class="attn__reason">${esc(reasons.join(", "))}</span></p>`
      : "";

    const note = latest
      ? `<p class="preview">${icon("note")}<span class="vh">Latest handoff note: </span><span class="preview__text">${esc(latest.text)}</span></p>`
      : `<p class="preview preview--none">No handoff notes yet</p>`;

    return `
      <tr role="row" class="row${reasons.length ? " is-attention" : ""}" data-id="${p.id}">
        <td role="cell" class="c-room"><span class="vh">Room </span>${esc(p.room)}</td>
        <th scope="row" role="rowheader" class="c-patient">
          <div class="who">
            <button type="button" class="who__name" data-open="${p.id}" aria-haspopup="dialog">${esc(p.name)}</button>
            <span class="who__age"><span class="vh">Age </span>${p.age}</span>
          </div>
          ${attention}
          ${note}
        </th>
        <td role="cell" class="c-acuity">${acuity(p.acuity)}</td>
        <td role="cell" class="c-ind">${keyVitalsCell(p)}</td>
        <td role="cell" class="c-tasks">${tasksCell(p)}</td>
        <td role="cell" class="c-updated">${timeAgo(p.updatedAt)}</td>
      </tr>`;
  }

  const HEAD = `
    <colgroup>
      <col class="col-room"><col class="col-patient"><col class="col-acuity">
      <col class="col-ind"><col class="col-tasks"><col class="col-updated">
    </colgroup>
    <thead role="rowgroup">
      <tr role="row">
        <th scope="col" role="columnheader">Room</th>
        <th scope="col" role="columnheader">Patient</th>
        <th scope="col" role="columnheader">Acuity</th>
        <th scope="col" role="columnheader">Vitals and flags</th>
        <th scope="col" role="columnheader">Tasks</th>
        <th scope="col" role="columnheader">Updated</th>
      </tr>
    </thead>`;

  function table(patients) {
    return `<div class="table-wrap"><table class="roster-table" role="table" aria-labelledby="roster-title">${HEAD}<tbody role="rowgroup">${patients.map(row).join("")}</tbody></table></div>`;
  }

  function loading() {
    const skel = Array.from({ length: 6 }, () => `
      <tr role="row" class="row row--skeleton" aria-hidden="true">
        <td role="cell" class="c-room"><span class="sk sk--room"></span></td>
        <td role="cell" class="c-patient"><span class="sk sk--name"></span><span class="sk sk--line"></span></td>
        <td role="cell" class="c-acuity"><span class="sk sk--pill"></span></td>
        <td role="cell" class="c-ind"><span class="sk sk--line"></span></td>
        <td role="cell" class="c-tasks"><span class="sk sk--short"></span></td>
        <td role="cell" class="c-updated"><span class="sk sk--short"></span></td>
      </tr>`).join("");
    return `<div class="table-wrap"><table class="roster-table" role="table" aria-labelledby="roster-title">${HEAD}<tbody role="rowgroup">${skel}</tbody></table></div>`;
  }

  function emptyUnit() {
    return `
      <div class="empty">
        ${icon("clipboard", "icon empty__icon")}
        <h3 class="empty__title">No patients assigned to 4 West yet</h3>
        <p class="empty__body">Assignments usually post about 30 minutes before shift change. The board fills in on its own as they land, no refresh needed.</p>
        <button type="button" class="btn btn--secondary" data-action="load-sample">Load sample patients</button>
      </div>`;
  }

  function noMatches() {
    return `
      <div class="empty empty--compact">
        ${icon("filter", "icon empty__icon")}
        <h3 class="empty__title">No patients match these filters</h3>
        <p class="empty__body">Nobody on the unit fits that combination right now. Try widening acuity or switching task status back to Any.</p>
        <button type="button" class="btn btn--secondary" data-action="clear-filters">Clear filters</button>
      </div>`;
  }

  SH.board = { table, loading, emptyUnit, noMatches, tasksCell };
})();
