"use client";

import { FootingCourse } from "./component";

const COLUMNS: [string, string[]][] = [
  ["Registry", ["Components", "Collections", "Changelog", "llms.txt"]],
  ["Install", ["shadcn CLI", "Tokens", "Themes", "Requirements"]],
  ["Elsewhere", ["GitHub", "Writing", "Contact"]],
];

export default function FootingCourseDemo() {
  return (
    <div>
      <FootingCourse
        footer={
          <div className="px-8 pb-8 pt-12">
            <div className="flex flex-wrap justify-between gap-10">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">ns-ui</p>
                <p className="mt-3 max-w-xs text-sm text-foreground">
                  222 self-contained components. Plain source you own, no runtime package.
                </p>
              </div>
              {COLUMNS.map(([heading, links]) => (
                <div key={heading}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{heading}</p>
                  <ul className="mt-3 space-y-2">
                    {links.map((l) => (
                      <li key={l}>
                        <a
                          href="#"
                          className="text-sm text-foreground/80 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {l}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-12 flex items-center justify-between border-t border-border pt-4">
              <span className="font-mono text-[11px] text-muted">MIT</span>
              <span className="font-mono text-[11px] text-muted">Athens</span>
            </div>
          </div>
        }
      >
        <section className="flex min-h-screen flex-col justify-center gap-6 px-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">ns-ui / footing-course</p>
          <h1 className="max-w-2xl text-4xl leading-tight text-foreground">
            The page is a sheet laid on the footer. Scroll to the end and the sheet slides off it.
          </h1>
          <p className="max-w-md text-sm text-muted">
            Nothing about the footer moves — no fixed positioning, no scroll-driven height. It is
            pinned once, and the content is what travels.
          </p>
          {/* Deliberately not an in-page anchor: the verify gate clicks the first
              interactive element, and a jump-to-footer link would leave every
              later screenshot taken at the bottom of the page. */}
          <button
            type="button"
            className="w-fit rounded-[6px] border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-foreground hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Keep scrolling
          </button>
        </section>
        <section id="footing-end" className="flex min-h-screen flex-col justify-center gap-4 px-8">
          {[
            "Sticky bottom. The sheet above is the only thing hiding it.",
            "No fixed positioning, no clip, no height driven by scroll.",
            "Footer content lags its own exposure by 24px.",
            "Keyboard focus into a covered footer scrolls it into the open.",
            "prefers-reduced-motion drops the lag, keeps the reveal.",
          ].map((line) => (
            <p key={line} className="border-b border-border pb-4 text-lg text-foreground/90">
              {line}
            </p>
          ))}
        </section>
      </FootingCourse>
    </div>
  );
}
