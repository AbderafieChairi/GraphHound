/** Per-project named saved Cypher queries. */
import { getRegistryDb } from "./db";
import type { SavedQuery } from "./types";

export function addSavedQuery(project: string, name: string, cypher: string): SavedQuery {
  const db = getRegistryDb();
  const now = Date.now();
  const info = db
    .prepare("INSERT INTO saved_queries (project, name, cypher, created_at) VALUES (?, ?, ?, ?)")
    .run(project, name, cypher, now);
  return { id: Number(info.lastInsertRowid), project, name, cypher, created_at: now };
}

export function listSavedQueries(project: string): SavedQuery[] {
  const db = getRegistryDb();
  return db
    .prepare("SELECT * FROM saved_queries WHERE project = ? ORDER BY created_at DESC")
    .all(project) as SavedQuery[];
}

export function deleteSavedQuery(id: number): void {
  const db = getRegistryDb();
  db.prepare("DELETE FROM saved_queries WHERE id = ?").run(id);
}

export function renameSavedQuery(id: number, name: string): void {
  const db = getRegistryDb();
  db.prepare("UPDATE saved_queries SET name = ? WHERE id = ?").run(name, id);
}
