/**
 * SharpHound (v5 / Community Edition) JSON -> generic graph model.
 * Pure functions, safe on client and server.
 */

export type GraphNodeInput = {
  objectid: string;
  kind: string;
  props: Record<string, string | number | boolean>;
};

export type GraphEdgeInput = {
  source: string;
  target: string;
  type: string;
};

export type ParsedFile = {
  kind: string;
  nodes: GraphNodeInput[];
  edges: GraphEdgeInput[];
};

const KIND_BY_FILE: Record<string, string> = {
  users: "User",
  computers: "Computer",
  groups: "Group",
  gpos: "GPO",
  ous: "OU",
  containers: "Container",
  domains: "Domain",
  aiacas: "AIACA",
  rootcas: "RootCA",
  enterprisecas: "EnterpriseCA",
  ntauthstores: "NTAuthStore",
  certtemplates: "CertTemplate",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = any;

export function detectKind(fileName: string, sample: AnyRecord | undefined): string {
  const lower = fileName.toLowerCase();
  for (const key of Object.keys(KIND_BY_FILE)) {
    if (lower.includes(key)) return KIND_BY_FILE[key]!;
  }
  const p = sample?.Properties ?? {};
  if (sample?.Members) return "Group";
  if (sample?.Sessions || p.operatingsystem) return "Computer";
  if (p.gpcpath) return "GPO";
  if (sample?.Links || sample?.GPOChanges) return "OU";
  if (sample?.Trusts) return "Domain";
  if (sample?.ChildObjects) return "Container";
  if (p.samaccountname) return "User";
  return "Base";
}

function cleanProps(p: AnyRecord, kind: string, objectid: string) {
  const out: AnyRecord = {
    objectid,
    kind,
    name: String(p?.name ?? objectid),
  };
  for (const [key, value] of Object.entries(p ?? {})) {
    if (value === null || value === undefined) continue;
    const lowerKey = key.toLowerCase();
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[lowerKey] = value;
    } else if (Array.isArray(value)) {
      out[lowerKey] = JSON.stringify(value);
    } else if (typeof value === "object") {
      out[lowerKey] = JSON.stringify(value);
    }
  }
  return out;
}

function sid(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().toUpperCase();
}

function safeType(name: unknown, fallback: string): string {
  const raw = typeof name === "string" ? name.replace(/[^A-Za-z0-9_]/g, "") : "";
  return raw.length ? raw : fallback;
}

/** Parse one SharpHound collection file into nodes + edges. */
export function parseSharpHoundFile(fileName: string, json: AnyRecord): ParsedFile {
  const nodes: GraphNodeInput[] = [];
  const edges: GraphEdgeInput[] = [];
  const push = (source: unknown, target: unknown, type: string) => {
    const s = sid(source);
    const t = sid(target);
    if (!s || !t || s === t) return;
    edges.push({ source: s, target: t, type });
  };

  const isCE =
    json &&
    typeof json === "object" &&
    (Array.isArray(json.graph?.nodes) ||
      Array.isArray(json.graph?.edges) ||
      (json.metadata && typeof json.metadata === "object"));

  if (isCE) {
    const ceNodes = Array.isArray(json.graph?.nodes) ? json.graph.nodes : [];
    const ceEdges = Array.isArray(json.graph?.edges) ? json.graph.edges : [];

    for (const entry of ceNodes) {
      const id = sid(entry?.id);
      if (!id) continue;
      const kindsList = Array.isArray(entry?.kinds) ? entry.kinds : [];
      const kind =
        kindsList.find((k: unknown) => typeof k === "string" && k.toLowerCase() !== "base") ||
        "Base";
      nodes.push({
        objectid: id,
        kind,
        props: cleanProps(entry?.properties ?? {}, kind, id),
      });
    }

    for (const edge of ceEdges) {
      if (!edge || typeof edge !== "object") continue;
      const source = edge.start?.value;
      const target = edge.end?.value;
      const type = safeType(edge.kind, "GenericAll");
      push(source, target, type);
    }

    const firstNodeKind = nodes[0]?.kind || "Base";
    return { kind: firstNodeKind, nodes, edges };
  }

  const data: AnyRecord[] = Array.isArray(json?.data) ? json.data : [];
  const metaType = typeof json?.meta?.type === "string" ? json.meta.type : "";
  const kind = detectKind(metaType || fileName, data[0]);

  for (const entry of data) {
    const id = sid(entry?.ObjectIdentifier);
    if (!id) continue;
    nodes.push({ objectid: id, kind, props: cleanProps(entry?.Properties ?? {}, kind, id) });

    for (const ace of entry?.Aces ?? []) {
      push(ace?.PrincipalSID, id, safeType(ace?.RightName, "GenericAll"));
    }

    for (const member of entry?.Members ?? []) {
      push(member?.ObjectIdentifier, id, "MemberOf");
    }

    if (entry?.ContainedBy?.ObjectIdentifier) {
      push(entry.ContainedBy.ObjectIdentifier, id, "Contains");
    }
    for (const child of entry?.ChildObjects ?? []) {
      push(id, child?.ObjectIdentifier, "Contains");
    }
    for (const link of entry?.Links ?? []) {
      push(link?.GUID ?? link?.ObjectIdentifier, id, "GpLink");
    }

    for (const key of ["Sessions", "PrivilegedSessions", "RegistrySessions"] as const) {
      for (const s of entry?.[key]?.Results ?? []) {
        push(s?.ComputerSID ?? id, s?.UserSID, "HasSession");
      }
    }

    const localGroups: Array<[string, string]> = [
      ["LocalAdmins", "AdminTo"],
      ["RemoteDesktopUsers", "CanRDP"],
      ["DcomUsers", "ExecuteDCOM"],
      ["PSRemoteUsers", "CanPSRemote"],
    ];
    for (const [key, edgeType] of localGroups) {
      for (const r of entry?.[key]?.Results ?? entry?.GPOChanges?.[key] ?? []) {
        push(r?.ObjectIdentifier ?? r, id, edgeType);
      }
    }

    for (const d of entry?.AllowedToDelegate ?? []) {
      push(id, d?.ObjectIdentifier ?? d, "AllowedToDelegate");
    }
    for (const a of entry?.AllowedToAct ?? []) {
      push(a?.ObjectIdentifier ?? a, id, "AllowedToAct");
    }
    for (const h of entry?.HasSIDHistory ?? []) {
      push(id, h?.ObjectIdentifier ?? h, "HasSIDHistory");
    }
    for (const t of entry?.Trusts ?? []) {
      push(id, t?.TargetDomainSid, "TrustedBy");
    }
    if (entry?.PrimaryGroupSID) push(id, entry.PrimaryGroupSID, "MemberOf");
  }

  return { kind, nodes, edges };
}

export const NODE_KINDS = Array.from(new Set(Object.values(KIND_BY_FILE))).concat("Base");
