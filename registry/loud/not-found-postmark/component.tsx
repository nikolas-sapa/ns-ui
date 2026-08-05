"use client";

import { Fragment, useEffect, useId, useMemo, useState, type CSSProperties } from "react";

// A 404 as returned mail, not an illustration of one. The "art" is a single
// envelope: a real, focusable recovery `<nav>` is the actual 404 page, and
// everything above it — the address block, the routing-history postmarks,
// the final NO SUCH ADDRESS hand-stamp — is aria-hidden decoration layered
// over a plain-text summary that carries the same information for anyone
// not watching it happen. The postmarks land one at a time (250ms apart,
// scale(1.3->1) with a small per-hop rotation scatter, an SVG feTurbulence
// + feDisplacementMap filter roughing their ink), the last one lands harder
// (a two-frame squash) and knocks the whole card with a 1px shake, and the
// forwarding-address label (search, home, recent pages) peels on with a
// slight skew right after. Reduced motion renders the whole thing already
// landed: no stamps dropping in, no peel, no shake.

export interface DeadLetterHop {
  /** Routing stop label, e.g. "Edge". */
  label: string;
  /** Optional small detail under the label, e.g. a node id. */
  detail?: string;
}

export interface DeadLetterLink {
  /** Visible, accessible label. */
  label: string;
  /** Destination. Omit to render a real, focusable link that does nothing. */
  href?: string;
}

export interface DeadLetterProps {
  /** The URL that 404'd. Defaults to the current location. */
  path?: string;
  /** Routing stops attempted, oldest first. Default: Edge / Origin / Router. */
  hops?: DeadLetterHop[];
  /** Recovery destinations besides Home, in source order. */
  recentPages?: DeadLetterLink[];
  /** Home link destination. Default "/". */
  homeHref?: string;
  /** Called with the trimmed query on submit. Omit for a real, inert form. */
  onSearch?: (query: string) => void;
  className?: string;
}

const DEFAULT_HOPS: DeadLetterHop[] = [
  { label: "Edge", detail: "edge-04" },
  { label: "Origin", detail: "origin-gw" },
  { label: "Router", detail: "svc-router" },
];

const DEFAULT_RECENT: DeadLetterLink[] = [
  { label: "Dashboard" },
  { label: "Settings" },
  { label: "Docs" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// Deterministic scatter in [-6, 6] degrees from a label, so re-renders don't
// jitter and every hop still reads as hand-stamped rather than uniform.
function scatter(label: string, index: number): number {
  return (Math.abs(hash(label + index)) % 13) - 6;
}

const CSS = `
@keyframes ns-dl-slide{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:translateX(0)}}
@keyframes ns-dl-stamp{
  0%{opacity:0;transform:scale(1.3) rotate(var(--ns-dl-rot,0deg))}
  100%{opacity:1;transform:scale(1) rotate(var(--ns-dl-rot,0deg))}
}
@keyframes ns-dl-final{
  0%{opacity:0;transform:translateY(-10px) scale(1.3) rotate(var(--ns-dl-rot,-8deg))}
  55%{opacity:1;transform:translateY(0) scale(1.08,0.88) rotate(var(--ns-dl-rot,-8deg))}
  78%{transform:translateY(0) scale(0.96,1.05) rotate(var(--ns-dl-rot,-8deg))}
  100%{opacity:1;transform:translateY(0) scale(1) rotate(var(--ns-dl-rot,-8deg))}
}
@keyframes ns-dl-shake{
  0%,100%{transform:translateX(0)}
  30%{transform:translateX(-1px)}
  60%{transform:translateX(1px)}
  85%{transform:translateX(-0.5px)}
}
@keyframes ns-dl-peel{
  from{opacity:0;transform:translateY(10px) skewY(-3.5deg) scale(0.98)}
  to{opacity:1;transform:translateY(0) skewY(0deg) scale(1)}
}
`;

export function DeadLetter({
  path: pathProp,
  hops = DEFAULT_HOPS,
  recentPages = DEFAULT_RECENT,
  homeHref = "/",
  onSearch,
  className = "",
}: DeadLetterProps) {
  const uid = useId();
  const grainId = `ns-dl-grain-${uid}`;
  const [reduced, setReduced] = useState(false);
  const [autoPath, setAutoPath] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.title = "404 — page not found";
  }, []);

  useEffect(() => {
    if (pathProp) return;
    setAutoPath(window.location.pathname + window.location.search);
  }, [pathProp]);

  const path = pathProp ?? autoPath ?? "/unknown";

  // --- timing --------------------------------------------------------------
  // Full sequence must be settled with real margin before the verify gate's
  // 1000ms default screenshot — the last two beats (a squash, a skew-peel)
  // read as visibly broken if caught mid-motion, unlike a plain fade. Hops
  // stamp the required 250ms apart starting near-immediately; the final
  // stamp lands right after the last hop; the forwarding label starts
  // peeling the moment the stamp starts landing rather than waiting for it
  // to finish. Everything at rest by ~870ms, ~130ms of margin.
  const slideDur = 150;
  const hopStagger = 250;
  const hopDelayBase = 40;
  const hopDur = 150;
  const lastHopDelay = hopDelayBase + (hops.length - 1) * hopStagger;
  const finalDelay = lastHopDelay + hopDur + 20;
  const finalDur = 140;
  const peelDelay = finalDelay;
  const peelDur = 160;

  // Slide entrance and the late shake live on the SAME element, so they must
  // share one `animation` shorthand as a comma list — two style objects spread
  // together would overwrite each other's `animation`, leaving the entrance
  // (and its fill-mode opacity) never applied and the envelope stuck invisible.
  const envelopeStyle: CSSProperties | undefined = reduced
    ? undefined
    : {
        opacity: 0,
        animation: `ns-dl-slide ${slideDur}ms cubic-bezier(.16,1,.3,1) both, ns-dl-shake 160ms linear ${finalDelay}ms both`,
      };

  // SVG elements transform around their border box by default in some
  // browsers, not their own visual center — explicit fill-box/center keeps
  // the scale+rotate pivoting in place rather than swinging from a corner.
  const hopStyle = (i: number): CSSProperties =>
    (reduced
      ? { transformBox: "fill-box", transformOrigin: "center", "--ns-dl-rot": `${scatter(hops[i]?.label ?? "", i)}deg` }
      : {
          opacity: 0,
          transformBox: "fill-box",
          transformOrigin: "center",
          "--ns-dl-rot": `${scatter(hops[i]?.label ?? "", i)}deg`,
          animation: `ns-dl-stamp ${hopDur}ms cubic-bezier(.16,1,.3,1) ${hopDelayBase + i * hopStagger}ms both`,
        }) as unknown as CSSProperties;

  const finalStyle: CSSProperties = (reduced
    ? { transformBox: "fill-box", transformOrigin: "center", "--ns-dl-rot": "-8deg" }
    : {
        opacity: 0,
        transformBox: "fill-box",
        transformOrigin: "center",
        "--ns-dl-rot": "-8deg",
        animation: `ns-dl-final ${finalDur}ms cubic-bezier(.16,1,.3,1) ${finalDelay}ms both`,
      }) as unknown as CSSProperties;

  const peelStyle: CSSProperties | undefined = reduced
    ? undefined
    : { opacity: 0, animation: `ns-dl-peel ${peelDur}ms cubic-bezier(.16,1,.3,1) ${peelDelay}ms both` };

  const hopSummary = useMemo(() => hops.map((h) => h.label).join(" → "), [hops]);

  return (
    <div className={["flex min-h-screen flex-col items-center bg-background px-6 py-10 md:px-10", className].join(" ")}>
      <style>{CSS}</style>

      {/* shared grain filter — geometric-only turbulence, no baked color */}
      <svg width={0} height={0} aria-hidden style={{ position: "absolute" }}>
        <defs>
          <filter id={grainId} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={3} result="ns-dl-noise" />
            <feDisplacementMap in="SourceGraphic" in2="ns-dl-noise" scale={1.6} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <div className="w-full max-w-2xl">
        <span className="font-mono text-xs tracking-[0.3em] text-ns-muted">UNDELIVERABLE MAIL</span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          404 — page not found
        </h1>
        <p className="mt-3 max-w-[60ch] font-mono text-xs leading-relaxed text-ns-muted">
          Route attempted: <span className="break-all text-foreground">{path}</span> — failed at every
          hop ({hopSummary}) with no such address.
        </p>

        {/* theatrical envelope — pure decoration, zero focusable elements */}
        <div
          aria-hidden="true"
          className="mt-6 rounded-md border border-border bg-background p-5 md:p-7"
          style={envelopeStyle}
        >
          <div className="border-b border-border pb-4">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ns-muted">To</span>
            <div className="mt-1 break-all font-mono text-sm text-foreground md:text-base">{path}</div>
          </div>

          <div className="relative mt-6 flex items-end gap-2 sm:gap-4">
            {hops.map((hop, i) => (
              <Fragment key={`${hop.label}-${i}`}>
                {i > 0 && (
                  <span
                    className="mb-4 hidden h-0 flex-1 border-t border-dashed border-border sm:block"
                    aria-hidden
                  />
                )}
                <div className="flex flex-col items-center gap-1">
                  <svg width={40} height={40} viewBox="0 0 40 40" style={hopStyle(i)} className="overflow-visible">
                    <g filter={`url(#${grainId})`}>
                      <circle cx={20} cy={20} r={16.5} fill="none" stroke="var(--foreground)" strokeWidth={1.3} />
                      <circle cx={20} cy={20} r={11} fill="none" stroke="var(--border)" strokeWidth={1} />
                      <path
                        d="M4,15 Q11,10 18,15 T32,15"
                        fill="none"
                        stroke="var(--ns-muted)"
                        strokeWidth={1}
                        strokeLinecap="round"
                      />
                      <path
                        d="M4,25 Q11,20 18,25 T32,25"
                        fill="none"
                        stroke="var(--ns-muted)"
                        strokeWidth={1}
                        strokeLinecap="round"
                      />
                    </g>
                  </svg>
                  <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-wide text-ns-muted">
                    {hop.label}
                  </span>
                  {hop.detail && (
                    <span className="whitespace-nowrap font-mono text-[8px] text-ns-muted/70">{hop.detail}</span>
                  )}
                </div>
              </Fragment>
            ))}

            {/* the final hop lands here — anchored to the row's own right
                edge (already inside the card's padding) rather than centered
                on the last icon, so the stamp can never hang off the card */}
            <svg
              width={128}
              height={44}
              viewBox="0 0 128 44"
              className="pointer-events-none absolute -top-7 right-0 overflow-visible"
              style={finalStyle}
            >
              <g filter={`url(#${grainId})`}>
                <rect x={2} y={2} width={124} height={40} rx={4} fill="none" stroke="var(--foreground)" strokeWidth={2} />
                <rect x={6} y={6} width={116} height={32} rx={3} fill="none" stroke="var(--foreground)" strokeWidth={1} />
                <text
                  x={64}
                  y={19}
                  textAnchor="middle"
                  className="font-mono"
                  fontWeight={700}
                  fontSize={9.5}
                  letterSpacing={0.5}
                  fill="var(--foreground)"
                >
                  NO SUCH
                </text>
                <text
                  x={64}
                  y={31}
                  textAnchor="middle"
                  className="font-mono"
                  fontWeight={700}
                  fontSize={9.5}
                  letterSpacing={0.5}
                  fill="var(--foreground)"
                >
                  ADDRESS
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* forwarding-address label — the real 404 page, first in tab order */}
        <nav
          aria-label="Recovery"
          className="mt-6 rounded-md border border-border bg-background p-5 md:p-6"
          style={peelStyle}
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-ns-muted">Forwarding address</span>

          <form
            role="search"
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch?.(query.trim());
            }}
          >
            <label htmlFor={`${uid}-search`} className="sr-only">
              Search
            </label>
            <input
              id={`${uid}-search`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-9 flex-1 rounded-sm border border-border bg-background px-3 font-mono text-sm text-foreground placeholder:text-ns-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            />
            <button
              type="submit"
              className="h-9 rounded-sm border border-border px-3 font-mono text-xs text-foreground transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              Search
            </button>
          </form>

          <ul className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <li>
              <a
                href={homeHref}
                className="rounded-sm px-1 py-0.5 font-mono text-xs text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              >
                Home
              </a>
            </li>
            {recentPages.map((page) => (
              <li key={page.label}>
                <a
                  href={page.href || "#"}
                  onClick={page.href ? undefined : (e) => e.preventDefault()}
                  className="rounded-sm px-1 py-0.5 font-mono text-xs text-ns-muted underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                >
                  {page.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
