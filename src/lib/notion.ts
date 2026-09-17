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

async function fetchNotionApi(database: string, body: any): Promise<any> {
  const headers = new Headers({
    Authorization: `Bearer ${import.meta.env.PUBLIC_NOTION_KEY}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  });
  const endpoint = `https://api.notion.com/v1/databases/${database}/query`;
  let dataBody: any = {
    sorts: [
      {
        property: "Name",
        direction: "ascending",
      },
    ],
  };
  if (body) {
    dataBody = {
      filter: body,
      ...dataBody,
    };
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

export async function getTags(): Promise<Tags[]> {
  const pages = await fetchNotionApi(tagsApiKey, null);
  const tags = pages.results
    .map((page: any) => {
      return {
        id: page.id,
        name: page.properties.Name.title[0].text.content,
        color: page.properties.Color.rich_text[0].plain_text,
      };
    })
    .filter((tag: Tags) => {
      // Filter out deprecated tags
      const name = tag.name.toLowerCase();
      return !name.includes('deprecated') && !name.includes('(old)');
    });
  return tags;
}

export async function getTools(): Promise<WebTools[]> {
  const pages = await fetchNotionApi(toolsApiKey, null);
  const tools = pages.results.map((page: any) => {
    return {
      id: page.id,
      title: page.properties.Name.title[0].text.content,
      url: page.properties.URL.url,
      tags: page.properties.Tags.relation.map((tag: any) => tag.id),
      img: page.properties.Image.url,
    };
  });
  return tools;
}

export async function searchTools(
  tags: string[],
  query: string
): Promise<WebTools[]> {
  let filter: any = {
    and: [
      {
        property: "Name",
        rich_text: {
          contains: query,
        },
      },
    ],
  };
  if (tags.length > 0) {
    const draft = tags.map((item) => ({
      property: "Tags",
      relation: {
        contains: item,
      },
    }));
    filter.and.push({
      or: draft,
    });
  }
  const pages = await fetchNotionApi(toolsApiKey, filter);
  const tools = pages.results.map((page: any) => {
    return {
      id: page.id,
      title: page.properties.Name.title[0].text.content,
      url: page.properties.URL.url,
      tags: page.properties.Tags.relation.map((tag: any) => tag.id),
      img: page.properties.Image.url,
    };
  });

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
  searchTools,
  getPage,
  getBlocks,
};
