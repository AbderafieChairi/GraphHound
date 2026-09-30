import { useState } from "react";
import { Check, Loader2, Palette } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { chooseTheme, saveCustomTheme } from "@/lib/graph.functions";
import type { ThemeInfo } from "../SettingsDialog";

interface ThemeSectionProps {
  themes: ThemeInfo[];
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
  /** Called after the "Custom" theme is saved so the parent can apply it. */
  onCustomThemeSaved?: (theme: ThemeInfo) => void;
}

const CUSTOM_DEFAULTS = {
  bg: "#141414",
  panel: "#1c1c1e",
  primary: "#22c55e",
  accent: "#3b82f6",
};

/** The four editable channels of a custom theme, in display order. */
const CUSTOM_FIELDS: { key: keyof typeof CUSTOM_DEFAULTS; label: string }[] = [
  { key: "bg", label: "Background" },
  { key: "panel", label: "Panel" },
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent" },
];

export function ThemeSection({
  themes,
  activeThemeId,
  onSelectTheme,
  onCustomThemeSaved,
}: ThemeSectionProps) {
  const [saving, setSaving] = useState(false);
  const changeTheme = useServerFn(chooseTheme);
  const saveCustom = useServerFn(saveCustomTheme);

  // Seed the pickers from a previously saved custom theme, else sensible defaults.
  const existingCustom = themes.find((t) => t.id === "custom");
  const [colors, setColors] = useState({
    bg: existingCustom?.color_bg ?? CUSTOM_DEFAULTS.bg,
    panel: existingCustom?.color_panel ?? CUSTOM_DEFAULTS.panel,
    primary: existingCustom?.color_primary ?? CUSTOM_DEFAULTS.primary,
    accent: existingCustom?.color_accent ?? CUSTOM_DEFAULTS.accent,
  });

  const selectTheme = async (id: string) => {
    if (saving || id === activeThemeId) return;
    setSaving(true);
    try {
      await changeTheme({ data: { id } });
      onSelectTheme(id);
    } finally {
      setSaving(false);
    }
  };

  const applyCustom = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await saveCustom({ data: { colors } });
      onCustomThemeSaved?.(saved as ThemeInfo);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Interface Theme</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Select a color profile for the workspace.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => void selectTheme(theme.id)}
            disabled={saving}
            className={`relative flex flex-col rounded-lg border p-3.5 text-left ${
              theme.id === activeThemeId
                ? "border-primary bg-primary/5 ring-1 ring-primary/25"
                : "border-border hover:bg-muted/20"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold">{theme.name}</span>
              {theme.id === activeThemeId && <Check className="size-4 text-primary" />}
            </div>
            <div className="flex gap-1.5">
              {[
                theme.color_bg,
                theme.color_panel,
                theme.color_primary,
                theme.color_accent,
              ].map((color) => (
                <span
                  key={color}
                  className="size-5 rounded-full border border-border/50"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Custom theme builder */}
      <div className="mt-2 rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <span className="text-xs font-semibold">Custom</span>
            {activeThemeId === "custom" && <Check className="size-4 text-primary" />}
          </div>
          <div className="flex gap-1.5">
            {[colors.bg, colors.panel, colors.primary, colors.accent].map((color, i) => (
              <span
                key={i}
                className="size-5 rounded-full border border-border/50"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Pick your own colors and save them as the "Custom" theme.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {CUSTOM_FIELDS.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2.5 rounded-md border border-border bg-muted/10 p-2"
            >
              <input
                type="color"
                value={colors[key]}
                onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
                className="size-8 shrink-0 cursor-pointer rounded border border-border/50 bg-transparent p-0"
                aria-label={label}
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-medium">{label}</span>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  {colors[key]}
                </span>
              </div>
            </label>
          ))}
        </div>
        <button
          onClick={() => void applyCustom()}
          disabled={saving}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Save &amp; apply custom
        </button>
      </div>
    </div>
  );
}
