/*
  Seed data for the demo. Everything here is invented.

  Times are stored as minute offsets from "now" so the board always looks
  like a shift in progress, whenever someone opens it. store.js turns these
  into real timestamps the first time the page loads.

  Acuity: 1 = Low, 2 = Medium, 3 = High. Vitals are rounded, simple and
  deliberately not clinically precise.
*/
(function () {
  const SH = (window.SH = window.SH || {});

  const NIGHT_RN = { author: "J. Alvarez, RN", shift: "Night" };
  const EVENING_RN = { author: "M. Osei, RN", shift: "Evening" };
  const NIGHT_CNA = { author: "K. Brandt, CNA", shift: "Night" };

  SH.SEED = {
    hospital: "Harbor Point General",
    unit: "4 West Med-Surg",
    currentUser: "S. Rivera, RN",

    patients: [
      {
        room: "401", name: "Marguerite Okafor", age: 78, acuity: 3,
        vitals: { hr: 108, sys: 104, dia: 62, spo2: 94, rr: 22, temp: 38.3, pain: 4, minutesAgo: 35 },
        flags: ["Fall risk", "Telemetry"],
        concern: "Fever overnight, heart rate climbing",
        updatedMinutesAgo: 18,
        tasks: [
          { label: "Recheck vitals", dueIn: -15 },
          { label: "Call provider with updated vitals", dueIn: 10 },
          { label: "Reposition", dueIn: 60 },
          { label: "Oral care", done: true, doneMinutesAgo: 50 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 70, text: "Spiked a temp around 3. Provider is aware and wants a call if HR stays over 110. Daughter is the main contact and usually calls around 9." },
          { ...EVENING_RN, minutesAgo: 640, text: "Ate about half of dinner. Needs one assist to the bathroom, walker at bedside." },
        ],
      },
      {
        room: "402", name: "Dennis Halvorsen", age: 64, acuity: 2,
        vitals: { hr: 76, sys: 132, dia: 80, spo2: 97, rr: 16, temp: 36.9, pain: 2, minutesAgo: 90 },
        flags: ["NPO after midnight"],
        concern: null,
        updatedMinutesAgo: 95,
        tasks: [
          { label: "Pre-op checklist", dueIn: 120 },
          { label: "Shower", done: true, doneMinutesAgo: 110 },
          { label: "Daily weight", done: true, doneMinutesAgo: 140 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 100, text: "Surgery got moved to tomorrow morning. He knows he's NPO after midnight and is still grumpy about it." },
        ],
      },
      {
        room: "403", name: "Priya Raman", age: 45, acuity: 1,
        vitals: { hr: 72, sys: 118, dia: 74, spo2: 99, rr: 14, temp: 36.7, pain: 1, minutesAgo: 120 },
        flags: ["Discharge today"],
        concern: null,
        updatedMinutesAgo: 60,
        tasks: [
          { label: "Discharge teaching", dueIn: 90 },
          { label: "Remove IV", dueIn: 150 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 65, text: "Ride is coming at 2. Wants to go over wound care one more time before she leaves." },
        ],
      },
      {
        room: "404", name: "Walter Brisco", age: 82, acuity: 3,
        vitals: { hr: 96, sys: 148, dia: 88, spo2: 90, rr: 23, temp: 37.2, pain: 3, minutesAgo: 25 },
        flags: ["Fall risk", "Bed alarm on", "Oxygen 2L"],
        concern: "Oxygen down to 90% on 2L",
        updatedMinutesAgo: 22,
        tasks: [
          { label: "Recheck oxygen level", dueIn: 5 },
          { label: "Breathing exercise coaching", dueIn: -30 },
          { label: "Reposition", dueIn: 45 },
          { label: "Intake and output totals", dueIn: 180 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 80, text: "Pulled at his nasal cannula a few times overnight. Does better with the lights low and the TV off." },
          { ...NIGHT_CNA, minutesAgo: 300, text: "Bed alarm went off twice, both times trying to get up to find his glasses. Glasses are in the top drawer now." },
        ],
      },
      {
        room: "405", name: "Lucía Ferraro", age: 57, acuity: 2,
        vitals: { hr: 84, sys: 168, dia: 94, spo2: 96, rr: 18, temp: 37.0, pain: 3, minutesAgo: 55 },
        flags: ["Contact precautions"],
        concern: null,
        updatedMinutesAgo: 50,
        tasks: [
          { label: "Recheck blood pressure", dueIn: 30 },
          { label: "Wound dressing change", dueIn: 120 },
          { label: "Walk in hallway", done: true, doneMinutesAgo: 75 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 55, text: "Gown and gloves going in. The supply cart outside the door got restocked at 5." },
        ],
      },
      {
        room: "406", name: "Tom Achterberg", age: 39, acuity: 1,
        vitals: { hr: 68, sys: 122, dia: 78, spo2: 98, rr: 14, temp: 36.8, pain: 0, minutesAgo: 140 },
        flags: [],
        concern: null,
        updatedMinutesAgo: 135,
        tasks: [
          { label: "Walk in hallway", done: true, doneMinutesAgo: 150 },
          { label: "Vitals", done: true, doneMinutesAgo: 140 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 140, text: "Easy night, slept straight through. Asking about getting a real breakfast." },
        ],
      },
      {
        room: "407", name: "Josephine Mbeki", age: 71, acuity: 2,
        vitals: { hr: 82, sys: 136, dia: 82, spo2: 96, rr: 16, temp: 36.9, pain: 2, minutesAgo: 80 },
        flags: ["Diabetic", "Fall risk"],
        concern: null,
        updatedMinutesAgo: 75,
        tasks: [
          { label: "Blood sugar check before breakfast", dueIn: -20 },
          { label: "Reposition", dueIn: 60 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 85, text: "Was a little shaky before breakfast yesterday. Keep juice at the bedside." },
        ],
      },
      {
        room: "408", name: "Arthur Lindqvist", age: 88, acuity: 3,
        vitals: { hr: 92, sys: 132, dia: 78, spo2: 95, rr: 18, temp: 37.6, pain: 2, minutesAgo: 40 },
        flags: ["Fall risk", "Bed alarm on", "Sitter requested"],
        concern: "New confusion since last shift",
        updatedMinutesAgo: 30,
        tasks: [
          { label: "Neuro check", dueIn: 5 },
          { label: "Update provider", done: true, doneMinutesAgo: 45 },
          { label: "Reposition", dueIn: 30 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 40, text: "Didn't know where he was around 4. Settled once his wife's photo was on the tray table. Sitter request is in." },
          { ...EVENING_RN, minutesAgo: 700, text: "Alert and oriented at 8, chatty, asking about the ballgame." },
        ],
      },
      {
        room: "409", name: "Hana Watanabe", age: 33, acuity: 1,
        vitals: { hr: 74, sys: 116, dia: 70, spo2: 99, rr: 14, temp: 36.6, pain: 2, minutesAgo: 150 },
        flags: [],
        concern: null,
        updatedMinutesAgo: 150,
        tasks: [
          { label: "Walk in hallway", dueIn: 60 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 155, text: "Pain well controlled. Partner stays overnight on the couch." },
        ],
      },
      {
        room: "410", name: "Ray Castellanos", age: 60, acuity: 2,
        vitals: { hr: 52, sys: 124, dia: 76, spo2: 97, rr: 15, temp: 36.7, pain: 1, minutesAgo: 70 },
        flags: ["Telemetry"],
        concern: null,
        updatedMinutesAgo: 65,
        tasks: [
          { label: "Recheck heart rate", dueIn: 20 },
          { label: "Intake and output totals", dueIn: 240 },
          { label: "Daily weight", done: true, doneMinutesAgo: 100 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 70, text: "HR in the low 50s asleep, 60s awake. Provider is fine with it, just keep an eye on it." },
        ],
      },
      {
        room: "411", name: "Bea Sorensen", age: 49, acuity: 2,
        vitals: { hr: 94, sys: 138, dia: 84, spo2: 96, rr: 18, temp: 37.1, pain: 7, minutesAgo: 45 },
        flags: ["Pressure injury risk"],
        concern: null,
        updatedMinutesAgo: 40,
        tasks: [
          { label: "Reassess pain", dueIn: -10 },
          { label: "Reposition", dueIn: 90 },
          { label: "Wound dressing change", dueIn: 150 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 45, text: "Pain is worse with turning. Plan is to time turns right after her next pain reassessment." },
        ],
      },
      {
        room: "412", name: "Kofi Mensah", age: 55, acuity: 1,
        vitals: { hr: 70, sys: 126, dia: 80, spo2: 98, rr: 14, temp: 36.8, pain: 1, minutesAgo: 100 },
        flags: ["Discharge today"],
        concern: null,
        updatedMinutesAgo: 90,
        tasks: [
          { label: "Remove IV", dueIn: 60 },
          { label: "Final vitals", dueIn: 120 },
          { label: "Discharge teaching", done: true, doneMinutesAgo: 95 },
        ],
        notes: [
          { ...NIGHT_RN, minutesAgo: 95, text: "Wife is picking him up after lunch. Paperwork is ready to go." },
        ],
      },
      {
        room: "414", name: "Elaine Dutra", age: 67, acuity: 2,
        vitals: { hr: 88, sys: 128, dia: 76, spo2: 95, rr: 17, temp: 37.0, pain: 3, minutesAgo: 60 },
        flags: ["Telemetry", "Fall risk"],
        concern: null,
        updatedMinutesAgo: 58,
        tasks: [
          { label: "Walk in hallway", dueIn: 45 },
          { label: "Daily weight", done: true, doneMinutesAgo: 120 },
        ],
        notes: [
          { ...EVENING_RN, minutesAgo: 620, text: "First time out of bed yesterday afternoon. Needed one assist and did great." },
        ],
      },
    ],
  };
})();
