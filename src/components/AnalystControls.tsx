import { Home, Minus, Plus } from "lucide-react";
import type { GraphApi } from "@/components/GraphCanvas";

export function AnalystControls({ api, zoom }: { api: GraphApi | null; zoom?: number }) {
  return (
    <div className="panel absolute bottom-4 left-4 z-10 flex flex-col gap-1 p-1.5">
      <button
        aria-label="Zoom in"
        title="Zoom in"
        onClick={() => api?.zoomIn()}
        className="control"
      >
        <Plus />
      </button>
      <button
        aria-label="Home page"
        title="Home page"
        onClick={() => api?.reset()}
        className="control"
      >
        <Home />
      </button>
      <button
        aria-label="Zoom out"
        title="Zoom out"
        onClick={() => api?.zoomOut()}
        className="control"
      >
        <Minus />
      </button>
    </div>
  );
}
