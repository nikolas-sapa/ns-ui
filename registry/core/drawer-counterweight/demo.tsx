"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SashWeight } from "./component";

// Rest state is gated on the same `embed=1&autoplay=1` pair as the reopen
// loop below. The honest `/preview/drawer-counterweight` reference rests CLOSED — the
// drawer opens only on deliberate interaction (the Filters trigger, Escape,
// a drag) and stays closed once closed, which is exactly what the owner
// asked for ("open only on deliberate interaction"). Only the landing-page
// *autoplay card* rests OPEN, because a closed drawer hides the entire point
// of the component (the weight's resting position IS the state indicator) and
// the card has no real cursor to open it with; its `press` autoplay closes
// the drawer and the gated timer reopens it, so the weight-drop keeps
// demonstrating on a loop rather than going stone-still.
//
// That reopen must only fire for the landing-page card. Same bug as
// input-focus-membrane's autoplay-only seed value (see its demo.tsx comment): this
// component's own local demo state was reopening the drawer unconditionally,
// including on the plain `/preview/drawer-counterweight` reference with no query params
// at all — the honest, fully-interactive view every real owner/consumer
// actually uses. Closing the drawer there (Apply, the close button, Escape,
// backdrop, or a drag-release toward closed) got silently undone ~1.8s later,
// which reads exactly like "the filter drawer always reopens / can't be
// closed" — because, unconditionally, it was. Gating on the same
// `embed=1&autoplay=1` pair page.tsx uses to decide whether the driver even
// mounts (see app/preview/[name]/page.tsx) confines the loop to the one
// context it's meant to demonstrate.
const REOPEN_MS = 1800;

const CATEGORIES = ["Lighting", "Seating", "Storage", "Textiles", "Outdoor"];

export default function SashWeightDemo() {
  const searchParams = useSearchParams();
  const autoplaying =
    searchParams.get("embed") === "1" && searchParams.get("autoplay") === "1";

  const [open, setOpen] = useState(autoplaying);
  const [checked, setChecked] = useState<Record<string, boolean>>({
    Lighting: true,
    Seating: true,
  });
  const [sort, setSort] = useState("relevance");
  const reopenRef = useRef(0);

  useEffect(() => () => window.clearTimeout(reopenRef.current), []);

  const handleOpenChange = (next: boolean) => {
    window.clearTimeout(reopenRef.current);
    setOpen(next);
    if (!next && autoplaying) {
      reopenRef.current = window.setTimeout(() => setOpen(true), REOPEN_MS);
    }
  };

  const toggle = (label: string) =>
    setChecked((prev) => ({ ...prev, [label]: !prev[label] }));

  const activeCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / drawer-counterweight — drag the rail, watch the weight decide
      </p>

      <div className="w-full max-w-3xl rounded-md border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">Catalog</h2>
            <p className="mt-0.5 font-mono text-xs text-muted">
              128 items · sorted by {sort === "relevance" ? "relevance" : "price"}
            </p>
          </div>
          <input
            type="search"
            placeholder="Search catalog…"
            className="w-40 rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-56"
          />
          <SashWeight
            open={open}
            onOpenChange={handleOpenChange}
            trigger={
              <>
                Filters
                {activeCount > 0 && (
                  <span className="rounded-full border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    {activeCount}
                  </span>
                )}
              </>
            }
            title="Filters"
            description="Narrow the catalog by category and price."
          >
            <div className="flex flex-col gap-6">
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-1 font-mono text-[11px] uppercase tracking-wider text-muted">
                  Category
                </legend>
                {CATEGORIES.map((c) => (
                  <label key={c} className="group flex cursor-pointer items-center gap-2.5">
                    <span className="relative inline-flex h-4 w-4 shrink-0">
                      <input
                        type="checkbox"
                        checked={checked[c] ?? false}
                        onChange={() => toggle(c)}
                        className="peer h-4 w-4 cursor-pointer appearance-none rounded-[4px] border border-border bg-transparent transition-colors duration-150 checked:border-foreground checked:bg-foreground hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      />
                      <svg
                        aria-hidden
                        viewBox="0 0 12 12"
                        fill="none"
                        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-background opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
                      >
                        <path
                          d="M2.5 6.5 5 9l4.5-5.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="text-[13px] text-foreground">{c}</span>
                  </label>
                ))}
              </fieldset>

              <div className="flex flex-col gap-2">
                <label htmlFor="sash-sort" className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Sort by
                </label>
                <select
                  id="sash-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                </select>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Apply filters
                </button>
                <button
                  type="button"
                  onClick={() => setChecked({})}
                  className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-foreground/25 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Reset
                </button>
              </div>
            </div>
          </SashWeight>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-sm border border-border bg-background p-3"
            >
              <div className="h-16 rounded-sm border border-border bg-foreground/[0.04]" />
              <p className="text-xs text-foreground">Item {i + 1}</p>
              <p className="font-mono text-[11px] text-muted">${(29 + i * 6).toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Grab the thin rail on the drawer's left edge — the weight travels
        opposite your drag at 0.6x. Release above the tick and it pulls the
        drawer shut; past it, the weight bottoms out and the drawer holds
        itself open. The trigger and Escape work the same spring without a
        drag.
      </p>
    </div>
  );
}
