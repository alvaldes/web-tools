import { tagsItems } from "./toolStore";
import type Tag from "@/components/Tag";

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
  const response = await fetch(endpoint, {
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
  const tags = pages.results.map((page: any) => {
    return {
      id: (page as any).id,
      name: (page as any).properties.Name.title[0].text.content,
      color: (page as any).properties.Color.rich_text[0].plain_text,
    };
  });
  return tags;
}

export async function getTools(): Promise<WebTools[]> {
  const pages = await fetchNotionApi(toolsApiKey, null);
  const tools = pages.results.map((page: any) => {
    return {
      id: (page as any).id,
      title: (page as any).properties.Name.title[0].text.content,
      url: (page as any).properties.URL.url,
      tags: (page as any).properties.Tags.relation.map((tag: any) => tag.id),
      img: (page as any).properties.Image.url,
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
  try {
    const pages = await fetchNotionApi(toolsApiKey, filter);
    const tools = pages.results.map((page: any) => {
      return {
        id: (page as any).id,
        title: (page as any).properties.Name.title[0].text.content,
        url: (page as any).properties.URL.url,
        tags: (page as any).properties.Tags.relation.map((tag: any) => tag.id),
        img: (page as any).properties.Image.url,
      };
    });

    return tools;
  } catch (error) {
    throw error;
  }
}

export default {
  getTags,
  getTools,
  searchTools,
};
