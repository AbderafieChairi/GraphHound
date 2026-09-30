/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cytoscape stylesheet builder for the graph canvas: node colors, stacked
 * background images (kind icon + status badges), edges and path highlighting.
 */
import {
  deathBadgeUri,
  highPrivBadgeUri,
  nodeIconDataUri,
  resolveNodeIcon,
  type NodeIconSpec,
} from "@/lib/node-icons";
import type { TagMap } from "@/lib/analyst";
import { cssVar } from "@/lib/graph-color";

const KIND_VAR: Record<string, string> = {
  User: "--kind-user",
  user: "--kind-user",
  Group: "--kind-group",
  group: "--kind-group",
  Computer: "--kind-computer",
  computer: "--kind-computer",
  OU: "--kind-ou",
  ou: "--kind-ou",
  GPO: "--kind-gpo",
  gpo: "--kind-gpo",
  Container: "--kind-container",
  container: "--kind-container",
  Domain: "--kind-domain",
  domain: "--kind-domain",
};

/**
 * Resolve a node's FontAwesome icon from the selected icon set (falling back to
 * per-kind defaults) and render it as a white-on-transparent SVG data URI for
 * the Cytoscape node background.
 */
function nodeIcon(kind: string, icons?: Record<string, NodeIconSpec>) {
  const spec = resolveNodeIcon(kind, icons);
  return nodeIconDataUri(spec) ?? "";
}

/** Node fill: the icon set's per-kind color when set, otherwise the kind CSS variable. */
function nodeColor(kind: string, icons?: Record<string, NodeIconSpec>) {
  const custom = icons?.[kind.toUpperCase()]?.color;
  if (custom && custom.trim()) return custom;
  return cssVar(KIND_VAR[kind] ?? "--muted-foreground", "#999");
}

/**
 * A node's stacked background images: the kind icon first, then any corner
 * status badges. Cytoscape renders `background-image` (and the sibling
 * `background-*` list properties) index-for-index, so every layer property is
 * built from this same ordered list to stay aligned.
 *
 * Owned → white skull ("Death") at the top-right; High Privileged → gold
 * diamond at the top-left. Badges overhang the node corner and are drawn on top
 * of the kind icon.
 */
type BgLayer = {
  img: string;
  fit: "contain" | "none";
  w: string;
  h: string;
  px: string;
  py: string;
  clip: "node" | "none";
};

function bgLayers(el: any, icons?: Record<string, NodeIconSpec>, tags?: TagMap): BgLayer[] {
  const layers: BgLayer[] = [
    {
      img: nodeIcon(String(el.data("kind") ?? ""), icons),
      fit: "contain",
      w: "100%",
      h: "100%",
      px: "50%",
      py: "50%",
      clip: "node",
    },
  ];
  const nodeTags = tags?.[String(el.data("id") ?? "")] ?? [];
  if (nodeTags.includes("High Privileged")) {
    layers.push({
      img: highPrivBadgeUri(),
      fit: "none",
      w: "45%",
      h: "45%",
      px: "0%",
      py: "0",
      clip: "none",
    });
  }
  if (nodeTags.includes("Owned")) {
    layers.push({
      img: deathBadgeUri(),
      fit: "none",
      w: "45%",
      h: "45%",
      px: "100%",
      py: "0%",
      clip: "none",
    });
  }
  return layers;
}

/** Build the full Cytoscape stylesheet for the current icon set and tags. */
export function buildStyle(icons?: Record<string, NodeIconSpec>, tags?: TagMap): any[] {
  return [
    {
      selector: "node",
      style: {
        "background-color": (el: any) => nodeColor(String(el.data("kind") ?? ""), icons),
        "background-image": (el: any) => bgLayers(el, icons, tags).map((l) => l.img),
        "background-fit": (el: any) => bgLayers(el, icons, tags).map((l) => l.fit),
        "background-width": (el: any) => bgLayers(el, icons, tags).map((l) => l.w),
        "background-height": (el: any) => bgLayers(el, icons, tags).map((l) => l.h),
        "background-position-x": (el: any) => bgLayers(el, icons, tags).map((l) => l.px),
        "background-position-y": (el: any) => bgLayers(el, icons, tags).map((l) => l.py),
        "background-clip": (el: any) => bgLayers(el, icons, tags).map((l) => l.clip),
        "background-image-containment": "over",
        label: "data(label)",
        color: cssVar("--foreground", "#eee"),
        "text-outline-color": cssVar("--background", "#111"),
        "text-outline-width": 1.6,
        "text-outline-opacity": 0.9,
        "font-family": "JetBrains Mono, ui-monospace, monospace",
        "font-size": 10,
        "font-weight": 500,
        "text-valign": "bottom",
        "text-margin-y": 6,
        "text-max-width": "130px",
        "text-wrap": "ellipsis",

        width: 24,
        height: 24,
        "border-width": 0,
        "border-color": cssVar("--background", "#111"),
      },
    },
    {
      selector: "node:selected",
      style: {
        "border-color": cssVar("--primary", "#f5a524"),
        "border-width": 0,
        width: 30,
        height: 30,
      },
    },
    {
      selector: ".path-node",
      style: { "border-color": cssVar("--accent", "#e5484d"), "border-width": 4 },
    },
    {
      selector: "edge",
      style: {
        width: 1.4,
        "line-color": cssVar("--border", "#444"),
        "target-arrow-color": cssVar("--border", "#444"),
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.8,
        "curve-style": "bezier",
        label: "data(label)",
        "font-family": "JetBrains Mono, ui-monospace, monospace",
        "font-size": 8,
        "font-weight": 500,
        color: cssVar("--muted-foreground", "#888"),
        "text-background-color": cssVar("--background", "#111"),
        "text-background-opacity": 0.75,

        "text-background-padding": "2px",
      },
    },
    {
      selector: ".path-edge",
      style: {
        "line-color": cssVar("--accent", "#e5484d"),
        "target-arrow-color": cssVar("--accent", "#e5484d"),
        width: 3,
        "overlay-opacity": 0,
        "overlay-padding": 12,
      },
    },
  ];
}
