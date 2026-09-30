/**
 * Standalone HTML report for Path Finder results. Self-contained (inline CSS +
 * inline SVG glyphs, no external assets) so the exported file opens anywhere.
 */
import { resolveNodeIcon, type NodeIconSpec } from "@/lib/node-icons";
import { resolveIcon } from "@/lib/fontawesome";
import type { PathEntry } from "@/lib/path-search";

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Kind colors mirror the app's --kind-* CSS variables (src/styles.css).
function kindColor(kind: string): string {
  switch ((kind || "").toLowerCase()) {
    case "user":
      return "oklch(0.78 0.15 75)";
    case "group":
      return "oklch(0.7 0.16 25)";
    case "computer":
      return "oklch(0.74 0.13 200)";
    case "gpo":
      return "oklch(0.74 0.14 300)";
    case "ou":
      return "oklch(0.72 0.13 145)";
    case "container":
      return "oklch(0.65 0.03 260)";
    case "domain":
      return "oklch(0.85 0.12 95)";
    default:
      return "oklch(0.7 0.02 260)";
  }
}

/** Build the report HTML string for a set of discovered paths. */
export function generatePathReportHtml(
  startName: string,
  endName: string,
  paths: PathEntry[],
  icons?: Record<string, NodeIconSpec>,
): string {
  // Resolve a node's icon + color the same way GraphCanvas does: the selected
  // icon set wins, then per-kind defaults. An empty spec.color means "use the
  // kind color", matching resolveNodeIcon's contract.
  const nodeVisual = (kind: string) => {
    const spec = resolveNodeIcon(kind || "", icons);
    const color = spec.color && spec.color.trim() ? spec.color : kindColor(kind);
    return { spec, color };
  };

  const iconSvg = (spec: NodeIconSpec, color: string) => {
    const def = resolveIcon(spec);
    if (!def) return "";
    const [w, h, , , path] = def.icon;
    const d = Array.isArray(path) ? path.filter(Boolean).join(" ") : String(path ?? "");
    if (!d) return "";
    return `<svg class="pf-glyph" viewBox="0 0 ${w} ${h}" fill="${color}" aria-hidden="true"><path d="${d}"/></svg>`;
  };

  // Shortest path = fewest hops (first one wins on ties, keeping discovery order).
  const shortest = paths.reduce((min, p) => (p.hops < min.hops ? p : min));

  const renderPath = (path: PathEntry) => {
    const steps = path.names
      .map((name, i) => {
        const kind = path.kinds[i] || "";
        const { spec, color } = nodeVisual(kind);
        const glyph = iconSvg(spec, color);
        const kindTag = kind
          ? `<span class="pf-kind" style="color:${color}">${esc(kind)}</span>`
          : "";
        const node = `<div class="pf-node" style="border-color:${color}"><span class="pf-node-inner">${glyph}<span class="pf-labels"><span class="pf-name">${esc(name)}</span>${kindTag}</span></span></div>`;
        if (i >= path.names.length - 1) return node;
        const rel = path.edges[i]
          ? `<span class="pf-rel">${esc(path.edges[i])}</span>`
          : `<span class="pf-rel pf-rel-empty"></span>`;
        // Arrow leads into the next node, so tint it with the target color.
        const nextColor = nodeVisual(path.kinds[i + 1] || "").color;
        const arrow = `<div class="pf-edge">${rel}<span class="pf-arrow" style="color:${nextColor}">&rarr;</span></div>`;
        return node + arrow;
      })
      .join("");
    return `<div class="pf-path">${steps}</div>`;
  };

  const shortestHtml = `
      <section class="card highlight">
        <div class="card-head">
          <span class="badge">Shortest path</span>
          <span class="hops">${shortest.hops} hop${shortest.hops !== 1 ? "s" : ""}</span>
        </div>
        ${renderPath(shortest)}
      </section>`;

  const allHtml = paths
    .map((path, idx) => {
      const isShortest = path === shortest;
      return `
      <section class="card${isShortest ? " is-shortest" : ""}">
        <div class="card-head">
          <span class="path-title">Path #${idx + 1}${isShortest ? ' <span class="tag">shortest</span>' : ""}</span>
          <span class="hops">${path.hops} hop${path.hops !== 1 ? "s" : ""}</span>
        </div>
        ${renderPath(path)}
      </section>`;
    })
    .join("");

  const generated = new Date().toLocaleString();
  const title = `Attack Paths — ${startName ?? "?"} → ${endName ?? "?"}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  :root {
    --bg: #0b0f1a; --panel: #131a2a; --panel-2: #0f1524; --border: #1e2a44;
    --text: #e2e8f0; --muted: #7c8aa5; --primary: #38bdf8; --accent: #f59e0b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    line-height: 1.5; padding: 32px 20px;
  }
  .wrap { max-width: 1100px; margin: 0 auto; }
  header { margin-bottom: 28px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
  h1 { font-size: 20px; margin: 0 0 6px; letter-spacing: .2px; }
  .route { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 14px; margin: 10px 0 4px; }
  .route .end { color: var(--accent); font-weight: 600; }
  .route .start { color: var(--primary); font-weight: 600; }
  .route .sep { color: var(--muted); }
  .meta { color: var(--muted); font-size: 12px; display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px; }
  .meta b { color: var(--text); font-weight: 600; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); margin: 28px 0 12px; }
  .card {
    background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 16px; margin-bottom: 12px;
  }
  .card.highlight { border-color: var(--accent); background: linear-gradient(180deg, rgba(245,158,11,.08), transparent 60%), var(--panel); }
  .card.is-shortest { border-color: rgba(245,158,11,.5); }
  .card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .badge { background: var(--accent); color: #1a1205; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; padding: 3px 9px; border-radius: 999px; }
  .path-title { font-size: 13px; font-weight: 600; }
  .tag { font-size: 10px; color: var(--accent); border: 1px solid rgba(245,158,11,.4); border-radius: 999px; padding: 1px 7px; margin-left: 6px; text-transform: uppercase; letter-spacing: .06em; vertical-align: middle; }
  .hops { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }

  /* Horizontal path flow */
  .pf-path { display: flex; align-items: stretch; flex-wrap: wrap; gap: 4px 0; }
  .pf-node {
    display: flex; align-items: center; border: 1px solid var(--border); border-radius: 8px;
    background: rgba(255,255,255,.02); padding: 8px 12px; min-height: 44px;
  }
  .pf-node-inner { display: flex; align-items: center; gap: 9px; }
  .pf-glyph { width: 16px; height: 16px; flex: none; }
  .pf-labels { display: flex; flex-direction: column; line-height: 1.25; }
  .pf-name {
    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: 12px;
    font-weight: 600; color: var(--text); word-break: break-all;
  }
  .pf-kind { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; font-weight: 600; opacity: .8; }
  .pf-edge { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 0 10px; align-self: center; }
  .pf-rel {
    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: 9px;
    color: var(--muted); text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis;
  }
  .pf-rel-empty { min-height: 11px; }
  .pf-arrow { font-size: 20px; line-height: 1; font-weight: 700; }
  footer { color: var(--muted); font-size: 11px; margin-top: 28px; text-align: center; border-top: 1px solid var(--border); padding-top: 16px; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Attack Path Report</h1>
      <div class="route">
        <span class="start">${esc(startName ?? "?")}</span>
        <span class="sep">→</span>
        <span class="end">${esc(endName ?? "?")}</span>
      </div>
      <div class="meta">
        <span><b>${paths.length}</b> path${paths.length !== 1 ? "s" : ""} found</span>
        <span>Shortest: <b>${shortest.hops}</b> hop${shortest.hops !== 1 ? "s" : ""}</span>
        <span>Generated ${esc(generated)}</span>
      </div>
    </header>

    <h2>Shortest path</h2>
    ${shortestHtml}

    <h2>All paths (${paths.length})</h2>
    ${allHtml}

    <footer>Generated by GraphHound · Path Finder</footer>
  </div>
</body>
</html>`;
}

/** Build and download the path report as a standalone HTML file. */
export function downloadPathReport(
  startName: string | undefined,
  endName: string | undefined,
  paths: PathEntry[],
  icons?: Record<string, NodeIconSpec>,
): void {
  const html = generatePathReportHtml(startName ?? "?", endName ?? "?", paths, icons);
  downloadReportHtml(html, startName, endName);
}

/** Download already-generated report HTML (e.g. the one shown in the preview). */
export function downloadReportHtml(
  html: string,
  startName: string | undefined,
  endName: string | undefined,
): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const slug = (s?: string) => (s ?? "node").replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  a.href = url;
  a.download = `paths_${slug(startName)}_to_${slug(endName)}_${stamp}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
