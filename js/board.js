/*
  The roster board. Renders one of four states into #roster:
  loading, empty unit, no filter matches, or the patient table.
*/
(function () {
  const SH = (window.SH = window.SH || {});
  const { esc, clock, timeAgo, icon, acuity, vital, flagTag } = SH.fmt;
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

    const shown = p.flags.slice(0, 2).map((f) => flagTag(f));
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
            <span class="who__age"><span class="vh">Age </span>${p.age} yrs</span>
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

  /*
    Skeleton rows mirror the real row's structure (name and age, attention or
    note line, two vitals and flags, task count and due time), with varied
    widths so the placeholder reads as content, not a barcode.
  */
  const SKELETON_WIDTHS = [
    [46, 82, 60], [38, 70, 0], [52, 88, 66], [42, 64, 0], [48, 76, 54], [36, 80, 0],
  ];

  function loading() {
    const skel = SKELETON_WIDTHS.map(([name, line, extra]) => `
      <tr role="row" class="row row--skeleton" aria-hidden="true">
        <td role="cell" class="c-room"><span class="sk sk--room"></span></td>
        <td role="cell" class="c-patient">
          <span class="sk-row"><span class="sk sk--name" style="width:${name}%"></span><span class="sk sk--age"></span></span>
          <span class="sk sk--line" style="width:${line}%"></span>
          ${extra ? `<span class="sk sk--line" style="width:${extra}%"></span>` : ""}
        </td>
        <td role="cell" class="c-acuity"><span class="sk-row"><span class="sk sk--bars"></span><span class="sk sk--word"></span></span></td>
        <td role="cell" class="c-ind">
          <span class="sk-row"><span class="sk sk--kv"></span><span class="sk sk--kv"></span></span>
          <span class="sk-row"><span class="sk sk--tag"></span><span class="sk sk--tag"></span></span>
        </td>
        <td role="cell" class="c-tasks"><span class="sk sk--count"></span><span class="sk sk--short"></span></td>
        <td role="cell" class="c-updated"><span class="sk sk--short"></span></td>
      </tr>`).join("");
    return `<div class="table-wrap table-wrap--loading"><table class="roster-table" role="table" aria-labelledby="roster-title">${HEAD}<tbody role="rowgroup">${skel}</tbody></table></div>`;
  }

  /* An empty unit still shows the shape of the board it's waiting to become. */
  function emptyUnit() {
    const ghosts = ["401", "402", "403"]
      .map((room) => `
        <div class="ghost__row">
          <span class="ghost__room">${room}</span>
          <span class="ghost__lines"><span></span><span></span></span>
          <span class="ghost__tag">Open bed</span>
        </div>`)
      .join("");
    return `
      <div class="empty empty--unit">
        <div class="ghost" aria-hidden="true">${ghosts}</div>
        <h3 class="empty__title">No patients assigned to 4 West yet</h3>
        <p class="empty__body">Assignments usually post about 30 minutes before shift change. The board fills in on its own as they land, no refresh needed.</p>
        <p class="empty__live"><span class="live-dot" aria-hidden="true"></span>Watching for new assignments</p>
        <button type="button" class="btn btn--secondary" data-action="load-sample">Load sample patients</button>
      </div>`;
  }

  /* Names the filters that are doing the excluding, so the way out is obvious. */
  function noMatches(active = []) {
    const list = active.length
      ? `<ul class="empty__filters" aria-label="Active filters">${active.map((a) => `<li class="tag tag--filter">${icon("filter", "icon tag__icon")}${esc(a)}</li>`).join("")}</ul>`
      : "";
    return `
      <div class="empty empty--compact">
        <span class="empty__badge">${icon("filter", "icon icon--md")}</span>
        <h3 class="empty__title">No patients match these filters</h3>
        ${list}
        <p class="empty__body">Nobody on the unit fits that combination right now. Remove a filter or clear them all.</p>
        <button type="button" class="btn btn--secondary" data-action="clear-filters">Clear filters</button>
      </div>`;
  }

  SH.board = { table, loading, emptyUnit, noMatches, tasksCell };
})();
