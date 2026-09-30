import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { DbReport } from "@/lib/env-registry";

interface ReportFormModalProps {
  open: boolean;
  /** The report being edited, or null when creating a new one. */
  editing: DbReport | null;
  onClose: () => void;
  onSave: (title: string, description: string) => void;
}

/** Create/edit dialog for a report's title and description. */
export function ReportFormModal({ open, editing, onClose, onSave }: ReportFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Sync the form to the entity being edited each time the dialog opens.
  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setDescription(editing?.description ?? "");
    }
  }, [open, editing]);

  if (!open || typeof window === "undefined") return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), description.trim());
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="panel relative w-full max-w-md p-6 shadow-2xl bg-card border border-border rounded-lg">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-primary"
        >
          <X className="size-4" />
        </button>
        <h3 className="text-base font-semibold mb-4">
          {editing ? "Edit Report" : "Create New Report"}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Report Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Executive Security Audit"
              className="w-full rounded border border-border bg-card/50 px-3 py-2 text-xs outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide brief context for this report notebook..."
              className="w-full rounded border border-border bg-card/50 px-3 py-2 text-xs outline-none focus:border-primary h-20 resize-none"
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
              {editing ? "Save Changes" : "Create Report"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
