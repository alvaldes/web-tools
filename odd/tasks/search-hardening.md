# Feature: Search and Data-Layer Hardening

Status: in progress
Branch: `feat/search-toolbar` (continuation; Etapa B ended at `b4ea414`)
Predecessors: `odd/tasks/search-toolbar.md` (pipeline), `odd/tasks/search-toolbar-ui.md` (toolbar).
Baseline: `bun run astro check` → 0 errors, 0 warnings, 0 hints at `b4ea414`.

## Problem

Eight defects that either break the listing, lie to the user, or leave the change
unverifiable. None of them are regressions from the two earlier phases; the searcher merely
makes them easier to hit.

### Correctness

- **D1. One malformed row takes down the whole listing, and the UI reports it as "no results".**
   `src/lib/notion.ts:102` reads `row.properties.Name.title[0].text.content` unguarded. A tool
   with no Name leaves `title` as `[]`, so `[0]` is `undefined` and `.text` throws. The
   exception leaves `getTools()`, `/api/tools.json` answers 500, the client's `catch` logs it,
   `tools` stays `[]`, and the page renders "No results" plus "Oops! Couldn't find any results
   matching your search". One bad row silently erases sixteen good ones. The same pattern sits
   at `src/lib/notion.ts:80-81` for `Name.title[0]` and `Color.rich_text[0]` in `getTags()`.
- **D2. `/api/tags.json` has no error handling and `getTags()` does not paginate.**
   `src/pages/api/tags.json.ts` awaits `getTags()` with no `try`/`catch`, so a Notion failure
   escapes as an uncontrolled 500. And `getTags()` reads a single Notion page, so a tag catalog
   past Notion's 100-row cap truncates silently — the same class `getTools()` already closed.
- **D3. A transport failure is indistinguishable from an empty result.** `src/components/Search.tsx`
   only calls `console.error(e)`, and its `finally` clears the loading flag, so a failed fetch
   renders a confident "nothing found".
- **D4. The pagination loop terminates on cursor truthiness, not on `has_more`.** In `getTools()`,
   `cursor = pages.has_more ? pages.next_cursor : undefined` with `while (cursor)` exits quietly
   if a page ever reports `has_more: true` with a falsy cursor — a silent truncation inside the
   code written to prevent silent truncation.

### Verifiability

- **D5. There is no test runner and no test.** `openspec/config.yaml` records none. Every check
   performed in both earlier phases lives in `/tmp` scripts that are already gone. `src/lib/query.ts`
   holds five non-trivial pure functions with zero permanent coverage.
- **D6. The Notion layer is untyped** — six `any`s at `notion.ts:43, 52, 77, 98, 99, 104`. This is the
   root cause of D1: no type says a row must have a Name, so nothing can flag the access.
- **D7. The `Others` group has never rendered with real data.** All 21 tags are categorised, so the
   fallback that closes the whitelist defect has only ever run against a synthetic fixture.

### Consistency

- **D8. The search is not in the URL.** It cannot be shared and Back cannot restore it.

## Decisions (user-approved)

| Decision | Choice |
| --- | --- |
| `Pagination` rendered twice | **Do nothing.** Pagination is scheduled for replacement by progressive scroll loading, so its duplicated text and extra tab stops are transitional and will be deleted rather than reorganised. |
| Lint / format / typecheck | **Add no tooling.** Only declare the command that already exists so a reviewer has one verifiable entry point. |
| URL state | **Include it** (`?q=&tags=&sort=`), built on the pure pipeline. |
| Stale dev server on 4322 | Killed (PID 61746). |
| Test runner | `bun test`, which Bun ships. **No dependency is added**, and only pure modules get tests: no DOM test library, because the alternative would be a new dependency and the browser matrix already covers component behaviour. |

## Advisories dismissed with reason

Recorded so they are not re-opened as defects by a future pass.

- **`find-import-file-without-extension` on `query.ts:10,13`.** The project convention is
  relative `./` within a directory and the `@/lib/…` alias across directories; `Gallery.tsx`,
  `Search.tsx` and `SearchToolbar.tsx` all import siblings relatively. The rule fires on the two
  `import type` lines and not on the equivalent component imports, so it is an artifact of the
  rule, not a convention break. Adding `.ts` extensions would deviate from the codebase.
- **`ts-redundant-filter-map` on `query.ts:145,153`.** The rule targets `filter(x => x).map(…)`,
  a truthiness filter. Both sites use a real predicate (`category.tags.includes(...)`), where
  `flatMap` would be less legible than the two passes.
- **`hover:bg-black/25 hover:text-white` in `Filter.tsx:29`.** Deliberate and documented in the
  file: the previous `hover:text-black/40` reduced contrast on an already dark pill. Semantic
  tokens are raw `var(…)` values, so an opacity modifier is unavailable here, and the app is
  dark-only. Not a residue of the token migration.
- **`useState<string>("")` in `Search.tsx`.** Kept only because the file is being edited for other
  reasons; the annotation is redundant but consistent with the file's style.

## Constraints

- Astro 4.3.6 + Preact 10.19.4, plain `preact` (not `preact/compat`): `onChange` on a text field
  is the native `change` event and fires on blur, so text fields use `onInput`.
- **No new runtime dependency and no new devDependency.** `bun test` is part of Bun.
- Tests are colocated as `src/lib/*.test.ts` next to their subject.
- `import.meta.env` does not exist under `bun test`, so any module a test imports **must not**
  read it at module scope. This is why the pure mapping moves out of `notion.ts`.
- Tailwind 3.4.1, existing semantic tokens, no opacity modifiers on token colours.
- UI copy is English; `tagCategories` labels stay Spanish.

## Non-goals

- **Any change to `Pagination.tsx` or `Gallery.tsx`'s pagination behaviour**, per the decision
  above. Progressive scroll is a future feature.
- Component tests, a DOM test library, or any test of the Preact islands. Their behaviour stays
  covered by the driven browser matrix.
- Lint, format, or an ESLint/Prettier configuration.
- The `Otros` group's rendering path in the browser (it has no data to render); it is covered by
  a unit test instead.
- `/api/tools.json` and `/api/tags.json` changing shape. The response contract stays an array.

## Tasks

| Id | Task | Evidence |
| --- | --- | --- |
| H1 | `bun test` enabled and the five functions of `query.ts` covered. | `f5aeb4e` |
| H2 | New `src/lib/notionRows.ts`: guarded readers, `mapToolRow`/`mapTagRow` returning `null`, `collectTools`/`collectTags` reporting `skippedIds`, `nextCursor` throwing on a missing cursor, `isDeprecatedTagName`. All six `any`s in `notion.ts` replaced with types. | `4ac0886` |
| H3 | `tests/notionRows.test.ts`: 21 tests over the guard chain, the skip rule and the cursor. | `4ac0886` |
| H4 | Both API routes answer a controlled 500 and the unreachable 404 branch is gone; `getTags()` follows pagination. | `df67c89` |
| H5 | `Search.tsx`: `loadError` with a `role="alert"` block and a retry, rendered instead of the toolbar and gallery so the empty state stays unreachable after a failure. | `fec8ecc` |
| H6 | New `src/lib/urlState.ts` plus 21 tests; wired into `Search.tsx` with `replaceState` while typing, `pushState` on discrete actions, `popstate` restore, and a pristine search that leaves no `?`. | `b34467b` |
| H7 | `popover.tsx`: the listener effect depends only on `isOpen` (handler read through a ref) and an opening panel receives focus on its first focusable control, with Tab deliberately not trapped. | `300a5cb` |
| H8 | `Content-Type` dropped from both GET fetches; typecheck and test commands declared in `openspec/config.yaml`. | `60b453d`, this commit |

Fixture/rework commit outside the numbered tasks: `81adabf` moved the suite from `src/lib/`
to `tests/` and replaced a fragile `@ts-expect-error` with `@ts-ignore` — see below.

## Verification evidence

`bun test` → **67 pass / 0 fail** (101 assertions, 3 files). `bun run astro check` → 0 errors,
0 warnings, 0 hints over 30 files, and green after every commit. `bun run build` → success.
Live: `GET /` 200, `/api/tools.json` 200 with 16 tools, `/api/tags.json` 200 with 21 tags. The
dev log carries no Vite resolution error. `package.json` gained one script and no dependency.

### Browser interaction matrix — executed

**25 PASS / 0 FAIL / 0 NA**, driven with the globally installed Playwright. This single run is
both the Etapa B regression and the new coverage.

| Case | Result |
| --- | --- |
| Load; panel contents (11 rows, no dead tags); no scrim; Escape closes and returns focus; outside click closes without focus theft; a chip is clickable while a panel is open | **PASS** — Etapa B behaviour unchanged |
| Focus moves into the panel | **PASS** — `activeElement` is an `<input type="checkbox">` inside the panel |
| Tab is not trapped | **PASS** — Shift+Tab from the first control lands on the trigger, outside the panel |
| URL clean at rest | **PASS** — `location.search` is `""` |
| Typing replaces rather than pushes | **PASS** — `?q=svg` with `history.length` unchanged (4 → 4) |
| A tag toggle pushes | **PASS** — `?q=svg&tags=<uuid>`, `history.length` 4 → 5 |
| Back restores the previous state | **PASS** — `?q=svg`, no chips, the field still reads `svg` |
| URL restore | **PASS** — `?q=svg&sort=desc` renders 7 results with the sort chip reading `Name ↓` |
| A bad link is not trusted | **PASS** — an unknown tag id is dropped and `sort=nonsense` falls back to `asc` |
| A failure is not the empty state | **PASS** — with `/api/tools.json` forced to 500 the alert reads "We couldn't load the tools…" and the empty-state text appears **zero** times |
| Retry recovers | **PASS** — 8 cards, count "16 results", alert gone |
| Tag toggle + badge; chip removal; clear button (which also clears the URL); sort panel; exact sort inversion; page reset; no results; keyboard order skipping closed panels | **PASS** |
| Console health | **PASS** — 0 `pageerror`; the only console errors are the two the deliberately induced 500 is expected to produce |

### Deviation from the brief, corrected during review

The first implementation suppressed the `bun:test` import with `@ts-expect-error`, which
**fails the type check once the suppression becomes unnecessary** — so a future `bun-types`
install would have broken the build for no reason. It had also colocated the suite under
`src/`, where Vite's dependency scanner logged an ERROR line on every `astro dev` start.

Corrected in `81adabf`: the suite moved to `tests/`, the directive became `@ts-ignore`, and the
root `tsconfig.json` was left **byte-identical to its original**. The tests stay inside the
project so they are still type-checked (which is why the 30 "not in any tsconfig project"
diagnostics disappeared) and the dev log is clean.

### Trade-off accepted

Typing uses `replaceState`, so the first keystroke overwrites the history entry the page was
opened with, and Back returns to the last discrete action rather than to the pristine page.
Pushing on every keystroke would be worse. If Back should also undo typing, push on the first
keystroke of a burst and replace the rest.
