// Run by `bun test`. `bun-types` is not installed and this project takes no test dependency, so
// the specifier below has no declarations. `@ts-ignore` rather than `@ts-expect-error`:
// the latter fails the type check if the directives ever become resolvable, which would turn
// a future dependency install into a broken build for no reason.
// @ts-ignore -- "bun:test" has no type declarations without bun-types.
import { describe, expect, test } from "bun:test";
import type { NotionPage, NotionQueryResponse } from "@/lib/notionRows";
import {
  collectTags,
  collectTools,
  isDeprecatedTagName,
  mapTagRow,
  mapToolRow,
  nextCursor,
  readRelationIds,
  readRichText,
  readTitle,
  readUrl,
} from "@/lib/notionRows";

function page(id: string, properties: Record<string, unknown>): NotionPage {
  return { id, properties };
}

/**
 * The real value that broke the fffuel cover: an in-app copy link whose `tok` is what names the
 * record. Kept verbatim rather than trimmed, because the whole parse is what is under test.
 */
const NOTION_IMAGE_URL =
  "https://img.notionusercontent.com/s3/prod-files-secure%2Fdf8ced50-ccac-401e-a48e-182b5498d7f4%2F890a4431-e325-472b-8aa8-ace1942d28d9%2FCleanShot_2026-09-17_at_4.32.37_PM2x.png/size/w=790?tok=eyJhbGciOiJFUzI1NiIsImtpZCI6IlI3dzVrRnREIiwidHlwIjoiSldUIn0.eyJzcGFjZUlkIjoiZGY4Y2VkNTAtY2NhYy00MDFlLWE0OGUtMTgyYjU0OThkN2Y0IiwiZmlsZUlkIjoiODkwYTQ0MzEtZTMyNS00NzJiLThhYTgtYWNlMTk0MmQyOGQ5IiwiYWN0b3IiOiJub3Rpb25fdXNlcjplZGVmMTViYS1jMjdkLTQyNjctODQ3MS02MzAzNjMzZDI2ZDEiLCJyZWNvcmQiOiJibG9jazozZGUzZTc2My1hMWYzLTgwMDktYjU3OC1kYzQ1MGEzZmI1NTciLCJleHAiOjE3ODk2ODU2NjN9.W5QlXEeEzEUlwTPKr3Uj_5dBRBscX8GedGBr24PFezqTCnWdBWq6GROf8EjEuHjfsIJ-mrHe3E-BJ72GsAHb0Q";

/** A `title`/`rich_text` payload: Notion always carries both text shapes. */
function textProp(...values: string[]) {
  return {
    title: values.map((value) => ({
      plain_text: value,
      text: { content: value },
    })),
    rich_text: values.map((value) => ({
      plain_text: value,
      text: { content: value },
    })),
  };
}

function toolPage(
  id: string,
  name: string,
  url: string,
  extra: Record<string, unknown> = {},
): NotionPage {
  return page(id, { Name: textProp(name), URL: { url }, ...extra });
}

function response(results: NotionPage[]): NotionQueryResponse {
  return { results, has_more: false, next_cursor: null };
}

describe("readTitle / readRichText / readUrl / readRelationIds", () => {
  test("reads a title and a rich text property", () => {
    const row = toolPage("t1", "Figma", "https://figma.com");
    expect(readTitle(row, "Name")).toBe("Figma");
    expect(readRichText(row, "Name")).toBe("Figma");
  });

  test("returns null for an empty title array", () => {
    expect(readTitle(page("t1", { Name: { title: [] } }), "Name")).toBe(null);
  });

  test("returns null for a missing property, a missing page, and a non-object property", () => {
    expect(readTitle(page("t1", {}), "Name")).toBe(null);
    expect(readTitle(page("t1", { Name: "Figma" }), "Name")).toBe(null);
    expect(readTitle(undefined as unknown as NotionPage, "Name")).toBe(null);
  });

  test("returns null for a blank title", () => {
    expect(readTitle(page("t1", { Name: textProp("   ") }), "Name")).toBe(null);
  });

  test("falls back to an empty url instead of throwing", () => {
    expect(readUrl(page("t1", {}), "URL")).toBe("");
    expect(readUrl(page("t1", { URL: { url: 42 } }), "URL")).toBe("");
  });

  test("returns an empty id list for a missing or malformed relation", () => {
    expect(readRelationIds(page("t1", {}), "Tags")).toEqual([]);
    expect(readRelationIds(page("t1", { Tags: { relation: "t1" } }), "Tags")).toEqual(
      [],
    );
    expect(
      readRelationIds(page("t1", { Tags: { relation: [{ id: "a" }, {}, null] } }), "Tags"),
    ).toEqual(["a"]);
  });
});

describe("mapToolRow", () => {
  test("returns null for a row whose Name is empty", () => {
    expect(mapToolRow(page("broken", { Name: { title: [] }, URL: { url: "https://x" } }))).toBe(
      null,
    );
  });

  test("returns null for a row with a name but no url", () => {
    expect(mapToolRow(page("no-url", { Name: textProp("Figma") }))).toBe(null);
    expect(mapToolRow(page("empty-url", { Name: textProp("Figma"), URL: { url: "" } }))).toBe(
      null,
    );
  });

  test("keeps a row with a name and url but no image, with img empty", () => {
    expect(mapToolRow(toolPage("t1", "Figma", "https://figma.com"))).toEqual({
      id: "t1",
      title: "Figma",
      url: "https://figma.com",
      tags: [],
      img: "",
    });
  });

  test("reads the tag relations and the image when they are present", () => {
    const row = toolPage("t1", "Figma", "https://figma.com", {
      Tags: { relation: [{ id: "tag-1" }, { id: "tag-2" }] },
      Image: { url: "https://img.example.com/figma.png" },
    });
    expect(mapToolRow(row)).toEqual({
      id: "t1",
      title: "Figma",
      url: "https://figma.com",
      tags: ["tag-1", "tag-2"],
      img: "https://img.example.com/figma.png",
    });
  });

  test("re-addresses a Notion-hosted image to the app's own route", () => {
    const row = toolPage("t1", "fffuel", "https://fffuel.co", {
      Image: { url: NOTION_IMAGE_URL },
    });
    expect(mapToolRow(row)?.img).toBe(
      "/api/img/3de3e763-a1f3-8009-b578-dc450a3fb557",
    );
  });
});

describe("collectTools", () => {
  test("skips an empty-Name row, keeps the rest, and names the skipped id", () => {
    const result = collectTools(
      response([
        toolPage("t1", "Figma", "https://figma.com"),
        page("broken-1", { Name: { title: [] }, URL: { url: "https://x" } }),
        toolPage("t2", "Coolors", "https://coolors.co"),
      ]),
    );
    expect(result.rows.map((row) => row.id)).toEqual(["t1", "t2"]);
    expect(result.skippedIds).toEqual(["broken-1"]);
  });

  test("survives a response whose results are not an array", () => {
    const result = collectTools({
      results: null as unknown as NotionPage[],
      has_more: false,
      next_cursor: null,
    });
    expect(result.rows).toEqual([]);
    expect(result.skippedIds).toEqual([]);
  });
});

describe("mapTagRow / collectTags", () => {
  test("falls back to an empty colour", () => {
    expect(mapTagRow(page("tag-1", { Name: textProp("Color") }))).toEqual({
      id: "tag-1",
      name: "Color",
      color: "",
    });
  });

  test("reads the colour when it is present", () => {
    expect(
      mapTagRow(page("tag-1", { Name: textProp("Color"), Color: { rich_text: [{ plain_text: "blue" }] } })),
    ).toEqual({ id: "tag-1", name: "Color", color: "blue" });
  });

  test("returns null for a tag row without a name", () => {
    expect(mapTagRow(page("tag-2", { Color: { rich_text: [] } }))).toBe(null);
  });

  test("skips the nameless tag and reports its id", () => {
    const result = collectTags(
      response([
        page("tag-1", { Name: textProp("Color") }),
        page("tag-2", { Name: { title: [] } }),
      ]),
    );
    expect(result.rows.map((row) => row.id)).toEqual(["tag-1"]);
    expect(result.skippedIds).toEqual(["tag-2"]);
  });
});

describe("nextCursor", () => {
  test("returns undefined when there is no more to read", () => {
    expect(
      nextCursor({ results: [], has_more: false, next_cursor: "cursor-1" }),
    ).toBe(undefined);
  });

  test("returns the cursor when there is more to read", () => {
    expect(
      nextCursor({ results: [], has_more: true, next_cursor: "cursor-1" }),
    ).toBe("cursor-1");
  });

  test("throws when has_more is true without a cursor", () => {
    expect(() =>
      nextCursor({ results: [], has_more: true, next_cursor: null }),
    ).toThrow(/has_more without a next_cursor/);
  });
});

describe("isDeprecatedTagName", () => {
  test("accepts the names this database retires with", () => {
    expect(isDeprecatedTagName("deprecated")).toBe(true);
    expect(isDeprecatedTagName("Deprecated")).toBe(true);
    expect(isDeprecatedTagName("Color (old)")).toBe(true);
  });

  test("rejects a live name, including a bare `old`", () => {
    expect(isDeprecatedTagName("Color")).toBe(false);
    expect(isDeprecatedTagName("Old School")).toBe(false);
    expect(isDeprecatedTagName("golden")).toBe(false);
  });
});
