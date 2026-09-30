import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { DbReportSection } from "@/lib/env-registry";
import type { ReportInputType } from "@/lib/report-sections";
import type { SectionInput } from "@/hooks/use-reports";

const DEFAULT_QUERY =
  "MATCH (a:Base)-[r]->(b:Base) WHERE a.name CONTAINS '%var1' RETURN a AS source, type(r) AS edge, b AS target LIMIT 150";

interface SectionFormModalProps {
  open: boolean;
  /** The section being edited, or null when adding a new one. */
  editing: DbReportSection | null;
  onClose: () => void;
  onSave: (data: SectionInput) => void;
}

/** Create/edit dialog for a single report section (a notebook cell). */
export function SectionFormModal({ open, editing, onClose, onSave }: SectionFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [inputType, setInputType] = useState<ReportInputType>("node");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description);
      setQuery(editing.query);
      setDefaultValue(editing.defaultValue);
      setInputType(editing.inputType);
    } else {
      setTitle("");
      setDescription("");
      setQuery(DEFAULT_QUERY);
      setDefaultValue("DOMAIN ADMINS");
      setInputType("node");
    }
  }, [open, editing]);

  if (!open || typeof window === "undefined") return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !query.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      query: query.trim(),
      defaultValue: defaultValue.trim(),
      inputType,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="panel relative w-full max-w-lg p-6 shadow-2xl bg-card border border-border rounded-lg max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-primary"
        >
          <X className="size-4" />
        </button>
        <h3 className="text-base font-semibold mb-4">
          {editing ? "Edit Section" : "Add Section to Report"}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Section Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Domain Admins Membership"
              className="w-full rounded border border-border bg-card/50 px-3 py-2 text-xs outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Markdown Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="# Description\nExplain what this cell queries..."
              className="w-full rounded border border-border bg-card/50 px-3 py-2 text-xs outline-none focus:border-primary h-20 resize-none font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Input Control Type *
              </label>
              <select
                value={inputType}
                onChange={(e) => {
                  const next = e.target.value as ReportInputType;
                  setInputType(next);
                  // A static query takes no input, so clear any default value.
                  if (next === "none") setDefaultValue("");
                }}
                className="w-full rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option value="none">none (Static query, no input)</option>
                <option value="node">node (Search Autocomplete)</option>
                <option value="string">string (Text Input)</option>
                <option value="number">number (Numeric Input)</option>
                <option value="date">date (Date Picker Input)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Default Input Value
              </label>
              <input
                type="text"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                disabled={inputType === "none"}
                placeholder={
                  inputType === "none"
                    ? "Not applicable for static queries"
                    : "e.g. DOMAIN ADMINS or 1600000000"
                }
                className="w-full rounded border border-border bg-card/50 px-3 py-2 text-xs outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Templated Cypher Query * (%var1 is replaced by input)
            </label>
            <textarea
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="MATCH (a:Base)-[r:MemberOf]->(g:Base) WHERE g.name CONTAINS '%var1' RETURN a AS source, type(r) AS edge, g AS target LIMIT 150"
              className="w-full rounded border border-border bg-card/50 px-3 py-2 text-xs outline-none focus:border-primary h-28 resize-none font-mono text-[11px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-muted-foreground hover:bg-muted font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
            >
              {editing ? "Save Changes" : "Create Section"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
