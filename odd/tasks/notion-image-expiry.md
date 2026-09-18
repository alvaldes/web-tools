# Feature: Resolve Notion-Hosted Image URLs

Status: complete, except the Notion data fix (I8), which the integration's permissions block
Branch: `fix/notion-image-expiry`
Baseline: `main` at `3aa5785`, `bun test` 67 pass / 0 fail.

## Problem

The `Image` property of the Tools database is a **`url` property**. Fifteen rows hold a plain
public URL and render. One row (fffuel) holds a link copied from inside the Notion app:

```text
https://img.notionusercontent.com/s3/prod-files-secure%2Fdf8ced50-…%2FCleanShot_2026-09-17_at_4.32.37_PM2x.png/size/w=790?tok=<JWT>
```

- **D1. That link is not a public URL: it is a session- and token-bound reference.** The `tok`
  query parameter is a Notion-signed JWT whose payload carries
  `fileId: 890a4431-…`, `record: block:3de3e763-…` and `exp: 1789685663`
  (**2026-09-17T22:54:23Z**, expired). Measured on 2026-09-18:

  | Request | Result |
  | --- | --- |
  | `GET` the stored URL (expired token) | **302** → `https://app.notion.com/image/…?id=3de3e763-…&userId=…` |
  | `GET` that `app.notion.com` URL without a Notion session cookie | **401** |

  The 401 is the defect as reported. `app.notion.com/image/…` requires the Notion session
  cookie, which an anonymous browser never sends.
- **D2. The app treats every stored image value as if it were permanent.** `src/lib/notionRows.ts:131`
  (`img: readUrl(page, "Image")`) and `src/pages/[id].astro:126`
  (`src={tool.properties.Image.url}`) consume the string as-is, so the listing card and the detail
  cover both point the browser at a URL that cannot authenticate.
- **D3. Nothing reports the failure.** A broken image renders as the `ImageWithSkeleton` fallback
  glyph; there is no warning that a row holds an unusable value, so the class of defect is
  invisible until a human notices a grey rectangle.
- **D4. The detail page throws on an empty property.** `tool.properties.Image.url` is read outside
  the guarded block, so clearing the property in Notion turns the page into a 500 instead of a
  page without a cover.

The underlying file is fine and recoverable. The screenshot is an image block in the same page
(`3de3e763-a1f3-8009-b578-dc450a3fb557`), and the Notion API hands out a **fresh presigned URL on
every request**:

| Request | Result |
| --- | --- |
| `GET /v1/blocks/3de3e763-a1f3-8009-b578-dc450a3fb557` (integration token) | fresh `prod-files-secure.s3…` URL, `X-Amz-Expires=3600` |
| `GET` that URL with no cookies | **200**, 2 286 299 bytes |

`GET /v1/blocks/<page-id>` also answers 200 with the page object, so one endpoint covers both the
`block:` and the `page:` records a Notion image URL can name.

## Decisions (user-approved)

| Decision | Choice |
| --- | --- |
| Where the defect is fixed | **Resolve server-side.** The app recognizes Notion-hosted image URLs and re-addresses them through the Notion API on each render, for both the listing and the detail page. Self-healing, and it keeps the Notion authoring flow. |
| The `Image` value in Notion | **Corrected by API** as part of this change, replacing the expiring token with a stable record-addressed URL. |
| Proxy route | **Not taken.** Rejected in favour of in-request resolution. The size and browser-cache consequences of resolving to the original file are recorded under Known trade-offs and left for a separate decision. |

## Constraints

- **No new dependency.** `bun test` ships with Bun; the resolver uses `fetch` and the existing
  `fetchWithTimeout`.
- **`import.meta.env` must not be read at module scope by anything a test imports.** This is why
  the pure parts go in `src/lib/notionImages.ts` and the I/O stays in `src/lib/notion.ts`.
- `src/lib/notionRows.ts` stays pure and keeps its single runtime edge to `notionImages.ts` only
  if that edge is type-free of I/O; the mapper is not being changed by this work.
- The resolver **never throws and never changes behaviour for a healthy row**: an unresolved URL
  falls back to the stored value, which is exactly today's behaviour.
- Notion documents an average rate of ~3 requests/second per integration, so resolutions are
  bounded rather than fired in parallel.

## Non-goals

- Optimizing image bytes (resizing, `sharp`, `astro:assets` remote patterns) or adding a caching
  proxy. Both are follow-ups, not part of this fix.
- Changing the `Image` property type, migrating the other fifteen rows, or adding a
  `Files & media` property.
- Touching `notionRows.ts`, the search pipeline, or the URL state.
- An in-process cache of resolved URLs. Recorded as a follow-up instead.

## Known trade-offs (recorded, not hidden)

- **The resolved URL is the original file, not the `w=790` variant.** Notion's resizing worker
  needs the session-bound token that this change removes from the loop, so a Notion-hosted cover
  now loads the full-size screenshot (2.28 MB) instead of the ~790 px variant the author copied.
- **A resolved URL is fresh on every render, so the browser cache cannot reuse it** (the
  signature changes). Repeat visits re-download the file. A stable proxy URL would fix both
  points and is the natural follow-up.
- The JWT payload is read but **never verified**: the signature is irrelevant to the fix, whose
  only question is *which record* the URL names. The record is then re-read through the API with
  the integration token, which is the real authorization step.

## Tasks

| Id | Task | Evidence |
| --- | --- | --- |
| I1 | This document. | this commit |
| I2 | New `src/lib/notionImages.ts`: `isNotionHostedImageUrl`, `notionFileReference`, `freshFileUrl`, `findBlockIdByFileId`. | `236f067` |
| I3 | New `src/lib/pool.ts`: `mapWithConcurrency`. | `554c45e` |
| I4 | `tests/notionImages.test.ts` (22 tests) and `tests/pool.test.ts` (6 tests) over the pure surface, using the real URLs captured above as fixtures. | `236f067`, `554c45e` |
| I5 | `src/lib/notion.ts`: `resolveImageUrl(url, children?)`, `notionHeaders`, resolution inside `getTools()`. | `ea44bc0` |
| I6 | `src/pages/[id].astro`: cover through `resolveImageUrl`, and D4 closed. | `94adbb9` |
| I7 | Verification below. | this commit |
| I8 | **Blocked.** The Notion data fix needs a capability this integration does not have; see Pending. | — |

## Verification evidence

`bun test` → **95 pass / 0 fail**, 151 assertions, 5 files (was 67 pass / 3 files). `bun run astro check`
→ 0 errors, 0 warnings, **1 hint**, over 34 files. The hint is the pre-existing `client:load`
one on `ImageWithSkeleton` and not this change: `git stash` on the branch measured 30 files and
the same 1 hint at the baseline. `bun run build` → `Complete!` (the build runs `astro check`
first, then bundles the Vercel function).

### Live end-to-end, against the real database

Rendered through the dev server already running on `:4322` (this change was picked up by HMR),
with the integration token from `.env`:

| Check | Result |
| --- | --- |
| `GET /3de3e763-a1f3-8111-8828-ea83d71723bb` | **200**, exactly one `<img>`, whose `src` is a fresh `prod-files-secure.s3.us-west-2.amazonaws.com/…` URL |
| the stored `img.notionusercontent.com` string in the HTML | **absent** |
| the failing `app.notion.com/image` string in the HTML | **absent** |
| `GET` the rendered `src` with no cookies | **200**, 2 286 299 bytes |
| `GET /api/tools.json` | **200**, 16 tools, **0** rows still carrying a `notionusercontent` token URL |

### Resolver matrix — executed against the live API

Run from a throwaway script outside the repository (the pure surface already has permanent
coverage; this exercises the I/O the tests cannot reach).

| Input | Changed | Fresh load |
| --- | --- | --- |
| The expired preview value that was stored | yes → `prod-files-secure.s3…` | **200** |
| A bare presigned storage location **with** the page's children | yes → a new presigned URL | **200** |
| A bare presigned storage location **without** children | no, and a warning | n/a |
| A public external URL | no | n/a |
| A Notion URL naming no record | no, and a warning | n/a |
| A Notion URL naming a block that does not exist | no, and a warning; **did not throw** | n/a |

The third row is the documented limit of the listing path: a value carrying only a storage
location costs one API read per row to resolve and the listing does not pay it, so it keeps the
stored value and says so.

### Advisories dismissed with reason

- **`typeof` checks and `unknown` parameters in `notionImages.ts`.** The automated rules read a
  parser of untrusted input as accidental runtime typing. Here the input is a hand-edited Notion
  property, so narrowing `unknown` at runtime *is* the job; a declared type would be a lie about
  data the app does not control.
- **`console.warn` in `notion.ts`.** The rule prefers `console.error`. The module already reports
  a malformed row through `warnSkippedRows`, and this is the same class of message: not a crash,
  but the only trace of a value that cannot be used.
- **"Unused" and call-graph advisories on `resolveImageUrl` / `getTools`.** Artifacts of the
  incremental edit; `astro check` reports 0 errors and the two call sites are `[id].astro` and the
  two API routes, which only `await` the result.

## Pending: the `Image` value in Notion

`PATCH /v1/pages/3de3e763-a1f3-8111-8828-ea83d71723bb` answers
**403 `restricted_resource` — "Insufficient permissions for this endpoint"**: the integration is
read-only, so the stored value could not be rewritten by API as approved. Nothing is broken by
this, because the resolver reads the expired `tok` payload and works today; what remains is the
hygiene of not keeping an expired credential in the source of truth.

Once the integration's **Update content** capability is on, the value to store is the same file
with the record named and no token — the expiring `?tok=` replaced by `?id=<block>&table=block`,
and the four image-worker render parameters (`variantMode`, `variantParams`, `cb`,
`isFromImgWorker`) dropped, because the stored value describes the file, not one rendering of it:

```text
https://app.notion.com/image/prod-files-secure%2Fdf8ced50-ccac-401e-a48e-182b5498d7f4%2F890a4431-e325-472b-8aa8-ace1942d28d9%2FCleanShot_2026-09-17_at_4.32.37_PM2x.png?id=3de3e763-a1f3-8009-b578-dc450a3fb557&table=block&userId=edef15ba-c27d-4267-8471-6303633d26d1&sourceLocation=prod-files-secure%2Fdf8ced50-ccac-401e-a48e-182b5498d7f4%2F890a4431-e325-472b-8aa8-ace1942d28d9%2FCleanShot_2026-09-17_at_4.32.37_PM2x.png&sourceMode=s3
```

Any future value must keep either the `id`/`table` pair or a `tok` payload, because those are the
only two shapes the listing can resolve without fetching each page's blocks.

## Follow-ups (not done here)

1. **A stable proxy URL.** Resolving in-request fixes correctness and costs three things a proxy
   would remove: the browser cannot reuse a changed signature, the fresh URL is the full-size
   file rather than a resized variant, and every render with a Notion-hosted row pays an extra
   API read. A `/api/img/<blockId>` route with `Cache-Control` would address all three.
2. **A `Files & media` property instead of a `url` property.** The API returns a fresh URL for
   such a property on every query, which removes the whole class at the source. That is a schema
   change in Notion plus a mapper change, so it is a decision of its own.
3. **An in-process cache of resolved URLs**, so a warm instance does not re-resolve the same
   record on every render.
