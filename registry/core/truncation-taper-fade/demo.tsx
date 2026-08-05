"use client";

import { VanishTaper } from "./component";

// Three realistic homes for the same mechanism: a file table (fixed-width
// name column, the case it exists for), a breadcrumb rail, and a lone path
// string at a width chosen to just barely clip — the still-frame case the
// component is judged on first. The primary "vt-demo-target" cell is the
// autoplay sweep target: narrow enough that the taper is obviously crowding
// its edge at rest, and long enough that hover triggers the peek glide too.

const FILES: { name: string; size: string; modified: string }[] = [
  { name: "README.md", size: "4.1 KB", modified: "2d ago" },
  { name: "truncation-taper-fade-mechanism-notes-and-benchmarks.md", size: "18.9 KB", modified: "just now" },
  { name: "registry/core/text-variable-weight/component.tsx", size: "2.3 KB", modified: "1w ago" },
  { name: "scripts/build-registry-and-llms-index.generated.ts", size: "6.7 KB", modified: "3w ago" },
];

const BREADCRUMB = [
  "Workspace",
  "Engineering Handbook",
  "Frontend Guidelines",
  "Typography and Variable Fonts",
  "Truncation Without An Ellipsis",
];

export default function VanishTaperDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / truncation-taper-fade</p>

      <div className="w-full max-w-xl space-y-2">
        <p className="text-sm text-ns-muted">Hover or focus a row to read its full name.</p>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[62%]" />
              <col className="w-[19%]" />
              <col className="w-[19%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-surface text-left font-mono text-[11px] uppercase tracking-wide text-ns-muted">
                <th className="px-3 py-2 font-normal">Name</th>
                <th className="px-3 py-2 font-normal">Size</th>
                <th className="px-3 py-2 font-normal">Modified</th>
              </tr>
            </thead>
            <tbody>
              {FILES.map((f, i) => (
                <tr key={f.name} className={i > 0 ? "border-t border-border" : undefined}>
                  <td className="px-3 py-2 text-foreground">
                    <VanishTaper
                      text={f.name}
                      className={i === 1 ? "vt-demo-target max-w-full" : "max-w-full"}
                    />
                  </td>
                  <td className="px-3 py-2 text-ns-muted">{f.size}</td>
                  <td className="px-3 py-2 text-ns-muted">{f.modified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <nav aria-label="Breadcrumb" className="w-full max-w-2xl">
        <ol className="flex items-center gap-1 overflow-hidden rounded-sm border border-border bg-surface px-3 py-2">
          {BREADCRUMB.map((crumb, i) => (
            <li key={crumb} className="flex shrink-0 items-center gap-1">
              {i > 0 && <span className="text-ns-muted">/</span>}
              <VanishTaper text={crumb} className="w-24" />
            </li>
          ))}
        </ol>
      </nav>

      <div className="w-full max-w-xs space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wide text-ns-muted">Path</p>
        <div className="rounded-sm border border-border bg-surface px-3 py-2">
          <VanishTaper text="/Users/nikolassapalidis/Developer/misc/ns-ui/registry/core/truncation-taper-fade/component.tsx" />
        </div>
      </div>
    </div>
  );
}
