import type { ReportSection } from "./report-sections";
import { rowsToElements } from "./graph-elements";
import { nodeRows } from "./analyst";
import { nodeIconDataUri, resolveNodeIcon, type NodeIconSpec } from "./node-icons";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface QueryData {
  section: ReportSection;
  rows: any[];
}

interface ThemeColors {
  color_bg: string;
  color_panel: string;
  color_primary: string;
  color_accent: string;
}

const DEFAULT_THEME: ThemeColors = {
  color_bg: "#141414",
  color_panel: "#1c1c1e",
  color_primary: "#22c55e",
  color_accent: "#3b82f6",
};

/** Escape </ sequences so JSON payload never closes the <script> tag early. */
function safeJson(obj: unknown): string {
  return JSON.stringify(obj).replace(/<\//g, "<\\/");
}

function lum(hex: string): number {
  const c = (hex ?? "").replace("#", "").trim();
  if (c.length < 6) return 0;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateStandaloneHtml(
  reportTitle: string,
  reportDescription: string,
  data: QueryData[],
  theme: ThemeColors = DEFAULT_THEME,
  icons?: Record<string, NodeIconSpec>,
): string {
  // ── Build section payload ────────────────────────────────────────────────
  const sectionsPayload = data.map((d) => {
    // Strip heavy props from cytoscape elements to keep JSON size manageable
    const rawEls = rowsToElements(d.rows);
    const elements = rawEls.map((el) => {
      const { props: _p, ...rest } = el.data as any;
      return { data: rest };
    });

    const nodes = nodeRows(d.rows);
    const grouped: Record<string, any[]> = {};
    const seen = new Set<string>();
    for (const n of nodes) {
      if (!n?.objectid || seen.has(n.objectid)) continue;
      seen.add(n.objectid);
      const k = n.kind || "Base";
      (grouped[k] ??= []).push(n);
    }

    return {
      id: d.section.id,
      title: d.section.title,
      description: d.section.description,
      defaultValue: d.section.defaultValue,
      inputType: d.section.inputType,
      elements,
      grouped,
    };
  });

  // ── Node icons ───────────────────────────────────────────────────────────
  // Precompute, per kind present in the report, the same FontAwesome glyph
  // (as an SVG data: URI) and fill colour the live graph uses, so the exported
  // Cytoscape draws identical node icons offline. `resolveNodeIcon` falls back
  // to per-kind defaults when the selected set omits a kind.
  const nodeIconsMap: Record<string, { img: string; color: string }> = {};
  const kindSet = new Set<string>();
  for (const s of sectionsPayload) {
    for (const el of s.elements) {
      const k = (el.data as any).kind;
      if (k) kindSet.add(String(k));
    }
    for (const k of Object.keys(s.grouped)) kindSet.add(k);
  }
  for (const kind of kindSet) {
    const spec = resolveNodeIcon(kind, icons);
    nodeIconsMap[kind.toUpperCase()] = {
      img: nodeIconDataUri(spec) ?? "",
      color: icons?.[kind.toUpperCase()]?.color?.trim() || "",
    };
  }
  const nodeIconsJson = safeJson(nodeIconsMap);

  // ── Theme derivation ─────────────────────────────────────────────────────
  const bg = theme.color_bg || "#141414";
  const panel = theme.color_panel || "#1c1c1e";
  const primary = theme.color_primary || "#22c55e";
  const accent = theme.color_accent || "#3b82f6";
  const isLight = lum(bg) > 0.5;
  const fg = isLight ? "#111113" : "#f5f5f7";
  const muted = isLight ? "#6b7280" : "#a1a1aa";
  const border = isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";
  const edgeCol = isLight ? "#d1d5db" : "#3f3f46";

  // Safe JSON strings (no </script> closing tag injection)
  const sectionsJson = safeJson(sectionsPayload);
  const descJson = safeJson(reportDescription || "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GraphHound — ${escapeHtml(reportTitle)}</title>
  <!--
    Cytoscape.js graph library + dagre layout.
    dagre MUST be loaded before cytoscape-dagre.
  -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/dagre/0.8.5/dagre.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/cytoscape-dagre@2.5.0/cytoscape-dagre.min.js"></script>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:${bg};--panel:${panel};--primary:${primary};--accent:${accent};
      --fg:${fg};--muted:${muted};--border:${border};--edge:${edgeCol};
    }
    body{background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;line-height:1.5;padding:2rem;width:100%;margin:0 auto;display:flex;flex-direction:column;gap:2rem}
    header{border-bottom:1px solid var(--border);padding-bottom:1.25rem}
    header h1{font-size:1.2rem;font-weight:700;text-transform:uppercase;letter-spacing:.15em}
    header p{font-size:.75rem;color:var(--muted);margin-top:.3rem}
    #sections-root{display:flex;flex-direction:column;gap:1.5rem}
    .sec-card{width:100%;background:var(--panel);border-radius:.5rem;padding:1.25rem;display:flex;flex-direction:column;gap:.9rem}
    .sec-title{font-size:.85rem;font-weight:600}
    .sec-desc{font-size:.7rem;color:var(--muted);background:rgba(0,0,0,.15);border-radius:.3rem;padding:.45rem .75rem}
    .sec-desc.md>*:first-child{margin-top:0}
    .sec-desc.md>*:last-child{margin-bottom:0}
    .sec-desc.md p{margin:.4rem 0}
    .sec-desc.md h1,.sec-desc.md h2,.sec-desc.md h3,.sec-desc.md h4,.sec-desc.md h5,.sec-desc.md h6{margin:.6rem 0 .3rem;color:var(--fg);font-weight:600;line-height:1.25}
    .sec-desc.md h1{font-size:1rem}.sec-desc.md h2{font-size:.9rem}.sec-desc.md h3{font-size:.8rem}
    .sec-desc.md h4,.sec-desc.md h5,.sec-desc.md h6{font-size:.72rem}
    .sec-desc.md ul,.sec-desc.md ol{margin:.4rem 0;padding-left:1.25rem}
    .sec-desc.md li{margin:.15rem 0}
    .sec-desc.md a{color:var(--accent);text-decoration:underline}
    .sec-desc.md strong{color:var(--fg);font-weight:600}
    .sec-desc.md code{font-family:monospace;background:rgba(128,128,128,.18);border-radius:.2rem;padding:.05rem .3rem;font-size:.9em}
    .sec-desc.md pre{background:rgba(0,0,0,.25);border-radius:.3rem;padding:.5rem .65rem;overflow:auto;margin:.4rem 0}
    .sec-desc.md pre code{background:none;padding:0}
    .sec-desc.md blockquote{margin:.4rem 0;padding:.1rem .7rem;border-left:2px solid var(--border);color:var(--muted)}
    .sec-desc.md hr{border:0;border-top:1px solid var(--border);margin:.6rem 0}
    .input-row{display:flex;align-items:center;gap:.5rem;font-size:.7rem;color:var(--muted)}
    .input-val{padding:.15rem .55rem;border-radius:.25rem;border:1px solid rgba(128,128,255,.3);background:rgba(128,128,255,.1);color:var(--accent);font-weight:600;font-size:.7rem}
    /* Graph */
    .cy-box{width:100%;height:360px;border:1px solid var(--border);border-radius:.4rem;background:${isLight ? "#f8f8f8" : "#0e0e12"};overflow:hidden;position:relative}
    .cy-box canvas{display:block}
    .no-graph{height:120px;border:1px solid var(--border);border-radius:.4rem;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:var(--muted)}
    /* Details block */
    .details{display:block;border:1px solid var(--border);border-radius:.4rem;overflow:hidden}
    .det-header{padding:.45rem .9rem;background:rgba(0,0,0,.1);border-bottom:1px solid var(--border);font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
    .tabs{display:flex;flex-wrap:wrap;gap:.25rem;padding:.45rem .75rem;border-bottom:1px solid var(--border)}
    .tab{border:1px solid var(--border);border-radius:.25rem;padding:.2rem .55rem;font-size:.68rem;font-weight:500;cursor:pointer;background:transparent;color:var(--muted);transition:all .1s}
    .tab:hover{color:var(--fg)}
    .tab.on{background:rgba(128,200,128,.12);border-color:rgba(128,200,128,.4);color:var(--primary)}
    .act-row{display:flex;align-items:center;gap:.5rem;padding:.35rem .75rem;border-bottom:1px solid var(--border)}
    .cnt{font-size:.65rem;color:var(--muted);font-family:monospace}
    .csv-btn{margin-left:auto;border:1px solid var(--border);border-radius:.25rem;background:transparent;color:var(--muted);cursor:pointer;padding:.2rem .5rem;font-size:.68rem;display:inline-flex;align-items:center;gap:.3rem}
    .csv-btn:hover{color:var(--fg)}
    .tbl-wrap{max-height:280px;overflow:auto;display:block}
    table{width:100%;border-collapse:collapse;font-size:.68rem;font-family:monospace;text-align:left}
    thead th{position:sticky;top:0;z-index:1;background:var(--panel);padding:.35rem .7rem;font-weight:500;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap}
    tbody tr:hover{background:rgba(128,128,128,.08)}
    tbody td{padding:.25rem .7rem;border-bottom:1px solid var(--border);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .empty{padding:1.5rem;text-align:center;color:var(--muted);font-size:.75rem}
    #err-banner{display:none;background:#7f1d1d;color:#fca5a5;padding:.75rem 1rem;border-radius:.4rem;font-size:.75rem;white-space:pre-wrap}
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(reportTitle)}</h1>
    <p id="rdesc"></p>
  </header>
  <div id="err-banner"></div>
  <main id="sections-root"></main>

  <script>
    /* ── Embedded report data ─────────────────────────────────────────────── */
    var SECTIONS = ${sectionsJson};
    var RDESC = ${descJson};
    var NODE_ICONS = ${nodeIconsJson};   // { KIND: { img: dataURI, color } }
    function nodeImg(k){ var m = NODE_ICONS[(k||'').toUpperCase()]; return (m && m.img) ? m.img : 'none'; }
    function nodeBg(k){ var m = NODE_ICONS[(k||'').toUpperCase()]; return (m && m.color) ? m.color : kc(k); }

    /* ── Bootstrap ────────────────────────────────────────────────────────── */
    document.getElementById('rdesc').textContent = RDESC;

    function showErr(msg) {
      var b = document.getElementById('err-banner');
      b.style.display = 'block';
      b.textContent = 'Render error: ' + msg;
    }

    /* ── Tiny helpers ─────────────────────────────────────────────────────── */
    var TIME_RE = /(timestamp|lastset|whencreated|whenchanged|lastlogon|expires|date|time)$/i;
    function fv(key, v) {
      if (v === null || v === undefined || v === '') return '—';
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (typeof v === 'number' && TIME_RE.test(key)) {
        if (v <= 0) return 'never';
        var ms = v > 1e12 ? v : v * 1000;
        return new Date(ms).toISOString().replace('T',' ').slice(0,19) + ' UTC';
      }
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }
    function esc(s) {
      return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }
    /* Minimal, dependency-free markdown → HTML.
       Input is HTML-escaped first, so all output is safe. Supports headings,
       bold/italic, inline & fenced code, links, blockquotes, ul/ol lists,
       horizontal rules and paragraphs. */
    function mdInline(s) {
      return s
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\\*([^*\\s][^*]*?)\\*/g, '$1<em>$2</em>')
        .replace(/(^|[^_])_([^_\\s][^_]*?)_/g, '$1<em>$2</em>')
        .replace(/\\[([^\\]]+)\\]\\((https?:[^)\\s]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    }
    function mdToHtml(src) {
      var lines = esc(String(src || '')).replace(/\\r\\n/g, '\\n').split('\\n');
      var out = [], i = 0;
      function flushList(tag, items){ out.push('<'+tag+'>'+items.map(function(t){return '<li>'+mdInline(t)+'</li>';}).join('')+'</'+tag+'>'); }
      while (i < lines.length) {
        var line = lines[i];
        if (/^\\s*\`\`\`/.test(line)) {              // fenced code block
          var buf = []; i++;
          while (i < lines.length && !/^\\s*\`\`\`/.test(lines[i])) { buf.push(lines[i]); i++; }
          i++;
          out.push('<pre><code>'+buf.join('\\n')+'</code></pre>');
          continue;
        }
        var h = line.match(/^(#{1,6})\\s+(.*)$/);
        if (h) { var lvl = h[1].length; out.push('<h'+lvl+'>'+mdInline(h[2])+'</h'+lvl+'>'); i++; continue; }
        if (/^\\s*([-*_])\\1{2,}\\s*$/.test(line)) { out.push('<hr/>'); i++; continue; }
        if (/^\\s*>\\s?/.test(line)) {                // blockquote
          var q = [];
          while (i < lines.length && /^\\s*>\\s?/.test(lines[i])) { q.push(lines[i].replace(/^\\s*>\\s?/, '')); i++; }
          out.push('<blockquote>'+mdInline(q.join(' '))+'</blockquote>');
          continue;
        }
        if (/^\\s*[-*+]\\s+/.test(line)) {            // unordered list
          var ul = [];
          while (i < lines.length && /^\\s*[-*+]\\s+/.test(lines[i])) { ul.push(lines[i].replace(/^\\s*[-*+]\\s+/, '')); i++; }
          flushList('ul', ul); continue;
        }
        if (/^\\s*\\d+\\.\\s+/.test(line)) {           // ordered list
          var ol = [];
          while (i < lines.length && /^\\s*\\d+\\.\\s+/.test(lines[i])) { ol.push(lines[i].replace(/^\\s*\\d+\\.\\s+/, '')); i++; }
          flushList('ol', ol); continue;
        }
        if (/^\\s*$/.test(line)) { i++; continue; }   // blank
        var para = [];                              // paragraph (until blank)
        while (i < lines.length && !/^\\s*$/.test(lines[i]) && !/^\\s*(#{1,6}\\s|[-*+]\\s|\\d+\\.\\s|>|\`\`\`)/.test(lines[i])) {
          para.push(lines[i]); i++;
        }
        out.push('<p>'+mdInline(para.join('<br/>'))+'</p>');
      }
      return out.join('');
    }
    function cols(rows) {
      var s = new Set();
      rows.forEach(function(r){ Object.keys(r).forEach(function(k){ if(k!=='_nf_id') s.add(k); }); });
      var prio = ['name','objectid','kind','domain'].filter(function(k){ return s.has(k); });
      return prio.concat(Array.from(s).filter(function(k){ return !prio.includes(k); }).sort());
    }
    function csvDl(kind, rows, cs) {
      var lines = [cs].concat(rows.map(function(r){ return cs.map(function(c){ return fv(c,r[c]); }); }))
        .map(function(line){ return line.map(function(cell){ return '"'+String(cell).replace(/"/g,'""')+'"'; }).join(','); })
        .join('\\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([lines],{type:'text/csv'}));
      a.download = 'hz-' + kind.toLowerCase() + '.csv';
      a.click();
    }

    /* ── Per-section runtime state ────────────────────────────────────────── */
    var ST = {};   // { secId: { kind, filter } }

    function renderTable(sid) {
      var sec = null;
      for (var i=0;i<SECTIONS.length;i++){ if(SECTIONS[i].id===sid){ sec=SECTIONS[i]; break; } }
      if (!sec) return;
      var st = ST[sid];
      if (!st) return;
      var rows = sec.grouped[st.kind] || [];
      var cs = cols(rows);
      var q = (st.filter||'').toLowerCase();
      var filtered = q ? rows.filter(function(r){ return cs.some(function(c){ return fv(c,r[c]).toLowerCase().indexOf(q)>-1; }); }) : rows;

      var cntEl = document.getElementById('cnt-'+sid);
      if (cntEl) cntEl.textContent = filtered.length + ' / ' + rows.length + ' rows';

      var csvBtn = document.getElementById('csv-'+sid);
      if (csvBtn) {
        var _cs = cs.slice(), _rows = filtered.slice(), _kind = st.kind;
        csvBtn.onclick = function(){ csvDl(_kind, _rows, _cs); };
      }

      var wrap = document.getElementById('tw-'+sid);
      if (!wrap) return;
      if (!filtered.length) { wrap.innerHTML = '<div class="empty">No matching records.</div>'; return; }
      var head = cs.map(function(c){ return '<th>'+esc(c)+'</th>'; }).join('');
      var body = filtered.map(function(r){
        return '<tr>'+cs.map(function(c){
          var v = esc(fv(c,r[c]));
          return '<td title="'+v+'">'+v+'</td>';
        }).join('')+'</tr>';
      }).join('');
      wrap.innerHTML = '<table><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table>';
    }

    function selectTab(sid, kind) {
      if (!ST[sid]) return;
      ST[sid].kind = kind;
      ST[sid].filter = '';
      var tabs = document.querySelectorAll('[data-tsec="'+sid+'"]');
      tabs.forEach(function(btn){ btn.classList.toggle('on', btn.getAttribute('data-k')===kind); });
      renderTable(sid);
    }

    /* ── Kind → border colour ─────────────────────────────────────────────── */
    var KC = {user:'#3b82f6',computer:'#ef4444',group:'#10b981',domain:'#f59e0b',gpo:'#8b5cf6',ou:'#ec4899'};
    function kc(k){ return KC[(k||'').toLowerCase()] || '${muted}'; }

    /* ── Render sections ──────────────────────────────────────────────────── */
    var root = document.getElementById('sections-root');

    try {
      SECTIONS.forEach(function(sec) {
        var kinds = Object.keys(sec.grouped).sort();
        ST[sec.id] = { kind: kinds[0]||'', filter:'' };

        var card = document.createElement('div');
        card.className = 'sec-card';

        /* Title */
        var t = document.createElement('div');
        t.className = 'sec-title';
        t.textContent = sec.title;
        card.appendChild(t);

        /* Description — rendered markdown (dependency-free) */
        if (sec.description) {
          var d = document.createElement('div');
          d.className = 'sec-desc md';
          d.innerHTML = mdToHtml(sec.description);
          card.appendChild(d);
        }

        /* Input badge — omitted for static (no-input) sections */
        if (sec.inputType !== 'none') {
          var badge = document.createElement('div');
          badge.className = 'input-row';
          badge.innerHTML = 'Input: <span class="input-val">'+esc(sec.defaultValue||'(none)')+'</span>';
          card.appendChild(badge);
        }

        /* Graph placeholder */
        var graphEl;
        if (sec.elements && sec.elements.length > 0) {
          graphEl = document.createElement('div');
          graphEl.className = 'cy-box';
          graphEl.id = 'cy-'+sec.id;
        } else {
          graphEl = document.createElement('div');
          graphEl.className = 'no-graph';
          graphEl.textContent = 'No graph results for this section.';
        }
        card.appendChild(graphEl);

        /* Details block */
        if (kinds.length > 0) {
          var det = document.createElement('div');
          det.className = 'details';
          var tabsHtml = kinds.map(function(k){
            var active = k===kinds[0] ? ' on' : '';
            return '<button class="tab'+active+'" data-tsec="'+esc(String(sec.id))+'" data-k="'+esc(k)+'">'+esc(k)+' ('+(sec.grouped[k]||[]).length+')</button>';
          }).join('');
          det.innerHTML =
            '<div class="det-header">Node Details</div>'+
            '<div class="tabs">'+tabsHtml+'</div>'+
            '<div class="act-row">'+
              '<span id="cnt-'+esc(String(sec.id))+'" class="cnt">0 / 0 rows</span>'+
              '<button id="csv-'+esc(String(sec.id))+'" class="csv-btn">'+
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>'+
                'CSV'+
              '</button>'+
            '</div>'+
            '<div class="tbl-wrap" id="tw-'+esc(String(sec.id))+'"></div>';
          card.appendChild(det);
          det.querySelectorAll('[data-tsec]').forEach(function(btn){
            btn.addEventListener('click', function(){
              selectTab(btn.getAttribute('data-tsec'), btn.getAttribute('data-k'));
            });
          });
        }

        root.appendChild(card);

        /* Initial table render — element is now in DOM */
        if (kinds.length > 0) renderTable(sec.id);

        /* Cytoscape — init after paint so the container has dimensions */
        if (sec.elements && sec.elements.length > 0) {
          (function(secRef){
            requestAnimationFrame(function(){
              var container = document.getElementById('cy-'+secRef.id);
              if (!container) return;
              if (typeof cytoscape === 'undefined') {
                container.textContent = 'Cytoscape not loaded (requires internet).';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.style.fontSize = '.75rem';
                container.style.color = '${muted}';
                return;
              }
              try {
                var cy = cytoscape({
                  container: container,
                  elements: secRef.elements,
                  style: [
                    {
                      selector: 'node',
                      style: {
                        'background-color': function(ele){ return nodeBg(ele.data('kind')); },
                        'background-image': function(ele){ return nodeImg(ele.data('kind')); },
                        'background-fit': 'contain',
                        'background-clip': 'node',
                        'label': 'data(label)',
                        'color': '${fg}',
                        'font-size': '9px',
                        'text-valign': 'bottom',
                        'text-margin-y': 5,
                        'border-width': 2,
                        'border-color': function(ele){ return kc(ele.data('kind')); },
                        'width': 22, 'height': 22,
                        'overlay-opacity': 0,
                        'min-zoomed-font-size': 6,
                      }
                    },
                    {
                      selector: 'edge',
                      style: {
                        'width': 1.5,
                        'line-color': '${edgeCol}',
                        'target-arrow-color': '${edgeCol}',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'label': 'data(label)',
                        'font-size': '8px',
                        'color': '${muted}',
                        'text-rotation': 'autorotate',
                        'text-background-opacity': 0.85,
                        'text-background-color': '${bg}',
                        'text-background-padding': '2px',
                        'arrow-scale': 0.8,
                        'overlay-opacity': 0,
                      }
                    }
                  ],
                  layout: { name:'dagre', nodeSep:50, edgeSep:10, rankSep:70, rankDir:'LR' },
                  wheelSensitivity: 0.3,
                });
                cy.on('tap', 'node', function(evt){
                  var st = ST[secRef.id];
                  if (!st) return;
                  var label = evt.target.data('label');
                  var kind = evt.target.data('kind');
                  // Switch the details table to the clicked node's kind tab first
                  // (when that kind has a tab), then filter by the node's name.
                  if (kind && secRef.grouped[kind]) {
                    st.kind = kind;
                    var tabs = document.querySelectorAll('[data-tsec="'+secRef.id+'"]');
                    tabs.forEach(function(btn){ btn.classList.toggle('on', btn.getAttribute('data-k')===kind); });
                  }
                  st.filter = label || '';
                  renderTable(secRef.id);
                });
              } catch(e) {
                container.textContent = 'Graph error: ' + e.message;
              }
            });
          })(sec);
        }
      });
    } catch(e) {
      showErr(e.message || String(e));
      console.error('Section render error:', e);
    }
  </script>
</body>
</html>`;
}
