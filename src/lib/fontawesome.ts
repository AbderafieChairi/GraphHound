import { config, type IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { fab } from "@fortawesome/free-brands-svg-icons";

// Graph nodes render self-contained inline SVGs, so FontAwesome's global CSS
// injection (used to prevent icon flicker on first paint) is not needed here.
config.autoAddCss = false;

type IconMap = Record<string, IconDefinition>;

/** Re-key a FontAwesome icon pack (`{ faGithub: {...} }`) by its icon name (`github`). */
function indexByName(pack: Record<string, IconDefinition>): IconMap {
  const map: IconMap = {};
  for (const key of Object.keys(pack)) {
    const def = pack[key];
    if (def && typeof def === "object" && def.iconName) map[def.iconName] = def;
  }
  return map;
}

/**
 * Mirror of the FontAwesome kit `byPrefixAndName` export, rebuilt from the free
 * icon packages. Lets callers look up an icon the same way a kit would, e.g.
 * `byPrefixAndName.fab["github"]` or `byPrefixAndName.fas["user"]`.
 */
export const byPrefixAndName = {
  fas: indexByName(fas as unknown as Record<string, IconDefinition>),
  fab: indexByName(fab as unknown as Record<string, IconDefinition>),
} as const;

export type IconPrefix = keyof typeof byPrefixAndName;

/**
 * Normalize an icon name from an icon set into a bare FontAwesome name.
 * Icon sets store names like `"fa-user-secret"`; the lookup tables are keyed by
 * the bare name (`"user-secret"`).
 */
export function normalizeIconName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^fa[bsrltdk]?[-\s]/, "")
    .replace(/^(solid|regular|brands)[-\s]/, "");
}

/** Map an icon set `type` field to a FontAwesome prefix. Brands → `fab`, else `fas`. */
export function prefixFromType(type: string | undefined): IconPrefix {
  const t = (type ?? "").toLowerCase();
  return t === "fab" || t.includes("brand") ? "fab" : "fas";
}

/** Resolve an icon by prefix + name, falling back across prefixes when missing. */
export function findIcon(prefix: string, name: string): IconDefinition | undefined {
  const bare = normalizeIconName(name);
  const table = (byPrefixAndName as Record<string, IconMap>)[prefix] ?? byPrefixAndName.fas;
  return table[bare] ?? byPrefixAndName.fas[bare] ?? byPrefixAndName.fab[bare];
}

/**
 * Resolve an icon set entry (`{ name, type }`) to a FontAwesome icon definition,
 * honoring the requested prefix but falling back across prefixes and names.
 */
export function resolveIcon(spec: { name: string; type?: string }): IconDefinition | undefined {
  return findIcon(prefixFromType(spec.type), spec.name);
}
