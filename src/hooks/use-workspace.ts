/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { graphLabels, isNodeOnlyResult, nodeRows } from "@/lib/analyst";
import { parseSharpHoundFile } from "@/lib/sharphound";
import { rowsToElements } from "@/lib/graph-elements";
import type { Stats } from "@/lib/presets";
import {
  graphStats,
  ingestBatch,
  queryGraph,
  resetGraph,
  recordSearch,
} from "@/lib/graph.functions";

interface WorkspaceOptions {
  currentProject: string;
  initialRows: Record<string, any>[];
  initialStats: Stats | null;
}

export function useWorkspace({ currentProject, initialRows, initialStats }: WorkspaceOptions) {
  const ingest = useServerFn(ingestBatch);
  const runQuery = useServerFn(queryGraph);
  const reset = useServerFn(resetGraph);
  const loadStats = useServerFn(graphStats);
  const logSearch = useServerFn(recordSearch);

  const [stats, setStats] = useState<Stats | null>(initialStats);
  const [rows, setRows] = useState<Record<string, any>[]>(initialRows);
  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState("");
  const [cypher, setCypher] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [savedQueries, setSavedQueries] = useState<string[]>([]);
  const [historyKey, setHistoryKey] = useState(0);
  const [filter] = useState<{ kinds: string[]; edgeTypes: string[]; hideIsolated: boolean }>({
    kinds: [],
    edgeTypes: [],
    hideIsolated: false,
  });

  const rawElements = useMemo(() => rowsToElements(rows), [rows]);
  const elements = useMemo(() => {
    const visible = rawElements.filter((element) => {
      if (element.data.source) return true;
      return !filter.kinds.length || filter.kinds.includes(String(element.data.kind));
    });
    const ids = new Set(
      visible.filter((element) => !element.data.source).map((element) => String(element.data.id)),
    );
    return visible.filter(
      (element) =>
        !element.data.source ||
        (ids.has(String(element.data.source)) && ids.has(String(element.data.target))),
    );
  }, [filter.kinds, rawElements]);

  const nodes = useMemo(() => graphLabels(elements), [elements]);
  const availableKinds = useMemo(
    () =>
      [
        ...new Set(
          rawElements
            .filter((element) => !element.data.source)
            .map((element) => String(element.data.kind)),
        ),
      ].sort(),
    [rawElements],
  );
  const availableEdgeTypes = useMemo(
    () =>
      [
        ...new Set(
          rawElements
            .filter((element) => element.data.source)
            .map((element) => String(element.data.label)),
        ),
      ].sort(),
    [rawElements],
  );
  const graphNodeRows = useMemo(
    () =>
      elements
        .filter((element) => !element.data.source && !element.data.target)
        .map((element) => element.data.props as Record<string, any>)
        .filter(Boolean),
    [elements],
  );
  const nodeOnly = useMemo(() => isNodeOnlyResult(rows), [rows]);

  const execute = useCallback(
    async (query: string) => {
      setRunning(true);
      setError("");
      setHistory((old) => [...old.filter((item) => item !== query), query].slice(-8));
      void logSearch({ data: { cypher: query, project: currentProject } })
        .then(() => setHistoryKey((key) => key + 1))
        .catch(() => undefined);
      try {
        const result = await runQuery({ data: { cypher: query, project: currentProject } });
        if (!result.ok) {
          setError(result.error);
          setRows([]);
          setColumns([]);
          setMeta("");
        } else {
          const parsed = JSON.parse(result.rowsJson) as Record<string, any>[];
          setRows(parsed);
          setColumns(result.columns);
          setMeta(`${result.count} rows · ${result.timeMs}ms`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Query failed");
      } finally {
        setRunning(false);
      }
    },
    [runQuery, currentProject, logSearch],
  );

  const searchNode = useCallback(
    async (q: string): Promise<Record<string, any> | null> => {
      if (!q) return null;
      setMeta("Searching…");
      setError("");
      const safe = q.replace(/'/g, "''");
      const searchCypher = `MATCH (n:Base) WHERE toLower(n.name) CONTAINS '${safe.toLowerCase()}' OR n.objectid = '${safe}' RETURN n AS node LIMIT 1`;
      setCypher(searchCypher);
      await execute(searchCypher);
      try {
        const result = await runQuery({
          data: { cypher: searchCypher, project: currentProject },
        });
        if (!result.ok) {
          setError(result.error);
          setMeta("");
          return null;
        }
        const parsed = JSON.parse(result.rowsJson) as Record<string, any>[];
        if (parsed.length) {
          const node = parsed?.at(0)?.node ?? Object.values(parsed?.at(0) ?? {})[0];
          if (node) {
            setMeta("Node found");
            return node as Record<string, any>;
          }
        }
        setMeta("No node found");
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setMeta("");
        return null;
      }
    },
    [execute, runQuery, currentProject],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setIngesting(true);
      setError("");
      try {
        setProgress("Resetting workspace…");
        await reset({ data: { project: currentProject } });
        const nodeMap = new Map<string, any>();
        const allEdges: any[] = [];
        for (const file of Array.from(files)) {
          setProgress(`Parsing ${file.name}…`);
          const parsed = parseSharpHoundFile(file.name, JSON.parse(await file.text()));
          for (const node of parsed.nodes)
            if (!nodeMap.has(node.objectid)) nodeMap.set(node.objectid, node);
          allEdges.push(...parsed.edges);
        }
        const allNodes = [...nodeMap.values()];
        for (let i = 0; i < allNodes.length; i += 400) {
          setProgress(`Objects ${Math.min(i + 400, allNodes.length)}/${allNodes.length}`);
          setStats(
            await ingest({
              data: { nodes: allNodes.slice(i, i + 400), edges: [], project: currentProject },
            }),
          );
        }
        for (let i = 0; i < allEdges.length; i += 2000) {
          setProgress(`Edges ${Math.min(i + 2000, allEdges.length)}/${allEdges.length}`);
          setStats(
            await ingest({
              data: { nodes: [], edges: allEdges.slice(i, i + 2000), project: currentProject },
            }),
          );
        }
        setStats(await loadStats({ data: { project: currentProject } }));
        setProgress("Collection ready");
        await execute(cypher);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ingest failed");
      } finally {
        setIngesting(false);
      }
    },
    [cypher, execute, ingest, loadStats, reset, currentProject],
  );

  const exportJson = useCallback(() => {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ rows, elements, exportedAt: new Date().toISOString() }, null, 2)],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "hound-zero-graph.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [rows, elements]);

  const shareQuery = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}?query=${encodeURIComponent(cypher)}`;
    await navigator.clipboard?.writeText(url);
    setMeta("Share link copied");
  }, [cypher]);

  const saveQuery = useCallback(() => {
    setSavedQueries((old) => [...new Set([...old, cypher])].slice(-12));
    setMeta("Query saved");
  }, [cypher]);

  /** Clear the rendered graph and its result rows (dataset untouched). */
  const clearGraph = useCallback(() => {
    setRows([]);
    setColumns([]);
    setError("");
    setMeta("");
  }, []);

  const resetDataset = useCallback(async () => {
    await reset();
    setRows([]);
    setColumns([]);
    setMeta("");
  }, [reset]);

  /** Sync local state with fresh loader data (e.g. on project switch). */
  const syncLoaderData = useCallback(
    (loaderRows: Record<string, any>[], loaderStats: Stats | null) => {
      setRows(loaderRows);
      setStats(loaderStats);
      setMeta("");
    },
    [],
  );

  return {
    // State
    stats,
    rows,
    ingesting,
    progress,
    cypher,
    setCypher,
    clearGraph,
    columns,
    error,
    meta,
    running,
    history,
    savedQueries,
    historyKey,
    // Derived
    rawElements,
    elements,
    nodes,
    availableKinds,
    availableEdgeTypes,
    graphNodeRows,
    nodeOnly,
    // Actions
    execute,
    searchNode,
    handleFiles,
    exportJson,
    shareQuery,
    saveQuery,
    resetDataset,
    runQuery,
    syncLoaderData,
  };
}
