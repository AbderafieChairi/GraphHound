import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface AnalysisSection {
  sectionId: number;
  sectionName: string;
  filename: string;
  filepath: string;
  queries: { id: number; title: string; cypher: string }[];
}

interface AnalysisTabProps {
  sections: AnalysisSection[];
  onRunQuery: (cypher: string) => void;
}

export function AnalysisTab({ sections, onRunQuery }: AnalysisTabProps) {
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});

  if (sections.length === 0) {
    return (
      <p className="text-xs text-muted-foreground p-3 text-center">No analysis queries loaded.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => {
        const isExpanded = !!expandedSections[section.sectionId];
        return (
          <div
            key={section.sectionId}
            className="flex flex-col border border-border/40 rounded-md overflow-hidden bg-card/30"
          >
            <button
              onClick={() => {
                setExpandedSections((prev) => ({
                  ...prev,
                  [section.sectionId]: !prev[section.sectionId],
                }));
              }}
              className="flex items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-muted/20 hover:bg-muted/40 transition-colors border-b border-border/20"
            >
              <span className="flex items-center gap-1.5 truncate">
                {section.sectionName}
                {section.filepath !== "" && (
                  <span className="text-[10px] text-muted-foreground font-mono font-normal normal-case">
                    ({section.filename})
                  </span>
                )}
              </span>
              {isExpanded ? (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
            </button>
            {isExpanded && (
              <div className="flex flex-col p-1.5 gap-1 bg-background/20">
                {section.queries.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => onRunQuery(q.cypher)}
                    className="rounded-md border border-transparent px-3 py-1.5 text-left text-xs text-foreground/80 transition-all hover:border-border hover:bg-muted/50 hover:text-primary truncate"
                    title={q.title}
                  >
                    {q.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
