import { Trash2 } from "lucide-react";
import { SearchHistoryPanel } from "@/components/SearchHistoryPanel";
import type { Stats } from "@/lib/presets";

interface DatabaseTabProps {
  stats: Stats | null;
  onReset: () => void;
  currentProject: string;
  cypher: string;
  historyKey: number;
  onSelectQuery: (cypher: string) => void;
}

export function DatabaseTab({
  stats,
  onReset,
  currentProject,
  cypher,
  historyKey,
  onSelectQuery,
}: DatabaseTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {stats && stats.nodeCount > 0 ? (
        <>
          <div className="panel p-3 bg-sidebar/20">
            <div className="flex items-baseline justify-between mb-1">
              <span className="mono text-xl font-bold text-primary">
                {stats.nodeCount.toLocaleString("en-US")}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                nodes
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-3">
              <span className="mono text-xl font-bold text-accent">
                {stats.edgeCount.toLocaleString("en-US")}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                edges
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(stats.kinds).map(([kind, count]) => (
                <span
                  key={kind}
                  className="mono rounded border border-border/50 bg-muted/60 px-1.5 py-0.5 text-[10px]"
                >
                  {kind} <span className="text-muted-foreground ml-1">{count}</span>
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onReset}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear dataset
          </button>
        </>
      ) : (
        <div className="flex items-center justify-center py-6 text-center">
          <p className="text-xs text-muted-foreground">
            No graph data loaded.
            <br />
            Use the Upload icon to ingest JSON.
          </p>
        </div>
      )}
      <SearchHistoryPanel
        project={currentProject}
        currentCypher={cypher}
        refreshKey={historyKey}
        onSelect={(next) => onSelectQuery(next)}
      />
    </div>
  );
}
