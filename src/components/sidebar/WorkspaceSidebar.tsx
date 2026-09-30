/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { SearchAutocomplete } from "@/components/SearchAutocomplete";
import { PathFinder } from "@/components/PathFinder";
import { ReportManager } from "@/components/report/ReportManager";
import { DatabaseTab } from "@/components/sidebar/DatabaseTab";
import { NodeEdgeTab } from "@/components/sidebar/NodeEdgeTab";
import { AnalysisTab } from "@/components/sidebar/AnalysisTab";
import type { GraphApi } from "@/components/GraphCanvas";
import type { Stats } from "@/lib/presets";
import type { AnalystTag, TagMap } from "@/lib/analyst";
import type { NodeIconSpec } from "@/lib/node-icons";

export type SidebarTab = "database" | "node" | "analysis" | "path-finding" | "report";

interface AnalysisSection {
  sectionId: number;
  sectionName: string;
  filename: string;
  filepath: string;
  queries: { id: number; title: string; cypher: string }[];
}

interface WorkspaceSidebarProps {
  /* Search */
  runQuery: any;
  onSearchNode: (id: string) => void;
  project: string;

  /* Tab state */
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;

  /* Database tab */
  stats: Stats | null;
  onReset: () => void;
  cypher: string;
  historyKey: number;
  onSelectQuery: (cypher: string) => void;

  /* Node/Edge tab */
  selected: Record<string, any> | null;
  selectedEdge: Record<string, any> | null;
  edgeDoc: { name: string; md_docs: string } | null;
  tags: TagMap;
  onToggleTag: (id: string, tag: AnalystTag) => void;
  onSelectNode: (node: Record<string, any>) => void;

  /* Analysis tab */
  analysisSections: AnalysisSection[];
  onRunAnalysisQuery: (cypher: string) => void;

  /* Path-finding tab */
  onPathFound: (rows: Record<string, any>[], cypher: string) => void;
  onClearGraph: () => void;
  api: GraphApi | null;

  /* Report tab */
  icons?: Record<string, NodeIconSpec>;
}

const TABS: { key: SidebarTab; label: string }[] = [
  { key: "database", label: "Database" },
  { key: "node", label: "Node/Edge" },
  { key: "analysis", label: "Analysis" },
  { key: "path-finding", label: "Paths" },
  { key: "report", label: "Reports" },
];

export function WorkspaceSidebar({
  runQuery,
  onSearchNode,
  project,
  activeTab,
  onTabChange,
  stats,
  onReset,
  cypher,
  historyKey,
  onSelectQuery,
  selected,
  selectedEdge,
  edgeDoc,
  tags,
  onToggleTag,
  onSelectNode,
  analysisSections,
  onRunAnalysisQuery,
  onPathFound,
  onClearGraph,
  api,
  icons,
}: WorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Re-fit the graph into the newly freed (or covered) area.
  useEffect(() => {
    const id = requestAnimationFrame(() => api?.fit());
    return () => cancelAnimationFrame(id);
  }, [collapsed]);

  return (
    <>
      {collapsed && (
        <button
          title="Show panel"
          onClick={() => setCollapsed(false)}
          className="absolute right-4 top-4 z-20 panel shadow-sm bg-card p-2 text-muted-foreground hover:text-foreground"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      )}
      {/* Kept mounted while collapsed so tab state (e.g. path results) survives. */}
      <div
        data-graph-overlay
        className={`absolute right-4 top-4 z-20 w-180 panel flex-col max-h-[calc(100vh-120px)] shadow-sm bg-card ${
          collapsed ? "hidden" : "flex"
        }`}
      >
        {/* Search Box */}
        <div className="p-3 border-b border-border flex gap-2">
          <SearchAutocomplete
            runQuery={runQuery}
            onSelect={(id) => onSearchNode(id)}
            project={project}
          />
          <button
            title="Hide panel"
            onClick={() => setCollapsed(true)}
            className="shrink-0 px-2 text-muted-foreground hover:text-foreground"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border text-xs bg-sidebar/30">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex-1 py-2.5 font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-primary text-primary bg-card"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto p-4 flex-1 min-h-[200px]">
          {activeTab === "database" && (
            <DatabaseTab
              stats={stats}
              onReset={onReset}
              currentProject={project}
              cypher={cypher}
              historyKey={historyKey}
              onSelectQuery={onSelectQuery}
            />
          )}
          {activeTab === "node" && (
            <div>
              <NodeEdgeTab
                selected={selected}
                selectedEdge={selectedEdge}
                edgeDoc={edgeDoc}
                tags={tags}
                onToggleTag={onToggleTag}
                onSelectNode={onSelectNode}
                runQuery={runQuery}
                project={project}
              />
            </div>
          )}
          {activeTab === "analysis" && (
            <AnalysisTab sections={analysisSections} onRunQuery={onRunAnalysisQuery} />
          )}
          {activeTab === "path-finding" && (
            <PathFinder
              runQuery={runQuery}
              onPathFound={onPathFound}
              onClearGraph={onClearGraph}
              api={api}
              project={project}
              icons={icons}
            />
          )}
          {activeTab === "report" && <ReportManager project={project} icons={icons} />}
        </div>
      </div>
    </>
  );
}
