# Steadyhand: a shift handoff board (concept)

**This is a self-directed concept and practice project.** It isn't real software, it isn't deployed anywhere clinical, and it isn't affiliated with any healthcare company or product. There was no client and no user research. The hospital ("Harbor Point General"), the unit ("4 West Med-Surg"), the staff and all 13 patients are invented. The vitals are rounded on purpose and the "out of range" rules are deliberately simple. None of it is clinical guidance.

I built it to work through one UI problem: **how do you make a dense list stay calm and readable for someone who's busy, tired and under time pressure?**

Live demo: `https://ederyc.github.io/Shift-Handoff-Demo/` (once GitHub Pages is turned on for this repo)

A longer write-up of the thinking lives in [docs/CASE-STUDY.md](docs/CASE-STUDY.md).

## What's in it

- **Roster board.** One row per patient: room, name, acuity, the two vitals most worth a glance, flags, open task count and last update. Rows reflow into cards on phones.
- **Filter and sort bar.** Acuity, "needs attention," task status, plus four sort orders. Everything updates instantly on the client, no reload.
- **Detail drawer.** Opens over the board from any row. Shows full vitals, flags, the task checklist and handoff note history.
- **Handoff notes.** Add a short note (280 characters max) for the next shift. It shows up at the top of the drawer's history and becomes the preview line on the board.
- **Needs attention.** Driven by a recorded concern or any overdue task. Always shown as icon, then text label, then color, so it never depends on color alone.
- **Task check-off.** The one bit of delight: the box settles, the check draws itself in, a soft ring breathes out once and the label gets struck through. About 200ms in total.
- **Loading, saving and empty states.** Skeleton rows on load, a global "Saving / All changes saved" indicator, a saving state on the note button, an empty-unit state and a "nothing matches these filters" state.
- **Night mode.** The same token system with a lower-luminance palette.

### Demo controls

The footer has buttons to replay the loading state, show the empty unit and reset the sample data. You can also deep link to `?state=empty` or `?state=loading` for screenshots.

Changes save to `localStorage` in your browser. After 12 hours the demo seeds a fresh "shift" so the timestamps never go stale.

## Accessibility

- Semantic table for the roster, with explicit ARIA table roles so screen readers still get table semantics when rows reflow into cards on small screens.
- One `h1`, then `h2` for page regions and `h3` for drawer sections.
- The drawer is a native modal `<dialog>`: the background goes inert, Escape closes it, Tab wraps inside it, and focus goes back to the row that opened it. If that row got filtered out in the meantime, focus lands on the list heading instead.
- Each patient's name is a real `<button>`, stretched over the whole row, so the full row is one big target for both mouse and touch, and it has one focus ring.
- Visible focus on every control. Every interactive target is at least 44px.
- Every text and status color pairing passes WCAG AA in both themes. I checked the token pairs with a script, and the lowest is 5.08:1 for subtle text on the sunken surface.
- Filter counts, result counts and save status are announced through `role="status"` regions.
- `prefers-reduced-motion` drops every transition and the check-off animation to instant.

## Running it

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```sh
npx serve .
# or
python -m http.server
```

To deploy: push to `main`, then in the repo go to **Settings → Pages** and set the source to "Deploy from a branch", `main`, `/ (root)`.

## Code tour

```
index.html        Markup, page structure, icon sprite
css/tokens.css    Every color, size, space, radius and duration. Light and night palettes.
css/base.css      Reset, type, buttons, app chrome, filter controls
css/board.css     Roster table, row states, skeleton, empty states, mobile card layout
css/drawer.css    Drawer, task checklist and check-off animation, note form
js/data.js        Seed data (invented), stored as minute offsets from "now"
js/store.js       State, localStorage, derived values (attention, overdue), fake save latency
js/format.js      Escaping, time formatting, small markup helpers
js/board.js       Renders the board's four states
js/drawer.js      Drawer rendering, focus handling, task and note interactions
js/app.js         Filters, sorting, census, sync indicator, demo controls, theme
```

It's plain HTML, CSS and JavaScript with no framework. The scripts are classic deferred scripts that share one `SH` namespace, so the page also works straight from the file system.

## Credits

Type is IBM Plex Sans, loaded from Google Fonts. I drew the icons for this project.
