/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CyElement } from "@/lib/graph-elements";

export const BUILT_IN_TAGS = [
  "Owned",
  "High Privileged",
  "High Value",
  "Critical",
  "Review",
  "False Positive",
] as const;
export type AnalystTag = (typeof BUILT_IN_TAGS)[number];

/** Cypher label matching a tag, e.g. "High Privileged" -> "HighPrivileged". */
export function tagLabel(tag: string) {
  return tag.replace(/[^A-Za-z0-9]/g, "");
}

export const TAG_STYLES: Record<AnalystTag, string> = {
  Owned: "bg-primary/15 text-primary border-primary/30",
  "High Privileged": "bg-destructive/15 text-destructive border-destructive/30",
  "High Value": "bg-accent/15 text-accent border-accent/30",
  Critical: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  Review: "bg-muted text-muted-foreground border-border",
  "False Positive": "bg-secondary text-secondary-foreground border-border",
};

export type NodeKind =
  "User" | "Group" | "Computer" | "GPO" | "OU" | "Container" | "Domain" | string;
export const NODE_ICON_NAMES: Record<string, string> = {
  User: "user",
  Group: "users",
  Computer: "monitor",
  GPO: "file-cog",
  OU: "folder-tree",
  Container: "box",
  Domain: "globe-2",
  Base: "circle-dot",
};

export function fingerprint(objects: { objectid?: string }[]) {
  return objects
    .slice(0, 20)
    .map((o) => o.objectid ?? "")
    .join("|");
}

export function findShortestPath(elements: CyElement[], start: string, end: string) {
  if (!start || !end) return [] as string[];
  const adjacency = new Map<string, string[]>();
  for (const element of elements) {
    const { source, target } = element.data;
    if (!source || !target) continue;
    if (!adjacency.has(source)) adjacency.set(source, []);
    if (!adjacency.has(target)) adjacency.set(target, []);
    adjacency.get(source)!.push(target);
    adjacency.get(target)!.push(source);
  }
  const queue = [start];
  const previous = new Map<string, string | null>([[start, null]]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current === end) break;
    for (const next of adjacency.get(current) ?? []) {
      if (!previous.has(next)) {
        previous.set(next, current);
        queue.push(next);
      }
    }
  }
  if (!previous.has(end)) return [];
  const path: string[] = [];
  for (let at: string | null = end; at; at = previous.get(at) ?? null) path.unshift(at);
  return path;
}

export function isNodeOnlyResult(rows: Record<string, any>[]) {
  return (
    rows.length > 0 &&
    rows.some((row) => Object.values(row).some((value) => value?.objectid)) &&
    !rows.some((row) =>
      Object.values(row).some((value) => value?.nodes || (value?.source && value?.target)),
    )
  );
}

export function nodeRows(rows: Record<string, any>[]) {
  const map = new Map<string, Record<string, any>>();
  for (const row of rows)
    for (const value of Object.values(row)) {
      if (value && typeof value === "object" && typeof value.objectid === "string")
        map.set(value.objectid, value);
    }
  return [...map.values()];
}

export function iconName(kind: NodeKind) {
  return NODE_ICON_NAMES[kind] ?? NODE_ICON_NAMES.Base;
}
const TAG_STORAGE_KEY = "hz-tags";
export type TagMap = Record<string, AnalystTag[]>;
export function readTags(): TagMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(TAG_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
export function saveTags(tags: TagMap) {
  localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(tags));
}

export function formatCell(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "object") {
    const record = value as Record<string, any>;
    return record.objectid
      ? `(${record.kind ?? "Node"}) ${record.name ?? record.objectid}`
      : JSON.stringify(value);
  }
  return String(value);
}
export function graphElementIds(elements: CyElement[]) {
  return elements.filter((e) => !e.data.source).map((e) => String(e.data.id));
}
export function graphLabels(elements: CyElement[]) {
  return elements
    .filter((e) => !e.data.source)
    .map((e) => ({
      id: String(e.data.id),
      label: String(e.data.label),
      kind: String(e.data.kind),
    }));
}

export const CYPHER_SUGGESTIONS = [
  "MATCH",
  "RETURN",
  "WHERE",
  "ORDER BY",
  "LIMIT",
  "CONTAINS",
  "AND",
  "OR",
  "NOT",
  "AS",
  "type",
  "count",
  "Base",
  "User",
  "Group",
  "Computer",
  "MemberOf",
  "AdminTo",
  "HasSession",
  "GenericAll",
  "WriteDacl",
];
export function getSuggestions(input: string) {
  const token = input.split(/\s+/).pop()?.toLowerCase() ?? "";
  return CYPHER_SUGGESTIONS.filter((item) => item.toLowerCase().startsWith(token)).slice(0, 8);
}
// antlr4-c3 integration seam: grammar candidates are merged with dataset-aware symbols when a grammar is supplied.
export function completeCypher(input: string) {
  return getSuggestions(input);
}

export function isGraphResult(rows: Record<string, any>[]) {
  return rows.some((row) => Object.values(row).some((value) => value?.source && value?.target));
}
