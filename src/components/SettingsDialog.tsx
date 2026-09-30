import { useState } from "react";
import { FileText, GitBranch, Palette, Shield, X } from "lucide-react";
import { ThemeSection } from "./settings/ThemeSection";
import { IconsSection } from "./settings/IconsSection";
import { EdgeSection } from "./settings/EdgeSection";
import { AnalysisSection } from "./settings/AnalysisSection";

export type EdgeDocInfo = { name: string; md_docs: string };
export type ThemeInfo = {
  id: string;
  name: string;
  color_bg: string;
  color_panel: string;
  color_primary: string;
  color_accent: string;
  is_selected: number;
};
export type IconSetInfo = {
  id: number;
  set_name: string;
  set_custom_icons_json: Record<string, { icon: { name: string; color: string; type: string } }>;
  is_selected: number;
  is_default: number;
};
interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  themes: ThemeInfo[];
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
  onCustomThemeSaved?: (theme: ThemeInfo) => void;
  iconSets: IconSetInfo[];
  onIconSetsChange: () => void;
  onAnalysisChange?: () => void;
  /** Active environment project – icon-set selection is scoped to it. */
  project: string;
}

type Tab = "theme" | "icons" | "edge" | "analysis";

export function SettingsDialog({
  open,
  onClose,
  themes,
  activeThemeId,
  onSelectTheme,
  onCustomThemeSaved,
  iconSets,
  onIconSetsChange,
  onAnalysisChange,
  project,
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>("theme");

  if (!open) return null;

  const tabClass = (tab: Tab) =>
    `flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium ${
      activeTab === tab
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="panel relative flex h-[min(680px,90vh)] w-[760px] max-w-full overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="absolute right-4 top-4 z-10 text-muted-foreground hover:text-primary"
        >
          <X className="size-5" />
        </button>
        <div className="flex w-48 shrink-0 flex-col gap-4 border-r border-border bg-muted/20 p-4">
          <h2 className="px-2 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Settings
          </h2>
          <div className="flex flex-col gap-1.5">
            <button onClick={() => setActiveTab("theme")} className={tabClass("theme")}>
              <Palette className="size-4" />
              Theme
            </button>
            <button onClick={() => setActiveTab("icons")} className={tabClass("icons")}>
              <Shield className="size-4" />
              Icons
            </button>
            <button onClick={() => setActiveTab("edge")} className={tabClass("edge")}>
              <GitBranch className="size-4" />
              Edge
            </button>
            <button onClick={() => setActiveTab("analysis")} className={tabClass("analysis")}>
              <FileText className="size-4" />
              Analysis
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "theme" && (
            <ThemeSection
              themes={themes}
              activeThemeId={activeThemeId}
              onSelectTheme={onSelectTheme}
              onCustomThemeSaved={onCustomThemeSaved}
            />
          )}
          {activeTab === "icons" && (
            <IconsSection
              iconSets={iconSets}
              onIconSetsChange={onIconSetsChange}
              project={project}
            />
          )}
          {activeTab === "edge" && <EdgeSection />}
          {activeTab === "analysis" && (
            <AnalysisSection onAnalysisChange={onAnalysisChange} />
          )}
        </div>
      </div>
    </div>
  );
}

