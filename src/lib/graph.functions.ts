import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SHARED_PROJECT = "bh";

const nodeSchema = z.object({
  objectid: z.string(),
  kind: z.string(),
  props: z.record(z.union([z.string(), z.number(), z.boolean()])),
});

const edgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.string(),
});

/* ── Graph operations (now project-aware) ── */

export const resetGraph = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ project: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { resetDataset, statsFor } = await import("./graph.server");
    return statsFor(await resetDataset(data.project ?? SHARED_PROJECT));
  });

export const ingestBatch = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        nodes: z.array(nodeSchema).max(5000),
        edges: z.array(edgeSchema).max(20000),
        project: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { ingest, statsFor } = await import("./graph.server");
    return statsFor(await ingest(data.nodes, data.edges, data.project ?? SHARED_PROJECT));
  });

export const queryGraph = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        cypher: z.string().min(1).max(20000),
        project: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { runCypher } = await import("./graph.server");
    try {
      const result = await runCypher(data.cypher, data.project ?? SHARED_PROJECT);
      return {
        ok: true,
        error: "",
        columns: result.columns,
        count: result.count,
        timeMs: result.timeMs,
        rowsJson: JSON.stringify(result.rows),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Query failed",
        columns: [] as string[],
        count: 0,
        timeMs: 0,
        rowsJson: "[]",
      };
    }
  });

export const graphStats = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ project: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { getDataset, statsFor } = await import("./graph.server");
    return statsFor(await getDataset(data.project ?? SHARED_PROJECT));
  });

/* ── Environment CRUD ── */

export const listEnvs = createServerFn({ method: "GET" }).handler(async () => {
  const { listEnvironments } = await import("./env-registry");
  return listEnvironments();
});

export const createEnv = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ name: z.string().min(1).max(100) }).parse(data))
  .handler(async ({ data }) => {
    const { createEnvironment } = await import("./env-registry");
    return createEnvironment(data.name);
  });

export const deleteEnv = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { deleteEnvironment } = await import("./env-registry");
    return { ok: deleteEnvironment(data.id) };
  });

/* ── Theme Management ── */

export const fetchThemes = createServerFn({ method: "GET" }).handler(async () => {
  const { listThemes } = await import("./env-registry");
  return listThemes();
});

export const chooseTheme = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { selectTheme } = await import("./env-registry");
    selectTheme(data.id);
    return { ok: true };
  });

export const activeTheme = createServerFn({ method: "GET" }).handler(async () => {
  const { getSelectedTheme } = await import("./env-registry");
  return getSelectedTheme();
});

export const saveCustomTheme = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        colors: z.object({
          bg: z.string(),
          panel: z.string(),
          primary: z.string(),
          accent: z.string(),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { upsertCustomTheme } = await import("./env-registry");
    return upsertCustomTheme(data.colors);
  });

export const fetchIconSets = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ project: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { listIconSets } = await import("./env-registry");
    return listIconSets(data.project ?? SHARED_PROJECT);
  });

export const chooseIconSet = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ id: z.number().int(), project: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { selectIconSet } = await import("./env-registry");
    selectIconSet(data.id, data.project ?? SHARED_PROJECT);
    return { ok: true };
  });

export const uploadIconSet = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(100),
        icons: z.record(
          z.object({ icon: z.object({ name: z.string(), color: z.string(), type: z.string() }) }),
        ),
        project: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createIconSet } = await import("./env-registry");
    return createIconSet(data.name, data.icons, data.project ?? SHARED_PROJECT);
  });

export const fetchEdgeDocs = createServerFn({ method: "GET" }).handler(async () => {
  const { listEdgeDocs } = await import("./env-registry");
  return listEdgeDocs();
});

export const uploadEdgeDocs = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        docs: z
          .array(
            z.object({ name: z.string().trim().min(1).max(200), md_docs: z.string().max(200000) }),
          )
          .min(1)
          .max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { upsertEdgeDocs } = await import("./env-registry");
    return upsertEdgeDocs(data.docs);
  });

export const fetchEdgeDoc = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ name: z.string().trim().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { getEdgeDoc } = await import("./env-registry");
    return getEdgeDoc(data.name);
  });

export const removeEdgeDoc = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ name: z.string().trim().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { deleteEdgeDoc } = await import("./env-registry");
    return { ok: deleteEdgeDoc(data.name) };
  });

export const removeIconSet = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.number().int() }).parse(data))
  .handler(async ({ data }) => {
    const { deleteIconSet } = await import("./env-registry");
    return { ok: deleteIconSet(data.id) };
  });

/* ── Search history & saved queries ── */

export const recordSearch = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ project: z.string().optional(), cypher: z.string().min(1).max(20000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { addSearchHistory } = await import("./env-registry");
    addSearchHistory(data.project ?? SHARED_PROJECT, data.cypher);
    return { ok: true };
  });

export const fetchSearchHistory = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        project: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { getSearchHistory } = await import("./env-registry");
    return getSearchHistory(data.project ?? SHARED_PROJECT, data.limit ?? 10, data.offset ?? 0);
  });

export const clearSearchHistoryFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ project: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { clearSearchHistory } = await import("./env-registry");
    clearSearchHistory(data.project ?? SHARED_PROJECT);
    return { ok: true };
  });

export const fetchSavedQueries = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ project: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { listSavedQueries } = await import("./env-registry");
    return listSavedQueries(data.project ?? SHARED_PROJECT);
  });

export const saveQuery = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        project: z.string().optional(),
        name: z.string().min(1).max(120),
        cypher: z.string().min(1).max(20000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { addSavedQuery } = await import("./env-registry");
    return addSavedQuery(data.project ?? SHARED_PROJECT, data.name, data.cypher);
  });

export const removeSavedQuery = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.number().int() }).parse(data))
  .handler(async ({ data }) => {
    const { deleteSavedQuery } = await import("./env-registry");
    deleteSavedQuery(data.id);
    return { ok: true };
  });

export const renameSavedQuery = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ id: z.number().int(), name: z.string().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { renameSavedQuery } = await import("./env-registry");
    renameSavedQuery(data.id, data.name);
    return { ok: true };
  });

/* ── Analyst tag labels ── */

export const setNodeTagLabel = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        objectid: z.string().min(1),
        label: z.string().min(1).max(64),
        enabled: z.boolean(),
        project: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { addNodeLabel, removeNodeLabel } = await import("./graph.server");
    const project = data.project ?? SHARED_PROJECT;
    const ok = data.enabled
      ? await addNodeLabel(data.objectid, data.label, project)
      : await removeNodeLabel(data.objectid, data.label, project);
    return { ok };
  });

/* ── Reports and Report Sections ── */

export const fetchReports = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ project: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { listReports } = await import("./env-registry");
    return listReports(data.project ?? SHARED_PROJECT);
  });

export const createReportFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000),
        project: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createReport } = await import("./env-registry");
    return createReport(data.title, data.description, data.project ?? SHARED_PROJECT);
  });

export const updateReportFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).max(200),
        description: z.string().max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { updateReport } = await import("./env-registry");
    return updateReport(data.id, data.title, data.description);
  });

export const deleteReportFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { deleteReport } = await import("./env-registry");
    return { ok: deleteReport(data.id) };
  });

export const fetchReportSections = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ reportId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { listReportSections } = await import("./env-registry");
    return listReportSections(data.reportId);
  });

export const createReportSectionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        reportId: z.string().min(1),
        title: z.string().min(1).max(200),
        description: z.string().max(2000),
        query: z.string().min(1).max(20000),
        defaultValue: z.string().max(500),
        inputType: z.enum(["none", "node", "string", "number", "date"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createReportSection } = await import("./env-registry");
    return createReportSection(data);
  });

export const updateReportSectionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).max(200),
        description: z.string().max(2000),
        query: z.string().min(1).max(20000),
        defaultValue: z.string().max(500),
        inputType: z.enum(["none", "node", "string", "number", "date"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { updateReportSection } = await import("./env-registry");
    return updateReportSection(data);
  });

export const deleteReportSectionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { deleteReportSection } = await import("./env-registry");
    return { ok: deleteReportSection(data.id) };
  });

export const uploadAnalysisFile = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        filename: z.string().trim().min(1),
        filepath: z.string().trim(),
        content: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { saveAnalysisFile } = await import("./env-registry");
    saveAnalysisFile(data.filename, data.filepath, data.content);
    return { ok: true };
  });

export const fetchAnalysisFiles = createServerFn({ method: "GET" }).handler(async () => {
  const { listAnalysisFiles } = await import("./env-registry");
  return listAnalysisFiles();
});

export const removeAnalysisFile = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.number().int() }).parse(data))
  .handler(async ({ data }) => {
    const { deleteAnalysisFile } = await import("./env-registry");
    return { ok: deleteAnalysisFile(data.id) };
  });

export const fetchAnalysisSectionsAndQueries = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getAnalysisSectionsAndQueries } = await import("./env-registry");
    return getAnalysisSectionsAndQueries();
  },
);
