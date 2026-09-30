/** Color theme records. */
import { getRegistryDb } from "./db";
import type { Theme } from "./types";

export function listThemes(): Theme[] {
  const db = getRegistryDb();
  return db.prepare("SELECT * FROM themes").all() as Theme[];
}

export function selectTheme(id: string): void {
  const db = getRegistryDb();
  db.transaction(() => {
    db.prepare("UPDATE themes SET is_selected = 0").run();
    db.prepare("UPDATE themes SET is_selected = 1 WHERE id = ?").run(id);
  })();
}

export type CustomThemeColors = {
  bg: string;
  panel: string;
  primary: string;
  accent: string;
};

/**
 * Insert or update the single user-defined "Custom" theme (id `custom`) and
 * make it the selected theme. Repeated saves overwrite the same row.
 */
export function upsertCustomTheme(colors: CustomThemeColors): Theme {
  const db = getRegistryDb();
  db.transaction(() => {
    db.prepare("UPDATE themes SET is_selected = 0").run();
    db.prepare(
      `INSERT INTO themes (id, name, color_bg, color_panel, color_primary, color_accent, is_selected)
       VALUES ('custom', 'Custom', ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
         color_bg = excluded.color_bg,
         color_panel = excluded.color_panel,
         color_primary = excluded.color_primary,
         color_accent = excluded.color_accent,
         is_selected = 1`,
    ).run(colors.bg, colors.panel, colors.primary, colors.accent);
  })();

  return {
    id: "custom",
    name: "Custom",
    color_bg: colors.bg,
    color_panel: colors.panel,
    color_primary: colors.primary,
    color_accent: colors.accent,
    is_selected: 1,
  };
}

export function getSelectedTheme(): Theme {
  const db = getRegistryDb();
  const row = db.prepare("SELECT * FROM themes WHERE is_selected = 1").get() as Theme;
  if (row) return row;
  return {
    id: "classic-dark",
    name: "Classic Dark",
    color_bg: "#141414",
    color_panel: "#1c1c1e",
    color_primary: "#e2e8f0",
    color_accent: "#3b82f6",
    is_selected: 1,
  };
}
