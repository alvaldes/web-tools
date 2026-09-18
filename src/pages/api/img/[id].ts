import type { APIRoute } from "astro";
import { getBlockRecord } from "@/lib/notion";
import {
  freshFileUrl,
  isNotionHostedImageUrl,
  isNotionId,
} from "@/lib/notionImages";

/**
 * `GET /api/img/<recordId>` serves the image of a Notion record under a stable address.
 *
 * Notion's own file URLs are presigned per read, so their address changes on every request and a
 * browser can never reuse the bytes it already has. This route exists to be the address that does
 * not change: the record id is permanent, so the URL is cacheable, and the Notion read that turns
 * an id into bytes happens once per cache miss instead of once per page view.
 *
 * The endpoint is not an open proxy. The id must be a Notion id, and the address fetched is the
 * one the Notion API returns for that record — a client cannot ask this route to fetch anything
 * else, and it can only reach content the integration is already allowed to read.
 */

/** How long the browser may reuse the bytes before asking again. */
const BROWSER_MAX_AGE_SECONDS = 3_600;

/** How long the edge may serve the bytes without asking Notion again. */
const EDGE_MAX_AGE_SECONDS = 86_400;

/** How long the edge may keep serving them while it refreshes them in the background. */
const EDGE_STALE_SECONDS = 604_800;

/**
 * The largest file this route will stream.
 *
 * Vercel caps a Function response at 4.5 MB, and a cover that trips the cap would fail *worse*
 * than not using the proxy at all: the browser would get a truncated response instead of an
 * image. A file above this ceiling is therefore answered with a redirect to the presigned URL —
 * uncached, exactly what the page did before this route existed — while everything smaller is
 * cached. Caching when it is cheap, correctness always.
 */
const MAX_PROXIED_BYTES = 4_000_000;

function errorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // A failure must not be cached: the record may exist again a moment later.
      "Cache-Control": "no-store",
    },
  });
}

/** A URL a browser should follow instead of receiving bytes from this function. */
function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "public, max-age=60",
    },
  });
}

/**
 * Cache directives for the bytes.
 *
 * `Cache-Control` is what the browser honours and `CDN-Cache-Control` is what Vercel's edge
 * honours, which is why they differ: an hour in the browser, a day at the edge (a week of
 * background refresh after that). The asymmetry is deliberate — a file replaced behind the same
 * record id is seen by a returning visitor within the hour and is fully gone from the edge within
 * a day — and every value is a ceiling, not a promise.
 */
function cacheHeaders(upstream: Response): Headers {
  const headers = new Headers({
    "Content-Type":
      upstream.headers.get("Content-Type") ?? "application/octet-stream",
    "Cache-Control": `public, max-age=${BROWSER_MAX_AGE_SECONDS}`,
    "CDN-Cache-Control": `public, s-maxage=${EDGE_MAX_AGE_SECONDS}, stale-while-revalidate=${EDGE_STALE_SECONDS}`,
    "Vercel-CDN-Cache-Control": `public, s-maxage=${EDGE_MAX_AGE_SECONDS}, stale-while-revalidate=${EDGE_STALE_SECONDS}`,
  });
  // Forwarded so the edge and the browser can revalidate without reading the body again, and so
  // the response has a known length: a chunked response caches less predictably than one that
  // announces its size, and the length is what the size ceiling above was read from.
  const etag = upstream.headers.get("ETag");
  if (etag) headers.set("ETag", etag);
  const length = upstream.headers.get("Content-Length");
  if (length) headers.set("Content-Length", length);
  return headers;
}

export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? "";
  if (!isNotionId(id)) {
    return errorResponse(400, "Not a Notion record id.");
  }

  let fileUrl: string | null;
  try {
    fileUrl = freshFileUrl(await getBlockRecord(id));
  } catch (error) {
    // A record the integration cannot read answers 403 or 404 from Notion; either way there is no
    // image here, and the page already renders a placeholder for one.
    console.error(`Could not read Notion record ${id}:`, error);
    return errorResponse(404, "No image for that record.");
  }
  if (!fileUrl) {
    return errorResponse(404, "That record holds no file.");
  }

  // A record can hold a linked external image. Redirecting rather than fetching it keeps this
  // route reading from Notion only, which is what makes "not an open proxy" structural.
  if (!isNotionHostedImageUrl(fileUrl)) {
    return redirectResponse(fileUrl);
  }

  let upstream: Response;
  try {
    upstream = await fetch(fileUrl);
  } catch (error) {
    console.error(`Could not fetch the file of Notion record ${id}:`, error);
    return errorResponse(502, "The image could not be read.");
  }

  const declaredSize = Number(upstream.headers.get("Content-Length") ?? "0");
  if (upstream.ok && declaredSize > MAX_PROXIED_BYTES) {
    await upstream.body?.cancel();
    return redirectResponse(fileUrl);
  }
  if (!upstream.ok || !upstream.body) {
    return errorResponse(502, "The image could not be read.");
  }

  return new Response(upstream.body, {
    status: 200,
    headers: cacheHeaders(upstream),
  });
};
