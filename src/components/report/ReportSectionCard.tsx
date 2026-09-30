import { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, Loader2, Table, Pencil, Trash2, Save, Check } from "lucide-react";
import { GraphCanvas } from "@/components/GraphCanvas";
import { SearchAutocomplete } from "@/components/SearchAutocomplete";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { NodeDetailsSheet } from "./NodeDetailsSheet";
import { renderQuery, type ReportSection } from "@/lib/report-sections";
import { queryGraph } from "@/lib/graph.functions";
import type { NodeIconSpec } from "@/lib/node-icons";
import { rowsToElements } from "@/lib/graph-elements";
import { nodeRows } from "@/lib/analyst";
import { useInView } from "@/hooks/use-in-view";

interface ReportSectionCardProps {
  section: ReportSection;
  project: string;
  icons?: Record<string, NodeIconSpec>;
  onEdit?: () => void;
  onDelete?: () => void;
  onSaveDefaultValue?: (newValue: string) => Promise<void>;
}

export function ReportSectionCard({
  section,
  project,
  icons,
  onEdit,
  onDelete,
  onSaveDefaultValue,
}: ReportSectionCardProps) {
  const [inputValue, setInputValue] = useState<string>(section.defaultValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [savingDefault, setSavingDefault] = useState(false);
  const [savedDefaultSuccess, setSavedDefaultSuccess] = useState(false);

  // Defer the initial query and the (heavy) Cytoscape canvas until this card
  // scrolls into view. Opening a report with many sections would otherwise fire
  // every query and build every graph instance at once — the RAM/CPU spike.
  const { ref: cardRef, inView } = useInView<HTMLDivElement>();

  const elements = useMemo(() => {
    return rowsToElements(rows);
  }, [rows]);

  const nodes = useMemo(() => {
    return nodeRows(rows);
  }, [rows]);

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const firstRow = rows[0];
    const hasCountColumn =
      firstRow && Object.keys(firstRow).some((k) => k.toLowerCase().startsWith("count"));

    if (hasCountColumn) {
      for (const row of rows) {
        let labelKey = "";
        let countVal: any = undefined;

        for (const k of Object.keys(row)) {
          const lowerK = k.toLowerCase();
          if (lowerK.startsWith("count")) {
            countVal = row[k];
          }
          if (
            lowerK === "type" ||
            lowerK === "kind" ||
            lowerK.includes("type(") ||
            lowerK.includes(".kind") ||
            lowerK.includes(".type")
          ) {
            labelKey = String(row[k]);
          }
        }

        const key = labelKey || "Base";
        const increment = Number(countVal) || 1;
        counts[key] = (counts[key] || 0) + increment;
      }
    } else {
      for (const node of nodes) {
        const k = node.kind || "Base";
        counts[k] = (counts[k] || 0) + 1;
      }
    }
    return counts;
  }, [rows, nodes]);

  const run = useCallback(
    async (valueToUse: string) => {
      setLoading(true);
      setError("");
      try {
        const cypher = renderQuery(section.query, valueToUse);
        const result = await queryGraph({ data: { cypher, project } });
        if (result.ok) {
          const parsed = JSON.parse(result.rowsJson);
          setRows(parsed);
        } else {
          setError(result.error || "Query failed");
          setRows([]);
        }
      } catch (err) {
        console.error("Query failed", err);
        setError(err instanceof Error ? err.message : "Query failed");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [section.query, project],
  );

  // Initial load — only once the card is on screen (see useInView above).
  useEffect(() => {
    if (inView) run(section.defaultValue);
  }, [inView, run, section.defaultValue]);

  const handleRefresh = () => {
    run(inputValue);
  };

  const handleSelectNode = (name: string) => {
    setInputValue(name);
    run(name);
  };

  const handleSaveDefault = async () => {
    if (!onSaveDefaultValue) return;
    setSavingDefault(true);
    try {
      await onSaveDefaultValue(inputValue);
      setSavedDefaultSuccess(true);
      setTimeout(() => setSavedDefaultSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save default value", err);
    } finally {
      setSavingDefault(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className="panel border border-border bg-card rounded-lg shadow-sm flex flex-col gap-4 p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight">{section.title}</h3>
          {onSaveDefaultValue && section.inputType !== "none" && (
            <button
              onClick={handleSaveDefault}
              disabled={savingDefault}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                savedDefaultSuccess
                  ? "border-green-500/50 bg-green-500/10 text-green-500"
                  : "border-border bg-muted/40 text-muted-foreground hover:border-primary hover:text-primary"
              }`}
              title="Save current input value as new default value"
            >
              {savingDefault ? (
                <Loader2 className="size-3 animate-spin" />
              ) : savedDefaultSuccess ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Save className="size-3" />
              )}
              <span>{savedDefaultSuccess ? "Saved!" : "Save default"}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {onEdit && (
            <button
              onClick={onEdit}
              className="control flex h-8 w-8 items-center justify-center rounded-md hover:border-primary text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              title="Edit section"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="control flex h-8 w-8 items-center justify-center rounded-md hover:border-destructive text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              title="Delete section"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="control flex h-8 w-8 items-center justify-center rounded-md hover:border-primary text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            title="Refresh view"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
        <SafeMarkdown source={section.description} />
      </div>

      {section.inputType !== "none" && (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[70px]">
          Input:
        </span>
        <div className="flex-1 flex items-center gap-3">
          {section.inputType === "node" ? (
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <div className="min-w-[200px] flex-1">
                <SearchAutocomplete
                  runQuery={queryGraph}
                  onSelect={() => {}}
                  onSelectSuggestion={(s) => handleSelectNode(s.name)}
                  project={project}
                />
              </div>
              {inputValue && (
                <span className="text-xs px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary font-medium">
                  Active: {inputValue}
                </span>
              )}
            </div>
          ) : (
            <input
              type={
                section.inputType === "number"
                  ? "number"
                  : section.inputType === "date"
                    ? "date"
                    : "text"
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRefresh();
              }}
              className="flex-1 rounded border border-border bg-card/50 px-3 py-1.5 text-xs outline-none focus:border-primary min-h-[36px]"
              placeholder={`Enter ${section.inputType}...`}
            />
          )}
        </div>
      </div>
      )}

      <div className="relative border border-border rounded-lg bg-background/50 overflow-hidden h-[350px]">
        {!inView || (loading && elements.length === 0) ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/75 z-10">
            <Loader2 className="animate-spin size-6 text-primary" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center text-destructive text-xs px-4 text-center">
            Error: {error}
          </div>
        ) : elements.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            No graph results. Try changing the input.
          </div>
        ) : (
          <GraphCanvas
            elements={elements}
            icons={icons}
            onSelect={(node) => {
              if (node && !node.source) {
                const name = node.props?.name || node.label;
                if (name) {
                  handleSelectNode(name);
                }
              }
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
        {Object.entries(kindCounts).map(([kind, count]) => (
          <span
            key={kind}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium border border-border"
          >
            <span
              className={`size-1.5 rounded-full bg-kind-${kind.toLowerCase()} text-kind-${kind.toLowerCase()}`}
            />
            {kind}: {count}
          </span>
        ))}
        {nodes.length > 0 && (
          <button
            onClick={() => setDetailsOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border border-primary/20 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary rounded transition-colors cursor-pointer ml-auto"
          >
            <Table className="size-3.5" />
            Details
          </button>
        )}
      </div>

      <NodeDetailsSheet open={detailsOpen} onOpenChange={setDetailsOpen} rows={nodes} />
    </div>
  );
}
