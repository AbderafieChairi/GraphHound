import { useMemo, useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NodeKindTable } from "./NodeKindTable";

interface NodeDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: Record<string, any>[];
}

export function NodeDetailsSheet({ open, onOpenChange, rows }: NodeDetailsSheetProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, Record<string, any>[]> = {};
    const seenSids = new Set<string>();

    const addNode = (node: any) => {
      if (!node || typeof node !== "object" || !node.objectid) return;
      if (seenSids.has(node.objectid)) return;
      seenSids.add(node.objectid);

      const kind = node.kind || "Base";
      if (!groups[kind]) {
        groups[kind] = [];
      }
      // Ensure we push properties directly for the table mapper
      groups[kind].push(node);
    };

    for (const row of rows) {
      if (row.objectid) {
        // Direct flat node
        addNode(row);
      } else {
        // Look for nested nodes (e.g. source, target, node, or other object attributes)
        if (row.node && typeof row.node === "object") {
          addNode(row.node);
        }
        if (row.source && typeof row.source === "object") {
          addNode(row.source);
        }
        if (row.target && typeof row.target === "object") {
          addNode(row.target);
        }
        for (const [key, val] of Object.entries(row)) {
          if (["node", "source", "target"].includes(key)) continue;
          if (val && typeof val === "object" && (val as any).objectid) {
            addNode(val);
          }
        }
      }
    }
    return groups;
  }, [rows]);

  const kinds = useMemo(() => {
    return Object.keys(grouped).sort();
  }, [grouped]);

  const [activeTab, setActiveTab] = useState<string>("");

  // Update active tab when the available kinds change (e.g. default to first kind)
  useEffect(() => {
    if (kinds.length > 0) {
      setActiveTab(kinds[0] || "");
    } else {
      setActiveTab("");
    }
  }, [kinds]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[75vh] max-h-[85vh] p-0 flex flex-col focus-visible:outline-none"
      >
        <SheetHeader className="px-6 py-4 border-b border-border flex-row items-center justify-between shrink-0">
          <SheetTitle className="text-lg font-semibold">Node Details</SheetTitle>
        </SheetHeader>

        {kinds.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            No node data available.
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-6 py-2 border-b border-border bg-muted/20 shrink-0">
              <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
                {kinds.map((kind) => (
                  <TabsTrigger
                    key={kind}
                    value={kind}
                    className="data-active:bg-background border border-transparent data-active:border-border rounded px-3 py-1.5 text-xs font-medium"
                  >
                    {kind} ({grouped[kind]?.length ?? 0})
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex-1 min-h-0 px-6 py-4 flex flex-col">
              {kinds.map((kind) => (
                <TabsContent
                  key={kind}
                  value={kind}
                  className="flex-1 min-h-0 flex flex-col data-inactive:hidden focus-visible:outline-none"
                >
                  <NodeKindTable kind={kind} rows={grouped[kind] || []} />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
