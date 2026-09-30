export type Stats = {
  nodeCount: number;
  edgeCount: number;
  kinds: Record<string, number>;
  edgeTypes: Record<string, number>;
};

export const PRESETS: { title: string; cypher: string }[] = [
  {
    title: "Domain admins (nested)",
    cypher: `MATCH p=(u:Base)-[:MemberOf*1..3]->(g:Base)
WHERE g.name CONTAINS 'DOMAIN ADMINS'
RETURN p LIMIT 100`,
  },
  {
    title: "Kerberoastable users",
    cypher: `MATCH (u:Base)
WHERE u.kind = 'User' AND u.hasspn = true AND u.enabled = true
RETURN u.name AS name, u.samaccountname AS sam, u.admincount AS admincount
ORDER BY name LIMIT 100`,
  },
  {
    title: "AS-REP roastable",
    cypher: `MATCH (u:Base)
WHERE u.kind = 'User' AND u.dontreqpreauth = true
RETURN u.name AS name, u.enabled AS enabled LIMIT 100`,
  },
  {
    title: "Unconstrained delegation",
    cypher: `MATCH (c:Base)
WHERE c.unconstraineddelegation = true
RETURN c.name AS name, c.kind AS kind, c.operatingsystem AS os LIMIT 100`,
  },
  {
    title: "Sessions on computers",
    cypher: `MATCH (c:Base)-[r:HasSession]->(u:Base)
RETURN c AS source, type(r) AS edge, u AS target LIMIT 150`,
  },
  {
    title: "Dangerous ACLs (GenericAll)",
    cypher: `MATCH (a:Base)-[r:GenericAll]->(b:Base)
RETURN a AS source, type(r) AS edge, b AS target LIMIT 150`,
  },
  {
    title: "WriteDacl takeover edges",
    cypher: `MATCH (a:Base)-[r:WriteDacl]->(b:Base)
RETURN a AS source, type(r) AS edge, b AS target LIMIT 150`,
  },
  {
    title: "Local admin rights",
    cypher: `MATCH (a:Base)-[r:AdminTo]->(c:Base)
RETURN a AS source, type(r) AS edge, c AS target LIMIT 150`,
  },
  {
    title: "Group nesting map",
    cypher: `MATCH (a:Base)-[r:MemberOf]->(g:Base)
WHERE g.kind = 'Group'
RETURN a AS source, type(r) AS edge, g AS target LIMIT 200`,
  },
  {
    title: "Owned GPO links",
    cypher: `MATCH (g:Base)-[r:GpLink]->(o:Base)
RETURN g AS source, type(r) AS edge, o AS target LIMIT 150`,
  },
  {
    title: "Computers without LAPS",
    cypher: `MATCH (c:Base)
WHERE c.kind = 'Computer' AND c.haslaps = false
RETURN c.name AS name, c.operatingsystem AS os LIMIT 100`,
  },
  {
    title: "Users with admin count",
    cypher: `MATCH (u:Base) WHERE u.kind = 'User' AND u.admincount = true RETURN u.name AS name, u.samaccountname AS sam LIMIT 100`,
  },
  {
    title: "Computers with sessions",
    cypher: `MATCH (c:Base)-[r:HasSession]->(u:Base) RETURN c AS source, type(r) AS edge, u AS target LIMIT 150`,
  },
  {
    title: "Outbound control edges",
    cypher: `MATCH (a:Base)-[r]->(b:Base) WHERE type(r) IN ['GenericAll','WriteDacl','Owns','AdminTo'] RETURN a AS source, type(r) AS edge, b AS target LIMIT 200`,
  },
  {
    title: "All users",
    cypher: `MATCH (u:Base) WHERE u.kind = 'User' RETURN u AS enabled LIMIT 500`,
  },
  {
    title: "All computers",
    cypher: `MATCH (c:Base) WHERE c.kind = 'Computer' RETURN c LIMIT 500`,
  },
  {
    title: "Everything (sample)",
    cypher: `MATCH (a:Base)-[r]->(b:Base)
RETURN a AS source, type(r) AS edge, b AS target LIMIT 200`,
  },
];
