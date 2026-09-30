import { useEffect, useRef, useState } from "react";
import {
  Check,
  Plus,
  Upload,
  X,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { fetchEdgeDocs, uploadEdgeDocs, removeEdgeDoc } from "@/lib/graph.functions";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import type { EdgeDocInfo } from "../SettingsDialog";

export function EdgeSection() {
  const [saving, setSaving] = useState(false);
  const [edgeName, setEdgeName] = useState("");
  const [edgeDocs, setEdgeDocs] = useState("");
  const [editingEdge, setEditingEdge] = useState<string | null>(null);
  const [previewEdge, setPreviewEdge] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [edgeDocList, setEdgeDocList] = useState<EdgeDocInfo[]>([]);
  const edgeFileRef = useRef<HTMLInputElement>(null);

  const loadEdgeDocs = useServerFn(fetchEdgeDocs);
  const addEdgeDocs = useServerFn(uploadEdgeDocs);
  const deleteEdgeDocFn = useServerFn(removeEdgeDoc);

  const refreshEdgeDocs = async () => {
    try {
      const list = await loadEdgeDocs();
      setEdgeDocList(list as EdgeDocInfo[]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void refreshEdgeDocs();
  }, []);

  const resetEdgeForm = () => {
    setEditingEdge(null);
    setEdgeName("");
    setEdgeDocs("");
  };

  const saveEdgeDoc = async () => {
    const name = edgeName.trim();
    if (!name || !edgeDocs.trim()) {
      setMessage("Enter an edge name and Markdown docs first.");
      return;
    }
    setSaving(true);
    try {
      await addEdgeDocs({ data: { docs: [{ name, md_docs: edgeDocs }] } });
      if (editingEdge && editingEdge !== name) {
        await deleteEdgeDocFn({ data: { name: editingEdge } });
      }
      setMessage(editingEdge ? `Updated docs for ${name}.` : `Saved docs for ${name}.`);
      resetEdgeForm();
      await refreshEdgeDocs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save edge docs.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdgeUpload = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const docs = Array.isArray(parsed)
        ? parsed
        : ((parsed as { docs?: unknown[] }).docs ?? [parsed]);
      const normalized = docs.map((item) => {
        const value = item as Record<string, unknown>;
        const name = String(value.name ?? "").trim();
        const md_docs = String(value.md_docs ?? value.markdown ?? "");
        if (!name || !md_docs) throw new Error("Each edge document needs name and md_docs.");
        return { name, md_docs };
      });
      await addEdgeDocs({ data: { docs: normalized } });
      setMessage("Edge docs imported.");
      await refreshEdgeDocs();
      if (edgeFileRef.current) edgeFileRef.current.value = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid edge docs JSON.");
    }
  };

  const startEditEdge = (doc: EdgeDocInfo) => {
    setEditingEdge(doc.name);
    setEdgeName(doc.name);
    setEdgeDocs(doc.md_docs);
    setMessage("");
  };

  const deleteEdge = async (name: string) => {
    if (saving) return;
    if (!confirm(`Delete edge docs for "${name}"?`)) return;
    setSaving(true);
    try {
      await deleteEdgeDocFn({ data: { name } });
      if (editingEdge === name) resetEdgeForm();
      if (previewEdge === name) setPreviewEdge(null);
      setMessage(`Deleted docs for ${name}.`);
      await refreshEdgeDocs();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold">Edge documentation</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Markdown docs shown when an edge is inspected on the graph. Docs are matched by edge
          name, e.g. <code>MemberOf</code>.
        </p>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/10 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {editingEdge ? `Editing: ${editingEdge}` : "Add new edge docs"}
          </p>
          {editingEdge && (
            <button
              onClick={resetEdgeForm}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
              Cancel edit
            </button>
          )}
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Edge name
          <input
            value={edgeName}
            onChange={(e) => setEdgeName(e.target.value)}
            placeholder="MemberOf"
            className="h-9 rounded-md border border-input bg-background px-3 font-mono text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Markdown documentation
          <textarea
            value={edgeDocs}
            onChange={(e) => setEdgeDocs(e.target.value)}
            placeholder="What this edge means, abuse steps, references…"
            rows={7}
            className="resize-y rounded-md border border-input bg-background p-3 font-mono text-xs"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void saveEdgeDoc()}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {editingEdge ? <Check className="size-4" /> : <Plus className="size-4" />}
            {editingEdge ? "Save changes" : "Save docs"}
          </button>
          <input
            ref={edgeFileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleEdgeUpload(file);
            }}
          />
          <button
            onClick={() => edgeFileRef.current?.click()}
            disabled={saving}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <Upload className="size-4" />
            Upload JSON
          </button>
          <span className="text-[11px] text-muted-foreground">
            JSON accepts a single object, an array, or {"{ docs: [...] }"} with <code>name</code>{" "}
            + <code>md_docs</code>.
          </span>
        </div>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Saved edge docs ({edgeDocList.length})
        </p>
        {edgeDocList.length ? (
          edgeDocList.map((doc) => (
            <div
              key={doc.name}
              className={`rounded-md border px-3 py-2 ${
                editingEdge === doc.name ? "border-primary bg-primary/5" : "border-border bg-muted/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewEdge(previewEdge === doc.name ? null : doc.name)}
                  aria-label={`Preview ${doc.name}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  {previewEdge === doc.name ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate font-mono text-xs font-medium">{doc.name}</span>
                </button>
                <button
                  onClick={() => startEditEdge(doc)}
                  aria-label={`Edit ${doc.name}`}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => void deleteEdge(doc.name)}
                  disabled={saving}
                  aria-label={`Delete ${doc.name}`}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {previewEdge === doc.name && (
                <div className="mt-2 max-h-56 overflow-y-auto border-t border-border pt-2">
                  <SafeMarkdown source={doc.md_docs} />
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            No edge docs saved yet — add one above or upload a JSON file.
          </p>
        )}
      </div>
    </div>
  );
}
