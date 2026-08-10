"use client";

import { GrazingLightCard, GrazingLightGrid } from "./component";

// One bold, stroke-based glyph per card so the grid doesn't read as an
// unfinished set of placeholder icons. Same weight (strokeWidth 2, round
// caps/joins) as each other, matching the built-in sparkle's visual mass —
// a hairline glyph would smear under the two hard feDropShadow offsets.
const ICON_PROPS = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const EdgeRoutingIcon = (
  <g {...ICON_PROPS}>
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v5M7 17l3-3M17 17l-3-3" />
  </g>
);

const LiveDiffingIcon = (
  <g {...ICON_PROPS}>
    <path d="M8 3v14M8 3l-4 4M8 3l4 4" />
    <path d="M16 21V7M16 21l4-4M16 21l-4-4" />
  </g>
);

const TypedWebhooksIcon = (
  <g {...ICON_PROPS}>
    <path d="M9 15l6-6" />
    <path d="M14 5l1.5-1.5a3.5 3.5 0 0 1 5 5L19 10" />
    <path d="M10 14l-1.5 1.5a3.5 3.5 0 0 1-5-5L5 9" />
  </g>
);

const ColdStartIcon = (
  <g {...ICON_PROPS}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 13l4-4" />
    <path d="M9 3h6" />
  </g>
);

const AuditTrailIcon = (
  <g {...ICON_PROPS}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </g>
);

const RollbackIcon = (
  <g {...ICON_PROPS}>
    <path d="M4 9a8 8 0 1 1 2 7" />
    <path d="M4 4v5h5" />
  </g>
);

const FEATURES = [
  {
    heading: "Edge routing",
    body: "Requests resolve at the nearest region before your origin ever wakes up.",
    href: "#edge-routing",
    icon: EdgeRoutingIcon,
  },
  {
    heading: "Live diffing",
    body: "Every deploy ships a byte-level diff against the previous build, not a full re-push.",
    href: "#live-diffing",
    icon: LiveDiffingIcon,
  },
  {
    heading: "Typed webhooks",
    body: "Payload shapes are generated from your schema, so a bad event fails at compile time.",
    href: "#typed-webhooks",
    icon: TypedWebhooksIcon,
  },
  {
    heading: "Cold-start budget",
    body: "A hard 40ms ceiling on first invoke, enforced in CI before it ships.",
    href: "#cold-start-budget",
    icon: ColdStartIcon,
  },
  {
    heading: "Audit trail",
    body: "Every mutation is signed and replayable, down to the field that changed.",
    href: "#audit-trail",
    icon: AuditTrailIcon,
  },
  {
    heading: "Rollback anywhere",
    body: "Pin traffic to any prior build by hash, no redeploy required.",
    href: "#rollback-anywhere",
    icon: RollbackIcon,
  },
];

export default function GrazingLightDemo() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-6 py-20">
        <header className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-widest text-ns-muted">ns-ui / grazing-light</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Blind embossed, lit in passing</h1>
          <p className="mt-3 text-sm leading-relaxed text-ns-muted">
            Every icon and heading below is carved into the surface, not printed on it — the relief only
            shows when a low-angle light rakes across. At rest the light drifts a slow 12-second circuit.
            Move your cursor over the grid and every card tilts its own light toward it at once.
          </p>
        </header>

        <GrazingLightGrid
          aria-label="Feature grid lit by a raking light"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <GrazingLightCard key={f.heading} heading={f.heading} body={f.body} href={f.href} icon={f.icon} />
          ))}
        </GrazingLightGrid>
      </section>
    </main>
  );
}
