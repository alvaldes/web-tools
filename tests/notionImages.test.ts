// Run by `bun test`. `bun-types` is not installed and this project takes no test dependency, so
// the specifier below has no declarations. `@ts-ignore` rather than `@ts-expect-error`:
// the latter fails the type check if the directives ever become resolvable, which would turn
// a future dependency install into a broken build for no reason.
// @ts-ignore -- "bun:test" has no type declarations without bun-types.
import { describe, expect, test } from "bun:test";
import type { NotionFileReference } from "@/lib/notionImages";
import {
  findBlockIdByFileId,
  freshFileUrl,
  imageSource,
  isNotionHostedImageUrl,
  isNotionId,
  notionFileReference,
  withoutQuery,
} from "@/lib/notionImages";

/**
 * The real value that broke the fffuel cover, captured from the Tools database on
 * 2026-09-18. Its `tok` payload is what names the record, so the whole fix rests on reading
 * this exact string correctly.
 */
const PREVIEW_URL =
  "https://img.notionusercontent.com/s3/prod-files-secure%2Fdf8ced50-ccac-401e-a48e-182b5498d7f4%2F890a4431-e325-472b-8aa8-ace1942d28d9%2FCleanShot_2026-09-17_at_4.32.37_PM2x.png/size/w=790?tok=eyJhbGciOiJFUzI1NiIsImtpZCI6IlI3dzVrRnREIiwidHlwIjoiSldUIn0.eyJzcGFjZUlkIjoiZGY4Y2VkNTAtY2NhYy00MDFlLWE0OGUtMTgyYjU0OThkN2Y0IiwiZmlsZUlkIjoiODkwYTQ0MzEtZTMyNS00NzJiLThhYTgtYWNlMTk0MmQyOGQ5IiwiYWN0b3IiOiJub3Rpb25fdXNlcjplZGVmMTViYS1jMjdkLTQyNjctODQ3MS02MzAzNjMzZDI2ZDEiLCJyZWNvcmQiOiJibG9jazozZGUzZTc2My1hMWYzLTgwMDktYjU3OC1kYzQ1MGEzZmI1NTciLCJleHAiOjE3ODk2ODU2NjN9.W5QlXEeEzEUlwTPKr3Uj_5dBRBscX8GedGBr24PFezqTCnWdBWq6GROf8EjEuHjfsIJ-mrHe3E-BJ72GsAHb0Q&imgBuildSrc=createSecureFileAccessTokenImageUrl&mtd=com";

/** The URL Notion's expired-token redirect lands on, which answers 401 without a session. */
const IN_APP_URL =
  "https://app.notion.com/image/prod-files-secure%2Fdf8ced50-ccac-401e-a48e-182b5498d7f4%2F890a4431-e325-472b-8aa8-ace1942d28d9%2FCleanShot_2026-09-17_at_4.32.37_PM2x.png?id=3de3e763-a1f3-8009-b578-dc450a3fb557&table=block&userId=edef15ba-c27d-4267-8471-6303633d26d1&sourceMode=s3&variantMode=size&variantParams=w=790";

/** The fresh URL the API returns for that same file: no record, only a storage location. */
const PRESIGNED_URL =
  "https://prod-files-secure.s3.us-west-2.amazonaws.com/df8ced50-ccac-401e-a48e-182b5498d7f4/890a4431-e325-472b-8aa8-ace1942d28d9/CleanShot_2026-09-17_at_4.32.37_PM2x.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=deadbeef";

const BLOCK_ID = "3de3e763-a1f3-8009-b578-dc450a3fb557";
const FILE_ID = "890a4431-e325-472b-8aa8-ace1942d28d9";

/** A children listing: one text block that must be ignored, then the image block. */
function childrenPayload(...urls: string[]) {
  return {
    results: urls.map((url, index) => ({
      id: `block-${index}`,
      type: "image",
      image: { caption: [], type: "file", file: { url } },
    })),
  };
}

describe("isNotionHostedImageUrl", () => {
  test("accepts the three shapes of a Notion file URL", () => {
    expect(isNotionHostedImageUrl(PREVIEW_URL)).toBe(true);
    expect(isNotionHostedImageUrl(IN_APP_URL)).toBe(true);
    expect(isNotionHostedImageUrl(PRESIGNED_URL)).toBe(true);
    expect(isNotionHostedImageUrl("https://www.notion.so/image/abc.png?id=1")).toBe(true);
  });

  test("rejects public hosts the database actually stores", () => {
    expect(
      isNotionHostedImageUrl(
        "https://raw.githubusercontent.com/rtivital/omatsuri/master/src/assets/logo-text.svg",
      ),
    ).toBe(false);
    expect(
      isNotionHostedImageUrl("https://animista.net/animista-media-img.gif"),
    ).toBe(false);
    expect(
      isNotionHostedImageUrl("https://i.pinimg.com/originals/e4/9b/45/e49b45b368972e1ef661d383127e0dd2.jpg"),
    ).toBe(false);
  });

  test("does not match a Notion-looking host on the wrong side of the dot", () => {
    expect(isNotionHostedImageUrl("https://notion.so.example.com/a.png")).toBe(false);
    expect(isNotionHostedImageUrl("https://notnotion.com/a.png")).toBe(false);
    expect(isNotionHostedImageUrl("https://example.com/notion.com/a.png")).toBe(false);
  });

  test("accepts a generic S3 host only when the path is Notion storage", () => {
    expect(
      isNotionHostedImageUrl(
        "https://s3.us-west-2.amazonaws.com/secure.notion-static.com/abc/file.png",
      ),
    ).toBe(true);
    expect(
      isNotionHostedImageUrl("https://my-bucket.s3.us-west-2.amazonaws.com/file.png"),
    ).toBe(false);
  });

  test("answers false for empty and malformed input", () => {
    expect(isNotionHostedImageUrl("")).toBe(false);
    expect(isNotionHostedImageUrl("not a url")).toBe(false);
  });
});

describe("notionFileReference", () => {
  test("reads the record out of the access token of a preview URL", () => {
    expect(notionFileReference(PREVIEW_URL)).toEqual({
      kind: "block",
      id: BLOCK_ID,
    });
  });

  test("prefers the explicit id and table pair of an in-app URL", () => {
    expect(notionFileReference(IN_APP_URL)).toEqual({
      kind: "block",
      id: BLOCK_ID,
    });
    expect(
      notionFileReference(`${IN_APP_URL.replace("table=block", "table=page")}`),
    ).toEqual({ kind: "page", id: BLOCK_ID });
  });

  test("falls back to the storage location of a presigned URL", () => {
    expect(notionFileReference(PRESIGNED_URL)).toEqual({
      kind: "file",
      fileId: FILE_ID,
    });
  });

  test("reads the location of a preview URL when the token is unusable", () => {
    const withoutToken = PREVIEW_URL.slice(0, PREVIEW_URL.indexOf("?"));
    expect(notionFileReference(withoutToken)).toEqual({
      kind: "file",
      fileId: FILE_ID,
    });
    expect(notionFileReference(`${withoutToken}?tok=@@@.@@@.@@@`)).toEqual({
      kind: "file",
      fileId: FILE_ID,
    });
  });

  test("ignores a token whose signature or payload is garbage", () => {
    const garbage = `https://img.notionusercontent.com/s3/other/file.png?tok=a.b.c`;
    expect(notionFileReference(garbage)).toBeNull();
  });

  test("answers null when the URL names no record at all", () => {
    expect(notionFileReference("https://www.notion.so/fffuel-1234")).toBeNull();
    expect(notionFileReference("https://github.com/user/repo/raw/main/logo.png")).toBeNull();
    expect(notionFileReference("")).toBeNull();
  });

  test("answers null for an id that is not a Notion id", () => {
    expect(
      notionFileReference("https://app.notion.com/image/x.png?id=nope&table=block"),
    ).toBeNull();
  });

  test("the reference type names either a record or a bare file", () => {
    const reference: NotionFileReference = notionFileReference(PREVIEW_URL)!;
    expect(["block", "page", "file"]).toContain(reference.kind);
  });
});

describe("freshFileUrl", () => {
  test("reads the file out of an uploaded image block", () => {
    expect(
      freshFileUrl({
        id: BLOCK_ID,
        type: "image",
        image: { caption: [], type: "file", file: { url: PRESIGNED_URL } },
      }),
    ).toBe(PRESIGNED_URL);
  });

  test("reads the file out of a linked image block", () => {
    expect(
      freshFileUrl({
        type: "image",
        image: { type: "external", external: { url: "https://example.com/a.png" } },
      }),
    ).toBe("https://example.com/a.png");
  });

  test("reads a page cover and a page icon", () => {
    expect(
      freshFileUrl({
        object: "page",
        cover: { type: "external", external: { url: "https://example.com/cover.jpg" } },
      }),
    ).toBe("https://example.com/cover.jpg");
    expect(
      freshFileUrl({
        object: "page",
        icon: { type: "file", file: { url: PRESIGNED_URL } },
      }),
    ).toBe(PRESIGNED_URL);
  });

  test("reads a file out of a database property", () => {
    expect(
      freshFileUrl({
        object: "page",
        properties: { Image: { type: "files", files: [{ type: "file", file: { url: PRESIGNED_URL } }] } },
      }),
    ).toBe(PRESIGNED_URL);
  });

  test("answers null for a record that holds no file, like the child_page that broke this", () => {
    expect(freshFileUrl({ id: BLOCK_ID, type: "child_page", child_page: { title: "fffuel" } })).toBeNull();
    expect(freshFileUrl({ type: "paragraph", paragraph: { rich_text: [] } })).toBeNull();
  });

  test("answers null for non-objects and empty payloads", () => {
    expect(freshFileUrl(null)).toBeNull();
    expect(freshFileUrl("https://example.com/a.png")).toBeNull();
    expect(freshFileUrl({})).toBeNull();
  });
});

describe("findBlockIdByFileId", () => {
  test("finds the block whose file matches, ignoring the others", () => {
    const children = {
      results: [
        { id: "paragraph-1", type: "paragraph", paragraph: { rich_text: [] } },
        {
          id: BLOCK_ID,
          type: "image",
          image: { type: "file", file: { url: PRESIGNED_URL } },
        },
      ],
    };
    expect(findBlockIdByFileId(children, FILE_ID)).toBe(BLOCK_ID);
  });

  test("answers null when no block holds that file", () => {
    expect(findBlockIdByFileId(childrenPayload(PRESIGNED_URL), "11111111-2222-3333-4444-555555555555")).toBeNull();
    expect(findBlockIdByFileId({ results: [] }, FILE_ID)).toBeNull();
  });

  test("answers null for a payload that is not a children listing", () => {
    expect(findBlockIdByFileId({ results: "nope" }, FILE_ID)).toBeNull();
    expect(findBlockIdByFileId(null, FILE_ID)).toBeNull();
  });
});

describe("isNotionId", () => {
  test("accepts a dashed or undashed Notion id", () => {
    expect(isNotionId(BLOCK_ID)).toBe(true);
    expect(isNotionId(BLOCK_ID.replaceAll("-", ""))).toBe(true);
  });

  test("rejects everything else the route could be handed", () => {
    expect(isNotionId("not-an-id")).toBe(false);
    expect(isNotionId("")).toBe(false);
    expect(isNotionId(null)).toBe(false);
    expect(isNotionId(`${BLOCK_ID}/../../secrets`)).toBe(false);
  });
});

describe("withoutQuery", () => {
  test("drops the query string, so a token cannot reach a log line", () => {
    expect(withoutQuery(PREVIEW_URL)).toBe(
      PREVIEW_URL.slice(0, PREVIEW_URL.indexOf("?")),
    );
    expect(withoutQuery("https://example.com/a.png")).toBe(
      "https://example.com/a.png",
    );
  });
});

/** The children listing of a page that holds the fffuel screenshot. */
function childrenWithTheFile() {
  return {
    results: [
      { id: "paragraph-1", type: "paragraph", paragraph: { rich_text: [] } },
      {
        id: BLOCK_ID,
        type: "image",
        image: { type: "file", file: { url: PRESIGNED_URL } },
      },
    ],
  };
}

describe("imageSource", () => {
  test("addresses a Notion-hosted value through the app's own route", () => {
    expect(imageSource(PREVIEW_URL)).toBe(`/api/img/${BLOCK_ID}`);
    expect(imageSource(IN_APP_URL)).toBe(`/api/img/${BLOCK_ID}`);
  });

  test("re-addresses a bare storage location when the page's blocks are in hand", () => {
    expect(imageSource(PRESIGNED_URL, childrenWithTheFile())).toBe(
      `/api/img/${BLOCK_ID}`,
    );
  });

  test("keeps a bare storage location when nothing names its record", () => {
    expect(imageSource(PRESIGNED_URL)).toBe(PRESIGNED_URL);
    expect(imageSource(PRESIGNED_URL, { results: [] })).toBe(PRESIGNED_URL);
  });

  test("leaves a public URL alone, so a healthy row costs nothing", () => {
    const publicUrl = "https://animista.net/animista-media-img.gif";
    expect(imageSource(publicUrl)).toBe(publicUrl);
    expect(imageSource("")).toBe("");
  });

  test("reports an unresolvable value without leaking its token", () => {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };
    try {
      expect(imageSource(PRESIGNED_URL)).toBe(PRESIGNED_URL);
      expect(imageSource("https://www.notion.so/fffuel-1234")).toBe(
        "https://www.notion.so/fffuel-1234",
      );
    } finally {
      console.warn = original;
    }
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).not.toContain("X-Amz");
  });
});
