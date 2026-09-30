/**
 * Registry barrel — the registry lives in `./registry/*`, split by domain.
 *
 * This file preserves the original public API (`@/lib/env-registry`) so existing
 * imports keep working. New code may import the focused modules directly, e.g.
 * `import { listReports } from "@/lib/registry/reports"`.
 *
 * Server-only: every re-exported module touches the SQLite connection.
 */
export type {
  Environment,
  Theme,
  IconDefinition,
  IconSet,
  EdgeDoc,
  DbReport,
  DbReportSection,
  SearchHistoryEntry,
  SavedQuery,
} from "./registry/types";

export { getRegistryDb, SHARED_PROJECT } from "./registry/db";
export { parseCypherFile } from "./registry/cypher-parser";

export {
  listEnvironments,
  createEnvironment,
  deleteEnvironment,
  getEnvironmentById,
  getProjectForEnv,
} from "./registry/environments";

export {
  listThemes,
  selectTheme,
  getSelectedTheme,
  upsertCustomTheme,
  type CustomThemeColors,
} from "./registry/themes";

export {
  listIconSets,
  createIconSet,
  selectIconSet,
  deleteIconSet,
  getSelectedIconSet,
  getSelectedIcons,
} from "./registry/icons";

export { listEdgeDocs, upsertEdgeDocs, getEdgeDoc, deleteEdgeDoc } from "./registry/edge-docs";

export { addSearchHistory, getSearchHistory, clearSearchHistory } from "./registry/search-history";

export {
  addSavedQuery,
  listSavedQueries,
  deleteSavedQuery,
  renameSavedQuery,
} from "./registry/saved-queries";

export {
  listReports,
  createReport,
  updateReport,
  deleteReport,
  listReportSections,
  createReportSection,
  updateReportSection,
  deleteReportSection,
} from "./registry/reports";

export {
  saveAnalysisFile,
  deleteAnalysisFile,
  listAnalysisFiles,
  getAnalysisSectionsAndQueries,
} from "./registry/analysis";
