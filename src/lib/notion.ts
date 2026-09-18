import {
  collectTags,
  collectTools,
  isDeprecatedTagName,
  nextCursor,
} from "./notionRows";
// Type-only: the value import above is the single runtime edge to the mapper.
import type { NotionQueryResponse } from "./notionRows";
import {
  findBlockIdByFileId,
  freshFileUrl,
  isNotionHostedImageUrl,
  notionFileReference,
} from "./notionImages";
import { mapWithConcurrency } from "./pool";

export type WebTools = {
  id: string;
  title: string;
  url: string;
  tags: string[];
  img: string;
};

export type Tags = {
  id: string;
  name: string;
  color: string;
};

const tagsApiKey = import.meta.env.PUBLIC_NOTION_TAGS_DATABASE_ID;
const toolsApiKey = import.meta.env.PUBLIC_NOTION_TOOLS_DATABASE_ID;

/** Default timeout for Notion API requests. */
const NOTION_TIMEOUT_MS = 15_000;

/**
 * How many image resolutions may be in flight at once.
 *
 * An integration is allowed an average of about three requests per second, so a listing that
 * needs several fresh image URLs is read through a bounded pool rather than all at once.
 */
const IMAGE_RESOLUTION_CONCURRENCY = 3;

/** The credential every Notion API call in this module carries. */
function notionHeaders(): Headers {
  return new Headers({
    Authorization: `Bearer ${import.meta.env.PUBLIC_NOTION_KEY}`,
    "Notion-Version": "2022-06-28",
  });
}

/**
 * Thin wrapper around fetch that aborts after NOTION_TIMEOUT_MS.
 * The raw Notion calls had no timeout, so a slow or unreachable endpoint would
 * leave the request hanging until the system TCP timeout (~21 s on this machine).
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = NOTION_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Request body of a Notion database query.
 *
 * `sorts` stays even though the client re-sorts: it keeps the feed deterministic and
 * gives `getTags()` a stable order, which has no client-side pipeline of its own.
 */
interface NotionQueryRequest {
  sorts: Array<{ property: string; direction: "ascending" | "descending" }>;
  start_cursor?: string;
}

async function fetchNotionApi(
  database: string,
  startCursor?: string,
): Promise<NotionQueryResponse> {
  const headers = notionHeaders();
  headers.set("Content-Type", "application/json");
  const endpoint = `https://api.notion.com/v1/databases/${database}/query`;
  const dataBody: NotionQueryRequest = {
    sorts: [
      {
        property: "Name",
        direction: "ascending",
      },
    ],
  };
  if (startCursor) {
    dataBody.start_cursor = startCursor;
  }
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(dataBody),
  });
  if (!response.ok) {
    throw new Error(`Notion API request failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Names every page the mapper had to skip.
 *
 * The mapping is deliberately non-fatal, so this warning is the only place a broken row
 * becomes visible: without it a malformed tool would vanish from the listing in silence,
 * which is half of how the "no results" bug stayed invisible.
 */
function warnSkippedRows(kind: string, skippedIds: string[]): void {
  for (const id of skippedIds) {
    console.warn(`Skipping malformed Notion ${kind} row: ${id}`);
  }
}

/**
 * Every tag the catalog holds, minus the retired ones.
 *
 * The mapping and the guards live in `notionRows.ts`, which is pure: the previous version
 * read `properties.Name.title[0].text.content` here, so one nameless tag threw and took
 * the whole catalog with it.
 */
export async function getTags(): Promise<Tags[]> {
  const tags: Tags[] = [];
  let cursor: string | undefined;
  // The same cap and the same loop as `getTools()`: the catalog used to be read from one
  // Notion page, so tag 101 would have been dropped without a word.
  do {
    const response = await fetchNotionApi(tagsApiKey, cursor);
    const { rows, skippedIds } = collectTags(response);
    warnSkippedRows("tag", skippedIds);
    tags.push(...rows.filter((tag) => !isDeprecatedTagName(tag.name)));
    cursor = nextCursor(response);
  } while (cursor);
  return tags;
}

export async function getTools(): Promise<WebTools[]> {
  const tools: WebTools[] = [];
  let cursor: string | undefined;
  // Notion caps page_size at 100, so a single read silently truncates the listing.
  // Follow `has_more` through `nextCursor`, which also refuses to end the loop quietly
  // on a page that reports more results without a cursor.
  do {
    const response = await fetchNotionApi(toolsApiKey, cursor);
    const { rows, skippedIds } = collectTools(response);
    warnSkippedRows("tool", skippedIds);
    tools.push(...rows);
    cursor = nextCursor(response);
  } while (cursor);
  // A Notion-hosted value cannot be loaded by the browser as stored (see `resolveImageUrl`),
  // so the listing re-addresses those here. Rows with a public URL never cost a request.
  return mapWithConcurrency(tools, IMAGE_RESOLUTION_CONCURRENCY, async (tool) =>
    tool.img === "" ? tool : { ...tool, img: await resolveImageUrl(tool.img) },
  );
}

export async function getPage(id: string) {
  const response = await fetchWithTimeout(
    `https://api.notion.com/v1/pages/${id}`,
    {
      method: "GET",
      headers: notionHeaders(),
    },
  );
  if (!response.ok) {
    throw new Error(`Notion API request failed: ${response.statusText}`);
  }
  return response.json();
}

export async function getBlocks(id: string) {
  const response = await fetchWithTimeout(
    `https://api.notion.com/v1/blocks/${id}/children?page_size=100`,
    {
      method: "GET",
      headers: notionHeaders(),
    },
  );
  if (!response.ok) {
    throw new Error(`Notion API request failed: ${response.statusText}`);
  }
  return response.json();
}

/** `GET /v1/blocks/<id>`, which answers for a page id as well as for a block id. */
async function fetchBlockRecord(id: string): Promise<unknown> {
  const response = await fetchWithTimeout(
    `https://api.notion.com/v1/blocks/${id}`,
    {
      method: "GET",
      headers: notionHeaders(),
    },
  );
  if (!response.ok) {
    throw new Error(`Notion API request failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * A URL with its query string dropped, so a `tok` credential never reaches a log line.
 */
function withoutQuery(url: string): string {
  const cut = url.indexOf("?");
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * The URL the browser should load for a stored image value.
 *
 * A Notion-hosted value is not a public address: it carries a token that expires, and once it
 * does, the host answers a redirect to a page that needs a Notion session cookie and the
 * browser gets a 401. So the record the URL names is read again through the API and the fresh
 * URL that read returns is what the page gets. Any other value is returned untouched.
 *
 * Two properties this function must keep. It **never throws**, because a Notion outage must
 * not be able to take a page down; and it **never returns something worse than its input**, so
 * an unresolvable value falls back to the stored one, which is exactly what the page rendered
 * before this existed.
 *
 * `children` is the page's block listing when the caller already has it. It is the only way to
 * resolve a value that carries a bare storage location — a pasted presigned link — because no
 * record id survives in it.
 */
export async function resolveImageUrl(
  url: string,
  children?: unknown,
): Promise<string> {
  if (!isNotionHostedImageUrl(url)) return url;
  try {
    const reference = notionFileReference(url);
    if (reference && reference.kind !== "file") {
      const fresh = freshFileUrl(await fetchBlockRecord(reference.id));
      if (fresh) return fresh;
    }
    if (children && reference?.kind === "file") {
      const blockId = findBlockIdByFileId(children, reference.fileId);
      if (blockId) {
        const fresh = freshFileUrl(await fetchBlockRecord(blockId));
        if (fresh) return fresh;
      }
    }
    console.warn(
      `Keeping an unresolved Notion-hosted image URL: ${withoutQuery(url)}`,
    );
  } catch (error) {
    console.warn(
      `Could not resolve a Notion-hosted image URL (${withoutQuery(url)}): ${String(error)}`,
    );
  }
  return url;
}

export default {
  getTags,
  getTools,
  getPage,
  getBlocks,
  resolveImageUrl,
};
