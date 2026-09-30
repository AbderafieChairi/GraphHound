import { renderToStaticMarkup } from "react-dom/server";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { resolveIcon } from "./fontawesome";

/** A single kind → icon mapping as stored in an icon set (`type` is the FA prefix). */
export type NodeIconSpec = { name: string; color: string; type: string };

/**
 * Default FontAwesome (solid) glyphs for the standard AD node kinds, used
 * whenever the selected icon set does not define an icon for a given kind.
 * `color: ""` means "let the caller pick the node color" (kind CSS variable).
 * Keys are UPPERCASE so kind matching is case-insensitive.
 */
export const DEFAULT_NODE_ICONS: Record<string, NodeIconSpec> = {
  USER: { type: "fas", name: "user", color: "" },
  GROUP: { type: "fas", name: "users", color: "" },
  COMPUTER: { type: "fas", name: "desktop", color: "" },
  OU: { type: "fas", name: "sitemap", color: "" },
  GPO: { type: "fas", name: "scroll", color: "" },
  CONTAINER: { type: "fas", name: "box", color: "" },
  DOMAIN: { type: "fas", name: "globe", color: "" },
  BASE: { type: "fas", name: "circle-nodes", color: "" },
};

const FALLBACK_ICON: NodeIconSpec = { type: "fas", name: "circle-nodes", color: "" };

// Rendering the same glyph repeatedly is wasteful; cache the produced data URIs.
// An empty string marks a spec we already know cannot be resolved.
const uriCache = new Map<string, string>();

/**
 * Render a node's FontAwesome icon to an SVG `data:` URI for use as a Cytoscape
 * `background-image`. The glyph is produced with the same component the rest of
 * the app uses — `<FontAwesomeIcon icon={byPrefixAndName.fab["..."]} />` — so
 * changing the icon set changes what the graph draws.
 */
export function nodeIconDataUri(spec: NodeIconSpec, glyphColor = "#ffffff"): string | null {
  const key = `${spec.type}|${spec.name}|${glyphColor}`;
  const cached = uriCache.get(key);
  if (cached !== undefined) return cached || null;

  const definition = resolveIcon(spec);
  if (!definition) {
    uriCache.set(key, "");
    return null;
  }

  const markup = renderToStaticMarkup(<FontAwesomeIcon icon={definition} color={glyphColor} />);
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svgForCanvas(markup, glyphColor))}`;
  uriCache.set(key, uri);
  return uri;
}

/**
 * FontAwesome's `<svg>` output is tuned for inline DOM use: no `xmlns`, no
 * intrinsic `width`/`height`, and `fill="currentColor"`. When the SVG is loaded
 * as a standalone image (Cytoscape rasterizes `background-image` onto a canvas),
 * Chrome needs an explicit namespace and size or it draws nothing, and
 * `currentColor` has no CSS context to resolve against. Normalize all three.
 */
/**
 * Fraction of the node the glyph occupies (the rest is transparent padding, so
 * the colored node ring shows around a smaller icon). Lower = smaller glyph.
 */
const GLYPH_SCALE = 0.55;

function svgForCanvas(markup: string, glyphColor: string): string {
  // Isolate the opening <svg ...> tag so attribute edits don't touch child paths.
  const open = markup.match(/^<svg\b[^>]*>/);
  if (!open) return markup.replace(/currentColor/g, glyphColor);

  const attrs = open[0]
    .replace(/^<svg\s*/, "")
    .replace(/\s*>$/, "")
    // Drop attrs we set ourselves (viewBox is rebuilt below to add padding).
    .replace(/\s(?:xmlns|width|height|viewBox)="[^"]*"/g, "");

  // Center the glyph's native viewBox inside a larger square so `contain` draws
  // it smaller than the node, leaving a transparent margin all around.
  const vb = open[0].match(/viewBox="([^"]+)"/);
  const parts = (vb?.[1] ?? "0 0 512 512").trim().split(/\s+/).map(Number);
  const [minX, minY, w, h] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 512, parts[3] ?? 512];
  const side = Math.max(w, h) / GLYPH_SCALE;
  const padX = minX - (side - w) / 2;
  const padY = minY - (side - h) / 2;
  const viewBox = `${padX} ${padY} ${side} ${side}`;

  const rebuilt = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="${viewBox}" ${attrs}>`;
  return (rebuilt + markup.slice(open[0].length)).replace(/currentColor/g, glyphColor);
}

// Corner status badges (Owned / High-Privileged) are cached like node icons.
const badgeCache = new Map<string, string>();

type BadgeColors = { bg: string; ring: string; glyph: string };

/**
 * Render a small circular "badge" — a filled disc with a white ring and a
 * centered FontAwesome glyph — to a standalone SVG `data:` URI. Used to overlay
 * status markers on the corner of a graph node (e.g. a skull for Owned nodes or
 * a diamond for High-Privileged ones). Unlike {@link nodeIconDataUri} this draws
 * its own opaque disc so the marker reads clearly against the node underneath.
 */
export function badgeIconDataUri(spec: NodeIconSpec, { bg, ring, glyph }: BadgeColors): string | null {
  const key = `${spec.type}|${spec.name}|${bg}|${ring}|${glyph}`;
  const cached = badgeCache.get(key);
  if (cached !== undefined) return cached || null;

  const definition = resolveIcon(spec);
  if (!definition) {
    badgeCache.set(key, "");
    return null;
  }

  // FontAwesome icon tuple: [width, height, ligatures, unicode, pathData].
  const [w, h, , , pathData] = definition.icon as [number, number, string[], string, string | string[]];
  const d = Array.isArray(pathData) ? pathData.join(" ") : pathData;

  // Center the glyph, scaled into a ~54px box, inside a 100×100 disc.
  const box = 54;
  const scale = box / Math.max(w, h);
  const tx = 50 - (w * scale) / 2;
  const ty = 50 - (h * scale) / 2;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">` +
    `<circle cx="50" cy="50" r="46" fill="${bg}" stroke="${ring}" stroke-width="6"/>` +
    `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">` +
    `<path d="${d}" fill="${glyph}"/></g></svg>`;

  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  badgeCache.set(key, uri);
  return uri;
}

/** Corner badge for Owned nodes: a black disc with a white "Death" skull. */
export function deathBadgeUri(): string {
  return (
    badgeIconDataUri(
      { type: "fas", name: "skull", color: "" },
      { bg: "#0b0b0b", ring: "#ffffff", glyph: "#ffffff" },
    ) ?? ""
  );
}

/** Corner badge for High-Privileged nodes: a gold disc with a dark diamond. */
export function highPrivBadgeUri(): string {
  return (
    badgeIconDataUri(
      { type: "fas", name: "gem", color: "" },
      { bg: "#f4b400", ring: "#ffffff", glyph: "#1a1a1a" },
    ) ?? ""
  );
}

/**
 * Icon for a kind, preferring the selected set, then per-kind defaults, then a
 * fallback. Matching is case-insensitive: both the icon map (see index.tsx) and
 * the defaults are keyed by UPPERCASE kind.
 */
export function resolveNodeIcon(
  kind: string,
  icons?: Record<string, NodeIconSpec>,
): NodeIconSpec {
  const key = kind.toUpperCase();
  return icons?.[key] ?? DEFAULT_NODE_ICONS[key] ?? FALLBACK_ICON;
}

type IconSetLike = {
  is_selected?: number | boolean;
  is_default?: number | boolean;
  set_custom_icons_json: Record<string, { icon: NodeIconSpec }>;
};

/**
 * Flatten the selected (or, failing that, the default) icon set into an
 * UPPERCASE kind → icon-spec map that `GraphCanvas` consumes. Shared by the
 * workspace and the report so both graphs use the same icons.
 */
export function selectedIconMap(sets: IconSetLike[]): Record<string, NodeIconSpec> | undefined {
  const selected = sets.find((s) => s.is_selected) ?? sets.find((s) => s.is_default);
  if (!selected) return undefined;
  const map: Record<string, NodeIconSpec> = {};
  for (const [kind, value] of Object.entries(selected.set_custom_icons_json)) {
    if (value?.icon?.name) map[kind.toUpperCase()] = value.icon;
  }
  return map;
}
