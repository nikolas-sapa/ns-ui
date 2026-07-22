"use client";

import { useState } from "react";
import { DrawTubeBreadcrumb, type DrawTubeCrumb } from "./component";

const DEEP_TRAIL: DrawTubeCrumb[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "eng", label: "Engineering", href: "/engineering" },
  { id: "platform", label: "Platform", href: "/engineering/platform" },
  { id: "storage", label: "Storage", href: "/engineering/platform/storage" },
  {
    id: "objects",
    label: "Object Store",
    href: "/engineering/platform/storage/objects",
  },
  {
    id: "buckets",
    label: "Buckets",
    href: "/engineering/platform/storage/objects/buckets",
  },
  {
    id: "bucket",
    label: "acme-prod-artifacts",
    href: "/engineering/platform/storage/objects/buckets/acme-prod-artifacts",
  },
];

const SHORT_TRAIL: DrawTubeCrumb[] = [
  { id: "home2", label: "Home", href: "/" },
  { id: "docs", label: "Docs", href: "/docs" },
  { id: "guide", label: "Getting Started", href: "/docs/getting-started" },
];

export default function DrawTubeDemo() {
  const [lastVisited, setLastVisited] = useState<string | null>(null);

  const handleNavigate = (id: string, trail: DrawTubeCrumb[]) => {
    const crumb = trail.find((c) => c.id === id);
    if (crumb) setLastVisited(crumb.label);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / draw-tube — breadcrumbs that telescope instead of truncating
      </p>

      <div className="w-full max-w-[480px] rounded-md border border-border bg-surface px-6 py-6">
        <h2 className="text-sm font-semibold text-foreground">
          Seven levels, 400px
        </h2>
        <p className="mt-1 text-sm text-muted">
          The classic overflow problem. Middle crumbs collapse into 2px
          slivers of their own border — hover or focus the trail to pull it
          back out.
        </p>

        <div className="mt-5 w-[380px] max-w-full overflow-visible rounded-sm border border-border bg-background px-3 py-2">
          <DrawTubeBreadcrumb
            items={DEEP_TRAIL}
            onNavigate={(id) => handleNavigate(id, DEEP_TRAIL)}
          />
        </div>

        <p className="mt-3 text-xs text-muted">
          Every collapsed crumb is still a real link in the DOM — nothing is
          display:none, so a screen reader always hears the full seven-level
          trail even while it reads as a stack of slivers on screen.
        </p>
      </div>

      <div className="w-full max-w-[480px] rounded-md border border-border bg-surface px-6 py-6">
        <h2 className="text-sm font-semibold text-foreground">
          A short trail never collapses
        </h2>
        <p className="mt-1 text-sm text-muted">
          Root and current page are never candidates — only the middle
          telescopes, and only once it has to.
        </p>

        <div className="mt-5 w-full rounded-sm border border-border bg-background px-3 py-2">
          <DrawTubeBreadcrumb
            items={SHORT_TRAIL}
            onNavigate={(id) => handleNavigate(id, SHORT_TRAIL)}
          />
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted" aria-live="polite">
        {lastVisited
          ? `Last navigated: ${lastVisited}`
          : "Click a crumb — navigation is intercepted in this demo."}
      </p>
    </div>
  );
}
