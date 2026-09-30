import { useRef } from "react";
import { Database, Loader2, X } from "lucide-react";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  ingesting: boolean;
  progress: string;
  onFiles: (files: FileList | null) => void;
}

export function UploadModal({ open, onClose, ingesting, progress, onFiles }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="panel relative w-[400px] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-primary"
        >
          <X className="size-5" />
        </button>
        <h2 className="text-lg font-semibold mb-4">Upload Dataset</h2>
        <div className="flex flex-col gap-4">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={ingesting}
            className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-card/50 px-3 py-10 text-center text-sm transition-colors hover:border-primary hover:bg-card disabled:opacity-60"
          >
            {ingesting ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
            ) : (
              <Database className="h-6 w-6 text-primary mb-2" />
            )}
            <span className="font-medium">Drop SharpHound JSON</span>
            <span className="mono text-[11px] text-muted-foreground mt-1">
              users · groups · computers · gpos · ous · containers
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            multiple
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
          {progress && <p className="mono text-[11px] text-primary text-center">{progress}</p>}
        </div>
      </div>
    </div>
  );
}
