/** Uploaded/predefined `.cypher` analysis packs and their sections/queries. */
import { getRegistryDb } from "./db";
import { parseCypherFile } from "./cypher-parser";

export function saveAnalysisFile(filename: string, filepath: string, content: string) {
  const db = getRegistryDb();
  const parsed = parseCypherFile(content);

  db.transaction(() => {
    // Check if file already exists (by filename)
    let fileRow = db.prepare("SELECT id FROM analysis_file WHERE filename = ?").get(filename) as
      { id: number } | undefined;
    if (fileRow) {
      // Overwrite: delete existing sections and queries for this file
      const sections = db
        .prepare("SELECT id FROM analysis_section WHERE analysis_file_id = ?")
        .all(fileRow.id) as { id: number }[];
      for (const sec of sections) {
        db.prepare("DELETE FROM analysis_query WHERE analysis_section_id = ?").run(sec.id);
      }
      db.prepare("DELETE FROM analysis_section WHERE analysis_file_id = ?").run(fileRow.id);

      // Update filepath
      db.prepare("UPDATE analysis_file SET filepath = ? WHERE id = ?").run(filepath, fileRow.id);
    } else {
      const result = db
        .prepare("INSERT INTO analysis_file (filename, filepath) VALUES (?, ?)")
        .run(filename, filepath);
      fileRow = { id: Number(result.lastInsertRowid) };
    }

    const insertSection = db.prepare(
      "INSERT INTO analysis_section (analysis_file_id, name, sort_order) VALUES (?, ?, ?)",
    );
    const insertQuery = db.prepare(
      "INSERT INTO analysis_query (analysis_section_id, name, query, sort_order) VALUES (?, ?, ?, ?)",
    );

    parsed.forEach((sec, secIdx) => {
      const secResult = insertSection.run(fileRow!.id, sec.name, secIdx + 1);
      const secId = Number(secResult.lastInsertRowid);
      sec.queries.forEach((q, qIdx) => {
        insertQuery.run(secId, q.name, q.query, qIdx + 1);
      });
    });
  })();
}

export function deleteAnalysisFile(id: number): boolean {
  const db = getRegistryDb();
  let success = false;
  db.transaction(() => {
    const sections = db
      .prepare("SELECT id FROM analysis_section WHERE analysis_file_id = ?")
      .all(id) as { id: number }[];
    for (const sec of sections) {
      db.prepare("DELETE FROM analysis_query WHERE analysis_section_id = ?").run(sec.id);
    }
    db.prepare("DELETE FROM analysis_section WHERE analysis_file_id = ?").run(id);
    const result = db.prepare("DELETE FROM analysis_file WHERE id = ?").run(id);
    success = result.changes > 0;
  })();
  return success;
}

export function listAnalysisFiles() {
  const db = getRegistryDb();
  return db.prepare("SELECT * FROM analysis_file ORDER BY id DESC").all() as {
    id: number;
    filename: string;
    filepath: string;
  }[];
}

export function getAnalysisSectionsAndQueries() {
  const db = getRegistryDb();
  const sections = db
    .prepare(
      `
    SELECT s.id as section_id, s.name as section_name, f.filename, f.filepath
    FROM analysis_section s
    JOIN analysis_file f ON s.analysis_file_id = f.id
    ORDER BY f.id ASC, s.sort_order ASC
  `,
    )
    .all() as { section_id: number; section_name: string; filename: string; filepath: string }[];

  const result = [];
  for (const sec of sections) {
    const queries = db
      .prepare(
        `
      SELECT id, name, query
      FROM analysis_query
      WHERE analysis_section_id = ?
      ORDER BY sort_order ASC
    `,
      )
      .all(sec.section_id) as { id: number; name: string; query: string }[];

    result.push({
      sectionId: sec.section_id,
      sectionName: sec.section_name,
      filename: sec.filename,
      filepath: sec.filepath,
      queries: queries.map((q) => ({
        id: q.id,
        title: q.name,
        cypher: q.query,
      })),
    });
  }
  return result;
}
