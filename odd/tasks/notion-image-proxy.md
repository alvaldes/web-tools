# Feature: Notion Image Proxy

Status: complete
Branch: `fix/notion-image-expiry` (continuation; the resolver ended at `1dd49a5`)
Predecessor: `odd/tasks/notion-image-expiry.md`
Baseline: `bun test` 95 pass / 0 fail at `1dd49a5`.

## Problem

The resolver closed the 401: every render now hands the browser a URL that loads. Three costs
were recorded at the time and are what this change pays down.

- **D1. The browser cannot cache the image.** Each render builds a *new* presigned URL, so the
  cache key changes on every page view. A returning visitor re-downloads the cover — 2 286 299
  bytes for the fffuel row.
- **D2. Every render with a Notion-hosted row costs one Notion API read.** On the listing that is
  a read per such row per view, which is why the first change had to bound concurrency: without
  the bound, a catalog full of Notion-hosted rows would collect `429`s.
- **D3. The read is paid even though the render needs nothing from it.** The page only needs the
  cover's *identity* to build an `src`, and the identity is already inside the stored URL — the
  resolver reads the API an extra time to translate it into a URL the browser can load.

## Decision

Serve Notion-hosted images through **the app's own route, addressed by the record id**:
`/api/img/<blockId>`.

The route is stable (one URL per record, forever), which is the whole point: it is the only way to
get a cacheable address, because Notion's own URLs are signed per read. It also moves the API read
out of the render path entirely — the render now needs the id, which the stored URL already
carries — so the read happens once per cache miss instead of once per page view.

This supersedes part of the previous change, so that change is trimmed rather than left in place:

| Superseded | Why it goes |
| --- | --- |
| `resolveImageUrl` performing an API read at render time | The proxy owns that read now, and the render path holds no I/O at all: `imageSource` is pure. |
| `src/lib/pool.ts` and its tests | The listing no longer performs concurrent reads, so the bound has nothing left to bound. Keeping it would be dead code with tests. Deleted rather than kept warm. |
| `fetchBlockRecord` as a private helper of the resolver | Exported as `getBlockRecord`, because the route is what reads a record now. |

Keeping the per-render read *and* adding the proxy was the alternative, and it is strictly worse:
two mechanisms producing one `src`, with the expensive one dead in the common case.

## Constraints

- **No new dependency**, so no resizing. The route streams the file Notion holds; a 790 px
  variant would need `sharp` or Notion's session-bound worker, and neither is available here.
  Size is a follow-up decision, not a silent gap: see Known limits.
- `import.meta.env` still must not be read at module scope by anything a test imports, so
  `imageSource` stays in `src/lib/notionImages.ts` and the route keeps every read.
- The endpoint serves only what the integration can already read: the id is validated as a Notion
  id, and the upstream URL is the one the API returns for that record. A client cannot ask it to
  fetch an arbitrary address, so it is not an open proxy. A record whose file is *external* is
  answered with a redirect rather than fetched, which keeps that property structural.

## Known limits (recorded, not hidden)

- **The bytes are still the original file.** Caching removes the repeat downloads, not the 2.28 MB
  first load. Removing that needs an image library (`sharp`) — a dependency decision, so it stays
  outside this change.
- **Cached for a day.** A record whose file is replaced in place can serve the old bytes for up to
  a day at the edge. Hour-long browser caching and a day-long edge cache are the compromise; a
  content-addressed route (the file id in the path) would remove the window entirely.
- **The listing still cannot resolve a value that carries only a storage location** (a pasted
  presigned link). Nothing names a record in it, so it keeps the stored value and warns, exactly
  as before.

## Non-goals

- Resizing, `astro:assets`, `sharp`, or any dependency.
- Changing the `Image` property in Notion, or the `Image` value contract.
- A content-addressed route variant, an in-process cache, or purge-on-webhook.
- Touching the search pipeline, the URL state, or the pagination behaviour.

## Tasks

| Id | Task | Evidence |
| --- | --- | --- |
| P1 | This document. | this commit |
| P2 | `src/lib/notionImages.ts`: `imageSource`, plus `isNotionId` and `withoutQuery` for the route. | `3d770b9` |
| P3 | `src/pages/api/img/[id].ts`: record read, stream, cache headers, size ceiling, 400/404/502. | `8bf484c` |
| P4 | `notionRows.ts` builds `img` through `imageSource`; `[id].astro` uses it with the block listing; `notion.ts` exports `getBlockRecord` and loses `resolveImageUrl`; `pool.ts` and its tests deleted. | `8bf484c` |
| P5 | Verification below. | this commit |
| P6 | Commits and this evidence. | this commit |

## Verification evidence

`bun test` → **98 pass / 0 fail**, 162 assertions, 4 files. Six of the previous 95 belonged to the
pool and left with it; nine are new (`imageSource`, `isNotionId`, `withoutQuery`, and the mapped
row). `bun run astro check` → 0 errors, 0 warnings, **1 hint** over 33 files, the same pre-existing
`client:load` hint as before. `bun run build` → `Complete!`.

**Each commit was verified on its own.** The pure layer is inert by itself, so its tree was checked
with the rest of the work stashed: 95 pass / 0 fail and 0 errors. The first attempt at these two
commits paired them wrongly — the pool was deleted in the commit that did not yet drop its
importer, which would have left a branch whose second commit cannot even type-check. It was rebuilt
before anything was pushed.

### Live, against the real database

Through the dev server on `:4322`, with the integration token from `.env`:

| Check | Result |
| --- | --- |
| detail page `<img src>` | `/api/img/3de3e763-a1f3-8009-b578-dc450a3fb557` |
| `/api/tools.json`, fffuel `img` | the same route |
| `GET` that route | **200**, `image/png`, 2 286 299 bytes, a valid PNG (2619×1524), byte-identical across two fetches |
| its headers | `Cache-Control: public, max-age=3600`; `CDN-Cache-Control` and `Vercel-CDN-Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`; `ETag: "6661cea718aec8dd0032e518846de589"`; `Content-Length: 2286299` |
| `GET /api/img/not-an-id` | **400** `Not a Notion record id.` |
| `GET /api/img/11111111-…` (no such record) | **404** `No image for that record.` |
| `GET /api/img/<the page id>` (a `child_page`, no cover) | **404** `That record holds no file.` |
| every failure | `Cache-Control: no-store` |

The render path holds no Notion read for images, and that is a property of the tests rather than a
claim: `imageSource` is asserted by equality against a string, which a promise could not satisfy.

### Not verifiable locally, stated as such

- **The edge cache itself.** The headers are what Vercel documents for caching a Function response;
  the dev server has no edge, so "cached at the edge" is configured, not measured. It becomes
  observable on the first deploy, in the response headers of a repeated request.
- **The 4 MB redirect branch.** No file in the database is that large (the largest is 2.28 MB).
- **The external-file redirect branch.** Every other row stores a public URL directly, so no record
  in reach holds a linked image.
- **The page-cover path of `freshFileUrl`.** No page in the database has a cover; that path is
  covered by unit tests only.

### Discovery worth keeping

A presigned Notion URL is signed for `GET`: a `HEAD` on it answers **403**. So the route must `GET`
and read `Content-Length` from the response, which is what it already does before deciding between
streaming and redirecting.

### Advisories dismissed with reason

- **Call-graph "will break" on `getTags` / `getTools`.** Their bodies changed; both call sites only
  `await` the result and serialise it. `astro check` reports 0 errors, and `/api/tools.json` was
  fetched live with 16 tools.
- **`console.warn` from a pure module.** `imageSource` decides whether a stored value can be used,
  so it is also the only place that knows when one cannot. It is the same reporting channel the row
  mapper already uses, and the test asserts the message never carries an `X-Amz` signature.
