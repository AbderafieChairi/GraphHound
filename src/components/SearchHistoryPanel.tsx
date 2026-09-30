/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2, Play, Star, Trash2, Edit2 } from "lucide-react";
import {
  fetchSavedQueries,
  fetchSearchHistory,
  clearSearchHistoryFn,
  removeSavedQuery,
  saveQuery,
  renameSavedQuery,
} from "@/lib/graph.functions";

type HistoryEntry = { id: number; project: string; cypher: string; created_at: number };
type SavedQueryEntry = { id: number; name: string; cypher: string; created_at: number };

const PAGE_SIZE = 10;
const MORE_SIZE = 3;

export function SearchHistoryPanel({
  project,
  currentCypher,
  onSelect,
  refreshKey,
}: {
  project: string;
  currentCypher: string;
  onSelect: (cypher: string) => void;
  refreshKey: number;
}) {
  const listHistory = useServerFn(fetchSearchHistory);
  const clearHistory = useServerFn(clearSearchHistoryFn);
  const listSaved = useServerFn(fetchSavedQueries);
  const createSaved = useServerFn(saveQuery);
  const deleteSaved = useServerFn(removeSavedQuery);
  const renameSaved = useServerFn(renameSavedQuery);

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<SavedQueryEntry[]>([]);
  const [name, setName] = useState("");
  const [savingOpen, setSavingOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(
    async (offset: number, limit: number, replace: boolean) => {
      setLoading(true);
      try {
        const rows = (await listHistory({ data: { project, limit, offset } })) as HistoryEntry[];
        setEntries((prev) => (replace ? rows : [...prev, ...rows]));
        if (rows.length < limit) setDone(true);
      } catch {
        setDone(true);
      } finally {
        setLoading(false);
      }
    },
    [listHistory, project],
  );

  const reloadSaved = useCallback(async () => {
    try {
      setSaved((await listSaved({ data: { project } })) as SavedQueryEntry[]);
    } catch {
      /* ignore */
    }
  }, [listSaved, project]);

  useEffect(() => {
    setDone(false);
    void loadPage(0, PAGE_SIZE, true);
    void reloadSaved();
  }, [loadPage, reloadSaved, refreshKey]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || loading || done) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) {
      void loadPage(entries.length, MORE_SIZE, false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search history */}
      <div className="panel p-3 bg-sidebar/20">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Search history
          </span>
          <button
            onClick={async () => {
              await clearHistory({ data: { project } });
              setEntries([]);
              setDone(true);
            }}
            className="text-[10px] text-muted-foreground transition-colors hover:text-destructive"
          >
            Clear
          </button>
        </div>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="max-h-[180px] overflow-y-auto pr-1 flex flex-col gap-1"
        >
          {entries.length === 0 && !loading && (
            <p className="text-[11px] text-muted-foreground">No queries yet.</p>
          )}
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry.cypher)}
              title={entry.cypher}
              className="rounded border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border hover:bg-muted/50"
            >
              <span className="mono block truncate text-[11px] text-foreground/85">
                {entry.cypher}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {new Date(entry.created_at).toLocaleString("en-US")}
              </span>
            </button>
          ))}
          {loading && (
            <div className="flex justify-center py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Saved queries */}
      <div className="panel p-3 bg-sidebar/20">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Star className="h-3.5 w-3.5" /> Saved queries
          </span>
          <button
            onClick={() => setSavingOpen((open) => !open)}
            className="text-[10px] text-muted-foreground transition-colors hover:text-primary"
          >
            {savingOpen ? "Cancel" : "Save current"}
          </button>
        </div>

        {savingOpen && (
          <div className="mb-2 flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Query name"
              className="flex-1 rounded border border-border bg-card/50 px-2 py-1.5 text-[11px] outline-none focus:border-primary"
            />
            <button
              disabled={!name.trim() || !currentCypher.trim()}
              onClick={async () => {
                await createSaved({
                  data: { project, name: name.trim(), cypher: currentCypher },
                });
                setName("");
                setSavingOpen(false);
                void reloadSaved();
              }}
              className="rounded bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
          </div>
        )}

        <div className="max-h-[180px] overflow-y-auto pr-1 flex flex-col gap-1">
          {saved.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No saved queries.</p>
          )}
          {saved.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-1 rounded border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                {editingId === item.id ? (
                  <div className="flex gap-1">
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 rounded border border-border bg-card/50 px-2 py-1 text-[11px] outline-none"
                    />
                    <button
                      disabled={!editingName.trim()}
                      onClick={async () => {
                        await renameSaved({ data: { id: item.id, name: editingName.trim() } });
                        setEditingId(null);
                        setEditingName("");
                        void reloadSaved();
                      }}
                      className="text-[11px] text-primary font-semibold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditingName("");
                      }}
                      className="text-[11px] text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="block truncate text-[11px] font-medium">{item.name}</span>
                    <span className="mono block truncate text-[10px] text-muted-foreground">
                      {item.cypher}
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => onSelect(item.cypher)}
                className="text-muted-foreground transition-colors hover:text-primary"
                title="Run"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
              {editingId !== item.id && (
                <button
                  onClick={() => {
                    setEditingId(item.id);
                    setEditingName(item.name);
                  }}
                  className="mr-1 text-muted-foreground transition-colors hover:text-primary"
                  title="Rename"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={async () => {
                  await deleteSaved({ data: { id: item.id } });
                  void reloadSaved();
                }}
                className="text-muted-foreground transition-colors hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
