import {
  collectTags,
  collectTools,
  isDeprecatedTagName,
  nextCursor,
} from "./notionRows";
// Type-only: the value import above is the single runtime edge to the mapper.
import type { NotionQueryResponse } from "./notionRows";

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
  const headers = new Headers({
    Authorization: `Bearer ${import.meta.env.PUBLIC_NOTION_KEY}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  });
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
 * Every tag the catalog holds, minus the retired ones.
 *
 * The mapping and the guards live in `notionRows.ts`, which is pure: the previous version
 * read `properties.Name.title[0].text.content` here, so one nameless tag threw and took
 * the whole catalog with it.
 */
export async function getTags(): Promise<Tags[]> {
  const response = await fetchNotionApi(tagsApiKey);
  const { rows } = collectTags(response);
  return rows.filter((tag) => !isDeprecatedTagName(tag.name));
}

export async function getTools(): Promise<WebTools[]> {
  const tools: WebTools[] = [];
  let cursor: string | undefined;
  // Notion caps page_size at 100, so a single read silently truncates the listing.
  // Follow `has_more` through `nextCursor`, which also refuses to end the loop quietly
  // on a page that reports more results without a cursor.
  do {
    const response = await fetchNotionApi(toolsApiKey, cursor);
    tools.push(...collectTools(response).rows);
    cursor = nextCursor(response);
  } while (cursor);
  return tools;
}

export async function getPage(id: string) {
  const response = await fetchWithTimeout(
    `https://api.notion.com/v1/pages/${id}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${import.meta.env.PUBLIC_NOTION_KEY}`,
        "Notion-Version": "2022-06-28",
      },
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
      headers: {
        Authorization: `Bearer ${import.meta.env.PUBLIC_NOTION_KEY}`,
        "Notion-Version": "2022-06-28",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Notion API request failed: ${response.statusText}`);
  }
  return response.json();
}

export default {
  getTags,
  getTools,
  getPage,
  getBlocks,
};
