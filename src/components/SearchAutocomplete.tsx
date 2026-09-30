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

type Suggestion = {
  objectid: string;
  name: string;
  kind: string;
};

export function SearchAutocomplete({
  runQuery,
  onSelect,
  onSelectSuggestion,
  project,
}: {
  runQuery: any;
  onSelect: (val: string) => void;
  /** Optional callback that receives the full suggestion object (objectid, name, kind). */
  onSelectSuggestion?: (suggestion: { objectid: string; name: string; kind: string }) => void;
  project?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
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
          const results = parsed.map((row) => {
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
        console.error("Autocomplete search failed", e);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, runQuery, project]);

  const getIcon = (kind: string) => {
    const k = kind?.toLowerCase() || "";
    if (k === "user") return User;
    if (k === "group") return Users;
    if (k === "computer") return Monitor;
    if (k === "ou") return Folder;
    if (k === "gpo") return FileText;
    if (k === "container") return Package;
    if (k === "domain") return Globe;
    return Circle;
  };

  const getColorClass = (kind: string) => {
    const k = kind?.toLowerCase() || "";
    if (["user", "group", "computer", "gpo", "ou", "container", "domain"].includes(k)) {
      return `text-kind-${k} bg-kind-${k}`;
    }
    return "text-muted-foreground bg-muted-foreground";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="flex-1 rounded border border-border bg-card/50 px-3 py-1.5 text-sm cursor-text text-muted-foreground text-left flex items-center min-h-[36px]"
          onClick={() => setOpen(true)}
        >
          {query || "Search for a node..."}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[318px] p-0" align="center" sideOffset={8}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type to search..." value={query} onValueChange={setQuery} />
          <CommandList>
            {loading && <CommandItem disabled>Searching...</CommandItem>}
            {!loading && suggestions.length === 0 && query && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {!loading && suggestions.length > 0 && (
              <CommandGroup heading="Suggestions">
                {suggestions.map((s) => {
                  const Icon = getIcon(s.kind);
                  const kClass = getColorClass(s.kind);
                  const [textColor, bgColor] = kClass.split(" ");
                  return (
                    <CommandItem
                      key={s.objectid}
                      onSelect={() => {
                        onSelect(s.objectid);
                        onSelectSuggestion?.(s);
                        setOpen(false);
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
  );
}
