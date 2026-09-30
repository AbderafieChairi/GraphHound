/* eslint-disable @typescript-eslint/no-explicit-any */
/** Report notebooks and their sections (cells). */
import { getRegistryDb, SHARED_PROJECT } from "./db";
import type { DbReport, DbReportSection } from "./types";

export function listReports(project: string = SHARED_PROJECT): DbReport[] {
  const db = getRegistryDb();
  const rows = db
    .prepare(
      `SELECT r.*, (SELECT COUNT(*) FROM report_section s WHERE s.report_id = r.id) AS sectionCount
       FROM reports r
       WHERE r.project = ? OR r.project = 'bh'
       ORDER BY r.created_at DESC`,
    )
    .all(project);

  return rows.map((r: any) => ({
    id: String(r.id),
    title: String(r.title),
    description: String(r.description),
    project: String(r.project),
    createdAt: Number(r.created_at),
    sectionCount: Number(r.sectionCount ?? 0),
  }));
}

export function createReport(
  title: string,
  description: string,
  project: string = SHARED_PROJECT,
): DbReport {
  const db = getRegistryDb();
  const id = `report-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = Date.now();
  db.prepare(
    "INSERT INTO reports (id, title, description, project, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, title, description, project, createdAt);

  return { id, title, description, project, createdAt, sectionCount: 0 };
}

export function updateReport(id: string, title: string, description: string): DbReport {
  const db = getRegistryDb();
  db.prepare("UPDATE reports SET title = ?, description = ? WHERE id = ?").run(
    title,
    description,
    id,
  );

  const row = db
    .prepare(
      `SELECT r.*, (SELECT COUNT(*) FROM report_section s WHERE s.report_id = r.id) AS sectionCount
       FROM reports r WHERE r.id = ?`,
    )
    .get(id);
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    project: String(row.project),
    createdAt: Number(row.created_at),
    sectionCount: Number(row.sectionCount ?? 0),
  };
}

export function deleteReport(id: string): boolean {
  const db = getRegistryDb();
  db.prepare("DELETE FROM report_section WHERE report_id = ?").run(id);
  const result = db.prepare("DELETE FROM reports WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listReportSections(reportId: string): DbReportSection[] {
  const db = getRegistryDb();
  const rows = db
    .prepare("SELECT * FROM report_section WHERE report_id = ? ORDER BY sort_order ASC, id ASC")
    .all(reportId);

  return rows.map((r: any) => ({
    id: String(r.id),
    reportId: String(r.report_id),
    title: String(r.title),
    description: String(r.description),
    query: String(r.query),
    defaultValue: String(r.default_value),
    inputType: String(r.input_type) as any,
    sortOrder: Number(r.sort_order ?? 0),
  }));
}

export function createReportSection(data: {
  reportId: string;
  title: string;
  description: string;
  query: string;
  defaultValue: string;
  inputType: string;
}): DbReportSection {
  const db = getRegistryDb();
  const id = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const maxOrderRow = db
    .prepare("SELECT MAX(sort_order) as maxOrder FROM report_section WHERE report_id = ?")
    .get(data.reportId);
  const sortOrder = Number(maxOrderRow?.maxOrder ?? 0) + 1;

  db.prepare(
    `INSERT INTO report_section (id, report_id, title, description, query, default_value, input_type, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.reportId,
    data.title,
    data.description,
    data.query,
    data.defaultValue,
    data.inputType,
    sortOrder,
  );

  return {
    id,
    reportId: data.reportId,
    title: data.title,
    description: data.description,
    query: data.query,
    defaultValue: data.defaultValue,
    inputType: data.inputType as any,
    sortOrder,
  };
}

export function updateReportSection(data: {
  id: string;
  title: string;
  description: string;
  query: string;
  defaultValue: string;
  inputType: string;
}): DbReportSection {
  const db = getRegistryDb();
  db.prepare(
    `UPDATE report_section
     SET title = ?, description = ?, query = ?, default_value = ?, input_type = ?
     WHERE id = ?`,
  ).run(data.title, data.description, data.query, data.defaultValue, data.inputType, data.id);

  const row = db.prepare("SELECT * FROM report_section WHERE id = ?").get(data.id);
  return {
    id: String(row.id),
    reportId: String(row.report_id),
    title: String(row.title),
    description: String(row.description),
    query: String(row.query),
    defaultValue: String(row.default_value),
    inputType: String(row.input_type) as any,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function deleteReportSection(id: string): boolean {
  const db = getRegistryDb();
  const result = db.prepare("DELETE FROM report_section WHERE id = ?").run(id);
  return result.changes > 0;
}
