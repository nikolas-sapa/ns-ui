import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * The component's real source, read off disk at build time (the playground
 * route is statically generated, same as lib/use-when.ts's meta reads).
 *
 * Exists because "npx shadcn add …" is not the only way people want a
 * component: plenty of readers want to see the code, or to paste one file into
 * a project that has no registry wired up at all. The source IS the artifact
 * here — these components install as plain files with no runtime package — so
 * showing it costs nothing and hides nothing.
 */
export function loadSource(name: string): { code: string; file: string } | null {
  for (const collection of ["core", "loud"]) {
    const file = path.join("registry", collection, name, "component.tsx");
    const full = path.join(process.cwd(), file);
    if (existsSync(full)) return { code: readFileSync(full, "utf8"), file };
  }
  return null;
}
