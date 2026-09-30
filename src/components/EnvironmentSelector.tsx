import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState, useRef } from "react";
import { ChevronDown, Plus, Trash2, Loader2, Building2, Check } from "lucide-react";
import { listEnvs, createEnv, deleteEnv } from "@/lib/graph.functions";

export type EnvironmentInfo = {
  id: string;
  name: string;
  project: string;
  createdAt: number;
};

interface EnvironmentSelectorProps {
  currentProject: string;
  onSwitch: (env: EnvironmentInfo) => void;
}

export function EnvironmentSelector({ currentProject, onSwitch }: EnvironmentSelectorProps) {
  const fetchEnvs = useServerFn(listEnvs);
  const addEnv = useServerFn(createEnv);
  const removeEnv = useServerFn(deleteEnv);

  const [environments, setEnvironments] = useState<EnvironmentInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const envs = await fetchEnvs();
      setEnvironments(envs as EnvironmentInfo[]);
    } catch {
      /* ignore */
    }
  }, [fetchEnvs]);

  useEffect(() => {
    void load();
  }, [load]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const currentEnv = environments.find((e) => e.project === currentProject) ?? environments[0];

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const env = await addEnv({ data: { name: trimmed } });
      setNewName("");
      setCreating(false);
      await load();
      onSwitch(env as EnvironmentInfo);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, envId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this environment? The graph data file will remain on disk.")) return;
    setLoading(true);
    try {
      const targetEnv = environments.find((env) => env.id === envId);
      await removeEnv({ data: { id: envId } });
      await load();
      if (targetEnv && currentProject === targetEnv.project) {
        // Switch back to shared
        const shared = environments.find((env) => env.id === "__shared__");
        if (shared) onSwitch(shared);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="env-selector-trigger"
        onClick={() => setOpen((v) => !v)}
        className="panel flex h-10 items-center gap-2 rounded-md px-3 hover:border-primary text-muted-foreground hover:text-primary transition-colors bg-card shadow-sm text-xs font-medium"
      >
        <Building2 className="size-4 shrink-0" />
        <span className="max-w-[120px] truncate">{currentEnv?.name ?? "Shared"}</span>
        <ChevronDown
          className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-md border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Environments
            </span>
          </div>

          {/* Environment list */}
          <div className="max-h-52 overflow-y-auto py-1">
            {environments.map((env) => (
              <button
                key={env.id}
                onClick={() => {
                  onSwitch(env);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 ${
                  env.project === currentProject ? "text-primary" : "text-foreground/85"
                }`}
              >
                {env.project === currentProject ? (
                  <Check className="size-3.5 shrink-0 text-primary" />
                ) : (
                  <span className="size-3.5 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{env.name}</span>
                {env.id !== "__shared__" && (
                  <button
                    onClick={(e) => void handleDelete(e, env.id)}
                    className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete environment"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </button>
            ))}
          </div>

          {/* Create new */}
          <div className="border-t border-border p-2">
            {creating ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreate();
                }}
                className="flex gap-1.5"
              >
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Environment name…"
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !newName.trim()}
                  className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}
                </button>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-primary"
              >
                <Plus className="size-3.5" />
                New Environment
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
