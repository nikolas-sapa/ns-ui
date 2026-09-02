"use client";

import { Component, type ReactNode } from "react";

/**
 * Scoped failure for one registry demo.
 *
 * Without it, a component that throws while rendering has no boundary between
 * itself and the route, so the throw walks all the way up to `app/error.tsx`
 * and a visitor sees the site-wide "Something went wrong." page *inside the
 * demo frame* — on `/components/<name>` that page is iframed, so a single
 * broken demo reads as the whole site having fallen over. For a gallery whose
 * entire job is rendering other people's components, one bad demo has to
 * degrade to one bad card while the page around it stays usable.
 *
 * Deliberately a class component: `componentDidCatch`/`getDerivedStateFromError`
 * have no hook equivalent, and pulling in a dependency for the one boundary
 * this app needs is not worth it.
 *
 * It does not swallow the throw. `componentDidCatch` re-reports to
 * `console.error`, because the person most likely to hit this is a builder
 * running their own component through the preview route, and a fallback card
 * that hid the stack would make that strictly harder to debug than no boundary
 * at all.
 */
export class DemoErrorBoundary extends Component<
  {
    children: ReactNode;
    /** Component name, used in the message and as the reset identity below. */
    name: string;
    /** False inside an `inert` embed, where a retry button would render as a
     *  control that cannot be clicked or focused. The message still shows. */
    interactive?: boolean;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[ns-ui] demo "${this.props.name}" failed to render`, error);
  }

  componentDidUpdate(prev: { name: string }) {
    // Navigating from a broken demo to a working one must not keep showing the
    // fallback: React holds boundary state until something resets it, and the
    // route change alone does not.
    if (prev.name !== this.props.name && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 py-16 text-center"
      >
        <span className="text-ns-muted">
          <BrokenDemoIcon />
        </span>
        <p className="text-sm text-foreground">This demo failed to render.</p>
        <p className="max-w-sm text-xs leading-relaxed text-ns-muted">
          Nothing else on the page is affected. The error is in the browser
          console with the component name attached.
        </p>
        {this.props.interactive ? (
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="rounded-sm border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.18em] text-ns-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }
}

/** Same stroke language as the registry's own glyphs, and no color of its own —
 *  it inherits `currentColor` so the caller decides the ink. */
function BrokenDemoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 9h18M9 22h6" />
      <path d="M12 18v4" />
    </svg>
  );
}
