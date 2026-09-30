/* eslint-disable @typescript-eslint/no-explicit-any */
/** Custom icon sets and their per-environment selection. */
import { getRegistryDb, SHARED_PROJECT } from "./db";
import type { IconDefinition, IconSet } from "./types";

/**
 * Resolve which icon-set id is selected for a given environment/project.
 *
 * Selection is stored per-project in `env_icon_selection`. When a project has
 * no explicit choice yet (or its chosen set was deleted), it falls back to the
 * default set so every environment always resolves to a valid set.
 */
function resolveSelectedIconSetId(db: any, project: string): number | null {
  const mapped = db
    .prepare(
      `SELECT s.icon_set_id AS id
       FROM env_icon_selection s
       JOIN custom_icons c ON c.id = s.icon_set_id
       WHERE s.project = ?`,
    )
    .get(project) as { id: number } | undefined;
  if (mapped) return mapped.id;

  const fallback = db
    .prepare("SELECT id FROM custom_icons ORDER BY is_default DESC, set_name ASC LIMIT 1")
    .get() as { id: number } | undefined;
  return fallback?.id ?? null;
}

export function listIconSets(project: string = SHARED_PROJECT): IconSet[] {
  const db = getRegistryDb();
  const selectedId = resolveSelectedIconSetId(db, project);
  return (
    db.prepare("SELECT * FROM custom_icons ORDER BY is_default DESC, set_name ASC").all() as any[]
  ).map((row) => ({
    id: row.id,
    set_name: row.set_name,
    set_custom_icons_json: JSON.parse(row.set_custom_icons_json),
    is_selected: row.id === selectedId ? 1 : 0,
    is_default: row.is_default,
  }));
}

export function createIconSet(
  name: string,
  icons: Record<string, { icon: IconDefinition }>,
  project: string = SHARED_PROJECT,
): IconSet {
  const db = getRegistryDb();
  // Newly imported sets become the active set for the current environment so
  // they apply to its graph immediately.
  let newId = 0;
  db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO custom_icons (set_name, set_custom_icons_json, is_selected, is_default) VALUES (?, ?, 0, 0)",
      )
      .run(name.trim(), JSON.stringify(icons));
    newId = Number(result.lastInsertRowid);
    db.prepare(
      `INSERT INTO env_icon_selection (project, icon_set_id) VALUES (?, ?)
       ON CONFLICT(project) DO UPDATE SET icon_set_id = excluded.icon_set_id`,
    ).run(project, newId);
  })();
  return listIconSets(project).find((set) => set.id === newId) as IconSet;
}

export function selectIconSet(id: number, project: string = SHARED_PROJECT): void {
  const db = getRegistryDb();
  db.prepare(
    `INSERT INTO env_icon_selection (project, icon_set_id) VALUES (?, ?)
     ON CONFLICT(project) DO UPDATE SET icon_set_id = excluded.icon_set_id`,
  ).run(project, id);
}

export function deleteIconSet(id: number): boolean {
  const db = getRegistryDb();
  const row = db.prepare("SELECT is_default FROM custom_icons WHERE id = ?").get(id) as any;
  if (!row || row.is_default) return false;
  let changes = 0;
  db.transaction(() => {
    // Drop any per-environment selections pointing at this set so those
    // environments fall back to the default set.
    db.prepare("DELETE FROM env_icon_selection WHERE icon_set_id = ?").run(id);
    changes = db.prepare("DELETE FROM custom_icons WHERE id = ?").run(id).changes;
  })();
  return changes > 0;
}

export function getSelectedIconSet(project: string = SHARED_PROJECT): IconSet {
  const sets = listIconSets(project);
  return (sets.find((set) => set.is_selected) ?? sets[0]) as IconSet;
}

export function getSelectedIcons(
  project: string = SHARED_PROJECT,
): Record<string, { icon: IconDefinition }> {
  return getSelectedIconSet(project).set_custom_icons_json;
}
