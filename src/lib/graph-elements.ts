/* eslint-disable @typescript-eslint/no-explicit-any */
/** Turn Cypher result rows into Cytoscape elements. */

export type CyElement = {
  data: Record<string, any>;
};

const isNode = (v: any) => v && typeof v === "object" && typeof v.objectid === "string";
const isPath = (v: any) => v && typeof v === "object" && Array.isArray(v.nodes);

export function rowsToElements(rows: Record<string, any>[]): CyElement[] {
  const nodes = new Map<string, CyElement>();
  const edges = new Map<string, CyElement>();

  const addNode = (value: any) => {
    if (!isNode(value)) return null;
    const id = String(value.objectid);
    if (!nodes.has(id)) {
      nodes.set(id, {
        data: {
          id,
          label: String(value.name ?? id),
          kind: String(value.kind ?? "Base"),
          props: value,
        },
      });
    }
    return id;
  };

  const addEdge = (source: string, target: string, type: string) => {
    const id = `${source}|${type}|${target}`;
    if (!edges.has(id)) edges.set(id, { data: { id, source, target, label: type } });
  };

  const walkPathArray = (value: any[]) => {
    const ids: (string | null)[] = [];
    const types: string[] = [];
    for (const item of value) {
      if (isNode(item)) ids.push(addNode(item));
      else if (item && typeof item === "object") {
        types.push(String(item.label ?? item.type ?? "RELATED"));
      }
    }
    for (let i = 0; i < ids.length - 1; i++) {
      const a = ids[i];
      const b = ids[i + 1];
      if (a && b) addEdge(a, b, types[i] ?? "RELATED");
    }
  };

  const walk = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (isPath(value)) {
      const ids = value.nodes.map((n: any) => addNode(n));
      const types: string[] = (value.edges ?? []).map((e: any) =>
        String(e?.label ?? e?.type ?? "RELATED"),
      );
      for (let i = 0; i < ids.length - 1; i++) {
        const a = ids[i];
        const b = ids[i + 1];
        if (a && b) addEdge(a, b, types[i] ?? "RELATED");
      }
      return;
    }
    if (isNode(value)) {
      addNode(value);
      return;
    }
    if (typeof value.source === "string" && typeof value.target === "string") {
      addEdge(value.source, value.target, String(value.type ?? value.label ?? "RELATED"));
      return;
    }
    if (Array.isArray(value)) {
      if (value.some(isNode)) walkPathArray(value);
      else value.forEach(walk);
    }
  };

  for (const row of rows) {
    const values = Object.values(row);
    values.forEach(walk);

    // a, r, b style rows: connect node columns in order using relationship types
    const nodeIds = values.filter(isNode).map((v) => String((v as any).objectid));
    const relTypes = [
      ...values.filter(
        (v): v is string => typeof v === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(v),
      ),
      ...values
        .filter((v: any) => v && typeof v === "object" && !isNode(v))
        .map((v: any) => String(v.label ?? v.type ?? v._type ?? "")),
    ].filter(Boolean);
    const hasExplicitEdges = values.some(
      (val) =>
        (val &&
          typeof val === "object" &&
          typeof val.source === "string" &&
          typeof val.target === "string") ||
        (Array.isArray(val) &&
          val.some(
            (item) =>
              item &&
              typeof item === "object" &&
              typeof item.source === "string" &&
              typeof item.target === "string",
          )),
    );
    if (nodeIds.length === 2 && !hasExplicitEdges) {
      addEdge(nodeIds[0]!, nodeIds[1]!, relTypes[0] ?? "RELATED");
    }
  }

  return [...nodes.values(), ...edges.values()];
}
