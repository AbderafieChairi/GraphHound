import { ChevronDown, ChevronUp, History, Play, RotateCcw, Sparkles, Table } from "lucide-react";
import { useMemo, useState } from "react";
import { completeCypher } from "@/lib/analyst";

const MIN_HEIGHT = 110;
const MAX_HEIGHT = 420;

export function QueryComposer({
  value,
  onChange,
  onRun,
  running,
  history,
  onHistory,
  onShowDetails,
  queryResultRows,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  running: boolean;
  history: string[];
  onHistory: (v: string) => void;
  onShowDetails?: () => void;
  queryResultRows?: Record<string, any>[];
}) {
  const [focused, setFocused] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(190);
  const suggestions = useMemo(() => completeCypher(value), [value]);
  const show = focused && suggestions.length > 0;

  // The panel is anchored to the bottom, so dragging the top edge up grows it.
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const start = e.clientY;
    const original = height;
    const max = () => Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, window.innerHeight * 0.6));
    const move = (event: PointerEvent) =>
      setHeight(Math.max(MIN_HEIGHT, Math.min(max(), original + start - event.clientY)));
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };
  return (
    <div className="absolute left-1/2 bottom-4 z-20 w-[min(760px,calc(100%-2rem))] -translate-x-1/2">
      <div
        className={`panel overflow-hidden shadow-2xl  ${collapsed ? " px-4 w-auto mx-auto inline-block border-2 border-primary/20 bg-card hover:border-primary" : "w-full"}`}
      >
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="horizontal"
            title="Drag to resize · double-click to reset"
            onPointerDown={startResize}
            onDoubleClick={() => setHeight(190)}
            className="group flex h-2.5 cursor-row-resize touch-none items-center justify-center"
          >
            <div className="h-1 w-10 rounded-full bg-border transition-colors group-hover:bg-primary" />
          </div>
        )}
        <div
          className={`flex items-center gap-2 px-3 py-2 ${collapsed ? "cursor-pointer" : ""}`}
          onClick={() => {
            if (collapsed) setCollapsed(false);
          }}
        >
          {collapsed ? (
            <div className="flex items-center gap-2 justify-center w-full">
              <span className="font-semibold text-sm">Raw Query</span>
            </div>
          ) : (
            <>
              <Sparkles className="size-4 text-primary" />
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Cipher query
              </span>
              <span className="ml-auto mono text-[10px] text-muted-foreground">Ctrl/⌘ + Enter</span>
              <button
                className="control"
                title={collapsed ? "Expand query" : "Collapse query"}
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed((v) => !v);
                }}
              >
                {collapsed ? <ChevronUp /> : <ChevronDown />}
              </button>
            </>
          )}
        </div>
        {!collapsed ? (
          <div className="border-t border-border p-2 bg-background/95 backdrop-blur">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 150)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  onRun();
                }
                if (e.key === "Tab" && suggestions[0]) {
                  e.preventDefault();
                  onChange(value.replace(/\S*$/, suggestions[0]));
                }
              }}
              spellCheck={false}
              rows={3}
              style={{ height }}
              className="mono w-full resize-none rounded-md border border-input bg-background/80 p-3 text-xs leading-relaxed outline-none focus:border-primary"
            />
            {show ? (
              <div className="flex flex-wrap gap-1 px-1 py-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onMouseDown={() => onChange(value.replace(/\S*$/, s))}
                    className="rounded border border-border bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            {queryResultRows && queryResultRows.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-1 py-1.5 border-t border-border/40 mt-1">
                {(() => {
                  const counts: Record<string, number> = {};
                  const firstRow = queryResultRows[0];
                  const hasCountColumn =
                    firstRow &&
                    Object.keys(firstRow).some((k) => k.toLowerCase().startsWith("count"));

                  if (hasCountColumn) {
                    for (const row of queryResultRows) {
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
                    const uniqueNodes = new Map<string, any>();
                    for (const row of queryResultRows) {
                      for (const val of Object.values(row)) {
                        if (
                          val &&
                          typeof val === "object" &&
                          typeof (val as any).objectid === "string"
                        ) {
                          uniqueNodes.set((val as any).objectid, val);
                        }
                      }
                    }
                    for (const node of uniqueNodes.values()) {
                      const k = node.kind || "Base";
                      counts[k] = (counts[k] || 0) + 1;
                    }
                  }
                  return Object.entries(counts).map(([kind, count]) => (
                    <span
                      key={kind}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 text-[10px] font-medium border border-border/50 text-muted-foreground"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {kind}: {count}
                    </span>
                  ));
                })()}
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={onRun}
                disabled={running}
                className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                <Play className="size-3.5" /> {running ? "Running…" : "Run query"}
              </button>
              {onShowDetails && (
                <button
                  type="button"
                  onClick={onShowDetails}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer"
                  title="View query results as searchable table spreadsheet"
                >
                  <span className="flex items-center gap-1.5">
                    <Table className="size-3.5" />
                    Details
                  </span>
                </button>
              )}
              <button title="Clear query" onClick={() => onChange("")} className="control">
                <RotateCcw />
              </button>
              {history.length ? (
                <div className="ml-auto flex items-center gap-1">
                  <History className="size-3.5 text-muted-foreground" />
                  {history.slice(-3).map((q, i) => (
                    <button
                      key={`${q}-${i}`}
                      onClick={() => onHistory(q)}
                      className="max-w-28 truncate text-[10px] text-muted-foreground hover:text-primary"
                    >
                      {q.split("\n")[0]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
