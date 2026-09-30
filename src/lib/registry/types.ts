/**
 * Shared row/DTO types for the registry database (`bg-database.db`).
 *
 * Kept dependency-free so every repository module can import them without
 * pulling in the SQLite connection.
 */

export type Environment = {
  id: string;
  name: string;
  project: string;
  createdAt: number;
};

export type Theme = {
  id: string;
  name: string;
  color_bg: string;
  color_panel: string;
  color_primary: string;
  color_accent: string;
  is_selected: number;
};

export type IconDefinition = {
  name: string;
  color: string;
  type: string;
};

export type IconSet = {
  id: number;
  set_name: string;
  set_custom_icons_json: Record<string, { icon: IconDefinition }>;
  is_selected: number;
  is_default: number;
};

export type EdgeDoc = { name: string; md_docs: string };

export type DbReport = {
  id: string;
  title: string;
  description: string;
  project: string;
  createdAt: number;
  sectionCount?: number;
};

export type DbReportSection = {
  id: string;
  reportId: string;
  title: string;
  description: string;
  query: string;
  defaultValue: string;
  inputType: "none" | "node" | "string" | "number" | "date";
  sortOrder: number;
};

export type SearchHistoryEntry = {
  id: number;
  project: string;
  cypher: string;
  created_at: number;
};

export type SavedQuery = {
  id: number;
  project: string;
  name: string;
  cypher: string;
  created_at: number;
};
