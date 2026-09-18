# Feature: Search Toolbar (client-side query pipeline + sort)

Status: implemented; 4 work-unit commits on `feat/search-toolbar`; awaiting a browser-level interaction check
Branch: `feat/search-toolbar` (branched from `main`)
Verification: `bun run astro check` → 0 errors, 0 warnings, 0 hints (green after every commit and at HEAD).
`bun run build` → success. Live `GET /api/tools.json` → 200, 16 rows, every row with `id`,
`title`, `url`, `img` and a `tags` array. `GET /api/tags.json` → 200, 21 tags. `GET /` → 200
with exactly one Preact island and no remaining `POST` wiring.

## Problem

The searcher is a server round trip that cannot behave like the toolbar it looks like.

1. **Every interaction costs a Notion round trip.** `Search.tsx` POSTs `{ tags, query }` to
   `/api/tools.json`, which calls `searchTools()` and rebuilds the whole result list. The
   dataset is **16 tools / ~1.7 KB**, so 100% of the perceived latency is the network call.
2. **Filters never re-query.** `selectCategory()` and `removeFilter()` only mutate
   `categoryFilter`. The chips appear immediately but the grid keeps the previous results
   until the search button is pressed. The UI promises reactivity it does not deliver.
3. **Enter reloads the page.** The `<form>` has no `onSubmit` handler and the search input
   has no `name`, so a native submit navigates and discards all island state.
4. **`currentPage` is never reset.** `Gallery.tsx` syncs `totalItems` through an effect but
   never returns `currentPage` to 1 when the result set changes. Searching from page 3
   renders an empty grid while the paginator reads "Showing 25 to 12 of 12". Adding sort
   inherits this defect.
5. **`getTools()` does not follow pagination.** It reads `pages.results` once; Notion caps
   `page_size` at 100. Today only 16 rows exist, so nothing is lost, but the silent
   truncation is a latent class of defect.
6. **Search is single-field and accent-sensitive.** `searchTools()` builds
   `rich_text.contains` against `Name` only. URLs and tag names are unsearchable, and
   Notion's `contains` is exact about diacritics, which is wrong for a Spanish-facing tool.
7. **Sort does not exist.** `sorts` is hardcoded to `Name ascending` inside
   `fetchNotionApi()`.
8. **The filter dropdown is a whitelist.** It lists only tags present in `tagCategories`
   (`src/lib/utils.ts`), so a tag outside that file is impossible to filter by. The trigger
   label is also hardcoded to `"All Categories"` regardless of selection.
9. **Row mapping is duplicated** byte-for-byte between `getTools()` and `searchTools()`.

## Measured baseline

| Metric | Value | How |
| --- | --- | --- |
| Tools in the Notion database | 16 | read-only `databases/{id}/query` page walk |
| Notion pages required | 1 (`has_more: false`) | same |
| Full dataset as JSON | ~1.7 KB (111 bytes/row) | serialized query rows |
| Rows missing URL / image / tags | 0 / 0 / 0 | same |
| `created_time` range | 2024-02-13 → 2026-09-17 | same |

## Decisions (user-approved)

| Decision | Choice |
| --- | --- |
| Query pipeline | **Client-side over the full dataset.** One initial fetch, then filter/sort/paginate in memory. Reactivity becomes free and multi-field, accent-insensitive search becomes possible. |
| Sort options | **Name A→Z / Z→A only.** No `createdAt` field, no `WebTools` type change, no relevance scoring. |
| Pagination loop in `getTools()` | Kept, as cheap insurance against the 100-row Notion cap. Not urgent at 16 rows but it closes the defect class. |

Rejected alternatives:

- **Server-side sort** (`sort` in the POST body, forwarded to Notion `sorts`): fewer files,
  but keeps a round trip per control change and permanently blocks multi-field or
  accent-insensitive search. It cannot deliver a Notion-style toolbar.
- **Relevance sort**: would require a scoring function and tie-break rules for 16 rows
  where alphabetical order is already the useful order.

## Constraints

- Stack is Astro 4.3.6 + Preact 10.19.4 + Tailwind 3.4.1. Islands only, no router.
- **No new runtime dependencies.** `cn()` in `src/lib/utils.ts` is deliberately local.
- Existing convention is non-English UI copy and Spanish `tagCategories` labels; keep them.
- No test runner exists (`openspec/config.yaml`: `strict_tdd: false`, no lint, no format).
  Verification is `bun run astro check` plus a manual interaction matrix.
- Repository-facing artifacts (code, comments, docs, commits) are English.

## Non-goals

- Replacing the `card-component-system` work or touching card/tag/detail rendering.
- URL-persisted search state (`?q=&tags=&sort=`). Deferred to a follow-up; it depends on
  this pipeline existing.
- Saved views, grouping, or a table/board layout switcher — Notion table affordances that
  do not apply to a two-dimension card grid.
- Notion data-layer rewrites beyond the mapping dedupe and the pagination loop.

## Tasks

| Id | Task | Evidence |
| --- | --- | --- |
| T1 | `src/lib/notion.ts`: extract one `mapToolPage()` row mapper and make `getTools()` follow `has_more`/`next_cursor`. | `721373d` |
| T2 | New `src/lib/query.ts`: pure, dependency-free `normalize()`, `filterTools()`, `sortTools()`, `SortDirection` type. Searches title + URL + resolved tag names. | `393c090` |
| T3 | `src/components/Search.tsx` + `Gallery.tsx`: wire the island to the client-side pipeline; live filtering, working Enter, page reset on result change, derived pagination instead of `totalItems` state. | `f17fc4c` |
| T4 | Sort control wired to the pipeline: a `Name ↑` chip whose click inverts the direction. | `f17fc4c` |
| T5 | Verification and cleanup: `astro check` green, live endpoint probe, independent `query.ts` assertions, and the orphaned `fetchNotionApi` argument plus the sort chip seam. | `762bfdb`, results below |

## Verification evidence

Independent probe of `src/lib/query.ts` (17 assertions, run from a scratch file outside the
repository — no runner added): accent folding `Café`→`cafe`, a `cafe` query matching both a
`Café` title and a URL, identical results for `cafe` and `café`, **any-of** tag semantics
(union, not intersection), empty query matching everything, empty result for an unmatched
query, accented `es` collation order that provably differs from codepoint order, `desc`
exactly the reverse of `asc`, and non-mutation of inputs by both functions.

The defect 2 in the Problem section was confirmed as pre-existing: selecting a category
mutated state without re-querying. `categoryFilter` is now a `useMemo` dependency, so the
chip and the grid can no longer disagree.

### Manual verification matrix

| Case | Expected | Result |
| --- | --- | --- |
| Load | 16 tools, page 1, `Name A→Z` | Data verified over HTTP (16 rows, all fields present); page 1 and `asc` are the declared initial state. Render not observed. |
| Type `svg` | grid narrows while typing, no submit | `results` recomputes from `searchFilter`; not observed in a browser. |
| Press Enter | no navigation, current results kept | The form now has `onSubmit` → `preventDefault()`, replacing the input's `required` attribute. Not observed in a browser. |
| Toggle a category checkbox | results update immediately, chip appears | Live through the `useMemo` dependency; not observed in a browser. |
| Remove a chip | results widen immediately | Same path; not observed in a browser. |
| Click the sort chip | order inverts, returns to page 1 | Inversion proven by probe (`desc` is exactly the reverse of `asc`). Page reset is the effect keyed on the result array. |
| Search while on page 2 | page returns to 1, never an empty grid | Reset effect plus `safePage` clamp; not observed in a browser. |
| Search `café` vs `cafe` | both match the same row | **PASS** — identical id sets in the probe. |
| No matches | empty state | **PASS** — the probe returns `[]`, which drives the existing empty state. |

**Known gap: no row above was exercised in a real browser.** The pure pipeline is verified
by execution and the wiring is verified by `astro check` and review, but nothing has
clicked a control. That is the one thing a reviewer cannot get from this document.

## Follow-ups (not in this change)

1. `GET /api/tags.json` calls `getTags()`, which still reads a single Notion page. A
   tag catalog past 100 rows would truncate silently, exactly as tools did before T1.
2. Both fetch paths swallow failures into `console.error`, so a transport error renders
   "Couldn't find any results matching your search" — a lie for a network failure. Needs
   an error state distinct from the empty state.
3. The category dropdown remains a whitelist over `tagCategories`: a tag absent from that
   file stays impossible to filter by. It is also the surface the Etapa B popover replaces.
4. The dropdown is not keyboard-operable — no Escape, no `aria-expanded`, no focus return,
   and outside-click is a `fixed inset-0` button.
5. `getTools()` ends its loop on cursor truthiness, so a page reporting `has_more: true`
   with an empty `next_cursor` would stop early. Notion does not do this today.
6. **No test runner is configured.** `src/lib/query.ts` is pure and `bun test` is already
   available through the package manager, so enabling a runner would turn the 17 ad-hoc
   probe assertions into permanent regression coverage. This is a new project capability
   and needs a user decision rather than an assumption.
7. Etapa B, the Notion-style toolbar: one row holding the input, a filter popover driven by
   the data instead of a whitelist, the sort chip, and the active chips.

## Notion-style toolbar: what was taken and what was left

Taken: the toolbar row, the removable chip per active criterion, and the direction-toggle
chip (`Name ↑` / `Name ↓`). Left: saved views, grouping, a table/board/gallery switcher,
`+ Add property` and per-column sort — all affordances of a column-based database that a
two-dimension card grid has no use for.
