/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { readTags, saveTags, tagLabel, type AnalystTag, type TagMap } from "@/lib/analyst";
import { setNodeTagLabel, fetchEdgeDoc } from "@/lib/graph.functions";

export function useNodeSelection({ currentProject }: { currentProject: string }) {
  const loadEdgeDoc = useServerFn(fetchEdgeDoc);

  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Record<string, any> | null>(null);
  const [edgeDoc, setEdgeDoc] = useState<{ name: string; md_docs: string } | null>(null);
  const [edgeDocsDialogOpen, setEdgeDocsDialogOpen] = useState(false);
  const [showSelectedNodes, setShowSelectedNodes] = useState(false);
  const [tags, setTags] = useState<TagMap>(() => readTags());

  useEffect(() => {
    saveTags(tags);
  }, [tags]);

  const handleEdgeSelect = useCallback(
    async (edge: Record<string, any> | null) => {
      setSelectedEdge(edge);
      setSelected(null);
      if (!edge) {
        setEdgeDoc(null);
        return;
      }
      setEdgeDocsDialogOpen(true);
      try {
        const name = String(edge.label ?? edge.type ?? "").trim();
        setEdgeDoc(name ? await loadEdgeDoc({ data: { name } }) : null);
      } catch (error) {
        console.error("[v0] Failed to load edge documentation", error);
        setEdgeDoc(null);
      }
    },
    [loadEdgeDoc],
  );

  const toggleTag = useCallback(
    (id: string, tag: AnalystTag) => {
      const hasTag = !!tags[id]?.includes(tag);
      setTags((old) => ({
        ...old,
        [id]: old[id]?.includes(tag) ? old[id].filter((t) => t !== tag) : [...(old[id] ?? []), tag],
      }));
      setNodeTagLabel({
        data: {
          objectid: id,
          label: tagLabel(tag),
          enabled: !hasTag,
          project: currentProject,
        },
      }).catch((err) => console.error("Failed to set tag label on server:", err));
    },
    [tags, currentProject],
  );

  return {
    selected,
    setSelected,
    selectedEdge,
    setSelectedEdge,
    edgeDoc,
    edgeDocsDialogOpen,
    setEdgeDocsDialogOpen,
    showSelectedNodes,
    setShowSelectedNodes,
    tags,
    handleEdgeSelect,
    toggleTag,
  };
}
