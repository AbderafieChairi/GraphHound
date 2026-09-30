/** Per-project executed-query history. */
import { getRegistryDb } from "./db";
import type { SearchHistoryEntry } from "./types";

const MAX_HISTORY_PER_PROJECT = 300;

export function addSearchHistory(project: string, cypher: string): void {
  const db = getRegistryDb();
  const now = Date.now();
  const normalized = cypher.trim();

  // If the same query already exists for this project, remove it so the new
  // entry will appear as the most recent (preserve timeline, avoid duplicates).
  db.prepare("DELETE FROM search_history WHERE project = ? AND cypher = ?").run(
    project,
    normalized,
  );

  db.prepare("INSERT INTO search_history (project, cypher, created_at) VALUES (?, ?, ?)").run(
    project,
    normalized,
    now,
  );

  // Rotate: keep only the latest MAX_HISTORY_PER_PROJECT rows per project
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM search_history WHERE project = ?")
    .get(project).count;
  if (count > MAX_HISTORY_PER_PROJECT) {
    const excess = count - MAX_HISTORY_PER_PROJECT;
    db.prepare(
      `DELETE FROM search_history WHERE id IN (
        SELECT id FROM search_history WHERE project = ? ORDER BY created_at ASC LIMIT ?
      )`,
    ).run(project, excess);
  }
}

export function getSearchHistory(
  project: string,
  limit: number,
  offset: number,
): SearchHistoryEntry[] {
  const db = getRegistryDb();
  return db
    .prepare(
      "SELECT * FROM search_history WHERE project = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .all(project, limit, offset) as SearchHistoryEntry[];
}

export function clearSearchHistory(project: string): void {
  const db = getRegistryDb();
  db.prepare("DELETE FROM search_history WHERE project = ?").run(project);
}
