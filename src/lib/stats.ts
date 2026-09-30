/* eslint-disable @typescript-eslint/no-explicit-any */
import { rowsToElements } from "@/lib/graph-elements";
import type { Stats } from "@/lib/presets";

export function parseRowsToStats(rows: Record<string, any>[], edge_count: number): Stats {
  const elements = rowsToElements(rows);
  const edges = elements.filter((el) => el.data.source);

  const kinds: Record<string, number> = rows.reduce(
    (acc, item) => {
      acc[item.kind] = (acc[item.kind] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const edgeTypes: Record<string, number> = {};
  for (const edge of edges) {
    const type = edge.data.label || "RELATED";
    edgeTypes[type] = (edgeTypes[type] || 0) + 1;
  }
  return {
    nodeCount: rows.length,
    edgeCount: edge_count,
    kinds,
    edgeTypes,
  };
}
