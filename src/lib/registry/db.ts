/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Registry database connection, schema, and first-run seeding.
 *
 * Owns the single `bg-database.db` connection (created lazily and memoized) and
 * the DDL/seed data. Repository modules import {@link getRegistryDb} and operate
 * on their own tables; they never open the connection themselves.
 *
 * Server-only module.
 */
import { resolveSqliteShim } from "../sqlite-shim-path";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { REPORT_SECTIONS } from "../report-sections";
import { parseCypherFile } from "./cypher-parser";

const require = createRequire(import.meta.url);
const SHIM_PATH = resolveSqliteShim(import.meta.url);

// Reuse the same resolution-patching approach from graph.server.ts
let patched = false;
function patchSqliteResolution() {
  if (patched) return;
  const Module = require("node:module") as any;
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request: string, ...rest: any[]) {
    if (request === "better-sqlite3") return SHIM_PATH;
    return original.call(this, request, ...rest);
  };
  patched = true;
}

/** The project key of the always-present virtual "Shared" environment. */
export const SHARED_PROJECT = "bh";

const DEFAULT_ICON_SET: Record<string, { icon: { name: string; color: string; type: string } }> =
  {};

let _registryDb: any = null;

export function getRegistryDb(): any {
  if (_registryDb) return _registryDb;

  patchSqliteResolution();

  const dir = path.resolve(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });

  const Database = require("better-sqlite3");
  _registryDb = new Database(path.join(dir, "bg-database.db"));
  _registryDb.pragma("journal_mode = WAL");

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS environments (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      project    TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS themes (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      color_bg      TEXT NOT NULL,
      color_panel   TEXT NOT NULL,
      color_primary TEXT NOT NULL,
      color_accent  TEXT NOT NULL,
      is_selected   INTEGER NOT NULL DEFAULT 0
    );
  `);

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS search_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project    TEXT NOT NULL,
      cypher     TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS saved_queries (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project    TEXT NOT NULL,
      name       TEXT NOT NULL,
      cypher     TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS custom_icons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_name TEXT NOT NULL UNIQUE,
      set_custom_icons_json TEXT NOT NULL,
      is_selected INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0
    );
  `);

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS env_icon_selection (
      project      TEXT PRIMARY KEY,
      icon_set_id  INTEGER NOT NULL
    );
  `);

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS edge_docs (
      name TEXT PRIMARY KEY,
      md_docs TEXT NOT NULL
    );
  `);

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS analysis_file (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filepath TEXT NOT NULL,
      filename TEXT NOT NULL
    );
  `);

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS analysis_section (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_file_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (analysis_file_id) REFERENCES analysis_file(id) ON DELETE CASCADE
    );
  `);

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS analysis_query (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_section_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (analysis_section_id) REFERENCES analysis_section(id) ON DELETE CASCADE
    );
  `);

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      project TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  _registryDb.exec(`
    CREATE TABLE IF NOT EXISTS report_section (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      query TEXT NOT NULL,
      default_value TEXT NOT NULL,
      input_type TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  seedDefaults(_registryDb);

  return _registryDb;
}

/** Populate first-run defaults: baseline report, predefined queries, icons, themes. */
function seedDefaults(db: any): void {
  const reportCount = db.prepare("SELECT COUNT(*) AS count FROM reports").get().count;
  if (reportCount === 0) {
    const defaultReportId = "default-baseline-report";
    const now = Date.now();
    db.prepare(
      "INSERT INTO reports (id, title, description, project, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(
      defaultReportId,
      "Active Directory Security Baseline",
      "Standard Active Directory security analysis cells covering domain admin membership, host sessions, local admin rights, tagged node paths, and stale passwords.",
      SHARED_PROJECT,
      now,
    );

    const insertSection = db.prepare(
      `INSERT INTO report_section (id, report_id, title, description, query, default_value, input_type, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    REPORT_SECTIONS.forEach((sec, idx) => {
      insertSection.run(
        sec.id,
        defaultReportId,
        sec.title,
        sec.description,
        sec.query,
        sec.defaultValue,
        sec.inputType,
        idx + 1,
      );
    });
  }

  const predefinedCount = db
    .prepare("SELECT COUNT(*) AS count FROM analysis_file WHERE filepath = '' AND filename = ''")
    .get().count;
  if (predefinedCount === 0) {
    try {
      const cypherFilePath = path.join(process.cwd(), "examples", "bh_ad_queries.cypher");
      if (fs.existsSync(cypherFilePath)) {
        const content = fs.readFileSync(cypherFilePath, "utf8");
        const parsed = parseCypherFile(content);

        db.transaction(() => {
          const fileResult = db
            .prepare("INSERT INTO analysis_file (filename, filepath) VALUES ('', '')")
            .run();
          const fileId = Number(fileResult.lastInsertRowid);

          const insertSection = db.prepare(
            "INSERT INTO analysis_section (analysis_file_id, name, sort_order) VALUES (?, ?, ?)",
          );
          const insertQuery = db.prepare(
            "INSERT INTO analysis_query (analysis_section_id, name, query, sort_order) VALUES (?, ?, ?, ?)",
          );

          parsed.forEach((sec, secIdx) => {
            const secResult = insertSection.run(fileId, sec.name, secIdx + 1);
            const secId = Number(secResult.lastInsertRowid);
            sec.queries.forEach((q, qIdx) => {
              insertQuery.run(secId, q.name, q.query, qIdx + 1);
            });
          });
        })();
      }
    } catch (err) {
      console.error("Failed to seed predefined cypher queries:", err);
    }
  }

  const iconCount = db.prepare("SELECT COUNT(*) AS count FROM custom_icons").get().count;
  if (iconCount === 0) {
    db.prepare(
      "INSERT INTO custom_icons (set_name, set_custom_icons_json, is_selected, is_default) VALUES (?, ?, 1, 1)",
    ).run("Default", JSON.stringify(DEFAULT_ICON_SET));
  }

  const count = db.prepare("SELECT COUNT(*) AS count FROM themes").get().count;
  if (count === 0) {
    const defaults = [
      {
        id: "classic-dark",
        name: "Classic Dark",
        color_bg: "#141414",
        color_panel: "#1c1c1e",
        color_primary: "#e2e8f0",
        color_accent: "#3b82f6",
        is_selected: 1,
      },
      {
        id: "slate-ocean",
        name: "Slate Ocean",
        color_bg: "#0f172a",
        color_panel: "#1e293b",
        color_primary: "#38bdf8",
        color_accent: "#f43f5e",
        is_selected: 0,
      },
      {
        id: "emerald-forest",
        name: "Emerald Forest",
        color_bg: "#062016",
        color_panel: "#0b3324",
        color_primary: "#10b981",
        color_accent: "#f59e0b",
        is_selected: 0,
      },
      {
        id: "cyberpunk",
        name: "Cyberpunk",
        color_bg: "#130f26",
        color_panel: "#1d173b",
        color_primary: "#ec4899",
        color_accent: "#06b6d4",
        is_selected: 0,
      },
      {
        id: "sunset-warm",
        name: "Sunset Warm",
        color_bg: "#1c1917",
        color_panel: "#292524",
        color_primary: "#f97316",
        color_accent: "#e11d48",
        is_selected: 0,
      },
      {
        id: "classic-light",
        name: "Classic Light",
        color_bg: "#f8fafc",
        color_panel: "#ffffff",
        color_primary: "#0f172a",
        color_accent: "#2563eb",
        is_selected: 0,
      },
    ];
    const stmt = db.prepare(
      "INSERT INTO themes (id, name, color_bg, color_panel, color_primary, color_accent, is_selected) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const t of defaults) {
      stmt.run(
        t.id,
        t.name,
        t.color_bg,
        t.color_panel,
        t.color_primary,
        t.color_accent,
        t.is_selected,
      );
    }
  }
}
