# Feature: Search Toolbar UI (Etapa B)

Status: implemented and verified. 4 work-unit commits: `a00b812`, `7979200`, `783f367`, `d17dfa5`.
Branch: `feat/search-toolbar` (continuation; Etapa A ended at `d2b52ee`)
Predecessor: `odd/tasks/search-toolbar.md` — the client-side query pipeline and sort.
Verification baseline: `bun run astro check` → 0 errors, 0 warnings, 0 hints at `d2b52ee`.

## Problem

Etapa A moved filtering, searching and sorting into the client, but the controls around them
are still the pre-existing ones, and the browser pass over Etapa A recorded the costs.

1. **The open dropdown scrims the whole page.** `isDropOpen` renders a
   `fixed inset-0 z-10 bg-black opacity-50` button as the outside-click catcher. While it is
   open, the chips, the search field and the sort chip are all unclickable. The Etapa A
   browser test had to close the dropdown before it could click the chip it had just created.
2. **The open panel covers its own trigger.** `#dropdown` is `absolute mt-12 z-20` with no
   positioned ancestor, so it lands over the `#dropdown-button` that opened it. Re-clicking
   the trigger to close does not work; only the scrim or a tag click does.
3. **No keyboard support.** No Escape, no `aria-expanded`, no `aria-haspopup`, no focus
   return when the panel closes. Outside-click is a full-page button rather than a document
   listener.
4. **Ten of the twenty-one tags lead nowhere.** AI, API, Cheatsheet, Code, Converter, Dev,
   Editor, Image, Tutorial and Typography currently carry no tool, so the dropdown offers
   ten rows that produce "Couldn't find any results" with no explanation. Measured against
   live data.
5. **Each tag row is a `<button>` wrapping an `<input type="checkbox">`.** A checkbox inside
   a button is not a control the platform knows how to describe, and it creates two tab
   stops for one choice.
6. **The magnifier button no longer does anything.** Filtering is live, so the submit button
   is decorative, yet it keeps `type="submit"` and a `sr-only` "Search" label.
7. **A resize listener drives a placeholder string.** `window.innerWidth` is read on every
   resize only to pick between two placeholder texts.
8. **The tag grouping is a whitelist.** `tagCategories` in `src/lib/utils.ts` gates which
   tags the dropdown can show. It happens to cover all 21 tags today — measured, zero
   orphans — so this is latent rather than live, but any tag added to Notion and not to that
   file would be silently unfilterable.

## What Etapa A's browser pass proved, and why it matters here

The pass found that the search filtered on blur, not on input, because Preact core binds
`onChange` to the native `change` event. No pure-function probe could have caught it. Every
interaction claim in this document therefore has to be proved by driving the DOM, not by
reasoning about the derived state.

## Measured baseline (live Notion, via `/api/*`)

| Metric | Value |
| --- | --- |
| Tools | 16 |
| Tags | 21 |
| Tags with at least one tool | 11 |
| Tags with zero tools | 10 |
| Tags outside `tagCategories` | 0 |
| Page size / total pages | 8 per page / 2 pages |

## Decisions (user-approved)

| Decision | Choice |
| --- | --- |
| Layout | **Unified toolbar bar with a result count.** One container holding the input, a `Filters` trigger, a `Sort` trigger, the active chips and the count. |
| Magnifier button | **Replaced by a clear (×) button** that appears only when the field has text and returns focus to the field. |
| Zero-tool tags | **Hidden.** The filter panel derives its options from the tags actually carried by the loaded tools, so a tag that empties out disappears and a new one appears without a code change. |

Deliberate additions that were not asked for, called out for review:

- The filter panel shows each tag's tool count next to its name. Not one of the offered
  options, but it is the same check the row itself performs and it makes a near-empty tag
  visible before the click instead of after it.
- The `window.innerWidth` placeholder is replaced by one short placeholder, which removes the
  resize listener and the `placeholder` state with it.

## Constraints

- Astro 4.3.6 + Preact 10.19.4 (**plain `preact`, not `preact/compat`**) + Tailwind 3.4.1.
- **No new runtime dependency.** No headless-ui, no floating-ui, no radix.
- Follow the `src/components/ui/card.tsx` conventions for primitives: `data-slot`
  attributes, the `PlainProps<T>` helper that narrows Preact's `className` and `size`
  typings, and comments that record the Tailwind 3 adaptation and the reason for each
  non-obvious class.
- Existing semantic tokens only (`bg-popover`, `bg-muted`, `text-muted-foreground`,
  `border-border`, `ring-ring`, `bg-primary`, `text-primary-foreground`). Tokens are raw
  `var(--…)` values, so no opacity modifiers such as `bg-muted/50`.
- No test runner is configured. Verification is `bun run astro check` plus the driven
  browser matrix.
- UI copy stays English. `tagCategories` labels stay Spanish.

## Non-goals

- Any change to `src/lib/notion.ts`, `src/pages/api/tools.json.ts`, `src/pages/api/tags.json.ts`
  or `src/lib/query.ts`'s existing function signatures. `/api/tags.json` still reads a single
  Notion page; that stays a recorded follow-up.
- An error state distinct from the empty state. Also a recorded follow-up.
- URL-persisted search state.
- Saved views, grouping, or a table/board layout switcher.
- A test runner. Still a user decision.

## Tasks

| Id | Task | Evidence |
| --- | --- | --- |
| U1 | `src/components/ui/popover.tsx` (new): `relative` anchor, panel dropped from `top-full`, document `pointerdown` outside-click, Escape with focus return, `aria-expanded`/`aria-controls`/`aria-haspopup`. No scrim. | `a00b812` |
| U2 | `src/lib/query.ts`: pure `countToolsByTag()` and `groupTagsByCategory()` that drop zero-count tags and fall back to an `Others` group; `otherTagCategory` added to `src/lib/utils.ts`. | `7979200` |
| U3 | `src/components/TagFilterPanel.tsx` (new): grouped `<label>` + `<input type="checkbox">` rows, zero-count tags dropped, counts shown. | `7979200` |
| U4 | `src/components/SearchToolbar.tsx` (new): the bar — field with clear (×), both triggers, chips, result count. Owns which panel is open. | `783f367` |
| U5 | `src/components/Search.tsx`: slimmed to data, state and derived results. Overlay button, old dropdown markup, `tagCategories` import, resize listener and placeholder state all deleted. | `783f367` |
| U6 | Verification, plus the dead-CSS defect review found: `astro check`, `bun run build`, and the driven browser matrix below. | `d17dfa5` |

## Verification evidence

`bun run astro check` → 0 errors, 0 warnings, 0 hints after every commit and at HEAD. No commit
left it non-green. `bun run build` → success.

### Browser interaction matrix — executed

Driven by `chromium.launch()` from the globally installed Playwright against `bun run dev` on a
free port; the driver lives in `/tmp`. **17 PASS / 0 FAIL / 0 NA.**

| Case | Result |
| --- | --- |
| Load | **PASS** — 8 cards, count "16 results", filter trigger `aria-expanded="false"` |
| Open the filter panel | **PASS** — `aria-expanded="true"`, panel visible |
| Panel contents | **PASS** — 11 checkbox rows; none of the 10 zero-tool tags present; every row shows its count |
| No scrim anywhere | **PASS** — 0 elements with computed `position: fixed` inside `main` |
| Trigger closes the panel | **PASS** — `aria-expanded="false"`, panel hidden |
| Escape closes + returns focus | **PASS** — `activeElement` is `tag-filter-trigger` |
| Outside click closes, no focus theft | **PASS** — focus went to the body, not to the trigger; the popover does not pull focus the way Escape does |
| Chip clickable while a panel is open | **PASS** — this is the defect Etapa A recorded: the panel was open (`aria-expanded="true"`) when the chip was clicked, and the click landed |
| Tag toggle narrows + badges | **PASS** — SVG (7 tools) → count "7 results", trigger reads `Filters 1`, 1 chip |
| Chip removal widens | **PASS** — back to "16 results", 0 chips |
| Clear button | **PASS** — value "", count back to "16 results", focus on `search-input`, the button unmounts itself |
| Sort panel | **PASS** — 2 options, `aria-pressed` `true/false` → `false/true`, panel closes on choose |
| Sort chip inverts + resets page | **PASS** — desc(16) reversed equals asc(16); page back to "Showing 1 to 8" |
| Page reset on query | **PASS** — "Showing 9 to 16 of 16" → "Showing 1 to 8 of 9" |
| No results | **PASS** — count "No results", empty state, no paginator |
| Keyboard tab order | **PASS** — `tag-filter-trigger → sort-trigger →` sort chip `→` paginator. **No checkbox is reached**, which is the observable proof that closed panels stay out of the tab order |
| Console health | **PASS** — no `pageerror`, no console errors |

Accent folding stays N/A in the browser: none of the 16 titles carries a diacritic.

### Defect review found that the matrix could not (fixed in `d17dfa5`)

Tailwind collects class candidates by scanning raw source text, comments included. The new
popover's docstring quoted the removed overlay's class list verbatim, so the build emitted four
rules no element used. Reworded to prose; the built stylesheet now has no standalone `.inset-0`,
`.bg-black` or `.opacity-50` rule. The remaining substring hits are legitimate: `after:inset-0`
in `ToolCard` and `bg-black/25` in `Filter`.

### Deviations accepted from the implementation brief

- `PlainProps<T>` was not needed: the popover takes no HTML-attribute passthrough, so the helper
  would have been dead code. `data-slot`/`data-state` and the Tailwind 3 comments are followed.
- The popover's own panel id is derived as `${labelledBy}-panel`; the consumer ids
  (`tag-filter-panel`, `sort-panel`) sit on the nested content, so both are unique and
  `aria-controls` resolves to the element the primitive actually hides.
- `TriggerProps.onClick` carries only the close half of the toggle, because the primitive does
  not own `isOpen`. `SearchToolbar` composes open and close. The matrix exercises this directly
  in the "trigger closes the panel" case.
- `countToolsByTag` counts tools, not relation edges, so a repeated relation inside one row
  counts once.
- Small deliberate additions: `accent-primary` on the checkboxes, a `sr-only` label for the
  field, both triggers disabled while the catalog loads, and row 2 always rendered so the count
  is visible at load.

## Still open (unchanged follow-ups)

`/api/tags.json` reads a single Notion page; a transport failure still renders as the empty
state; no test runner is configured; URL-persisted search state.

## Known gap carried over from Etapa A

Accent folding cannot be proved in the browser: none of the 16 titles carries a diacritic. It
stays a pure-function result.
