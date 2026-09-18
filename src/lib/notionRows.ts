/**
 * Pure mapping of Notion query responses onto the listing's rows.
 *
 * It lives outside `notion.ts` for two reasons. First, `notion.ts` reads
 * `import.meta.env` at module scope and that global does not exist under `bun test`, so
 * nothing it imports may be pulled into a test. Second, these guards are the whole fix
 * for the malformed-row defect: a single row whose `Name` was empty used to throw inside
 * the mapping and take every other row down with it. Nothing here touches the
 * environment, the network, or `fetch`, so each guard is testable on its own.
 *
 * The types are imported with `import type`, which is erased at compile time: this module
 * has no runtime edge back to `notion.ts`. The one runtime import is the pure image helper,
 * which reads no environment and performs no I/O.
 */
import type { Tags, WebTools } from "./notion";
import { imageSource } from "./notionImages";

/** One row of a Notion database query. */
export interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
}

/** The envelope `POST /v1/databases/{id}/query` answers with. */
export interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

/** A plain object, or `null` for anything else a JSON body may hold there. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Reads one property of a page, or `null` when the page, its `properties`, or the
 * property itself is missing or is not an object.
 *
 * This is the first guard of every reader below. The unguarded version assumed the
 * property was always there, so a rename in Notion produced a `TypeError` rather than a
 * skipped row.
 */
function readProperty(
  page: NotionPage,
  property: string,
): Record<string, unknown> | null {
  const properties = asRecord(page?.properties);
  if (properties === null) return null;
  return asRecord(properties[property]);
}

/**
 * The plain text of one rich-text block.
 *
 * `plain_text` is what a `rich_text` property carries; `text.content` is what a `title`
 * block carries, so both are accepted and an unreadable block yields `""`.
 */
function textOf(block: unknown): string {
  const record = asRecord(block);
  if (record === null) return "";
  if (typeof record.plain_text === "string") return record.plain_text;
  const text = asRecord(record.text);
  return typeof text?.content === "string" ? text.content : "";
}

/**
 * Joins the text of a title or rich-text array, or `null` when nothing is readable.
 *
 * The whole point of the guard is here: Notion represents an empty Name as `title: []`,
 * so `[0]` is `undefined` and the previous `title[0].text.content` threw. An all-blank
 * value counts as unreadable, because a card whose title is whitespace has no identity
 * to show.
 */
function readText(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const text = value.map(textOf).join("");
  return text.trim() === "" ? null : text;
}

/** The readable title of a `title` property, or `null` when there is none. */
export function readTitle(page: NotionPage, property: string): string | null {
  const prop = readProperty(page, property);
  if (prop === null) return null;
  return readText(prop.title);
}

/** The readable text of a `rich_text` property, or `null` when there is none. */
export function readRichText(page: NotionPage, property: string): string | null {
  const prop = readProperty(page, property);
  if (prop === null) return null;
  return readText(prop.rich_text);
}

/** The url of a `url` property, or `""` when it is missing or not a string. */
export function readUrl(page: NotionPage, property: string): string {
  const prop = readProperty(page, property);
  if (prop === null) return "";
  return typeof prop.url === "string" ? prop.url : "";
}

/** The ids a `relation` property points at; entries without an id are dropped. */
export function readRelationIds(page: NotionPage, property: string): string[] {
  const prop = readProperty(page, property);
  if (prop === null) return [];
  if (!Array.isArray(prop.relation)) return [];
  return prop.relation
    .map((entry) => asRecord(entry)?.id)
    .filter((id): id is string => typeof id === "string");
}

/**
 * Maps one Notion page onto a `WebTools` row, or `null` when the row is not usable.
 *
 * A row is malformed when it has no readable name **or** no non-empty url: the card's
 * identity is its title and its primary action is the url, so a row without either is
 * not a listing entry and is better skipped than rendered as an empty card. `img` is
 * optional and falls back to `""`, because a card without an image still reads.
 *
 * `img` goes through `imageSource` rather than being passed along, because a Notion-hosted
 * value is not an address a browser can load. The rewrite is pure: the id comes out of the
 * stored URL, and no request is made here.
 */
export function mapToolRow(page: NotionPage): WebTools | null {
  const title = readTitle(page, "Name");
  if (title === null) return null;
  const url = readUrl(page, "URL");
  if (url === "") return null;
  return {
    id: page.id,
    title,
    url,
    tags: readRelationIds(page, "Tags"),
    img: imageSource(readUrl(page, "Image")),
  };
}

/**
 * Maps one Notion page onto a `Tags` row, or `null` when it has no readable name.
 *
 * `color` falls back to `""`: `Filter` already resolves an unknown colour to its default
 * variant, so a missing colour is a cosmetic detail and never a reason to drop a tag.
 */
export function mapTagRow(page: NotionPage): Tags | null {
  const name = readTitle(page, "Name");
  if (name === null) return null;
  return {
    id: page.id,
    name,
    color: readRichText(page, "Color") ?? "",
  };
}

/** The pages of one response, tolerating a body that is not shaped as expected. */
function resultPages(response: NotionQueryResponse): NotionPage[] {
  return Array.isArray(response?.results) ? response.results : [];
}

/**
 * Maps every readable tool row and reports the ids it had to skip.
 *
 * The ids come back so the caller can name the offending page in a warning. Skipping in
 * silence is how one malformed row turned into an empty listing that the UI reported as
 * "no results": the failure has to leave a trace.
 */
export function collectTools(response: NotionQueryResponse): {
  rows: WebTools[];
  skippedIds: string[];
} {
  const rows: WebTools[] = [];
  const skippedIds: string[] = [];
  for (const page of resultPages(response)) {
    const row = mapToolRow(page);
    if (row === null) {
      skippedIds.push(page.id);
      continue;
    }
    rows.push(row);
  }
  return { rows, skippedIds };
}

/** Maps every readable tag row and reports the ids it had to skip. */
export function collectTags(response: NotionQueryResponse): {
  rows: Tags[];
  skippedIds: string[];
} {
  const rows: Tags[] = [];
  const skippedIds: string[] = [];
  for (const page of resultPages(response)) {
    const row = mapTagRow(page);
    if (row === null) {
      skippedIds.push(page.id);
      continue;
    }
    rows.push(row);
  }
  return { rows, skippedIds };
}

/**
 * The cursor of the page after this one, or `undefined` on the last page.
 *
 * `has_more` decides, not the truthiness of the cursor: the previous
 * `cursor = pages.has_more ? pages.next_cursor : undefined` with `while (cursor)` ended
 * quietly on a page that reported more results without a cursor, which is a silent
 * truncation inside the code written to prevent silent truncation. When Notion says
 * there is more and gives no way to fetch it, continuing is impossible and stopping
 * quietly is worse than failing, so this throws.
 */
export function nextCursor(response: NotionQueryResponse): string | undefined {
  if (!response?.has_more) return undefined;
  if (!response.next_cursor) {
    throw new Error(
      "Notion reported has_more without a next_cursor: the listing would be truncated.",
    );
  }
  return response.next_cursor;
}

/**
 * Whether a tag name marks a retired tag.
 *
 * These were two inline string literals inside `getTags()`, where nothing said why a tag
 * could not be called that: `deprecated` is the naming convention this database uses for
 * a retired tag, and `(old)` is the residue of a rename that was never cleaned up.
 */
export function isDeprecatedTagName(name: string): boolean {
  const normalized = name.toLowerCase();
  return normalized.includes("deprecated") || normalized.includes("(old)");
}
