# Feature: Card Component System

Status: implemented and verified; committed on `main`, plus two follow-up rounds from
visual passes over a loaded card (T8, T9)
Branch: `main`. GitButler's abandoned `gitbutler/integration` branch was deleted: its single
commit (`979fabd`) had an empty diff against `main`, so nothing was lost.
Verification baseline: `bun run astro check` → 0 errors, 0 warnings, 2 hints (pre-change)

## Problem

The tool listing card (`src/components/Card.tsx`) has correctness and structural defects:

1. `props.title` is mutated and truncated with `substring(0, 75)`, which cuts mid-word and
   produces cards of unequal height.
2. `<Tag>` elements are rendered without a `key`, causing Preact reconciliation warnings.
3. The card root is hardcoded dark (`bg-gray-800 border-gray-700`) while the title uses
   `text-gray-900 dark:text-white`. Tailwind's default `darkMode` is `media`, so on a
   light-preference OS the title renders dark gray on a dark card.
4. `<picture>` wraps a fragment that renders a `div` skeleton plus an `img`. `<picture>`
   only accepts `img`/`source` children, so the markup is invalid.
5. `h-48` on the image conflicts with `aspect-video`.
6. The loading skeleton in `Gallery.tsx` duplicates the card markup by hand, so the two
   structures drift independently.
7. Card content is not a link: the whole card is not clickable, and the two CTAs
   (external `Visit`, internal `Read More`) compete with equal visual weight.
8. There are no semantic design tokens. Surfaces, borders and foregrounds are ad-hoc
   `gray-*` values repeated across `Card`, `Tag`, `Filter`, `Pagination` and `Search`.
9. `colorVariants.indigo` maps to pink values, duplicating the `pink` entry.
10. `Filter` uses `hover:text-black/40` on a `bg-*-900` surface, which reduces contrast
    on hover instead of increasing affordance.

## Decisions (user-approved)

| Decision | Choice |
| --- | --- |
| Card API scope | shadcn-like primitive at `src/components/ui/card.tsx` with `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`, `data-slot` attributes and a `size` prop |
| Theming | Semantic tokens (`--card`, `--card-foreground`, `--muted`, `--border`, `--ring`, `--primary`) defined once and consumed app-wide, migrating Card, Tag, Filter, Pagination and the search controls |
| Card behaviour | Whole card navigates to the tool detail page via one stretched link; external `Visit` stays as a secondary action |

## Constraints

- Stack is **Tailwind 3.4.1**, not v4. The current shadcn docs use v4-only syntax
  (`gap-(--card-spacing)`, `bg-card` theme keys, `ring-foreground/10`, `@container`).
  The port keeps the v4 *API and composition* and translates the classes to TW3 syntax:
  arbitrary values `[var(--card-spacing)]`, extended theme colors, `has-[...]`/`data-[...]`
  variants where TW 3.4 supports them, and no `@container` (requires a plugin that is
  not installed).
- No new runtime dependencies. `clsx` exists only as a transitive dependency, so `cn()`
  is implemented locally without `tailwind-merge`; conflicting-class resolution is out
  of scope.
- The app is dark-only. `data-theme="dark"` on `<html>` is not read by Tailwind, so
  `darkMode` is switching to `"class"` and `<html>` gains `class="dark"` to make the
  existing `dark:` variants deterministic.

## Non-goals

- Light theme support or a theme switcher.
- Adding card descriptions: the tools listing (`WebTools = { id, title, url, tags, img }`)
  has no description field and fetching one would add N+1 Notion requests.
- Rewriting Notion data access, filtering, or pagination logic.
- Test infrastructure: the project has no test runner; verification is `astro check`
  plus a manual visual pass.

## Tasks

- [x] T1 — Add semantic theme tokens and explicit dark mode (`src/layouts/Layout.astro`, `tailwind.config.mjs`)
- [x] T2 — Add a dependency-free `cn()` helper and fix the `indigo` variant (`src/lib/utils.ts`)
- [x] T3 — Create the shadcn-like Card primitive (`src/components/ui/card.tsx`)
- [x] T4 — Build `ToolCard` on the primitive with a whole-card link (`src/components/ToolCard.tsx`, delete `src/components/Card.tsx`)
- [x] T5 — Rebuild the gallery skeletons and grid on the primitive (`src/components/Gallery.tsx`)
- [x] T6 — Migrate Tag, Filter, Pagination and the search controls to tokens
- [x] T7 — Verify: `bun run astro check` clean plus manual visual pass
- [x] T8 — Fix what the visual pass over a loaded card exposed (title size regression,
      footer weight, ambiguous arrow, preview crop)
- [x] T9 — Second visual pass: measurable contrast for the tag pills and the footer link,
      and the horizontal image bleed. Reported by the user as: the gray tag is invisible,
      "Visit site" does not stand out, and the image does not reach the right card edge

## Evidence

| Task | Evidence |
| --- | --- |
| baseline | `bun run astro check` → 0 errors, 0 warnings, 2 hints |
| T1 | compiled CSS preflight contains `*,:before,:after{border-color:var(--border)}`; `html` now carries `class="dark"`; `darkMode: "class"` |
| T2 | `cn()` in `src/lib/utils.ts`; `indigo` no longer aliases pink |
| T3 | compiled CSS contains `[&:has([data-slot=card-footer])]:pb-0`, `[&.border-b]:pb-[var(--card-spacing)]`, `[&:has(>img:first-child)]:pt-0`, `[--card-spacing:1rem]`, `data-[size=sm]:[--card-spacing:0.75rem]` |
| T4/T5 | SSR of `/` returns 8 skeleton cards with `data-slot="card"`, `card-header`, `card-content`, `card-footer` and `aria-busy="true"` |
| T6 | `lens_diagnostics` (LSP, 8 paths) → 7 clean; 3 information-level findings, all pre-existing in `Search.tsx` |
| T7 | `bun run astro check` → 0 errors, 0 warnings, 0 hints (was 2 hints); `bun run build` completes |
| T8 | Visual pass over a loaded card screenshot; title measured at ~14px against the previous `text-xl`, plus `object-top`/`text-base` present and `py-2.5` emitted at byte 12710, after `p-[var(--card-spacing)]` at 8432 |
| T9 | Playwright measurement of the rendered card (`~/Library/Caches/ms-playwright`, viewport 1440) against `astro dev` on :4399. Before: gray pill `rgb(17,24,39)` vs card `rgb(22,24,32)` = **1.00:1**; green pill 1.94:1; blue pill 1.71:1; `--primary` link vs `bg-muted` footer = **2.88:1**; image box `128→417-16` inside a card `144→417` = **16px right gap and 16px left overhang**. After: gray pill fill 1.17:1 plus a 1px inset ring of gray-400/25 measuring 1.84:1 against the card; link 5.85:1; image `144→417` = 0px gap on both sides. Details in "Visual pass 2" below |
| T9 (extra) | Skeleton (data fetch aborted) → image width **== card width**, 0px gap on both sides. Detail page → 5 pills carry the new tint + ring. Production bundle `.vercel/output/static/_astro/_id_.f_1Tu9qz.css` contains `.bg-gray-500\/15{background-color:#6b728026}`, `.ring-gray-400\/25{--tw-ring-color: rgb(156 163 175 / .25)}` and `.text-link{color:var(--link)}`, with `bg-gray-900` and `bg-blue-900` gone. `astro check` → 0 errors, 0 warnings, 0 hints; `astro build` completes |

### Verification notes

Tailwind 3 silently drops two utility forms that the upstream Tailwind 4 docs use.
Both were confirmed absent from the compiled CSS and then rewritten and re-confirmed present:

| Upstream form | Dropped | Replacement |
| --- | --- | --- |
| `has-data-[slot=card-footer]:pb-0` | yes — TW3.4 cannot stack `data-*` inside `has-*` | `[&:has([data-slot=card-footer])]:pb-0` |
| `[.border-b]:pb-[var(--card-spacing)]` | yes — arbitrary variants need an explicit `&` | `[&.border-b]:pb-[var(--card-spacing)]` |

Data path check: `POST /api/tools.json` → HTTP 200, 16 items, keys `id,title,url,tags,img`,
which is exactly what `ToolCard` destructures.

## Risks

- **Generated CSS trust.** Resolved: every translated variant was asserted against the
  compiled CSS instead of assumed, and two broken forms were found and fixed.
- **Shared dirty file.** `src/components/Search.tsx` already carries unrelated
  uncommitted work (tag categories). Only class strings were edited there; the
  pre-existing `toogle` typo and the redundant `useState<Tags[]>` annotation were
  deliberately left alone to avoid colliding with that in-flight change.
- **`--card-spacing` doc comment.** The usage example in `card.tsx` is scanned by
  Tailwind as content, so it emits one extra `[--card-spacing:1.5rem]` rule. Harmless,
  but it is why that unused utility appears in the bundle.
- **Git history.** Committed on `main` as three work units (tokens, card system, tag
  categories). The worktree also carried unrelated uncommitted work by the repository
  owner (tag categories and the deprecated-tag filter), which overlaps this change in
  `Search.tsx`, `utils.ts` and `.gitignore`. `Search.tsx` could not be split: the
  dropdown line was modified by both changes. Intermediate file states were rebuilt
  rather than split by patch, and each staged diff was inspected before committing.
- **Build output.** `bun run build` writes `.vercel/output`; it was not gitignored and
  the build was generated there. `.vercel/` is now ignored and the output was removed.

## Visual pass (T8)

Observed on a screenshot of a loaded card. What it confirmed and what it broke:

| Finding | Severity | Resolution |
| --- | --- | --- |
| Title rendered at ~14px: `CardTitle` has no size class and inherited `text-sm` from the card root, while the component it replaced used `text-xl`. A regression, not a design choice | regression | `text-base` on `ToolCard`'s `CardTitle` |
| Footer sat at the same size as the title with a full `--card-spacing` box around a single secondary link | cosmetic | `py-2.5` on `ToolCard`'s `CardFooter` |
| The far-right arrow shared a row with "Visit site" and read as if it belonged to that external link, while it actually signalled the stretched card link to the internal detail page | ambiguity | arrow removed; the hover ring carries the affordance |
| `object-cover` centred the crop of a tall screenshot, cutting rows top and bottom and slicing names at the left edge | cosmetic | `object-top` |

The image bleeding edge to edge under rounded corners confirmed the negative-margin bleed
works. The violet ring in the screenshot is the hover state, not the resting one: the
compiled CSS shows `.ring-border` as the only unconditional ring rule and all four
`ring-ring` rules prefixed by a state (`:hover`, `:focus-within`, `:focus`,
`:focus-visible`).

## Visual pass 2 (T9)

The three defects the user reported were reproduced with an instrumented Chromium page
(`playwright`, global install) that reads `getBoundingClientRect` plus the computed colors
and computes WCAG relative-luminance ratios, instead of judging a screenshot by eye.

| Report | Root cause | Fix |
| --- | --- | --- |
| The gray tag reads as bare text | `colorVariants.gray` was `bg-gray-900` (`#111827`) on a `--card` of `#161820`: a **1.00:1** surface delta, mathematically indistinguishable. The sibling variants were barely better (green 1.94:1, blue 1.71:1), so this was a class of defect, not one bad entry | Every variant is now a translucent tint plus an inset hairline: `bg-{c}-500/15 text-{c}-300 ring-1 ring-inset ring-{c}-400/25`. A translucent fill cannot coincide with any surface, and the ring defines the pill edge (gray: 1.82:1 ring against the card). The class strings stay literal on purpose: Tailwind's scanner cannot see an interpolated `bg-${color}-500/15`, so a helper would silently emit no CSS |
| "Visit site" does not stand out | The link used `--primary` (`#2563eb`), which is a *fill* token for the blue search button and only reaches **2.88:1** as text on the `bg-muted` footer, below the 4.5:1 the 14px label needs | New `--link` token (`#60a5fa`, **5.86:1** on `bg-muted`, 6.97:1 on `--card`). `--primary` keeps painting the button, so the text-link role and the action-fill role are no longer the same token |
| The image does not reach the right card edge | The card root carries only vertical padding (horizontal inset belongs to each section), so `w-full` was already the full card width. The horizontal negative margin inherited from the upstream v4 pattern (where the root itself has `px`) therefore only *shifted* the image 16px left and left 16px uncovered at the right | Horizontal negative margin removed from the card and the skeleton. The image now measures exactly `144→417`, flush on both sides and with **no horizontal crop** (the previous left overhang was being clipped by `overflow-hidden`, so the left 16px of every screenshot was silently cropped too) |

A note was added to the `Card` primitive documenting that the root insets the horizontal
axis to its sections, so a flush child needs no horizontal negative margin. That is the
trap that produced this third defect: the bleed pattern was copied from a version of the
primitive whose root padding is symmetric.

The soft tint leaves the pill fill deliberately quiet (gray 1.17:1, green 1.29:1, blue
1.20:1 against the card), so the **ring** is what draws the pill edge: 1.84:1 for gray and
2.29:1 for green against the card. Verified in the rendered pixels at 4x, not only in the
numbers. If that hairline ever reads too faint on a given monitor, the single lever is the
ring alpha in `colorVariants` (`/25` -> `/40`, about 2.4:1 for gray); the fill alpha is not
worth raising, since the text never was the contrast problem (it already sits at 8-10:1
on the tint).

## Follow-ups (not done)

- Card descriptions: needs a `description` field in `WebTools` (backend change).
- Showing the tool's domain instead of the raw URL in the footer.
- `toogleDropdown` typo in `Search.tsx` (belongs to the unrelated in-flight change).
- The rest of the detail page (`src/pages/[id].astro`) still carries ad-hoc palette classes
  (`text-gray-400`, `hover:text-white`) instead of the semantic tokens. Only the tag pills
  and the URL link were migrated; the page as a whole was out of scope for this pass.

## Follow-ups (done after T9)

- The detail page rendered its tags with inline markup plus a direct `colorVariants` lookup.
  It now renders the shared `Tag` component. Same measured box (20px tall, widths 44/61/78/
  46/71 unchanged), now with the component's `inline-flex` + `whitespace-nowrap`, and the
  wrapper moved from `me-2` per pill to an 8px `gap` with `flex-wrap` (measured: 1 row at
  1440px, 2 rows and 0px overflow at 360px, where the previous `nowrap` could only clip).
  The `tagsList.length && ...` guard also became a comparison: `0 && x` evaluates to `0`,
  which Astro renders as a literal "0" in the toolbar of a tool with no tags.
- The detail page's external URL link used a hardcoded `text-blue-600` (`#2563eb`) at 16px on
  `--background`, the same defect reported for the card footer one commit earlier:
  **3.68:1**. It now uses the `--link` token, measured at **7.47:1**.
