# PrivHound - Prebuilt Cypher Queries for GraphHound
# Import these as custom searches in the GraphHound UI
# Navigate to: Explore → Cypher tab → paste and run
#
# NOTE: the Community Edition (CE) Cypher engine may not support property access
# (e.g., n.property_name) on OpenGraph custom nodes. If a "Table View"
# query returns "No results", use the graph/path version instead.

# ─────────────────────────────────────────────────
# DISCOVERY: Show the full PrivHound attack graph
# ─────────────────────────────────────────────────

## All PrivHound paths to SYSTEM
MATCH p=(u:PHUser)-[*1..5]->(t:PHPrivTarget)
WHERE t.account = "NT AUTHORITY\\SYSTEM"
RETURN p

## All PrivHound paths to Local Admin
MATCH p=(u:PHUser)-[*1..5]->(t:PHPrivTarget)
WHERE t.account = "BUILTIN\\Administrators"
RETURN p

## Full PrivHound graph (all nodes and edges)
MATCH p=()-[:PHCanModifyService|PHCanWriteBinary|PHCanHijackPath|PHCanWriteTo|PHDLLHijackTo|PHCanExploit|PHHasPrivilege|PHCanEscalateTo|PHCanWriteTaskBinary|PHCanWriteAutorun|PHCanModifyRegKey|PHCanReadCreds|PHHasStoredCreds|PHCanDecryptGPP|PHCanReadHistory|PHCanAccessFile|PHCanBypassUAC|PHCanWriteProgDir|PHCanLoginAs|PHMemberOf|PHHostsBinaryFor|PHRunsAsUser|PHRunsAs|PHEscalatesTo|PHExecutesAs|PHHosts|PHHasSessionOn|PHCanReadProtected|PHCanExtractHashes|PHCanWriteProtected|PHCanInjectInto|PHCanLoginViaRunas|PHCanAccessProfile|PHProfileContains|PHContainsCreds|PHCanRequestJIT|PHGrantsTempAdmin|PHCanExploitSpooler|PHCanExploitWSUS|PHCanReadNAA|PHCanHijackCOM|PHCanImpersonatePipe|PHHasCachedCreds|PHCanModifyWMI|PHCanRelayWebClient|PHCanWriteRecoveryBin|PHCanAccessShadowCopy|PHContainsSensitiveFile]->()
RETURN p

# ─────────────────────────────────────────────────
# SERVICES: Weak permissions and writable binaries
# ─────────────────────────────────────────────────

## Modifiable services running as SYSTEM
MATCH p=(u:PHUser)-[:PHCanModifyService]->(s:PHService)-[:PHRunsAs]->(t:PHPrivTarget)
RETURN p

## Services with writable binaries
MATCH p=(u:PHUser)-[:PHCanWriteBinary]->(s:PHService)-[:PHRunsAs]->(t:PHPrivTarget)
RETURN p

## List all vulnerable services
MATCH p=(u:PHUser)-[:PHCanModifyService|PHCanWriteBinary]->(s:PHService)
RETURN p

## Non-SYSTEM service accounts → local user → admin
MATCH p=(u:PHUser)-[:PHCanModifyService|PHCanWriteBinary]->(s:PHService)-[:PHRunsAsUser]->(lu:PHLocalUser)-[:PHMemberOf]->(t:PHPrivTarget)
RETURN p

# ─────────────────────────────────────────────────
# UNQUOTED PATHS
# ─────────────────────────────────────────────────

## Unquoted service path hijacking opportunities
MATCH p=(u:PHUser)-[:PHCanHijackPath]->(uq:PHUnquotedPath)-[:PHRunsAs]->(t:PHPrivTarget)
RETURN p

## List unquoted paths
MATCH p=(u:PHUser)-[:PHCanHijackPath]->(uq:PHUnquotedPath)
RETURN p

# ─────────────────────────────────────────────────
# DLL HIJACKING
# ─────────────────────────────────────────────────

## Writable PATH directories (DLL hijack)
MATCH p=(u:PHUser)-[:PHCanWriteTo]->(d:PHWritablePath)-[:PHDLLHijackTo]->(t:PHPrivTarget)
RETURN p

## List writable PATH dirs
MATCH p=(u:PHUser)-[:PHCanWriteTo]->(d:PHWritablePath)
RETURN p

# ─────────────────────────────────────────────────
# TOKEN PRIVILEGES
# ─────────────────────────────────────────────────

## Dangerous token privileges → SYSTEM
MATCH p=(u:PHUser)-[:PHHasPrivilege]->(priv:PHTokenPrivilege)-[:PHCanEscalateTo]->(t:PHPrivTarget)
RETURN p

## List dangerous privileges
MATCH p=(u:PHUser)-[:PHHasPrivilege]->(priv:PHTokenPrivilege)
RETURN p

## SeBackup: privilege → SAM/SYSTEM hives → hash extraction → admin
MATCH p=(u:PHUser)-[:PHHasPrivilege]->(priv:PHTokenPrivilege)-[:PHCanReadProtected]->(f:PHSensitiveFile)-[:PHCanExtractHashes]->(t:PHPrivTarget)
RETURN p

## SeDebug: privilege → process injection → SYSTEM
MATCH p=(u:PHUser)-[:PHHasPrivilege]->(priv:PHTokenPrivilege)-[:PHCanInjectInto]->(t:PHPrivTarget)
RETURN p

## SeRestore: privilege → write protected files → SYSTEM
MATCH p=(u:PHUser)-[:PHHasPrivilege]->(priv:PHTokenPrivilege)-[:PHCanWriteProtected]->(t:PHPrivTarget)
RETURN p
