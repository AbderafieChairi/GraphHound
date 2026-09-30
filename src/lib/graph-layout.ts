/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cytoscape layout routines: full render (dagre for graphs, hex beehive for
 * node-only sets), incremental add that preserves existing positions, and the
 * depth-column layout used for path-finder results.
 */
import type { CyElement } from "@/lib/graph-elements";

/** Base spacing unit for the path layout (px). */
const SIZE = 90;
const COL_GAP = SIZE * 1.5;

/** Replace all elements and lay them out (dagre when edges exist, else hex grid). */
export function render(cy: any, elements: CyElement[]) {
  cy.elements().remove();
  if (!elements.length) return;
  cy.add(elements as any);

  const hasEdges = elements.some((el) => el.data.source);
  if (hasEdges) {
    cy.layout({
      name: "dagre",
      rankDir: "LR",
      nodeSep: 26,
      rankSep: 110,
      animate: false,
      fit: true,
      padding: 40,
    }).run();
  } else {
    // Lay nodes out in a hexagonal beehive layout with equal distance
    const nodes = cy.nodes();
    const count = nodes.length;
    const spacing = 120; // equal distance between nodes

    let index = 0;
    let ring = 0;

    // Assign position to center node
    if (count > 0) {
      nodes[0].position({ x: 0, y: 0 });
      index++;
    }

    // Spiral outward in rings; a hexagonal ring of radius `ring` has 6 * ring nodes
    while (index < count) {
      ring++;
      for (let i = 0; i < 6 * ring && index < count; i++) {
        const angle = (i / (6 * ring)) * 2 * Math.PI;
        const x = ring * spacing * Math.cos(angle);
        const y = ring * spacing * Math.sin(angle);
        nodes[index].position({ x, y });
        index++;
      }
    }
    fitVisible(cy, 40);
  }
}

/** Add new elements to the graph while preserving positions of existing nodes. */
export function renderIncremental(cy: any, newElements: CyElement[]) {
  // Save positions of all existing nodes
  const positions = new Map<string, { x: number; y: number }>();
  cy.nodes().forEach((n: any) => {
    positions.set(n.id(), { ...n.position() });
  });

  // Filter out elements that already exist
  const existingIds = new Set<string>(cy.elements().map((e: any) => e.id()));
  const toAdd = newElements.filter((el) => !existingIds.has(String(el.data.id)));
  if (!toAdd.length) return;

  cy.add(toAdd as any);

  // Run layout only on nodes that don't have a position yet
  const newNodes = cy.nodes().filter((n: any) => !positions.has(n.id()));
  if (newNodes.length) {
    newNodes
      .layout({
        name: "dagre",
        rankDir: "LR",
        nodeSep: 26,
        rankSep: 110,
        animate: false,
        fit: false,
        padding: 40,
      })
      .run();
  }

  // Restore original positions for pre-existing nodes
  positions.forEach((pos, id) => {
    const node = cy.getElementById(id);
    if (node.length) node.position(pos);
  });

  fitVisible(cy, 40);
}

/**
 * Column layout for path-finding results.
 * Column index = depth of the node along the paths (start = 0).
 * The end node always sits in the right-most column (max path length found so far).
 * Nodes at the same depth are stacked vertically, SIZE apart; columns are SIZE*1.5 apart.
 */
export function applyPathLayout(cy: any, paths: string[][]) {
  if (!paths.length) return;
  const startId = paths[0]![0]!;
  const endId = paths[0]![paths[0]!.length - 1]!;
  const maxLen = Math.max(...paths.map((p) => p.length - 1));

  // depth per node = smallest depth it appears at across all paths
  const depth = new Map<string, number>();
  for (const p of paths) {
    p.forEach((id, i) => {
      if (id === endId) return;
      const d = depth.get(id);
      if (d === undefined || i < d) depth.set(id, i);
    });
  }
  depth.set(startId, 0);
  depth.set(endId, maxLen);

  // group by column, keep a stable order
  const columns = new Map<number, string[]>();
  [...depth.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .forEach(([id, d]) => {
      if (!columns.has(d)) columns.set(d, []);
      columns.get(d)!.push(id);
    });

  columns.forEach((ids, d) => {
    const height = (ids.length - 1) * SIZE;
    ids.forEach((id, i) => {
      const node = cy.getElementById(id);
      if (node.length) node.position({ x: d * COL_GAP, y: i * SIZE - height / 2 });
    });
  });

  fitVisible(cy, 40);
}

/**
 * Like `cy.fit`, but fits the graph into the part of the canvas not covered by
 * floating panels (elements marked `data-graph-overlay`, e.g. the sidebar).
 */
export function fitVisible(cy: any, padding = 40) {
  const eles = cy.elements();
  if (!eles.length) return;
  const container: HTMLElement = cy.container();
  const box = container.getBoundingClientRect();
  let left = 0;
  let right = box.width;
  document.querySelectorAll<HTMLElement>("[data-graph-overlay]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom <= box.top || r.top >= box.bottom) return;
    // Panel docked on the right half narrows the free area from the right, and vice versa.
    if (r.left - box.left > box.width / 2) right = Math.min(right, r.left - box.left);
    else if (r.right - box.left < box.width / 2) left = Math.max(left, r.right - box.left);
  });
  const freeW = right - left - padding * 2;
  const freeH = box.height - padding * 2;
  // Too little room left over: fall back to a normal full-canvas fit.
  if (freeW < 200 || freeH < 100) {
    cy.fit(eles, padding);
    return;
  }
  const bb = eles.boundingBox();
  const zoom = Math.min(
    cy.maxZoom(),
    Math.max(cy.minZoom(), Math.min(freeW / (bb.w || 1), freeH / (bb.h || 1))),
  );
  cy.zoom(zoom);
  cy.pan({
    x: (left + right) / 2 - (bb.x1 + bb.w / 2) * zoom,
    y: box.height / 2 - (bb.y1 + bb.h / 2) * zoom,
  });
}
