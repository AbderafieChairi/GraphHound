/**
 * Parse a `.cypher` analysis pack into sections of named queries.
 *
 * Pure function — no database or filesystem access — so it is trivially testable
 * and safe to import from both the connection bootstrap (for seeding) and the
 * analysis repository (for uploads) without creating an import cycle.
 *
 * Format:
 *   - A section header is a `#` divider line (containing `───`/`===`/`---`)
 *     immediately followed by a single-`#` title line.
 *   - A query starts with a `##` title; following non-comment, non-blank lines
 *     (until the next `##` or section) form its body.
 *   - Lines starting with `#` or `//` inside a query are treated as comments.
 */
export function parseCypherFile(content: string) {
  const lines = content.split(/\r?\n/);
  const sections: { name: string; queries: { name: string; query: string }[] }[] = [];
  let currentSection: (typeof sections)[0] | null = null;
  let currentQuery: (typeof sections)[0]["queries"][0] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();

    // Check for section boundary
    if (
      line.startsWith("#") &&
      (line.includes("───") || line.includes("===") || line.includes("---"))
    ) {
      if (i + 1 < lines.length) {
        const nextLine = (lines[i + 1] ?? "").trim();
        if (nextLine.startsWith("#") && !nextLine.startsWith("##")) {
          const sectionName = nextLine.replace(/^#\s*/, "").trim();
          currentSection = { name: sectionName, queries: [] };
          sections.push(currentSection);
          currentQuery = null;
          i++; // Skip the section name line
          // Skip closing divider if exists
          if (i + 1 < lines.length) {
            const afterNextLine = (lines[i + 1] ?? "").trim();
            if (
              afterNextLine.startsWith("#") &&
              (afterNextLine.includes("───") ||
                afterNextLine.includes("===") ||
                afterNextLine.includes("---"))
            ) {
              i++;
            }
          }
          continue;
        }
      }
    }

    if (line.startsWith("##")) {
      const queryName = line.replace(/^##\s*/, "").trim();
      currentQuery = { name: queryName, query: "" };
      if (!currentSection) {
        currentSection = { name: "General Queries", queries: [] };
        sections.push(currentSection);
      }
      currentSection.queries.push(currentQuery);
      continue;
    }

    if (currentQuery) {
      if (line.startsWith("#") || line.startsWith("//")) {
        continue;
      }
      if (line) {
        if (currentQuery.query) {
          currentQuery.query += "\n" + lines[i];
        } else {
          currentQuery.query = lines[i] ?? "";
        }
      }
    }
  }

  return sections
    .map((sec) => ({
      name: sec.name,
      queries: sec.queries
        .map((q) => ({ name: q.name, query: q.query.trim() }))
        .filter((q) => q.query.length > 0),
    }))
    .filter((sec) => sec.queries.length > 0);
}
