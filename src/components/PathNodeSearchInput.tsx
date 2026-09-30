/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { User, Users, Monitor, Folder, FileText, Package, Globe, Circle } from "lucide-react";
import type { NodeSuggestion } from "@/lib/path-search";

const KIND_ICON: Record<string, typeof Circle> = {
  user: User,
  group: Users,
  computer: Monitor,
  ou: Folder,
  gpo: FileText,
  container: Package,
  domain: Globe,
};

const KIND_SET = new Set(Object.keys(KIND_ICON));

/** Debounced node-name search box used to pick the start/end node of a path. */
export function PathNodeSearchInput({
  label,
  value,
  onSelect,
  runQuery,
  project,
}: {
  label: string;
  value: NodeSuggestion | null;
  onSelect: (node: NodeSuggestion) => void;
  runQuery: any;
  project?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setSuggestions([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const safe = query.replace(/'/g, "''");
        const cypher = `MATCH (n:Base) WHERE toLower(n.name) CONTAINS '${safe.toLowerCase()}' OR n.objectid = '${safe}' RETURN n LIMIT 10`;
        const result = await runQuery({ data: { cypher, project } });
        if (result.ok) {
          const parsed = JSON.parse(result.rowsJson) as Record<string, any>[];
          const results = parsed.map((row: any) => {
            const node = row?.n ?? Object.values(row ?? {})[0];
            return {
              objectid: String(node.objectid),
              name: String(node.name),
              kind: String(node.kind),
            };
          });
          setSuggestions(results);
        }
      } catch (e) {
        console.error("Path finder search failed", e);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query, runQuery, project]);

  const getIcon = (kind: string) => KIND_ICON[kind?.toLowerCase() || ""] ?? Circle;

  const getColorClass = (kind: string) => {
    const k = kind?.toLowerCase() || "";
    return KIND_SET.has(k)
      ? `text-kind-${k} bg-kind-${k}`
      : "text-muted-foreground bg-muted-foreground";
  };

  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            className="w-full rounded border border-border bg-card/50 px-3 py-2 text-xs cursor-text text-left flex items-center min-h-[36px] hover:border-muted-foreground/50 transition-colors"
            onClick={() => setOpen(true)}
          >
            {value ? (
              <span className="flex items-center gap-2">
                <span className="font-medium truncate">{value.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{value.kind}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Search nodes…</span>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start" sideOffset={4}>
          <Command shouldFilter={false}>
            <CommandInput placeholder="Type to search…" value={query} onValueChange={setQuery} />
            <CommandList>
              {loading && <CommandItem disabled>Searching…</CommandItem>}
              {!loading && suggestions.length === 0 && query && (
                <CommandEmpty>No results found.</CommandEmpty>
              )}
              {!loading && suggestions.length > 0 && (
                <CommandGroup heading="Nodes">
                  {suggestions.map((s) => {
                    const Icon = getIcon(s.kind);
                    const [textColor, bgColor] = getColorClass(s.kind).split(" ");
                    return (
                      <CommandItem
                        key={s.objectid}
                        onSelect={() => {
                          onSelect(s);
                          setOpen(false);
                          setQuery("");
                        }}
                        className="flex justify-between items-center cursor-pointer"
                      >
                        <span className="truncate max-w-[80%] font-medium">{s.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <Icon className={`size-3.5 ${textColor}`} />
                          <div className={`size-2 rounded-full ${bgColor}`} />
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
