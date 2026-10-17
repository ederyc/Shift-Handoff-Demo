/*
  Local state. No backend: everything lives in memory and is mirrored to
  localStorage so check-offs and notes survive a refresh.

  Writes go through small fake delays so the UI has a real "saving" state
  to design for, the way it would against a network.
*/
(function () {
  const SH = (window.SH = window.SH || {});

  const KEY = "steadyhand:v1";
  // Bumped when the saved shape changes, so old saves reseed instead of breaking.
  const VERSION = 2;
  // After 12 hours the demo starts a fresh shift, so timestamps never go stale.
  const SHIFT_MS = 12 * 60 * 60 * 1000;
  const MIN = 60 * 1000;

  let state = null;
  const listeners = new Set();

  /* ---------- Seeding ---------- */

  /*
    The activity log is append-only, like a real audit trail: reopening a
    task adds a "reopened" entry rather than erasing the "checked off" one.
    The seed version is built from what the data already implies happened.
  */
  function seedActivity(seed, id, now, tasks, notes) {
    const log = [];
    const at = (min) => now - min * MIN;
    log.push({ kind: "vitals", at: at(seed.vitals.minutesAgo), who: SH.SEED.vitalsBy, text: "recorded vitals" });
    if (seed.concern) {
      log.push({ kind: "concern", at: at(seed.updatedMinutesAgo + 5), who: SH.SEED.nightRn, text: `raised a concern: ${seed.concern}` });
    }
    notes.forEach((n) => log.push({ kind: "note", at: n.createdAt, who: n.author, text: "added a handoff note" }));
    tasks.filter((t) => t.done).forEach((t) => log.push({ kind: "task-done", at: t.doneAt, who: t.doneBy, text: `checked off ${t.label}` }));
    return log
      .sort((a, b) => b.at - a.at)
      .map((e, i) => ({ id: `${id}-a${i}`, ...e }));
  }

  function hydrate(seed, now) {
    const id = "p" + seed.room;
    const tasks = seed.tasks.map((t, i) => ({
      id: `${id}-t${i}`,
      label: t.label,
      dueAt: t.done ? null : now + t.dueIn * MIN,
      done: Boolean(t.done),
      doneAt: t.done ? now - t.doneMinutesAgo * MIN : null,
      doneBy: t.done ? SH.SEED.nightRn : null,
    }));
    const notes = seed.notes.map((n, i) => ({
      id: `${id}-n${i}`,
      text: n.text,
      author: n.author,
      shift: n.shift,
      createdAt: now - n.minutesAgo * MIN,
    }));
    return {
      id,
      room: seed.room,
      name: seed.name,
      age: seed.age,
      acuity: seed.acuity,
      flags: seed.flags.slice(),
      concern: seed.concern,
      updatedAt: now - seed.updatedMinutesAgo * MIN,
      vitals: { ...seed.vitals, takenAt: now - seed.vitals.minutesAgo * MIN },
      tasks,
      notes,
      activity: seedActivity(seed, id, now, tasks, notes),
    };
  }

  function fresh() {
    const now = Date.now();
    return {
      version: VERSION,
      seededAt: now,
      empty: false,
      patients: SH.SEED.patients.map((p) => hydrate(p, now)),
    };
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* Private mode or storage full: the demo still works, it just won't remember. */
    }
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && saved.version === VERSION && Date.now() - saved.seededAt < SHIFT_MS) {
        state = saved;
        return;
      }
    } catch (e) {
      /* fall through to a fresh seed */
    }
    state = fresh();
    persist();
  }

  function emit() {
    listeners.forEach((fn) => fn());
  }

  function commit() {
    persist();
    emit();
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function log(p, kind, text) {
    p.activity.unshift({ id: `${p.id}-a${Date.now()}${p.activity.length}`, kind, at: Date.now(), who: SH.SEED.currentUser, text });
  }

  /* ---------- Derived values ---------- */

  const openTasks = (p) => p.tasks.filter((t) => !t.done);
  const overdueTasks = (p, now = Date.now()) => p.tasks.filter((t) => !t.done && t.dueAt < now);

  function attentionReasons(p, now = Date.now()) {
    const reasons = [];
    if (p.concern) reasons.push(p.concern);
    const overdue = overdueTasks(p, now).length;
    if (overdue) reasons.push(overdue === 1 ? "1 task overdue" : `${overdue} tasks overdue`);
    return reasons;
  }

  const needsAttention = (p, now) => attentionReasons(p, now).length > 0;

  /*
    Very simple out-of-range rules. Not clinical guidance, just enough to
    show how the UI flags a value that's off.
  */
  const VITALS = {
    spo2: { icon: "o2", label: "SpO₂", long: "Oxygen saturation", unit: "%", value: (v) => v.spo2, check: (v) => (v.spo2 < 93 ? "low" : null) },
    hr: { icon: "heart", label: "HR", long: "Heart rate", unit: "bpm", value: (v) => v.hr, check: (v) => (v.hr > 100 ? "high" : v.hr < 55 ? "low" : null) },
    bp: { icon: "gauge", label: "BP", long: "Blood pressure", unit: "mmHg", value: (v) => `${v.sys}/${v.dia}`, check: (v) => (v.sys > 160 ? "high" : v.sys < 95 ? "low" : null) },
    rr: { icon: "wind", label: "RR", long: "Respiratory rate", unit: "/min", value: (v) => v.rr, check: (v) => (v.rr > 22 ? "high" : v.rr < 10 ? "low" : null) },
    temp: { icon: "thermometer", label: "Temp", long: "Temperature", unit: "°C", value: (v) => v.temp.toFixed(1), check: (v) => (v.temp >= 38 ? "high" : v.temp < 35.5 ? "low" : null) },
    pain: { icon: "face", label: "Pain", long: "Pain score", unit: "/10", value: (v) => v.pain, check: (v) => (v.pain >= 7 ? "high" : null) },
  };
  const VITAL_ORDER = ["spo2", "hr", "bp", "rr", "temp", "pain"];

  /* The two vitals worth a glance on the board: anything out of range first, otherwise SpO₂ and HR. */
  function keyVitals(p) {
    const off = VITAL_ORDER.filter((k) => VITALS[k].check(p.vitals));
    const picks = off.concat(["spo2", "hr"].filter((k) => !off.includes(k)));
    return picks.slice(0, 2);
  }

  /* ---------- Public API ---------- */

  SH.store = {
    load,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    patients: () => (state.empty ? [] : state.patients),
    patient: (id) => state.patients.find((p) => p.id === id),
    isEmpty: () => state.empty,

    openTasks,
    overdueTasks,
    attentionReasons,
    needsAttention,
    VITALS,
    VITAL_ORDER,
    keyVitals,

    /* Optimistic: the change shows instantly, the returned promise is the "save". */
    toggleTask(patientId, taskId, done) {
      const p = this.patient(patientId);
      const t = p && p.tasks.find((x) => x.id === taskId);
      if (!t) return Promise.resolve();
      t.done = done;
      t.doneAt = done ? Date.now() : null;
      t.doneBy = done ? SH.SEED.currentUser : null;
      p.updatedAt = Date.now();
      log(p, done ? "task-done" : "task-reopened", `${done ? "checked off" : "reopened"} ${t.label}`);
      commit();
      return wait(380);
    },

    /* Notes are not optimistic: the note appears once the save "lands". */
    async addNote(patientId, text) {
      await wait(650);
      const p = this.patient(patientId);
      const note = {
        id: `${patientId}-n${Date.now()}`,
        text,
        author: SH.SEED.currentUser,
        shift: SH.fmt.currentShift().name,
        createdAt: Date.now(),
      };
      p.notes.unshift(note);
      p.updatedAt = note.createdAt;
      log(p, "note", "added a handoff note");
      commit();
      return note;
    },

    setEmpty(empty) {
      state.empty = empty;
      commit();
    },

    reset() {
      state = fresh();
      commit();
    },
  };
})();
