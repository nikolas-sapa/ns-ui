"use client";

import { SurfaceCrtGlass } from "./component";

// The glass sits over a real pricing card: heading, price, feature list and
// a CTA all remain ordinary interactive DOM, tabbable and selectable — only
// the canvas layer on top is decorative.
export default function SurfaceCrtGlassDemo() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-16">
      <SurfaceCrtGlass className="w-full max-w-sm bg-background shadow-sm">
        <div className="flex flex-col gap-6 p-8">
          <div className="flex flex-col gap-1">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
              ns-ui / surface-crt-glass
            </p>
            <h2 className="text-lg font-medium text-foreground">Studio plan</h2>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-semibold text-foreground">$24</span>
            <span className="text-sm text-ns-muted">/ month</span>
          </div>

          <ul className="flex flex-col gap-2.5 text-sm text-foreground">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="text-ns-muted">
                –
              </span>
              Unlimited projects
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="text-ns-muted">
                –
              </span>
              Priority render queue
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="text-ns-muted">
                –
              </span>
              Team seats, up to 10
            </li>
          </ul>

          <a
            href="#checkout"
            className="inline-flex items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Subscribe
          </a>
        </div>
      </SurfaceCrtGlass>
    </main>
  );
}
