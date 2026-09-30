import { useEffect, useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { uploadAnalysisFile, fetchAnalysisFiles, removeAnalysisFile } from "@/lib/graph.functions";

interface AnalysisSectionProps {
  onAnalysisChange?: () => void;
}

export function AnalysisSection({ onAnalysisChange }: AnalysisSectionProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [analysisFiles, setAnalysisFiles] = useState<{ id: number; filename: string; filepath: string }[]>([]);
  const analysisFileRef = useRef<HTMLInputElement>(null);

  const uploadAnalysis = useServerFn(uploadAnalysisFile);
  const loadAnalysisFiles = useServerFn(fetchAnalysisFiles);
  const deleteAnalysisFn = useServerFn(removeAnalysisFile);

  const refreshAnalysisFiles = async () => {
    try {
      const list = await loadAnalysisFiles();
      setAnalysisFiles(list as { id: number; filename: string; filepath: string }[]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void refreshAnalysisFiles();
  }, []);

  const handleAnalysisUpload = async (file: File) => {
    try {
      const content = await file.text();
      // Use file.name for both filepath and filename
      await uploadAnalysis({ data: { filename: file.name, filepath: file.name, content } });
      setMessage(`Analysis file "${file.name}" uploaded.`);
      if (analysisFileRef.current) analysisFileRef.current.value = "";
      await refreshAnalysisFiles();
      if (onAnalysisChange) onAnalysisChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid cypher file.");
    }
  };

  const deleteAnalysisFileItem = async (id: number, name: string) => {
    if (saving) return;
    if (!confirm(`Delete custom analysis file "${name}"?`)) return;
    setSaving(true);
    try {
      await deleteAnalysisFn({ data: { id } });
      setMessage(`Deleted "${name}".`);
      await refreshAnalysisFiles();
      if (onAnalysisChange) onAnalysisChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete analysis file.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold">Custom Analysis Queries</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Upload custom <code>.cypher</code> files to group queries into collapsible sections. If a
          file with the same name is re-uploaded, it will overwrite the existing queries.
        </p>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/10 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Upload Custom .cypher File
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={analysisFileRef}
            type="file"
            accept=".cypher"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAnalysisUpload(file);
            }}
          />
          <button
            onClick={() => analysisFileRef.current?.click()}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            <Upload className="size-4" />
            Upload .cypher File
          </button>
        </div>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Uploaded Custom Files ({analysisFiles.filter((f) => f.filepath !== "").length})
        </p>
        {analysisFiles.filter((f) => f.filepath !== "").length ? (
          analysisFiles
            .filter((f) => f.filepath !== "")
            .map((file) => (
              <div key={file.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-medium font-mono">{file.filename}</span>
                  <button
                    onClick={() => void deleteAnalysisFileItem(file.id, file.filename)}
                    disabled={saving}
                    aria-label={`Delete ${file.filename}`}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))
        ) : (
          <p className="text-xs text-muted-foreground">No custom analysis files uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
