/* eslint-disable @typescript-eslint/no-explicit-any */
import { NodeRelationships } from "@/components/NodeRelationships";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import type { AnalystTag, TagMap } from "@/lib/analyst";

interface NodeEdgeTabProps {
  selected: Record<string, any> | null;
  selectedEdge: Record<string, any> | null;
  edgeDoc: { name: string; md_docs: string } | null;
  tags: TagMap;
  onToggleTag: (id: string, tag: AnalystTag) => void;
  onSelectNode: (node: Record<string, any>) => void;
  runQuery: any;
  project: string;
}

const ANALYST_TAGS: AnalystTag[] = [
  "Owned",
  "High Privileged",
  "High Value",
  "Critical",
  "Review",
  "False Positive",
];

export function NodeEdgeTab({
  selected,
  selectedEdge,
  edgeDoc,
  tags,
  onToggleTag,
  onSelectNode,
  runQuery,
  project,
}: NodeEdgeTabProps) {
  if (selectedEdge) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="mono text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
            Node/Edge
          </p>
          <p className="break-words text-sm font-semibold">
            {String(selectedEdge.label ?? "Edge")}
          </p>
        </div>
        <div className="h-[1px] w-full bg-border" />
        {edgeDoc?.md_docs ? (
          <SafeMarkdown source={edgeDoc.md_docs} />
        ) : (
          <p className="text-xs text-muted-foreground">No docs for this edge</p>
        )}
      </div>
    );
  }

  if (selected) {
    return (
      <>
        <p className="mono text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
          {String(selected.kind ?? "Node/Edge")}
        </p>
        <p className="break-words text-sm font-semibold">{String(selected.name)}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ANALYST_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => onToggleTag(String(selected.objectid), tag)}
              className={`rounded border px-2 py-1 text-[10px] font-medium transition-colors ${
                tags[String(selected.objectid)]?.includes(tag)
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground/30"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="mt-5 h-[1px] w-full bg-border" />
        <NodeRelationships
          objectid={String(selected.objectid)}
          runQuery={runQuery}
          onSelectNode={onSelectNode}
          project={project}
        />
        <div className="mt-5 h-[1px] w-full bg-border" />
        <dl className="mono mt-4 flex flex-col gap-2.5 text-[11px]">
          {Object.entries(selected)
            .filter(([key]) => !["_nf_id", "name", "kind"].includes(key))
            .map(([key, value]) => (
              <div key={key} className="flex gap-3 border-b border-border/50 pb-2 last:border-0">
                <dt className="w-24 shrink-0 text-muted-foreground/80 font-medium">{key}</dt>
                <dd className="min-w-0 break-words">{String(value)}</dd>
              </div>
            ))}
        </dl>
      </>
    );
  }

  return (
    <div className="flex h-[150px] items-center justify-center text-center">
      <p className="text-xs text-muted-foreground">
        Search for a node or click one
        <br />
        in the graph to view details.
      </p>
    </div>
  );
}
