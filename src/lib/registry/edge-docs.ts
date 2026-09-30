/** Markdown documentation per relationship (edge) type. */
import { getRegistryDb } from "./db";
import type { EdgeDoc } from "./types";

export function listEdgeDocs(): EdgeDoc[] {
  const db = getRegistryDb();
  return db.prepare("SELECT name, md_docs FROM edge_docs ORDER BY name ASC").all() as EdgeDoc[];
}

export function upsertEdgeDocs(docs: EdgeDoc[]): EdgeDoc[] {
  const db = getRegistryDb();
  const statement = db.prepare(
    "INSERT INTO edge_docs (name, md_docs) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET md_docs = excluded.md_docs",
  );
  db.transaction(() => {
    for (const doc of docs) statement.run(doc.name.trim(), doc.md_docs);
  })();
  return listEdgeDocs();
}

export function getEdgeDoc(name: string): EdgeDoc | null {
  const row = getRegistryDb()
    .prepare("SELECT name, md_docs FROM edge_docs WHERE lower(name) = lower(?)")
    .get(name.trim()) as EdgeDoc | undefined;
  return row ?? null;
}

export function deleteEdgeDoc(name: string): boolean {
  const db = getRegistryDb();
  const result = db.prepare("DELETE FROM edge_docs WHERE lower(name) = lower(?)").run(name.trim());
  return result.changes > 0;
}
