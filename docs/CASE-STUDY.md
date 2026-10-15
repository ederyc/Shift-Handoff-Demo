# Steadyhand: keeping a dense clinical list calm

*A self-directed concept piece. There was no client, no real users, no real patients and no research behind it. Everything below is my own reasoning, and I've written the last section as what I would test, not what I did test.*

![The Steadyhand roster board for a fictional unit, 4 West Med-Surg](images/board.png)

## The problem

Picture a nurse picking up a unit at shift change. They need to know who is on the floor, who's getting worse, what's overdue and what the last shift wanted them to know. They need all of it in the first ten minutes, and probably while someone is asking them something else.

That's a lot of data per person: a name, a room, acuity, vitals, flags, tasks and notes, times 13 patients. The easy move is to show all of it, and the result is a wall of equally loud cells. The design problem I gave myself was narrower: **make a dense list that stays calm**, where the thing you need jumps out and everything else waits its turn.

## Constraints

- **It's a concept, not a product.** I'm not a nurse and I didn't talk to any. The workflow is based on the general shape of handoff and rounding tools, and anything that sounds clinical is simplified on purpose. Precision wasn't the point, and fake data that's too precise starts to look like a real record.
- **One unit, one board, one drawer.** No orders, no charting, no meds and no navigation between units. Keeping the scope that tight is what let me spend the time on typography and states.
- **No framework, no backend.** Plain HTML, CSS and JS with `localStorage`. A filterable list, a drawer and a form don't need more than that, and staying small keeps everything fast.
- **The accessibility bar is fixed**, not a stretch goal: keyboard operable, AA contrast, 44px targets and reduced motion support.

## Process: structure before pixels

I started from questions, not layouts. The first pass was just a list of what someone walking onto the unit asks, in rough order:

1. Is anyone in trouble right now?
2. Who's the sickest overall?
3. What do I owe whom, and is any of it late?
4. What did the last shift want me to know?
5. When did someone last lay eyes on this person?

Each question became a column or a signal, and the order of the questions set the visual priority. That gave me a few rules before I opened a stylesheet:

- **"Needs attention" and "acuity" are different things.** A high acuity patient can be completely stable, and a low acuity patient can have an overdue blood sugar check. Mixing them up is how boards end up all red. Attention is about *right now*, so it gets the alert color. Acuity is a standing fact, so it stays neutral.
- **Attention is computed, not just typed in.** A patient needs attention if someone recorded a concern *or* any task has gone overdue. That means finishing the overdue task can clear the flag, which turns out to matter a lot for the check-off moment.
- **The board answers questions 1 through 5. The drawer holds everything else.** If a piece of information doesn't help you decide where to walk next, it belongs in the drawer.
- **No navigation away from the board.** The drawer opens over it, and the board keeps updating behind it as you check things off.

Only after that did I set up tokens: a 4px spacing scale, a seven-step type scale from 12px to 28px, three motion durations and a deliberately small set of status colors.

## Key screens and decisions

### The roster

![Roster rows: attention rows carry a red left rule, an icon and a text label](images/filtered.png)

- **Attention is icon, then words, then color.** Every flagged row reads "⚠ Needs attention" followed by the reason in plain language. The red left rule and the faint tint come last. Someone with red-green color blindness, or a washed-out monitor at 3 AM, still gets the full message.
- **Red means one thing.** Alert red is only ever used for "needs attention". Overdue tasks and out-of-range vitals use amber, and acuity uses ink weight plus a three-bar glyph. When red is rare, it actually works.
- **The vitals column shows what's off.** Rather than always showing the same two vitals, each row picks the two most out of range and falls back to SpO₂ and heart rate. Abnormal values get an arrow, a screen-reader "high" or "low", and amber.
- **Whitespace does the grouping.** Rows are split by one hairline and generous padding, not boxes. Inside the patient cell, the name, the attention line and the note preview stack with different weights and sizes so they read as three layers instead of three equal lines.
- **Tabular numerals everywhere.** Room numbers, vitals, counts and times all line up in their columns, so scanning down a column is easy.
- **Priority sort by default.** Attention first, then acuity, then room. "Longest since update" is there too, because "who hasn't anyone checked on?" is a real question.

### Filters

- **Counts on every chip**, so you know what a filter will do before you press it.
- **Selected chips get a check mark**, not just a color change.
- **It updates on every input with no apply button.** With a list this size, filtering client side is instant, and an apply step would only add friction.
- **Two empty states, because they mean different things.** "No patients match these filters" comes with a one-click way out. "No patients assigned yet" explains *why* the board is empty and when it will fill in.

![Empty unit state](images/empty.png)

### The detail drawer

![Detail drawer with attention banner, vitals grid, tasks and notes](images/drawer.png)

- **A native `<dialog>`**, so the page behind is truly inert and Escape works without extra code. I added a Tab wrap on top, and focus goes back to the row you came from. If that row has since been filtered out (say you cleared someone's overdue task while filtering by "needs attention"), focus lands on the list heading instead of falling back to the top of the page.
- **Attention sits at the top as a banner**, repeating the reasons from the board, so the drawer never contradicts the row you clicked.
- **Vitals are a grid of six tiles**, with out-of-range values tinted and labeled "↑ High" or "↓ Low" in words.
- **Task order is frozen while the drawer is open.** Checked items don't jump to the bottom under your cursor. They settle into place the next time you open it.

### The one delight moment: checking off a task

![A task mid check-off: the box filled, the check drawn, the label struck through](images/checkoff-mid.png)

This is the bit I spent the most time on, because it's the whole thesis in one interaction: software for a stressful job can still feel good to use.

In about 200ms, the box fills with the accent color and settles from a slight press (scale 0.84 to 1, ease out, no overshoot). The check draws itself in, a soft ring breathes out once, and a strike line sweeps across the label as it steps back to a quieter gray. The progress bar slides forward and the board behind updates its counts.

What I left out matters just as much: no bounce, no confetti, no sound, no toast. The context is serious, so the feedback is quick and then gets out of the way. If the task was the overdue one, the attention banner disappears at the same moment, which is honestly the most satisfying part. You can see the problem go away.

With reduced motion, everything still happens, just instantly.

### Handoff notes

- **Capped at 280 characters**, with a live counter that turns amber near the limit. Handoff notes should be short, and the limit nudges people that way.
- **Notes aren't optimistic.** Task check-offs show instantly and save in the background. A note waits for its save to finish ("Saving" with a spinner, the field locked) before it shows up in the history, because a note that looks saved but isn't is the worst way for this to fail.
- **The newest note becomes the board's preview line**, so the next shift sees it without opening anything.

### Loading, saving and night mode

![Loading skeleton](images/loading.png)

- Skeleton rows match the real column layout, so nothing jumps when data lands. The census numbers skeleton out too, instead of flashing stale values.
- A global "Saving / All changes saved" indicator sits in the header, the way a real tool would show sync status.
- Night mode is a second set of the same tokens at lower luminance, since units run around the clock. Every pairing was checked against AA.

![Night mode with drawer open](images/night.png)

![Mobile card layout](images/mobile.png)

## What I'd test if this were real

I didn't test any of this with people. If I were to, these are the questions I'd want answered first:

1. **Can people find the patient who needs them in under five seconds?** I'd show the board briefly, hide it and ask who they'd see first. I'd compare the current attention treatment against a version with only color, and against one with a separate status column.
2. **Is "needs attention" the right trigger?** Rolling overdue tasks into attention could be useful, or it could create alarm fatigue on a busy day. I'd want to watch how fast the flag stops meaning anything.
3. **Does the auto-picked vitals column help or confuse?** Showing different vitals per row is efficient, but it breaks the "same thing in the same place" rule. People might prefer fixed columns they can scan down.
4. **Is 280 characters right for handoff notes?** I'd look at real handoff habits. It might be too short, or it might need structure (like a "watch for" field) more than it needs length.
5. **Does the check-off moment hold up on the fortieth task of a shift?** Delight that wears thin by hour ten is just noise. I'd want to hear whether it still feels good or starts feeling slow.
6. **Accessibility with real assistive tech users**, not just automated checks and my own screen reader passes: especially the table to card reflow and the drawer's focus behavior.

## What I'd do next

Add a "since you last looked" marker for rows that changed while you were away, add an undo for task check-offs to cover mis-taps on a moving cart, and try a print view, since a lot of handoff still happens on paper.
