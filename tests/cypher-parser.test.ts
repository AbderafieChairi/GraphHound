import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseCypherFile } from "../src/lib/registry/cypher-parser";

describe("parseCypherFile", () => {
  test("parses sections and queries, skipping comments", () => {
    const src = [
      "# ─────",
      "# Discovery",
      "# ─────",
      "## DC computers",
      "// comment",
      "MATCH (u:Computer {isdc:true})",
      "RETURN *",
      "## Empty",
    ].join("\n");
    expect(parseCypherFile(src)).toEqual([
      {
        name: "Discovery",
        queries: [{ name: "DC computers", query: "MATCH (u:Computer {isdc:true})\nRETURN *" }],
      },
    ]);
  });

  test("puts queries without a section under General Queries", () => {
    expect(parseCypherFile("## Q\nMATCH (n) RETURN n")[0]?.name).toBe("General Queries");
  });

  test("parses the bundled example packs", () => {
    for (const f of ["examples/bh_ad_queries.cypher", "examples/privhound_queries.cypher"]) {
      const sections = parseCypherFile(readFileSync(f, "utf8"));
      expect(sections.length).toBeGreaterThan(0);
      for (const s of sections) expect(s.queries.length).toBeGreaterThan(0);
    }
  });
});
