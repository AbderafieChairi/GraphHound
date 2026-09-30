export type ReportInputType = "none" | "node" | "string" | "number" | "date";

export type ReportSection = {
  id: string;
  title: string;
  /** Markdown description rendered above the query. */
  description: string;
  /** Cypher template; `%var1` is replaced by the section input value. */
  query: string;
  defaultValue: string;
  inputType: ReportInputType;
};

export const REPORT_SECTIONS: ReportSection[] = [
  {
    id: "group-members",
    title: '"Domain Admins" Members',
    description: "# List of members of a group\nSearch a group and inspect its direct members.",
    query: `MATCH (a:Base)-[r:MemberOf]->(g:Base) WHERE g.name CONTAINS '%var1' RETURN a AS source, type(r) AS edge, g AS target LIMIT 150`,
    defaultValue: "DOMAIN ADMINS",
    inputType: "node",
  },
  {
    id: "local-admins",
    title: "Local admin rights on a computer",
    description:
      "## AdminTo edges\nPrincipals holding local administrator rights on the selected computer.",
    query: `MATCH (a:Base)-[r:AdminTo]->(c:Base) WHERE c.name CONTAINS '%var1' RETURN a AS source, type(r) AS edge, c AS target LIMIT 150`,
    defaultValue: "DC01",
    inputType: "node",
  },
  {
    id: "sessions",
    title: "Sessions on a host",
    description: "## HasSession\nUsers with an active session on the selected computer.",
    query: `MATCH (c:Base)-[r:HasSession]->(u:Base) WHERE c.name CONTAINS '%var1' RETURN c AS source, type(r) AS edge, u AS target LIMIT 150`,
    defaultValue: "",
    inputType: "node",
  },
  {
    id: "owned-outbound",
    title: "Outbound control from tagged nodes",
    description:
      "## Tagged nodes\nControl edges leaving nodes tagged with the given label (e.g. `Owned`).",
    query: `MATCH (a:Base)-[r]->(b:Base) WHERE '%var1' IN labels(a) RETURN a AS source, type(r) AS edge, b AS target LIMIT 200`,
    defaultValue: "Owned",
    inputType: "string",
  },
  {
    id: "stale-accounts",
    title: "Accounts by password age",
    description:
      "## Password last set\nUsers whose password was set before the given UNIX timestamp.",
    query: `MATCH (u:Base) WHERE u.kind = 'User' AND u.pwdlastset < %var1 AND u.pwdlastset > 0 RETURN u LIMIT 200`,
    defaultValue: "1600000000",
    inputType: "number",
  },
];

export function renderQuery(template: string, value: string) {
  return template.replaceAll("%var1", value.replaceAll("'", "''"));
}
