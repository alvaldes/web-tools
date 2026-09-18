/**
 * Pure helpers that recognize Notion-hosted image URLs and say which record they name.
 *
 * Two facts drive the whole module. First, a Notion-hosted image URL is not a public
 * address: it is a session- or token-bound reference that stops answering `200` for an
 * anonymous browser as soon as its token expires. Second, the same URL still names the
 * record it came from, and that record can be re-read through the API to obtain a fresh
 * URL. So the module answers one question — *which record is this?* — and never performs
 * I/O. The API call lives in `notion.ts`.
 *
 * The access token inside `?tok=` is decoded but deliberately **not verified**. Its
 * signature is irrelevant here; the only thing read from it is the record identifier, and
 * the real authorization happens when `notion.ts` re-reads that record with the
 * integration token.
 *
 * This file has no runtime edge to `notion.ts`, and reads no environment: `import.meta.env`
 * does not exist under `bun test`, so anything a test imports must stay free of it.
 */

/** Hosts that serve Notion file content. A suffix match also covers `app.` and `www.`. */
const NOTION_FILE_HOSTS = [
  "notionusercontent.com",
  "notion-static.com",
  "notion.so",
  "notion.com",
];

/** Marker segments that precede `<spaceId>/<fileId>/<filename>` in Notion storage paths. */
const NOTION_STORAGE_MARKERS = ["/prod-files-secure/", "/secure.notion-static.com/"];

/** A Notion id, dashed or undashed. */
const NOTION_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/**
 * What a Notion-hosted image URL points at.
 *
 * `block` and `page` are the two record kinds an in-app URL names, and both are re-readable
 * through `GET /v1/blocks/<id>`. `file` is what remains when a URL only carries the storage
 * location — a pasted presigned S3 link — and it can only be resolved by matching the file
 * against the blocks of a known page.
 */
export type NotionFileReference =
  | { kind: "block"; id: string }
  | { kind: "page"; id: string }
  | { kind: "file"; fileId: string };

/**
 * Parses a URL, answering `null` instead of throwing.
 *
 * The values reaching this module come from a hand-edited Notion property, so a malformed
 * or empty string is an expected input rather than a programming error.
 */
function parseUrl(url: string): URL | null {
  if (typeof url !== "string" || url === "") return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isNotionId(value: string | null | undefined): value is string {
  return typeof value === "string" && NOTION_ID.test(value);
}

/**
 * True when the URL serves Notion file content and therefore cannot be trusted to load
 * anonymously.
 *
 * The check is on the host, not on the path: preview URLs (`img.notionusercontent.com`),
 * in-app URLs (`app.notion.com/image/…`) and presigned S3 links
 * (`prod-files-secure.s3.us-west-2.amazonaws.com`) are three shapes of the same problem.
 * Suffix matching is on a dot boundary, so `notion.so.example.com` is not a Notion host.
 */
export function isNotionHostedImageUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (
    NOTION_FILE_HOSTS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    )
  ) {
    return true;
  }
  if (!host.endsWith(".amazonaws.com")) return false;
  const decodedPath = safeDecode(parsed.pathname);
  return (
    host.startsWith("prod-files-secure.") ||
    NOTION_STORAGE_MARKERS.some(
      (marker) => parsed.pathname.includes(marker) || decodedPath.includes(marker),
    )
  );
}

/**
 * The `<fileId>` of a Notion storage location: `<spaceId>/<fileId>/<filename>`.
 *
 * Two shapes reach here. A preview URL spells the location inside its path
 * (`/s3/prod-files-secure%2F<spaceId>%2F<fileId>%2F<name>/size/w=790`), while a presigned S3
 * URL keeps the bucket in the host and starts the path at the space id. Both are read
 * through the same segment walk once the location has been located.
 */
/** Segment of a path, empty entries dropped. Both URL shapes are read with it. */
function pathSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function fileIdFromLocation(parsed: URL): string | null {
  const decodedPath = safeDecode(parsed.pathname);
  const fromQuery = parsed.searchParams.get("sourceLocation");
  const candidates = [fromQuery, decodedPath].filter(
    (value): value is string => typeof value === "string" && value !== "",
  );
  for (const candidate of candidates) {
    const segments = pathSegments(candidate);
    for (let index = 0; index < segments.length; index += 1) {
      if (!isStorageMarker(segments[index])) continue;
      const fileId = segments[index + 2];
      if (isNotionId(fileId)) return fileId;
    }
  }
  // A presigned S3 URL names the bucket in the host, so the path starts at `<spaceId>`.
  if (parsed.hostname.toLowerCase().startsWith("prod-files-secure.")) {
    const fileId = pathSegments(decodedPath)[1];
    if (isNotionId(fileId)) return fileId;
  }
  return null;
}

/** True for the path segment Notion puts in front of `<spaceId>/<fileId>/<filename>`. */
function isStorageMarker(segment: string | undefined): boolean {
  return segment === "prod-files-secure" || segment === "secure.notion-static.com";
}

/** `decodeURIComponent` that answers the input unchanged when it cannot decode it. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The record named by the `tok` access token of a Notion preview URL.
 *
 * The token is a JWT whose payload carries `record: "block:<uuid>"` (or `page:<uuid>`) and a
 * `fileId`. Nothing about its signature or expiry matters: the payload is read as data, and
 * the record is re-read through the API afterwards.
 */
function referenceFromAccessToken(token: string | null): NotionFileReference | null {
  if (typeof token !== "string") return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  const decoded = decodeBase64Url(payload);
  if (decoded === null) return null;
  let claims: unknown;
  try {
    claims = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (typeof claims !== "object" || claims === null) return null;
  const { record, fileId } = claims as { record?: unknown; fileId?: unknown };
  if (typeof record === "string") {
    const [kind, id] = record.split(":");
    if ((kind === "block" || kind === "page") && isNotionId(id)) {
      return { kind, id: id as string };
    }
  }
  if (isNotionId(typeof fileId === "string" ? fileId : null)) {
    return { kind: "file", fileId: fileId as string };
  }
  return null;
}

/** Base64url decoder that answers `null` instead of throwing on garbage. */
function decodeBase64Url(value: string): string | null {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  try {
    return atob(normalized);
  } catch {
    return null;
  }
}

/**
 * The record a Notion-hosted image URL names, or `null` when it names nothing recoverable.
 *
 * The explicit `?id=&table=` pair is read first because it is unambiguous, then the access
 * token, then the bare storage location. A URL with none of the three — a hand-trimmed link,
 * or an expired share URL — resolves to `null`, which callers treat as "keep the stored
 * value".
 */
export function notionFileReference(url: string): NotionFileReference | null {
  const parsed = parseUrl(url);
  if (!parsed || !isNotionHostedImageUrl(url)) return null;

  const id = parsed.searchParams.get("id");
  if (isNotionId(id)) {
    return parsed.searchParams.get("table") === "page"
      ? { kind: "page", id }
      : { kind: "block", id };
  }

  const byToken = referenceFromAccessToken(parsed.searchParams.get("tok"));
  if (byToken) return byToken;

  const fileId = fileIdFromLocation(parsed);
  return fileId === null ? null : { kind: "file", fileId };
}

/**
 * Reads the URL out of a Notion `file` / `external` object: `{ type, file: { url } }`.
 *
 * Notion wraps the same idea two ways depending on whether the author uploaded a file or
 * linked one, and both wrappers appear inside blocks, covers, icons and database properties.
 */
function readFileObject(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const holder = value as {
    file?: { url?: unknown };
    external?: { url?: unknown };
  };
  const url = holder.file?.url ?? holder.external?.url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

/**
 * The fresh, anonymously loadable URL carried by a Notion record.
 *
 * A block keeps its payload under its own type key (`image`, `file`, `video`, `audio`,
 * `pdf`), while a page carries a `cover`, an `icon` and database `properties`. Every shape
 * is tried in that order and the first URL found wins, because a record is re-read only
 * when a caller already knows it holds the file it wants. An id the integration cannot read
 * a file out of — a `child_page`, for instance — answers `null` rather than a wrong URL.
 */
export function freshFileUrl(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;

  if (typeof record.type === "string") {
    const fromBlock = readFileObject(record[record.type]);
    if (fromBlock) return fromBlock;
  }

  const fromCover = readFileObject(record.cover);
  if (fromCover) return fromCover;
  const fromIcon = readFileObject(record.icon);
  if (fromIcon) return fromIcon;

  const properties = record.properties;
  if (typeof properties === "object" && properties !== null) {
    for (const property of Object.values(properties as Record<string, unknown>)) {
      const files = (property as { files?: unknown } | null)?.files;
      if (!Array.isArray(files)) continue;
      for (const file of files) {
        const url = readFileObject(file);
        if (url) return url;
      }
    }
  }
  return null;
}

/**
 * The id of the block in a children listing whose file is `fileId`.
 *
 * This is the last resort for a stored value that carries only a storage location — a
 * presigned S3 link, where the signature is what expired and nothing names a record. The
 * caller passes the children of the page the row belongs to, and the file id has to match
 * one of them exactly.
 */
export function findBlockIdByFileId(payload: unknown, fileId: string): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return null;
  for (const block of results) {
    if (typeof block !== "object" || block === null) continue;
    const record = block as Record<string, unknown>;
    const url = freshFileUrl(record);
    if (!url) continue;
    const id = record.id;
    if (typeof id !== "string") continue;
    const reference = notionFileReference(url);
    if (reference?.kind === "file" && reference.fileId === fileId) return id;
  }
  return null;
}
