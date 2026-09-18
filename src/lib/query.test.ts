// `bun-types` is not installed and the hardening constraints forbid adding any dependency,
// so `astro check` cannot resolve this specifier even though `bun test` runs it. The
// directive goes away if the type declarations are ever installed.
// @ts-expect-error -- types for the "bun:test" specifier are not available without bun-types.
import { describe, expect, test } from "bun:test";
import {
  countToolsByTag,
  filterTools,
  groupTagsByCategory,
  normalize,
  sortTools,
} from "./query";
import type { Tags } from "./notion";
import type { TagCategory } from "./utils";

/** A tool row with only the fields a case cares about spelled out. */
function tool(id: string, title: string, url: string, tags: string[] = []) {
  return { id, title, url, tags, img: "" };
}

/** A tag row with the default colour, which no case under test reads. */
function tag(id: string, name: string): Tags {
  return { id, name, color: "gray" };
}

function tagsById(tags: Tags[]): Map<string, Tags> {
  return new Map(tags.map((entry) => [entry.id, entry]));
}

describe("normalize", () => {
  test("folds surrounding whitespace, case and accents", () => {
    expect(normalize("  Café  ")).toBe("cafe");
  });

  test("folds an uppercase accented word", () => {
    expect(normalize("ÉDITEUR")).toBe("editeur");
  });

  test("leaves an empty string empty", () => {
    expect(normalize("")).toBe("");
  });
});

describe("filterTools", () => {
  const catalog = [tag("t1", "Imagen"), tag("t2", "Color"), tag("t3", "Código")];
  const byId = tagsById(catalog);
  const tools = [
    tool("a", "Figma", "https://figma.com", ["t1"]),
    tool("b", "Coolors", "https://coolors.co", ["t2"]),
    tool("c", "Editor X", "https://editor.example.com", ["t1", "t2"]),
  ];

  test("matches on title", () => {
    expect(filterTools(tools, [], "figma", byId).map((t) => t.id)).toEqual([
      "a",
    ]);
  });

  test("matches on url", () => {
    expect(filterTools(tools, [], "coolors.co", byId).map((t) => t.id)).toEqual(
      ["b"],
    );
  });

  test("matches on a resolved tag name", () => {
    expect(filterTools(tools, [], "imagen", byId).map((t) => t.id)).toEqual([
      "a",
      "c",
    ]);
  });

  test("treats an accented query and its folded form identically", () => {
    const withAccent = filterTools(tools, [], "café", byId);
    const withoutAccent = filterTools(tools, [], "cafe", byId);
    // The fixture gains a match for the pair, so the assertion below is not a
    // trivially equal pair of empty arrays.
    const accented = [...tools, tool("d", "Café", "https://cafe.example.com")];
    expect(filterTools(accented, [], "café", byId).map((t) => t.id)).toEqual(
      filterTools(accented, [], "cafe", byId).map((t) => t.id),
    );
    expect(withAccent.map((t) => t.id)).toEqual(withoutAccent.map((t) => t.id));
  });

  test("returns every tool for an empty query", () => {
    expect(filterTools(tools, [], "", byId)).toHaveLength(tools.length);
  });

  test("applies no tag constraint when no tag is selected", () => {
    expect(filterTools(tools, [], "", byId).map((t) => t.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("keeps a tool carrying any of the selected tags, not all of them", () => {
    // `a` carries only `t1` and `b` only `t2`, so the union is `[a, b, c]` while the
    // intersection would be `[c]`: the two semantics give different answers here.
    expect(filterTools(tools, ["t1", "t2"], "", byId).map((t) => t.id)).toEqual(
      ["a", "b", "c"],
    );
  });

  test("returns an empty array when nothing matches", () => {
    expect(filterTools(tools, [], "no-such-tool", byId)).toEqual([]);
  });

  test("returns a new array and leaves the inputs untouched", () => {
    const snapshot = structuredClone(tools);
    const selected = ["t1"];
    const selectedSnapshot = [...selected];
    const result = filterTools(tools, selected, "e", byId);
    expect(result).not.toBe(tools);
    expect(tools).toEqual(snapshot);
    expect(selected).toEqual(selectedSnapshot);
  });
});

describe("sortTools", () => {
  const tools = [
    tool("b", "beta", "https://beta.example.com"),
    tool("a", "árbol", "https://arbol.example.com"),
  ];

  test("orders ascending under Spanish collation with accents folded", () => {
    expect(sortTools(tools, "asc").map((t) => t.title)).toEqual([
      "árbol",
      "beta",
    ]);
  });

  test("orders differently from plain codepoint order", () => {
    // `á` is U+00E1 and sorts after `b` by codepoint, so the intended order and the
    // codepoint order disagree: this test cannot pass by accident.
    const codepointOrder = [...tools].sort((a, b) =>
      a.title < b.title ? -1 : 1,
    );
    expect(codepointOrder.map((t) => t.title)).toEqual(["beta", "árbol"]);
    expect(sortTools(tools, "asc").map((t) => t.title)).not.toEqual(
      codepointOrder.map((t) => t.title),
    );
  });

  test("orders descending as the exact reverse of ascending", () => {
    const ascending = sortTools(tools, "asc").map((t) => t.id);
    expect(sortTools(tools, "desc").map((t) => t.id)).toEqual(
      [...ascending].reverse(),
    );
  });

  test("returns a new array and leaves the input untouched", () => {
    const snapshot = structuredClone(tools);
    const result = sortTools(tools, "asc");
    expect(result).not.toBe(tools);
    expect(tools).toEqual(snapshot);
  });
});

describe("countToolsByTag", () => {
  test("counts tools, not relation edges", () => {
    const tools = [
      // The repeated id is the whole point: one tool, one count.
      tool("a", "Figma", "https://figma.com", ["t1", "t1", "t2"]),
      tool("b", "Coolors", "https://coolors.co", ["t1"]),
    ];
    const counts = countToolsByTag(tools);
    expect(counts.get("t1")).toBe(2);
    expect(counts.get("t2")).toBe(1);
  });

  test("leaves out an id nobody carries", () => {
    const counts = countToolsByTag([
      tool("a", "Figma", "https://figma.com", ["t1"]),
    ]);
    expect(counts.has("t9")).toBe(false);
  });
});

describe("groupTagsByCategory", () => {
  const categories: TagCategory[] = [
    { name: "Tipo", tags: ["color", "svg", "image"] },
    { name: "Función", tags: ["generator"] },
  ];

  test("drops a tag nobody uses", () => {
    const tags = [tag("t1", "color"), tag("t2", "svg")];
    const counts = new Map([["t1", 2]]);
    const groups = groupTagsByCategory(tags, counts, categories, "Otros");
    expect(groups.flatMap((g) => g.options.map((o) => o.tag.id))).toEqual(["t1"]);
  });

  test("omits a group whose options all drop", () => {
    const tags = [tag("t1", "color"), tag("t2", "generator")];
    const counts = new Map([["t1", 1]]);
    const groups = groupTagsByCategory(tags, counts, categories, "Otros");
    expect(groups.map((g) => g.name)).toEqual(["Tipo"]);
  });

  test("puts an uncategorised tag in the final other group", () => {
    const tags = [tag("t1", "color"), tag("t9", "new-thing")];
    const counts = new Map([
      ["t1", 1],
      ["t9", 3],
    ]);
    const groups = groupTagsByCategory(tags, counts, categories, "Otros");
    expect(groups.map((g) => g.name)).toEqual(["Tipo", "Otros"]);
    expect(groups[groups.length - 1]?.options.map((o) => o.tag.id)).toEqual([
      "t9",
    ]);
  });

  test("omits the other group when every tag is categorised", () => {
    const tags = [tag("t1", "color")];
    const counts = new Map([["t1", 1]]);
    const groups = groupTagsByCategory(tags, counts, categories, "Otros");
    expect(groups.map((g) => g.name)).toEqual(["Tipo"]);
  });

  test("preserves the authored category order", () => {
    const tags = [tag("t1", "generator"), tag("t2", "color")];
    const counts = new Map([
      ["t1", 1],
      ["t2", 1],
    ]);
    const groups = groupTagsByCategory(tags, counts, categories, "Otros");
    expect(groups.map((g) => g.name)).toEqual(["Tipo", "Función"]);
  });

  test("sorts a group's options by name", () => {
    const tags = [tag("t1", "svg"), tag("t2", "Color"), tag("t3", "image")];
    const counts = new Map([
      ["t1", 1],
      ["t2", 1],
      ["t3", 1],
    ]);
    const groups = groupTagsByCategory(tags, counts, categories, "Otros");
    expect(groups[0]?.options.map((o) => o.tag.name)).toEqual([
      "Color",
      "image",
      "svg",
    ]);
  });

  test("leaves both input arrays untouched", () => {
    const tags = [tag("t1", "color"), tag("t9", "new-thing")];
    const counts = new Map([
      ["t1", 1],
      ["t9", 1],
    ]);
    const tagsSnapshot = structuredClone(tags);
    const categoriesSnapshot = structuredClone(categories);
    groupTagsByCategory(tags, counts, categories, "Otros");
    expect(tags).toEqual(tagsSnapshot);
    expect(categories).toEqual(categoriesSnapshot);
  });
});
