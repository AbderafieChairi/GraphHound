/* eslint-disable @typescript-eslint/no-explicit-any */
/** Environment records and their project-key resolution. */
import { getRegistryDb, SHARED_PROJECT } from "./db";
import type { Environment } from "./types";

/** The default "Shared" environment — always present, never stored in the DB. */
const DEFAULT_ENV: Environment = {
  id: "__shared__",
  name: "Shared",
  project: SHARED_PROJECT,
  createdAt: 0,
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shortHash(input: string): string {
  // Simple deterministic hash – djb2
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).slice(0, 6);
}

export function listEnvironments(): Environment[] {
  const db = getRegistryDb();
  const rows = db.prepare("SELECT * FROM environments ORDER BY created_at ASC").all() as any[];
  const envs: Environment[] = [DEFAULT_ENV];
  for (const row of rows) {
    envs.push({
      id: row.id,
      name: row.name,
      project: row.project,
      createdAt: row.created_at,
    });
  }
  return envs;
}

export function createEnvironment(name: string): Environment {
  const db = getRegistryDb();
  const slug = slugify(name);
  const hash = shortHash(`${name}-${Date.now()}`);
  const project = `bh-${slug}-${hash}`;
  const id = `env-${slug}-${hash}`;
  const now = Date.now();

  db.prepare("INSERT INTO environments (id, name, project, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    name,
    project,
    now,
  );

  return { id, name, project, createdAt: now };
}

export function deleteEnvironment(id: string): boolean {
  if (id === DEFAULT_ENV.id) return false;
  const db = getRegistryDb();
  const result = db.prepare("DELETE FROM environments WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getEnvironmentById(id: string): Environment | null {
  if (id === DEFAULT_ENV.id) return DEFAULT_ENV;
  const db = getRegistryDb();
  const row = db.prepare("SELECT * FROM environments WHERE id = ?").get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    project: row.project,
    createdAt: row.created_at,
  };
}

export function getProjectForEnv(envId: string): string {
  if (!envId || envId === DEFAULT_ENV.id) return SHARED_PROJECT;
  const env = getEnvironmentById(envId);
  return env?.project ?? SHARED_PROJECT;
}
