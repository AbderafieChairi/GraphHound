# Active Directory - Prebuilt Cypher Queries

# ─────────────────────────────────────────────────
# DISCOVERY: Domain overview
# ─────────────────────────────────────────────────

## DC computers
MATCH (u:Computer {isdc:true})
RETURN *


## All domain admins
MATCH (u:Base)-[m:MemberOf*1..]->(g:Group)
WHERE g.objectid ENDS WITH "-512"
RETURN *


## All high value / tagged targets
MATCH (n:Base)
WHERE n.highvalue = true
RETURN *


## All enabled Kerberoastable users (SPN set)
MATCH (u:User)
WHERE u.hasspn = true AND u.enabled = true
RETURN *


## All AS-REP roastable users (no preauth required)
MATCH (u:User)
WHERE u.dontreqpreauth = true
RETURN *


## Users with passwords set to never expire
MATCH (u:User)
WHERE u.pwdneverexpires = true AND u.enabled = true
RETURN *


## Users with password not required
MATCH (u:User)
WHERE u.passwordnotreqd = true
RETURN *


## Users with admincount
MATCH (u:User)
WHERE u.admincount = true
RETURN *


# ─────────────────────────────────────────────────
# ACL ABUSE: Dangerous permissions
# ─────────────────────────────────────────────────

## Principals with GenericAll on domain objects
MATCH (n:Base)-[r:GenericAll]->(m:Base)
RETURN *


## Principals with DCSync rights (GetChanges + GetChangesAll)
MATCH (n:Base)-[r:GetChanges|GetChangesAll]->(d:Domain)
RETURN *


## Principals with ForceChangePassword rights
MATCH (n:Base)-[r:ForceChangePassword]->(u:User)
RETURN *


## Principals that can add themselves/others to privileged groups
MATCH (n:Base)-[r:AddMember]->(g:Group)
WHERE g.highvalue = true
RETURN *


## Principals with WriteDacl or WriteOwner on any object
MATCH (n:Base)-[r:WriteDacl|WriteOwner]->(m:Base)
RETURN *


## Principals with GenericWrite on GPOs
MATCH (n:Base)-[r:GenericWrite]->(gpo:GPO)
RETURN *


## Owned objects with dangerous outbound edges
MATCH (n:Base)-[r:GenericAll|GenericWrite|WriteDacl|WriteOwner|ForceChangePassword|AddMember]->(m:Base)
WHERE n.owned = true
RETURN *


# ─────────────────────────────────────────────────
# LOCAL ADMIN & SESSIONS
# ─────────────────────────────────────────────────

## Computers where Domain Users have local admin
MATCH (g:Group)-[r:AdminTo]->(c:Computer)
WHERE g.objectid ENDS WITH "-513"
RETURN *


## All AdminTo relationships (who is local admin where)
MATCH (n:Base)-[r:AdminTo]->(c:Computer)
RETURN *


## Computers with sessions 
MATCH (c:Base)-[r1:HasSession]->(u:Base)
RETURN *


## Computers with sessions from Domain Admins
MATCH (c:Computer)-[r1:HasSession]->(u:User)-[r2:MemberOf*1..]->(g:Group)
WHERE g.objectid ENDS WITH "-512"
RETURN *




## RDP access mapping
MATCH (n:Base)-[r:CanRDP]->(c:Computer)
RETURN *


# ─────────────────────────────────────────────────
# DELEGATION & KERBEROS ABUSE
# ─────────────────────────────────────────────────

## Computers configured with unconstrained delegation
MATCH (c:Computer)
WHERE c.unconstraineddelegation = true
RETURN *


## Constrained delegation relationships
MATCH (n:Base)-[r:AllowedToDelegate]->(c:Computer)
RETURN *


## Resource-based constrained delegation (RBCD)
MATCH (n:Base)-[r:AllowedToAct]->(c:Computer)
RETURN *


## Users/computers trusted for delegation to Domain Controllers
MATCH (n:Base)-[r:AllowedToDelegate]->(dc:Computer)
WHERE dc.name CONTAINS "DC"
RETURN *


# ─────────────────────────────────────────────────
# GPO & OU ANALYSIS
# ─────────────────────────────────────────────────

## GPOs applied to OUs containing high value targets
MATCH (gpo:GPO)-[r1:GPLink]->(ou:OU)-[r2:Contains*1..]->(t:Base)
WHERE t.highvalue = true
RETURN *


## Principals who can edit GPOs linked to Domain Controllers OU
MATCH (n:Base)-[r1:GenericAll|GenericWrite|WriteDacl|WriteOwner]->(gpo:GPO)-[r2:GPLink]->(ou:OU)
WHERE ou.name CONTAINS "DOMAIN CONTROLLERS"
RETURN *


## OU structure containing computers
MATCH (ou:OU)-[r:Contains]->(c:Computer)
RETURN *


# ─────────────────────────────────────────────────
# FOREIGN / CROSS-DOMAIN
# ─────────────────────────────────────────────────

## Foreign group membership (cross-domain group nesting)
MATCH (n:Base)-[r:MemberOf]->(g:Group)
WHERE n.domain <> g.domain
RETURN *


# ─────────────────────────────────────────────────
# CLEANUP / MARKED DATA
# ─────────────────────────────────────────────────

## All nodes marked as "owned"
MATCH (n:Base)
WHERE n.owned = true
RETURN *


## All edges between two owned/high-value nodes
MATCH (n:Base)-[r*1..3]->(m:Base)
WHERE n.owned = true AND m.highvalue = true
RETURN *