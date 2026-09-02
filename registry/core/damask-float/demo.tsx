"use client";

import { DamaskFloatCard, DamaskFloatGrid } from "./component";

// Filled solid glyphs, not stroke outlines — component.tsx rasterises
// `iconPath` with ctx.fill(), so a hairline stroke path would fill to
// nothing. Each is a single closed (or compound) path in a 0 0 24 24
// viewBox, sized and weighted to read clearly once woven into cloth at
// card scale.
const CIRCLE_PATH = "M12 2a10 10 0 100 20 10 10 0 000-20z";
const DIAMOND_PATH = "M12 2l10 10-10 10L2 12z";
const TRIANGLE_PATH = "M12 3l9 18H3z";
const BOLT_PATH = "M13 2L4 14h6l-1 8 10-12h-6l1-8z";
const HEXAGON_PATH = "M12 2l8.7 5v10L12 22l-8.7-5V7z";
const PLUS_PATH = "M9 2h6v7h7v6h-7v7H9v-7H2V9h7z";

const FEATURES = [
  {
    heading: "One source of truth",
    body: "Every surface reads the same record, so a change lands everywhere at once.",
    iconPath: CIRCLE_PATH,
  },
  {
    heading: "Typed end to end",
    body: "Your schema generates the client, so a wrong field fails at build time.",
    iconPath: DIAMOND_PATH,
  },
  {
    heading: "Permissions per field",
    body: "Scope what a role can read or write without forking the data model.",
    iconPath: TRIANGLE_PATH,
  },
  {
    heading: "Live collaboration",
    body: "Cursors, comments and edits arrive in order, with no refresh.",
    iconPath: BOLT_PATH,
  },
  {
    heading: "Complete audit trail",
    body: "Every write records who changed what and when, and stays queryable.",
    iconPath: HEXAGON_PATH,
  },
  {
    heading: "Bring your own data",
    body: "Import existing tables as they are and map the columns later.",
    iconPath: PLUS_PATH,
  },
];

export default function DamaskFloatDemo() {
  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* the whole section is height-bounded so all six cells compose inside
          the card frame instead of running off its bottom edge */}
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-6 py-6">
        <header className="shrink-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ns-muted">ns-ui / damask-float</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">Built on one surface</h1>
        </header>

        <DamaskFloatGrid
          aria-label="Feature grid woven as one reversible damask cloth"
          className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:grid-rows-3 md:grid-cols-3 md:grid-rows-2"
        >
          {FEATURES.map((f) => (
            <DamaskFloatCard key={f.heading} heading={f.heading} body={f.body} iconPath={f.iconPath} />
          ))}
        </DamaskFloatGrid>
      </section>
    </main>
  );
}
