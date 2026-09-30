/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";

const TIME_KEYS = /(timestamp|lastset|whencreated|whenchanged|lastlogon|expires|date|time)$/i;

/** AD collectors store dates as UNIX seconds; -1/0 means "never". */
export function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && TIME_KEYS.test(key)) {
    if (value <= 0) return "never";
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function NodeKindTable({ kind, rows }: { kind: string; rows: Record<string, any>[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState("");

  const keys = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) for (const key of Object.keys(row)) if (key !== "_nf_id") set.add(key);
    const ordered = ["name", "objectid", "kind", "domain"].filter((k) => set.has(k));
    return [...ordered, ...[...set].filter((k) => !ordered.includes(k)).sort()];
  }, [rows]);

  const columns = useMemo<ColumnDef<Record<string, any>>[]>(
    () =>
      keys.map((key) => ({
        accessorFn: (row) => row[key],
        id: key,
        header: key,
        cell: (ctx) => <span>{formatValue(key, ctx.getValue())}</span>,
        filterFn: "includesString",
      })),
    [keys],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    globalFilterFn: (row, _columnId, value) =>
      keys.some((key) =>
        formatValue(key, row.original[key]).toLowerCase().includes(String(value).toLowerCase()),
      ),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const exportCsv = () => {
    const lines = [
      keys,
      ...table
        .getFilteredRowModel()
        .rows.map((row) => keys.map((key) => formatValue(key, row.original[key]))),
    ]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `hound-zero-${kind.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-1 py-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`Filter ${kind}…`}
            className="w-full rounded border border-border bg-card/50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-primary"
          />
        </div>
        <span className="mono text-[10px] text-muted-foreground">
          {table.getFilteredRowModel().rows.length} / {rows.length} rows
        </span>
        <button
          onClick={exportCsv}
          title="Export as CSV"
          className="control ml-auto"
          aria-label={`Export ${kind} as CSV`}
        >
          <Download />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="mono w-full text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-sidebar">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer whitespace-nowrap border-b border-border px-3 py-2 font-medium text-muted-foreground hover:text-foreground"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted()
                      ? header.column.getIsSorted() === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/40">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="max-w-[280px] truncate border-b border-border/50 px-3 py-1.5"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
