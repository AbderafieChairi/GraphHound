/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import type { CyElement } from "@/lib/graph-elements";
import type { NodeIconSpec } from "@/lib/node-icons";
import type { TagMap } from "@/lib/analyst";
import { buildStyle } from "@/lib/graph-style";
import { render, renderIncremental, applyPathLayout, fitVisible } from "@/lib/graph-layout";

type Props = {
  elements: CyElement[];
  onSelect: (data: Record<string, any> | null) => void;
  onEdgeSelect?: (data: Record<string, any> | null) => void;
  path?: string[];
  onReady?: (api: GraphApi) => void;
  /** Reports how many elements the canvas currently draws (incl. ones added via the api). */
  onCountChange?: (count: number) => void;
  /** Selected icon set: kind → FontAwesome icon spec. Falls back to per-kind defaults. */
  icons?: Record<string, NodeIconSpec>;
  /** Analyst tags per node (objectid → tags), drives the corner status badges. */
  tags?: TagMap;
};

export type GraphApi = {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  center: () => void;
  reset: () => void;
  highlightPath: (ids: string[]) => void;
  addElements: (newElements: CyElement[]) => void;
  layoutPaths: (paths: string[][]) => void;
  clear: () => void;
};

export function GraphCanvas({
  elements,
  onSelect,
  onEdgeSelect,
  path = [],
  onReady,
  onCountChange,
  icons,
  tags,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<any>(null);
  const apiRef = useRef<GraphApi | null>(null);
  const selectRef = useRef(onSelect);
  const edgeSelectRef = useRef(onEdgeSelect);
  const iconsRef = useRef(icons);
  const tagsRef = useRef(tags);
  const countRef = useRef(onCountChange);
  countRef.current = onCountChange;
  selectRef.current = onSelect;
  edgeSelectRef.current = onEdgeSelect;
  iconsRef.current = icons;
  tagsRef.current = tags;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const [{ default: cytoscape }, { default: dagre }] = await Promise.all([
        import("cytoscape"),
        import("cytoscape-dagre"),
      ]);
      if (disposed || !containerRef.current) return;
      if (!(cytoscape as any).__dagreRegistered) {
        cytoscape.use(dagre as any);
        (cytoscape as any).__dagreRegistered = true;
      }
      const cy = cytoscape({
        container: containerRef.current,
        elements: [],
        wheelSensitivity: 0.22,
        style: buildStyle(iconsRef.current, tagsRef.current),
      });
      cy.on("tap", "node", (event: any) => selectRef.current(event.target.data("props") ?? null));
      cy.on("tap click", "edge", (event: any) => {
        event.stopPropagation();
        edgeSelectRef.current?.(event.target.data() ?? null);
      });
      cy.on("tap", (event: any) => {
        if (event.target === cy) selectRef.current(null);
      });
      cy.on("add remove", () => countRef.current?.(cy.elements().length));
      cyRef.current = cy;
      const api: GraphApi = {
        zoomIn: () =>
          cy.zoom({
            level: cy.zoom() * 1.25,
            renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
          }),
        zoomOut: () =>
          cy.zoom({
            level: cy.zoom() * 0.8,
            renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
          }),
        fit: () => fitVisible(cy, 40),
        center: () => cy.center(),
        reset: () => {
          cy.zoom(1);
          cy.center();
        },
        highlightPath: (ids) => {
          cy.elements().removeClass("path-node path-edge");
          const set = new Set(ids);
          cy.nodes().forEach((n: any) => {
            if (set.has(n.id())) n.addClass("path-node");
          });
          cy.edges().forEach((e: any) => {
            if (set.has(e.source().id()) && set.has(e.target().id())) e.addClass("path-edge");
          });
        },
        addElements: (newElements) => renderIncremental(cy, newElements),
        layoutPaths: (paths) => applyPathLayout(cy, paths),
        clear: () => {
          cy.elements().remove();
        },
      };

      apiRef.current = api;
      onReady?.(api);
      render(cy, elements);
    })();
    return () => {
      disposed = true;
      cyRef.current?.destroy();
      cyRef.current = null;
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (cyRef.current) render(cyRef.current, elements);
  }, [elements]);

  // Rebuild node styles when the selected icon set or analyst tags change.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.style().fromJson(buildStyle(icons, tags)).update();
  }, [icons, tags]);

  useEffect(() => {
    apiRef.current?.highlightPath(path);
  }, [path]);

  // Re-apply colors when the light/dark theme class changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new MutationObserver(() => {
      const cy = cyRef.current;
      if (!cy) return;
      requestAnimationFrame(() =>
        cy.style().fromJson(buildStyle(iconsRef.current, tagsRef.current)).update(),
      );
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef} className="grid-scan h-full w-full" />;
}
