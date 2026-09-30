/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef } from "react";
import { Route, Loader2, Download, Eye } from "lucide-react";
import type { NodeIconSpec } from "@/lib/node-icons";
import { PathNodeSearchInput } from "@/components/PathNodeSearchInput";
import {
  findFirstPath,
  findAllPaths,
  type NodeSuggestion,
  type PathEntry,
} from "@/lib/path-search";
import { downloadReportHtml, generatePathReportHtml } from "@/lib/path-report";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PathFinder({
  runQuery,
  onPathFound,
  onClearGraph,
  api,
  project,
  icons,
}: {
  runQuery: any;
  onPathFound: (pathRows: Record<string, any>[], pathCypher: string) => void;
  onClearGraph?: () => void;
  api: {
    highlightPath: (ids: string[]) => void;
    addElements: (elements: any[]) => void;
    layoutPaths: (paths: string[][]) => void;
  } | null;
  project?: string;
  icons?: Record<string, NodeIconSpec>;
}) {
  const [startNode, setStartNode] = useState<NodeSuggestion | null>(null);
  const [endNode, setEndNode] = useState<NodeSuggestion | null>(null);
  const [searching, setSearching] = useState(false);
  const [pathResult, setPathResult] = useState<{ hops: number; names: string[] } | null>(null);
  const [allPathsResult, setAllPathsResult] = useState<PathEntry[] | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [error, setError] = useState("");
  const [maxDepth, setMaxDepth] = useState(10);
  const [algo, setAlgo] = useState<"BFS" | "DFS">("BFS");
  const abortRef = useRef<AbortController | null>(null);

  const cancelSearch = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setSearching(false);
  };

  /** Start a fresh cancellable search, returning its AbortController. */
  const beginSearch = () => {
    cancelSearch();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setError("");
    onClearGraph?.();
    return controller;
  };

  const endSearch = (controller: AbortController) => {
    if (!controller.signal.aborted) setSearching(false);
    if (abortRef.current === controller) abortRef.current = null;
  };

  const findPath = async () => {
    if (!startNode || !endNode) return;
    const controller = beginSearch();
    setPathResult(null);

    try {
      const result = await findFirstPath({
        runQuery,
        project,
        start: startNode,
        end: endNode,
        algo,
        maxDepth,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      if (!result) {
        setError("No path found between these nodes.");
      } else {
        setPathResult({ hops: result.ids.length - 1, names: result.names });
        if (result.rows.length === 0) {
          // Same start/end node.
          api?.highlightPath(result.ids);
          onPathFound([], "");
        } else if (api) {
          const { rowsToElements } = await import("@/lib/graph-elements");
          api.addElements(rowsToElements(result.rows));
          api.layoutPaths([result.ids]);
          api.highlightPath(result.ids);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Path search failed");
    } finally {
      endSearch(controller);
    }
  };

  const runFindAllPaths = async () => {
    if (!startNode || !endNode) return;
    const controller = beginSearch();
    setPathResult(null);
    setAllPathsResult([]);
    setLiveCount(0);

    const discoveredPaths: string[][] = [];
    try {
      const count = await findAllPaths({
        runQuery,
        project,
        start: startNode,
        end: endNode,
        algo,
        maxDepth,
        signal: controller.signal,
        onPath: async (entry, fullPath, rows) => {
          setAllPathsResult((prev) => [...(prev || []), entry]);
          setLiveCount((c) => c + 1);
          if (!api) return;
          if (rows.length === 0) {
            // Same start/end node.
            api.highlightPath(fullPath);
            onPathFound([], "");
            return;
          }
          const { rowsToElements } = await import("@/lib/graph-elements");
          api.addElements(rowsToElements(rows));
          discoveredPaths.push(fullPath);
          api.layoutPaths(discoveredPaths);
          api.highlightPath([...new Set(discoveredPaths.flat())]);
        },
      });
      if (controller.signal.aborted) return;
      if (count === 0) {
        setAllPathsResult(null);
        setError("No paths found between these nodes.");
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Path search failed");
    } finally {
      endSearch(controller);
    }
  };

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const buildReportHtml = () =>
    allPathsResult && allPathsResult.length > 0
      ? generatePathReportHtml(startNode?.name ?? "?", endNode?.name ?? "?", allPathsResult, icons)
      : null;

  const exportHtmlReport = () => {
    const html = buildReportHtml();
    if (html) downloadReportHtml(html, startNode?.name, endNode?.name);
  };

  const previewHtmlReport = () => setPreviewHtml(buildReportHtml());

  const clearPath = () => {
    setStartNode(null);
    setEndNode(null);
    setPathResult(null);
    setAllPathsResult(null);
    setLiveCount(0);
    setError("");
    if (api) api.highlightPath([]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs">
        <Route className="size-4 text-primary" />
        <span className="font-semibold uppercase tracking-wider">Path Finder</span>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Find relationship paths between any two nodes in the full database.
      </p>

      <PathNodeSearchInput
        label="Start node"
        value={startNode}
        onSelect={setStartNode}
        runQuery={runQuery}
        project={project}
      />

      <PathNodeSearchInput
        label="End node"
        value={endNode}
        onSelect={setEndNode}
        runQuery={runQuery}
        project={project}
      />

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
          Traversal
        </label>
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["BFS", "DFS"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setAlgo(mode)}
              disabled={searching}
              className={`flex-1 px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                algo === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-card/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
          Max depth
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={20}
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="mono text-xs text-muted-foreground w-6 text-right">{maxDepth}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={findPath}
            disabled={!startNode || !endNode || searching}
            className="flex-1 rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2 transition-colors hover:bg-primary/90"
          >
            {searching ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Searching…
              </>
            ) : algo === "BFS" ? (
              "Find shortest path"
            ) : (
              "Find path (DFS)"
            )}
          </button>
          <button
            onClick={runFindAllPaths}
            disabled={!startNode || !endNode || searching}
            className="flex-1 rounded-md border border-border bg-card/30 px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {searching && liveCount > 0 ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Found {liveCount} path{liveCount !== 1 ? "s" : ""}
              </>
            ) : (
              "Find all paths"
            )}
          </button>
        </div>
        {searching && (
          <button
            onClick={cancelSearch}
            className="w-full rounded-md border border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      {pathResult && (
        <div className="border-t border-border pt-3">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-semibold text-primary">
              {pathResult.hops} hop{pathResult.hops !== 1 ? "s" : ""}
            </span>
            <button
              onClick={clearPath}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {pathResult.names.map((name, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                {i > 0 && <span className="text-muted-foreground/50 -mt-1 ml-1">↓</span>}
                <span
                  className={`mono break-words ${i === 0 || i === pathResult.names.length - 1 ? "text-primary font-medium" : "text-muted-foreground"}`}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {allPathsResult && (
        <div className="border-t border-border pt-3">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-semibold text-primary">
              {allPathsResult.length} path{allPathsResult.length !== 1 ? "s" : ""} found
            </span>
            <div className="flex items-center gap-3">
              {allPathsResult.length > 0 && (
                <button
                  onClick={previewHtmlReport}
                  title="Preview the HTML report before downloading"
                  className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  <Eye className="size-3" />
                  Preview HTML
                </button>
              )}
              {allPathsResult.length > 0 && (
                <button
                  onClick={exportHtmlReport}
                  title="Export as standalone HTML report"
                  className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  <Download className="size-3" />
                  Export HTML
                </button>
              )}
              <button
                onClick={clearPath}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto pr-1">
            {allPathsResult.map((path, idx) => (
              <div key={idx} className="border border-border/50 rounded p-2 bg-card/30">
                <div className="text-[10px] font-semibold text-muted-foreground mb-1">
                  Path #{idx + 1} ({path.hops} hop{path.hops !== 1 ? "s" : ""})
                </div>
                <div className="flex flex-col gap-1">
                  {path.names.map((name, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      {i > 0 && (
                        <span className="flex items-center gap-1.5 ml-1 -my-0.5 text-muted-foreground/50">
                          <span>↓</span>
                          {path.edges?.[i - 1] && (
                            <span className="text-[9px] text-primary/70 mono uppercase tracking-wide">
                              {path.edges[i - 1]}
                            </span>
                          )}
                        </span>
                      )}
                      <span
                        className={`mono break-words text-[11px] ${i === 0 || i === path.names.length - 1 ? "text-primary font-medium" : "text-muted-foreground"}`}
                      >
                        {name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(startNode || endNode) && !searching && !pathResult && !allPathsResult && (
        <button
          onClick={clearPath}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors self-center"
        >
          Clear selection
        </button>
      )}
      <Dialog open={previewHtml !== null} onOpenChange={(open) => !open && setPreviewHtml(null)}>
        <DialogContent className="max-w-[90vw] w-[1100px] h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Path report preview</DialogTitle>
            <DialogDescription>
              {startNode?.name ?? "?"} → {endNode?.name ?? "?"} · {allPathsResult?.length ?? 0}{" "}
              paths
            </DialogDescription>
          </DialogHeader>
          {previewHtml && (
            <iframe
              title="Path report preview"
              srcDoc={previewHtml}
              sandbox=""
              className="flex-1 w-full rounded-md border border-border bg-white"
            />
          )}
          <DialogFooter>
            <button
              onClick={() => setPreviewHtml(null)}
              className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
            >
              Close
            </button>
            <button
              onClick={() =>
                previewHtml && downloadReportHtml(previewHtml, startNode?.name, endNode?.name)
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Download className="size-3.5" />
              Download HTML
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
