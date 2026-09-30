/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftToLine, ArrowRightFromLine, ChevronRight, Loader2 } from "lucide-react";

type QueryFn = (args: { data: { cypher: string; project?: string } }) => Promise<{
  ok: boolean;
  error: string;
  rowsJson: string;
}>;

type Direction = "outbound" | "inbound";

type Group = {
  type: string;
  count: number;
  nodes: Record<string, any>[];
  loading: boolean;
  open: boolean;
};

const PAGE = 10;

const esc = (value: string) => value.replace(/'/g, "''");

function groupCypher(direction: Direction, objectid: string) {
  const where = direction === "outbound" ? "a.objectid" : "b.objectid";
  return `MATCH (a:Base)-[r]->(b:Base) WHERE ${where} = '${esc(objectid)}' RETURN type(r) AS edge, count(r) AS count ORDER BY count DESC`;
}

function nodesCypher(direction: Direction, objectid: string, type: string, limit: number) {
  const safeType = type.replace(/[^A-Za-z0-9_]/g, "");
  return direction === "outbound"
    ? `MATCH (a:Base)-[r:${safeType}]->(b:Base) WHERE a.objectid = '${esc(objectid)}' RETURN b AS target LIMIT ${limit}`
    : `MATCH (a:Base)-[r:${safeType}]->(b:Base) WHERE b.objectid = '${esc(objectid)}' RETURN a AS source LIMIT ${limit}`;
}

export function NodeRelationships({
  objectid,
  runQuery,
  onSelectNode,
  project,
}: {
  objectid: string;
  runQuery: QueryFn;
  onSelectNode?: (node: Record<string, any>) => void;
  project?: string;
}) {
  const [groups, setGroups] = useState<Record<Direction, Group[]>>({
    outbound: [],
    inbound: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setGroups({ outbound: [], inbound: [] });
    (async () => {
      try {
        const [out, inb] = await Promise.all([
          runQuery({ data: { cypher: groupCypher("outbound", objectid), project } }),
          runQuery({ data: { cypher: groupCypher("inbound", objectid), project } }),
        ]);
        if (cancelled) return;
        if (!out.ok || !inb.ok) {
          setError(out.error || inb.error);
          return;
        }
        const toGroups = (json: string): Group[] =>
          (JSON.parse(json) as Record<string, any>[]).map((row) => ({
            type: String(row.edge ?? "RELATED"),
            count: Number(row.count ?? 0),
            nodes: [],
            loading: false,
            open: false,
          }));
        setGroups({ outbound: toGroups(out.rowsJson), inbound: toGroups(inb.rowsJson) });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objectid, runQuery, project]);

  const patch = useCallback((direction: Direction, type: string, next: Partial<Group>) => {
    setGroups((old) => ({
      ...old,
      [direction]: old[direction].map((g) => (g.type === type ? { ...g, ...next } : g)),
    }));
  }, []);

  const load = useCallback(
    async (direction: Direction, group: Group, limit: number) => {
      patch(direction, group.type, { loading: true, open: true });
      try {
        const result = await runQuery({
          data: { cypher: nodesCypher(direction, objectid, group.type, limit), project },
        });
        if (!result.ok) {
          setError(result.error);
          patch(direction, group.type, { loading: false });
          return;
        }
        const rows = JSON.parse(result.rowsJson) as Record<string, any>[];
        const nodes = rows
          .map((row) => (direction === "outbound" ? row.target : row.source))
          .filter(Boolean) as Record<string, any>[];
        patch(direction, group.type, { nodes, loading: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
        patch(direction, group.type, { loading: false });
      }
    },
    [objectid, patch, runQuery, project],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Loading relationships…
      </div>
    );
  }

  const section = (direction: Direction) => {
    const list = groups[direction];
    return (
      <div className="mt-4">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {direction === "outbound" ? (
            <ArrowRightFromLine className="size-3" />
          ) : (
            <ArrowLeftToLine className="size-3" />
          )}
          {direction} relationships
        </div>
        {!list.length ? (
          <p className="mt-2 text-[11px] text-muted-foreground/70">None</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1">
            {list.map((group) => (
              <div key={group.type} className="rounded-md border border-border/60">
                <button
                  onClick={() =>
                    group.open
                      ? patch(direction, group.type, { open: false })
                      : void load(direction, group, PAGE)
                  }
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs hover:bg-muted/50"
                >
                  <ChevronRight
                    className={`size-3.5 shrink-0 transition-transform ${group.open ? "rotate-90" : ""}`}
                  />
                  <span className="mono truncate font-medium text-primary">{group.type}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {group.count} {group.count === 1 ? "node" : "nodes"}
                  </span>
                </button>
                {group.open ? (
                  <div className="border-t border-border/50 px-2.5 py-2">
                    {group.loading && !group.nodes.length ? (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> Loading…
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {group.nodes.map((node, index) => (
                          <li key={`${String(node.objectid)}-${index}`}>
                            <button
                              onClick={() => onSelectNode?.(node)}
                              className="mono w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-foreground/85 hover:bg-muted/60 hover:text-primary"
                              title={String(node.name ?? node.objectid)}
                            >
                              <span className="text-muted-foreground/70">
                                {String(node.kind ?? "Base")}
                              </span>{" "}
                              {String(node.name ?? node.objectid)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {group.nodes.length < group.count ? (
                      <button
                        onClick={() => void load(direction, group, group.nodes.length + PAGE)}
                        disabled={group.loading}
                        className="mt-1.5 w-full rounded border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        {group.loading
                          ? "Loading…"
                          : `More (${group.count - group.nodes.length} remaining)`}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {error ? <p className="mono text-[11px] text-destructive">{error}</p> : null}
      {section("outbound")}
      {section("inbound")}
    </div>
  );
}
