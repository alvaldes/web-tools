# Feature: Dependency Upgrade (Astro 4 → 7, Tailwind 3 → 4)

**This is the first task of the next session.** The user asked for it explicitly after two deploy
failures whose common cause was version drift.

Status: not started. Nothing here has been attempted.
Branch to create: `feat/dependency-upgrade` (from `main`).

## Why this is first

Two consecutive Vercel deploys failed, and neither failure was about application code:

1. **`invalid runtime: _render (nodejs18.x)`.** `@astrojs/vercel` 7.3.1 derives the function
   runtime from the build's Node major against a table hardcoded in the adapter that stops at
   Node 20. Vercel builds on Node 24, so the adapter fell through to `nodejs18.x`, which Vercel
   no longer accepts. No 7.x release fixes it: 7.7.0 and 7.8.2 carry the same date-blind table.
   `@astrojs/vercel` 11 needs `astro ^7`.
2. **Six `ts` errors in the build.** `scripts/patch-vercel-runtime.ts` used `node:fs`, `node:path`
   and `process` without Node's type declarations. They were present locally only because a
   transitive dependency had installed `@types/node`, and absent from Vercel's resolved tree —
   partly because bun 1.3.14 on Vercel migrates and re-resolves the 2024-era `bun.lockb`.

Both are symptoms of the same thing: **the local toolchain and the deployed toolchain have
diverged, and the framework is three majors behind.** Patching around it is now generating its own
follow-up work — the runtime patch script is a workaround with a deletion condition, not a fix.

## Verified current state (npm, 2026-09-17)

| Package | Here | Latest | Constraint that matters |
| --- | --- | --- | --- |
| `astro` | 4.3.6 | **7.3.3** | three majors behind |
| `@astrojs/vercel` | 7.3.1 | 11.0.10 | latest needs `astro ^7.0.0` |
| `@astrojs/preact` | 3.1.0 | 6.0.5 | — |
| `@astrojs/tailwind` | 5.1.0 | 6.0.2 | **tops out at `astro ^5.0.0` and `tailwindcss ^3.0.24`** |
| `@astrojs/check` | 0.5.4 | 0.9.10 | — |
| `preact` | 10.19.4 | 10.29.8 | — |
| `tailwindcss` | 3.4.1 | **4.3.3** | major rewrite |
| `typescript` | 5.3.3 | 7.0.2 | TS 7 is the native port |
| `@types/node` | 22.20.3 | 26.6.1 | should track the *function* runtime |

Toolchain drift, separately:

| | Local | Vercel |
| --- | --- | --- |
| bun | **1.0.14** | **1.3.14** |
| lockfile | `bun.lockb` (binary, v1, from 2024) | migrates and rewrites it on every install |

`bun.lockb` predates Bun's text `bun.lock` format (Bun 1.2+). Vercel logs `Saved lockfile` on every
build, which is the migration happening. Local Bun 1.0.14 cannot produce the current format at
all.

## The hard structural facts

- **`@astrojs/tailwind` was never released for Astro 6 or 7.** Its peer range stops at `^5.0.0`, so
  any Astro 6+ upgrade **must** drop it and adopt Tailwind 4 through the Vite plugin
  (`@tailwindcss/vite`). This is not optional and it is the largest single piece of work here.
- **Tailwind 4 is CSS-first.** Theme configuration moves from `tailwind.config.mjs` into `@theme`
  in CSS, and `darkMode: "class"` becomes `@custom-variant dark`. The 15 `var(--…)` colour
  references in `tailwind.config.mjs` have to become `--color-*` theme variables.

## The migration surface in this repository (measured)

| Pattern | Count | Why it matters |
| --- | --- | --- |
| `[&:has([data-slot=…])]` arbitrary variants | 5 | This is a **Tailwind 3 workaround**; v4 supports `has-data-[slot=…]` natively, so these should be simplified back |
| other `[&.…]` arbitrary variants | 2 | same family |
| `data-[…]` variants | 2 | supported in both |
| `@container` | 1 | currently **disabled** in `card.tsx` because the plugin is not installed; v4 has container queries built in, so this can be restored |
| `bg-muted/…` opacity modifier | 1 | `card.tsx` documents that opacity modifiers **do not work** on raw `var()` tokens in v3. In v4, `--color-*` theme variables make them work — this is a gain, but every "use a dedicated token instead" comment becomes stale |
| `ring-inset` | 9 | renamed in v4 (`inset-ring`) |
| logical properties (`ps-`, `me-`, `border-s-`, `rounded-e-`, …) | 52 | supported in both; no change expected |
| `dark:` variant | 1 | `darkMode: "class"` needs re-expressing as `@custom-variant` |
| `var(--…)` in `tailwind.config.mjs` | 15 | the token palette, moving to `@theme` |

Files carrying version-specific comments that must be rewritten rather than left lying:
`src/components/ui/card.tsx`, `src/components/ui/popover.tsx`, `src/lib/utils.ts`,
`tailwind.config.mjs`.

## Order of operations

Each step is its own branch, its own work units, and must leave **its own gate green** before the
next one starts. Do not attempt this as one change.

1. **Toolchain first, framework second.** Pin the package manager (`packageManager` in
   `package.json`), migrate `bun.lockb` → `bun.lock` with a Bun ≥ 1.2, and confirm a clean
   `bun install` is reproducible. Without this, local and Vercel keep resolving different trees and
   every later step is unverifiable.
2. **Astro 4 → 5**, keeping `@astrojs/tailwind` (it still supports `^5.0.0`). Smallest possible
   framework step, so a failure is attributable.
3. **Tailwind 3 → 4 + drop `@astrojs/tailwind` + adopt `@tailwindcss/vite`**, together with
   **Astro 5 → 6 → 7**. The Tailwind move is forced by the Astro move; doing them together avoids
   maintaining a config that cannot survive the next step.
4. **`@astrojs/check` → 0.9.10** and TypeScript → 7. TypeScript 7 is the native port; treat it as
   its own risk with its own gate because it will surface new diagnostics across the codebase.
5. **Delete the workarounds.** See below.

## Deletion conditions this upgrade satisfies

- **`scripts/patch-vercel-runtime.ts` is deleted** once `@astrojs/vercel` 11 emits a supported
  runtime on its own, together with the extra step in the `build` script. The script's own
  docstring carries this instruction.
- `@types/node` **stays** — a TypeScript file that imports `node:fs` must declare its Node types,
  and that is now a permanent, correct declaration rather than a workaround. Only its pinned major
  should be revisited, and it should keep tracking the *function* runtime rather than the build
  runtime.

## Verification gate for every step

The complete gate, run on each step and recorded in `odd/tasks/`:

1. `bun test` → 67 passing today, 0 failing.
2. `bun run astro check` → 0 errors, 0 warnings, 0 hints.
3. `bun run build` → success, and the emitted function runtime is a Vercel-supported one
   (`nodejs22.x` or newer).
4. **The browser matrix is the interaction regression net.** `tests/` covers only the pure
   modules; every island behaviour claim rests on a driven Chromium run. Re-run the 25-case matrix
   and record the result. Do not treat `astro check` as evidence that the UI still works.
5. `bun run dev` must start without a Vite resolution error in the log.

## Open questions to resolve in that session (do not guess now)

- Whether to keep a `tailwind.config.mjs` at all, or go fully CSS-first and delete it.
- Whether Astro 5/6/7 changes the `output: "server"` + Vercel adapter contract.
- Whether TypeScript 7's stricter or changed diagnostics affect `src/lib/notionRows.ts`'s
  deliberate `Record<string, unknown>` guards.
- Whether Preact 10.29 changes anything this project relies on — in particular that `onChange` on
  a text field is the native `change` event and only fires on blur, which is why the search field
  uses `onInput`.
