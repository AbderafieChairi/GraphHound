/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Settings, Upload } from "lucide-react";

import { EnvironmentSelector } from "@/components/EnvironmentSelector";
import { GraphCanvas, type GraphApi } from "@/components/GraphCanvas";
import { selectedIconMap } from "@/lib/node-icons";
import { QueryComposer } from "@/components/QueryComposer";
import { AnalystControls } from "@/components/AnalystControls";
import { UploadModal } from "@/components/UploadModal";
import { WorkspaceSidebar, type SidebarTab } from "@/components/sidebar/WorkspaceSidebar";
import { SettingsDialog, type ThemeInfo, type IconSetInfo } from "@/components/SettingsDialog";

import { parseRowsToStats } from "@/lib/stats";
import { applyTheme } from "@/lib/theme";
import { NodeDetailsSheet } from "@/components/report/NodeDetailsSheet";
import { nodeRows } from "@/lib/analyst";
import {
  queryGraph,
  fetchThemes,
  activeTheme,
  fetchIconSets,
  fetchAnalysisSectionsAndQueries,
} from "@/lib/graph.functions";

import { useWorkspace } from "@/hooks/use-workspace";
import { useNodeSelection } from "@/hooks/use-node-selection";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
// ... (omitting remaining lines for replacing targetContent cleanly)

/* ------------------------------------------------------------------ */
/*  Route definition                                                   */
/* ------------------------------------------------------------------ */

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GraphHound" },
      {
        name: "description",
        content: "Standalone Active Directory graph analysis workspace.",
      },
    ],
  }),
  validateSearch: (search) =>
    z
      .object({
        env: z.string().optional(),
      })
      .parse(search),
  loaderDeps: ({ search }) => ({
    env: search.env,
  }),
  loader: async ({ deps }) => {
    const project = deps.env ?? "bh";
    const empty = {
      rows: [] as Record<string, any>[],
      stats: parseRowsToStats([], 0),
      project,
      themes: [] as any[],
      currentTheme: null as any,
      iconSets: [] as any[],
    };

    try {
      const [themes, currentTheme, iconSets] = await Promise.all([
        fetchThemes(),
        activeTheme(),
        fetchIconSets({ data: { project } }),
      ]);

      let rows: Record<string, any>[] = [];
      const result_nodes = await queryGraph({
        data: { cypher: "MATCH (n:Base) RETURN n LIMIT 10000", project },
      });
      if (result_nodes.ok) rows = nodeRows(JSON.parse(result_nodes.rowsJson));

      let edge_count = 0;
      const result_edges = await queryGraph({
        data: { cypher: "MATCH ()-[r]->() RETURN count(r) AS edge_count", project },
      });
      if (result_edges.ok) {
        const first = JSON.parse(result_edges.rowsJson).at(0);
        edge_count = Number(first?.["edge_count"] ?? 0);
      }

      const stats = parseRowsToStats(rows, edge_count);
      return { rows, stats, project, themes, currentTheme, iconSets };
    } catch {
      // The graph store can be unavailable (e.g. first boot / no dataset);
      // render the workspace with empty data instead of crashing SSR.
      return empty;
    }
  },
  component: HoundZero,
});

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function HoundZero() {
  const {
    rows: rows_,
    stats: stats_,
    project: project_,
    themes: initialThemes,
    currentTheme: initialTheme,
    iconSets: initialIconSets,
  } = Route.useLoaderData();
  const currentProject = project_ || "bh";
  const navigate = useNavigate();

  /* — Workspace hook (query, rows, stats, ingest, etc.) — */
  const workspace = useWorkspace({
    currentProject,
    initialRows: rows_,
    initialStats: stats_,
  });

  /* — Node / Edge selection hook — */
  const selection = useNodeSelection({ currentProject });

  /* — Theme & settings state — */
  const loadIconSets = useServerFn(fetchIconSets);
  const loadAnalysis = useServerFn(fetchAnalysisSectionsAndQueries);
  const [themes, setThemes] = useState<ThemeInfo[]>(initialThemes as ThemeInfo[]);
  const [activeThemeState, setActiveThemeState] = useState<ThemeInfo>(initialTheme as ThemeInfo);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [iconSets, setIconSets] = useState<IconSetInfo[]>(initialIconSets as IconSetInfo[]);

  /* — Flatten the selected icon set into kind → icon spec for the graph — */
  const graphIcons = useMemo(() => selectedIconMap(iconSets), [iconSets]);

  /* — Analysis sections — */
  const [analysisSections, setAnalysisSections] = useState<
    {
      sectionId: number;
      sectionName: string;
      filename: string;
      filepath: string;
      queries: { id: number; title: string; cypher: string }[];
    }[]
  >([]);

  const refreshAnalysisData = useCallback(async () => {
    try {
      const data = await loadAnalysis();
      setAnalysisSections(data as any);
    } catch (err) {
      console.error("Failed to load analysis sections:", err);
    }
  }, [loadAnalysis]);

  useEffect(() => {
    void refreshAnalysisData();
  }, [refreshAnalysisData]);

  /* — UI state — */
  const [activeTab, setActiveTab] = useState<SidebarTab>("database");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [api, setApi] = useState<GraphApi | null>(null);
  const [path] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [canvasCount, setCanvasCount] = useState(0);

  /* — Graph clearing — */
  const handleClearGraph = useCallback(() => {
    workspace.clearGraph();
    api?.clear();
  }, [workspace.clearGraph, api]);

  const handleClearAll = useCallback(() => {
    workspace.setCypher("");
    handleClearGraph();
  }, [workspace.setCypher, handleClearGraph]);

  /* — Keyboard shortcuts — */
  useKeyboardShortcuts({
    cypher: workspace.cypher,
    execute: workspace.execute,
    saveQuery: workspace.saveQuery,
    setShortcutsOpen,
    clearAll: handleClearAll,
  });

  /* — Apply active theme — */
  useEffect(() => {
    if (activeThemeState) {
      applyTheme(activeThemeState);
    }
  }, [activeThemeState]);

  /* — Sync loader data on project switch — */
  useEffect(() => {
    workspace.syncLoaderData(rows_, stats_);
    selection.setSelected(null);
    selection.setShowSelectedNodes(false);
    if (initialThemes) setThemes(initialThemes as ThemeInfo[]);
    if (initialTheme) setActiveThemeState(initialTheme as ThemeInfo);
    if (initialIconSets) setIconSets(initialIconSets as IconSetInfo[]);
  }, [rows_, stats_, initialThemes, initialTheme, initialIconSets]);

  /* — Composed callbacks — */
  const handleSearchNode = useCallback(
    async (id: string) => {
      const node = await workspace.searchNode(id);
      if (node) {
        selection.setSelected(node as Record<string, any>);
        selection.setShowSelectedNodes(false);
        setActiveTab("node");
      }
    },
    [workspace.searchNode, selection],
  );

  const handleReset = useCallback(async () => {
    await workspace.resetDataset();
    selection.setSelected(null);
    selection.setShowSelectedNodes(false);
  }, [workspace.resetDataset, selection]);

  const handleSelectQuery = useCallback(
    (q: string) => {
      workspace.setCypher(q);
      void workspace.execute(q);
    },
    [workspace.setCypher, workspace.execute],
  );

  const handleRunAnalysisQuery = useCallback(
    (q: string) => {
      workspace.setCypher(q);
      void workspace.execute(q);
    },
    [workspace.setCypher, workspace.execute],
  );

  const handlePathFound = useCallback(
    (pathRows: Record<string, any>[], pathCypher: string) => {
      workspace.setCypher(pathCypher);
      // setRows directly via workspace internals isn't ideal,
      // but we mirror the original behaviour via searchNode pattern:
      void workspace.execute(pathCypher);
    },
    [workspace.setCypher, workspace.execute],
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 relative bg-background">
        <main className="relative flex min-w-0 flex-1 flex-col">
          {/* Top Left Icons */}
          <div className="absolute left-4 top-4 z-20 flex gap-2">
            <EnvironmentSelector
              currentProject={currentProject}
              onSwitch={(env) => {
                void navigate({
                  search: ((prev: Record<string, string | undefined> | undefined) => {
                    const next: Record<string, string | undefined> = { ...(prev ?? {}) };
                    if (env.project === "bh") {
                      delete next.env;
                      return next as Record<string, string | undefined>;
                    }
                    return { ...next, env: env.project };
                  }) as any,
                });
              }}
            />
            <button
              onClick={() => setSettingsOpen(true)}
              className="panel flex h-10 w-10 items-center justify-center rounded-md hover:border-primary text-muted-foreground hover:text-primary transition-colors bg-card shadow-sm cursor-pointer"
            >
              <Settings className="size-5" />
            </button>
            <button
              onClick={() => setUploadModalOpen(true)}
              className="panel flex h-10 w-10 items-center justify-center rounded-md hover:border-primary text-muted-foreground hover:text-primary transition-colors bg-card shadow-sm cursor-pointer"
            >
              <Upload className="size-5" />
            </button>
          </div>

          {/* Settings Modal */}
          <SettingsDialog
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            themes={themes}
            activeThemeId={activeThemeState?.id}
            iconSets={iconSets}
            project={currentProject}
            onIconSetsChange={() =>
              void loadIconSets({ data: { project: currentProject } }).then((next) =>
                setIconSets(next as IconSetInfo[]),
              )
            }
            onSelectTheme={(themeId) => {
              const selectedTheme = themes.find((t) => t.id === themeId);
              if (selectedTheme) {
                setActiveThemeState(selectedTheme);
              }
            }}
            onCustomThemeSaved={(theme) => {
              // Merge (or replace) the custom theme in the list, then activate it.
              setThemes((prev) => {
                const rest = prev.filter((t) => t.id !== theme.id);
                return [...rest, theme];
              });
              setActiveThemeState(theme);
            }}
            onAnalysisChange={refreshAnalysisData}
          />

          {/* Upload Modal */}
          <UploadModal
            open={uploadModalOpen}
            onClose={() => setUploadModalOpen(false)}
            ingesting={workspace.ingesting}
            progress={workspace.progress}
            onFiles={workspace.handleFiles}
          />

          {/* Right Sidebar Panel */}
          <WorkspaceSidebar
            runQuery={workspace.runQuery}
            onSearchNode={handleSearchNode}
            project={currentProject}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            stats={workspace.stats}
            onReset={handleReset}
            cypher={workspace.cypher}
            historyKey={workspace.historyKey}
            onSelectQuery={handleSelectQuery}
            selected={selection.selected}
            selectedEdge={selection.selectedEdge}
            edgeDoc={selection.edgeDoc}
            tags={selection.tags}
            onToggleTag={selection.toggleTag}
            onSelectNode={(node) => {
              selection.setSelected(node);
              setActiveTab("node");
            }}
            analysisSections={analysisSections}
            onRunAnalysisQuery={handleRunAnalysisQuery}
            onPathFound={handlePathFound}
            onClearGraph={handleClearGraph}
            api={api}
            icons={graphIcons}
          />

          {/* Query Composer */}
          <QueryComposer
            value={workspace.cypher}
            onChange={workspace.setCypher}
            onRun={() => void workspace.execute(workspace.cypher)}
            running={workspace.running}
            history={workspace.history}
            onHistory={workspace.setCypher}
            onShowDetails={() => setSheetOpen(true)}
            queryResultRows={workspace.rows}
          />

          {/* Graph Canvas */}
          <div className="relative min-h-0 flex-1">
            <GraphCanvas
              elements={workspace.elements}
              icons={graphIcons}
              tags={selection.tags}
              onSelect={(node) => {
                selection.setSelectedEdge(null);
                selection.setSelected(node);
                selection.setShowSelectedNodes(Boolean(node));
                if (node) setActiveTab("node");
              }}
              onEdgeSelect={(edge) => void selection.handleEdgeSelect(edge)}
              onReady={setApi}
              onCountChange={setCanvasCount}
              path={path}
            />
            <AnalystControls api={api} />

            {/* Keyboard Shortcuts Overlay */}
            {shortcutsOpen ? (
              <div className="panel absolute left-4 top-16 z-20 w-64 p-4 mt-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                  <Keyboard className="size-3.5 text-primary" /> Keyboard shortcuts
                </div>
                <div className="mono mt-3 flex flex-col gap-2 text-[11px] text-muted-foreground">
                  <span>
                    <kbd>Ctrl/Cmd + Enter</kbd> Run query
                  </span>
                  <span>
                    <kbd>Ctrl/Cmd + S</kbd> Save query
                  </span>
                  <span>
                    <kbd>Alt + C</kbd> Clear query and graph
                  </span>
                  <span>
                    <kbd>Esc</kbd> Close overlays
                  </span>
                  <span>
                    <kbd>Click node</kbd> Inspect entities
                  </span>
                </div>
              </div>
            ) : null}

            {/* Empty State */}
            {!workspace.elements.length && !canvasCount ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="mono text-xs text-muted-foreground">
                  {workspace.stats?.nodeCount
                    ? "No graph elements in this result — inspect the table below"
                    : "Upload a SharpHound JSON collection to begin"}
                </p>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Node Details Sheet */}
      <NodeDetailsSheet open={sheetOpen} onOpenChange={setSheetOpen} rows={workspace.rows} />
    </div>
  );
}
