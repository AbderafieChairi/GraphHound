/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Graph traversal for the Path Finder — pure async algorithms decoupled from
 * React. Both functions walk the graph one hop at a time via `runQuery` and are
 * cancellable through an `AbortSignal`. UI concerns (state, canvas updates) are
 * handled by the caller via the return value / `onPath` callback.
 */

export type NodeSuggestion = { objectid: string; name: string; kind: string };

export type PathEntry = {
  hops: number;
  names: string[];
  kinds: string[];
  edges: string[];
};

type RunQuery = (args: {
  data: { cypher: string; project?: string };
}) => Promise<{ ok: boolean; error?: string; rowsJson: string }>;

type TraversalOptions = {
  runQuery: RunQuery;
  project?: string;
  start: NodeSuggestion;
  end: NodeSuggestion;
  algo: "BFS" | "DFS";
  maxDepth: number;
  signal: AbortSignal;
};

/** Outgoing-neighbour Cypher for a single node. */
function neighbourQuery(currentId: string): string {
  return `MATCH (a:Base)-[r]->(b:Base) WHERE a.objectid = '${currentId.replace(
    /'/g,
    "''",
  )}' RETURN a AS source, type(r) AS edge, b AS target LIMIT 1000`;
}

type Frame = {
  currentId: string;
  path: string[];
  names: string[];
  rowHistory: Record<string, any>[];
};

/** The signal fired mid-traversal; callers treat `null` returns as "aborted or no path". */
export type FirstPathResult = {
  rows: Record<string, any>[];
  ids: string[];
  names: string[];
} | null;

/** Find a single path (shortest via BFS, or first-found via DFS). */
export async function findFirstPath(opts: TraversalOptions): Promise<FirstPathResult> {
  const { runQuery, project, start, end, algo, maxDepth, signal } = opts;

  if (start.objectid === end.objectid) {
    return { rows: [], ids: [start.objectid], names: [start.name] };
  }

  const visited: string[] = [start.objectid];
  const queue: Frame[] = [
    { currentId: start.objectid, path: [start.objectid], names: [start.name], rowHistory: [] },
  ];

  while (queue.length > 0) {
    if (signal.aborted) return null;
    const { currentId, path, names, rowHistory } = algo === "BFS" ? queue.shift()! : queue.pop()!;
    if (path.length - 1 >= maxDepth) continue;

    const result = await runQuery({ data: { cypher: neighbourQuery(currentId), project } });
    if (signal.aborted) return null;
    if (!result.ok) throw new Error(result.error || `Query failed during ${algo} traversal`);

    const parsed = JSON.parse(result.rowsJson) as Record<string, any>[];
    for (const row of parsed) {
      const bNode = row.target;
      if (!bNode || typeof bNode.objectid !== "string") continue;
      const neighborId = bNode.objectid;
      const neighborName = bNode.name || neighborId;

      if (neighborId === end.objectid) {
        return {
          rows: [...rowHistory, row],
          ids: [...path, neighborId],
          names: [...names, neighborName],
        };
      }

      const seen = algo === "BFS" ? visited.includes(neighborId) : path.includes(neighborId);
      if (!seen) {
        if (algo === "BFS") visited.push(neighborId);
        queue.push({
          currentId: neighborId,
          path: [...path, neighborId],
          names: [...names, neighborName],
          rowHistory: [...rowHistory, row],
        });
      }
    }
  }
  return null;
}

/** Max number of distinct paths {@link findAllPaths} will enumerate. */
export const MAX_PATHS = 100;

type AllPathsOptions = TraversalOptions & {
  /** Invoked for each newly discovered distinct path, in discovery order. */
  onPath: (
    entry: PathEntry,
    fullPath: string[],
    rows: Record<string, any>[],
  ) => void | Promise<void>;
};

/** Enumerate up to {@link MAX_PATHS} distinct paths, streaming each via `onPath`. */
export async function findAllPaths(opts: AllPathsOptions): Promise<number> {
  const { runQuery, project, start, end, algo, maxDepth, signal, onPath } = opts;

  if (start.objectid === end.objectid) {
    await onPath(
      { hops: 0, names: [start.name], kinds: [start.kind], edges: [] },
      [start.objectid],
      [],
    );
    return 1;
  }

  const queue: Frame[] = [
    { currentId: start.objectid, path: [start.objectid], names: [start.name], rowHistory: [] },
  ];
  const seenSignatures = new Set<string>();
  let count = 0;

  while (queue.length > 0) {
    if (signal.aborted) return count;
    const { currentId, path, names, rowHistory } = algo === "BFS" ? queue.shift()! : queue.pop()!;
    if (path.length - 1 >= maxDepth) continue;

    const result = await runQuery({ data: { cypher: neighbourQuery(currentId), project } });
    if (signal.aborted) return count;
    if (!result.ok) throw new Error(result.error || `Query failed during ${algo} traversal`);

    const parsed = JSON.parse(result.rowsJson) as Record<string, any>[];
    for (const row of parsed) {
      const bNode = row.target;
      if (!bNode || typeof bNode.objectid !== "string") continue;
      const neighborId = bNode.objectid;
      const neighborName = bNode.name || neighborId;

      if (neighborId === end.objectid) {
        const fullPath = [...path, neighborId];
        const sig = fullPath.join("|");
        if (seenSignatures.has(sig)) continue;
        seenSignatures.add(sig);

        const pathRows = [...rowHistory, row];
        const nodeSeq = pathRows[0] ? [pathRows[0].source, ...pathRows.map((r) => r.target)] : [];
        const entry: PathEntry = {
          hops: fullPath.length - 1,
          names: [...names, neighborName],
          kinds: nodeSeq.map((n) => String(n?.kind ?? "")),
          edges: pathRows.map((r) => String(r?.edge ?? "")),
        };
        count++;
        await onPath(entry, fullPath, pathRows);
        if (count >= MAX_PATHS) return count;
        continue;
      }

      if (!path.includes(neighborId)) {
        queue.push({
          currentId: neighborId,
          path: [...path, neighborId],
          names: [...names, neighborName],
          rowHistory: [...rowHistory, row],
        });
      }
    }
    if (count >= MAX_PATHS) return count;
  }
  return count;
}
