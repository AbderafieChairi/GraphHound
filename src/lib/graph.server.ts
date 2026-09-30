/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LeanGraph-backed graph store (server only).
 *
 * LeanGraph's local/test mode requires a `better-sqlite3` module. We resolve that
 * request to a small shim backed by Node's built-in `node:sqlite`, so no native
 * module compilation is needed.
 */
import { resolveSqliteShim } from "./sqlite-shim-path";
import { createRequire } from "node:module";

import type { GraphEdgeInput, GraphNodeInput } from "./sharphound";

const require = createRequire(import.meta.url);
const SHIM_PATH = resolveSqliteShim(import.meta.url);

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

export type Dataset = {
  db: any;
  createdAt: number;
  nodeCount: number;
  edgeCount: number;
  kinds: Record<string, number>;
  edgeTypes: Record<string, number>;
};

const SHARED_PROJECT = "bh";
const datasets = new Map<string, Dataset>();

/**
 * Cache of low-level LeanGraph `GraphDatabase` handles keyed by project.
 *
 * `enrichEdges` and `removeNodeLabel` need raw SQL access to the same SQLite
 * file the pooled LeanGraph instance uses. Opening (and `initialize()`-ing) a
 * fresh handle on every query is expensive and churns memory badly — a report
 * fires one query per section in parallel, so a fresh connection was being
 * created and torn down for each. Reuse one handle per project instead; it is
 * kept open for the lifetime of the process, exactly like the dataset pool.
 */
const rawDbs = new Map<string, any>();

async function getRawDb(project: string): Promise<any> {
  const existing = rawDbs.get(project);
  if (existing) return existing;

  patchSqliteResolution();
  const { GraphDatabase } = await import("leangraph");
  const raw = new (GraphDatabase as any)(`./data/${project}.db`);
  raw.initialize();
  rawDbs.set(project, raw);
  return raw;
}

function closeRawDb(project: string): void {
  const raw = rawDbs.get(project);
  if (!raw) return;
  rawDbs.delete(project);
  try {
    raw.close();
  } catch {
    /* ignore */
  }
}

async function hydrateDatasetMetrics(db: any, dataset: Dataset): Promise<void> {
  const nodeCountResult = await db.queryRaw("MATCH (n) RETURN count(n) AS count");
  const edgeCountResult = await db.queryRaw("MATCH ()-[r]->() RETURN count(r) AS count");

  dataset.nodeCount = Number(nodeCountResult?.data?.[0]?.count ?? 0);
  dataset.edgeCount = Number(edgeCountResult?.data?.[0]?.count ?? 0);

  const kindResult = await db.queryRaw("MATCH (n) RETURN n.kind AS kind, count(*) AS count");
  for (const row of kindResult?.data ?? []) {
    const kind = String(row.kind ?? "");
    if (!kind) continue;
    dataset.kinds[kind] = Number(row.count ?? 0);
  }

  const edgeTypeResult = await db.queryRaw(
    "MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS count",
  );
  for (const row of edgeTypeResult?.data ?? []) {
    const type = String(row.type ?? "");
    if (!type) continue;
    dataset.edgeTypes[type] = Number(row.count ?? 0);
  }
}

export async function resetDataset(project: string = SHARED_PROJECT): Promise<Dataset> {
  patchSqliteResolution();
  const key = project;
  const existing = datasets.get(key);
  if (existing) {
    try {
      existing.db.close();
    } catch {
      /* ignore */
    }
  }
  // Drop any cached raw handle so it can't outlive the reset dataset.
  closeRawDb(key);
  const { LeanGraph } = await import("leangraph");
  // Use local (on-disk) mode so the SQLite database persists between page reloads.
  // Data files will be stored under ./data by default; specify dataPath if a
  // different location is desired.
  const db = await LeanGraph({ mode: "local", project: key, dataPath: "./data" });
  try {
    await db.execute("MATCH (n) DETACH DELETE n");
  } catch (err) {
    console.error("Failed to run DETACH DELETE in resetDataset:", err);
  }
  const dataset: Dataset = {
    db,
    createdAt: Date.now(),
    nodeCount: 0,
    edgeCount: 0,
    kinds: {},
    edgeTypes: {},
  };
  datasets.set(key, dataset);
  return dataset;
}

export async function getDataset(project: string = SHARED_PROJECT): Promise<Dataset> {
  const key = project;
  const existing = datasets.get(key);
  if (existing) return existing;

  patchSqliteResolution();
  const { LeanGraph } = await import("leangraph");
  const db = await LeanGraph({ mode: "local", project: key, dataPath: "./data" });

  const dataset: Dataset = {
    db,
    createdAt: Date.now(),
    nodeCount: 0,
    edgeCount: 0,
    kinds: {},
    edgeTypes: {},
  };

  await hydrateDatasetMetrics(db, dataset);
  datasets.set(key, dataset);
  return dataset;
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const NODE_KEYS = [
  "objectid",
  "kind",
  "name",
  "domain",
  "domainsid",
  "distinguishedname",
  "samaccountname",
  "description",
  "operatingsystem",
  "enabled",
  "admincount",
  "hasspn",
  "unconstraineddelegation",
  "trustedtoauth",
  "dontreqpreauth",
  "passwordnotreqd",
  "pwdneverexpires",
  "sensitive",
  "haslaps",
  "isdc",
  "highvalue",
  "blocksinheritance",
  "lastlogontimestamp",
  "pwdlastset",
  "whencreated",
  "title",
  "email",
  "gpcpath",
  "spncount",
] as const;

const NODE_MAP = NODE_KEYS.map((key) => `${key}: row.${key}`).join(", ");

function getLabelSuffix(row: Record<string, any>): string | null {
  const kind = row.kind;
  if (!kind) return null;
  const normalized = String(kind).trim().toLowerCase();
  if (normalized === "base") return null;

  if (normalized === "c") {
    const dn = String(row.distinguishedname || "").toLowerCase();
    if (dn.includes("certificate template") || dn.includes("public key services")) {
      return "CertTemplate";
    }
    return "Computer";
  }
  if (normalized === "computer") return "Computer";
  if (normalized === "user" || normalized === "u") return "User";
  if (normalized === "group" || normalized === "g") return "Group";
  if (normalized === "gpo") return "GPO";
  if (normalized === "ou") return "OU";
  if (normalized === "container") return "Container";
  if (normalized === "domain") return "Domain";
  if (normalized === "aiaca") return "AIACA";
  if (normalized === "rootca") return "RootCA";
  if (normalized === "enterpriseca") return "EnterpriseCA";
  if (normalized === "ntauthstore") return "NTAuthStore";
  if (normalized === "certtemplate" || normalized === "certtemplates") return "CertTemplate";

  const safe = String(kind).replace(/[^A-Za-z0-9_]/g, "");
  if (!safe) return null;
  if (safe === safe.toLowerCase()) {
    return safe.charAt(0).toUpperCase() + safe.slice(1);
  }
  return safe;
}

/**
 * Insert nodes (CREATE with an explicit property map) and relationships
 * (MERGE endpoints by objectid, literal relationship type).
 */
export async function ingest(
  nodes: GraphNodeInput[],
  edges: GraphEdgeInput[],
  project: string = SHARED_PROJECT,
): Promise<Dataset> {
  const dataset = await getDataset(project);
  const { db } = dataset;

  for (const batch of chunk(nodes, 200)) {
    const rows = batch.map((node) => {
      const row: Record<string, unknown> = {};
      for (const key of NODE_KEYS) row[key] = node.props[key] ?? null;
      row["objectid"] = node.objectid;
      row["kind"] = node.kind;
      row["name"] = node.props["name"] ?? node.objectid;
      return row;
    });

    const groupsByLabel = new Map<string | null, typeof rows>();
    for (const row of rows) {
      const label = getLabelSuffix(row);
      const list = groupsByLabel.get(label) ?? [];
      list.push(row);
      groupsByLabel.set(label, list);
    }

    for (const [label, labelRows] of groupsByLabel.entries()) {
      const labels = label ? `:Base:${label}` : ":Base";
      await db.execute(`UNWIND $rows AS row CREATE (n${labels} {${NODE_MAP}})`, {
        rows: labelRows,
      });
    }

    for (const node of batch) dataset.kinds[node.kind] = (dataset.kinds[node.kind] ?? 0) + 1;
  }
  dataset.nodeCount += nodes.length;

  const byType = new Map<string, GraphEdgeInput[]>();
  for (const edge of edges) {
    const type = edge.type.replace(/[^A-Za-z0-9_]/g, "");
    if (!type) continue;
    const bucket = byType.get(type) ?? [];
    bucket.push(edge);
    byType.set(type, bucket);
  }

  for (const [type, list] of byType) {
    for (const batch of chunk(list, 200)) {
      await db.execute(
        `UNWIND $rows AS row
         MERGE (a:Base {objectid: row.source})
         MERGE (b:Base {objectid: row.target})
         CREATE (a)-[:${type}]->(b)`,
        { rows: batch },
      );
    }
    dataset.edgeTypes[type] = (dataset.edgeTypes[type] ?? 0) + list.length;
    dataset.edgeCount += list.length;
  }

  return dataset;
}

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  count: number;
  timeMs: number;
};

async function enrichEdges(rows: Record<string, unknown>[], project: string): Promise<void> {
  const edgeObjects = new Map<string, any[]>();
  function collectEdgeObjects(val: any) {
    if (!val || typeof val !== "object") return;
    if (Array.isArray(val)) {
      for (const item of val) {
        collectEdgeObjects(item);
      }
    } else {
      const id = val._nf_id || val.id;
      if (typeof id === "string" && val.objectid === undefined && val.kind === undefined) {
        const list = edgeObjects.get(id) ?? [];
        list.push(val);
        edgeObjects.set(id, list);
      }
      for (const key of Object.keys(val)) {
        if (key !== "_nf_id" && key !== "id") {
          collectEdgeObjects(val[key]);
        }
      }
    }
  }

  for (const row of rows) {
    collectEdgeObjects(row);
  }

  const ids = Array.from(edgeObjects.keys());
  if (ids.length === 0) return;

  const raw = await getRawDb(project);
  const chunkSize = 500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunkIds = ids.slice(i, i + chunkSize);
    const placeholders = chunkIds.map(() => "?").join(",");
    const sql = `
      SELECT
        e.id AS id,
        e.type AS type,
        e.source_id AS source_id,
        e.target_id AS target_id,
        json_extract(sn.properties, '$.objectid') AS source_objectid,
        json_extract(tn.properties, '$.objectid') AS target_objectid
      FROM edges e
      LEFT JOIN nodes sn ON e.source_id = sn.id
      LEFT JOIN nodes tn ON e.target_id = tn.id
      WHERE e.id IN (${placeholders})
    `;
    const dbResult = raw.db.prepare(sql).all(...chunkIds) as any[];
    for (const edgeInfo of dbResult) {
      const objs = edgeObjects.get(edgeInfo.id);
      if (objs) {
        for (const obj of objs) {
          obj.source_id = edgeInfo.source_id;
          obj.target_id = edgeInfo.target_id;
          obj.type = edgeInfo.type;
          obj.source = edgeInfo.source_objectid;
          obj.target = edgeInfo.target_objectid;
        }
      }
    }
  }
}

export async function runCypher(
  cypher: string,
  project: string = SHARED_PROJECT,
): Promise<QueryResult> {
  const dataset = await getDataset(project);
  const response = await dataset.db.queryRaw(cypher);
  const rows: Record<string, unknown>[] = (response?.data ?? []).slice(0, 1500);
  await enrichEdges(rows, project);
  const columns = rows.length ? Object.keys(rows[0]!) : [];
  return {
    columns,
    rows,
    count: response?.meta?.count ?? rows.length,
    timeMs: response?.meta?.time_ms ?? 0,
  };
}

export function statsFor(dataset: Dataset) {
  return {
    nodeCount: dataset.nodeCount,
    edgeCount: dataset.edgeCount,
    kinds: dataset.kinds,
    edgeTypes: dataset.edgeTypes,
  };
}

/* ── Analyst tag labels ── */

/**
 * Add a label to a node (`SET n:Label`). Labels let analysts query tagged
 * nodes directly, e.g. `MATCH (u:Owned) RETURN u`.
 */
export async function addNodeLabel(
  objectid: string,
  label: string,
  project: string = SHARED_PROJECT,
) {
  const safeLabel = label.replace(/[^A-Za-z0-9_]/g, "");
  if (!safeLabel) return false;
  const dataset = await getDataset(project);
  await dataset.db.execute(`MATCH (n:Base) WHERE n.objectid = $objectid SET n:${safeLabel}`, {
    objectid,
  });
  return true;
}

/**
 * Remove a label from a node. LeanGraph's `REMOVE n:Label` translation does not
 * scope to the matched row, so the label array is edited with raw SQL instead.
 */
export async function removeNodeLabel(
  objectid: string,
  label: string,
  project: string = SHARED_PROJECT,
) {
  const safeLabel = label.replace(/[^A-Za-z0-9_]/g, "");
  if (!safeLabel) return false;
  await getDataset(project); // ensure the file + schema exist
  const raw = await getRawDb(project);
  raw.execute(
    `UPDATE nodes SET label = (
       SELECT json_group_array(value) FROM (
         SELECT value FROM json_each(nodes.label) WHERE value <> ? ORDER BY value
       )
     ) WHERE json_extract(properties, '$.objectid') = ?`,
    [safeLabel, objectid],
  );
  return true;
}
