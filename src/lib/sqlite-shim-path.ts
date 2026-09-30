import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Locate vendor/sqlite-shim.cjs relative to the calling module.
 *
 * In dev, callers live at different depths under src/ (lib/, lib/registry/);
 * in the build they are all bundled into dist/server/assets/ and the shim is
 * copied to dist/server/vendor/. Try each layout instead of hard-coding one.
 */
export function resolveSqliteShim(moduleUrl: string): string {
  const candidates = ["../vendor/sqlite-shim.cjs", "../../vendor/sqlite-shim.cjs"].map((rel) =>
    fileURLToPath(new URL(rel, moduleUrl)),
  );
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0]!;
}
