"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// PostListAsciiIndex — a blog/post list whose ASCII gutter does real work
// instead of decorating the margin. j/k and the arrow keys move a roving-
// tabindex selection across real <button> rows; the gutter (one <canvas>,
// measured against the actual row rects) draws a running index rule — a
// vertical hairline with a marker that EASES to the selected row's live
// position every frame — plus, per row, its reading length as a literal
// ASCII bar (repeated block glyphs). The selected row's bar is not just
// highlighted: it redraws with its own left-to-right reveal sweep every
// time selection changes, a genuine recompute triggered by the selection
// event, not a static picture recolored on hover. Distinct from
// listbox-sticky-groups (a grouped listbox whose margin trick is sticky
// group headers fanning into a stack — no per-row metric, no marker
// tracking a cursor), feed-escapement (a metered arrival queue with no
// selection or navigation at all) and filter-facet-mesh (a sieve of filter
// chips, not a list of ranked/selectable rows).
// ---------------------------------------------------------------------------

export interface PostListAsciiItem {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  minutes: number;
}

export interface PostListAsciiIndexProps {
  /** the posts, in list order */
  posts: PostListAsciiItem[];
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const GUTTER_W = 56;
const MARKER_LERP = 0.22;
const REVEAL_MS = 260;
const MAX_MINUTES_BAR = 10; // full-length bar caps at this many minutes

interface Tokens {
  fg: string;
  muted: string;
  border: string;
  accent: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    fg: get("--foreground", "#ededed"),
    muted: get("--ns-muted", "#8f8f8f"),
    border: get("--border", "#2e2e2e"),
    accent: get("--ns-accent", "#006bff"),
  };
}

function easeOutCubic(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

export function PostListAsciiIndex({ posts, className = "" }: PostListAsciiIndexProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tokensRef = useRef<Tokens>(
    typeof document === "undefined"
      ? { fg: "#ededed", muted: "#8f8f8f", border: "#2e2e2e", accent: "#006bff" }
      : readTokens()
  );
  const reducedRef = useRef(false);
  const rafRef = useRef(0);
  const markerYRef = useRef(0);
  const revealStartRef = useRef(0);
  const rowRectsRef = useRef<{ top: number; height: number }[]>([]);
  const liveRef = useRef<HTMLSpanElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const n = posts.length;

  const maxMinutes = useMemo(() => Math.min(MAX_MINUTES_BAR, Math.max(1, ...posts.map((p) => p.minutes))), [posts]);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mo = new MutationObserver(() => {
      tokensRef.current = readTokens();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => mo.disconnect();
  }, []);

  const measureRows = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    rowRectsRef.current = rowRefs.current.slice(0, n).map((el) => {
      if (!el) return { top: 0, height: 0 };
      const r = el.getBoundingClientRect();
      return { top: r.top - canvasRect.top, height: r.height };
    });
  };

  useEffect(() => {
    measureRows();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      measureRows();
      wake();
    });
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  useEffect(() => {
    revealStartRef.current = performance.now();
    wake();
  }, [activeIndex]);

  const wake = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(loop);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 1;
    const cssH = canvas.clientHeight || 1;
    const targetW = Math.ceil(cssW * dpr);
    const targetH = Math.ceil(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const { fg, muted, border, accent } = tokensRef.current;

    const ruleX = cssW - 11.5;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ruleX, 0);
    ctx.lineTo(ruleX, cssH);
    ctx.stroke();

    ctx.font = `10px "GeistMono", ui-monospace, monospace`;
    ctx.textBaseline = "middle";

    const rows = rowRectsRef.current;
    const now = performance.now();
    const revealT = reducedRef.current ? 1 : Math.min(1, (now - revealStartRef.current) / REVEAL_MS);
    const revealEased = easeOutCubic(revealT);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const post = posts[i];
      if (!row || !post || row.height <= 0) continue;
      const cy = row.top + row.height / 2;
      const isActive = i === activeIndex;

      // tick into the rule
      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.moveTo(ruleX - 3, cy);
      ctx.lineTo(ruleX + 3, cy);
      ctx.stroke();

      // index number
      ctx.textAlign = "left";
      ctx.fillStyle = isActive ? fg : muted;
      ctx.fillText(String(i + 1).padStart(2, "0"), 0, cy - 9);

      // reading-length bar: full for resting rows, eased reveal for the
      // active row so the metric visibly recomputes on selection
      const barLen = Math.max(1, Math.round((post.minutes / maxMinutes) * 8));
      const shownLen = isActive ? Math.max(0, Math.round(barLen * revealEased)) : barLen;
      const bar = "█".repeat(shownLen); // █
      ctx.fillStyle = isActive ? accent : fg;
      ctx.globalAlpha = isActive ? 1 : 0.35;
      ctx.fillText(bar, 0, cy + 6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = muted;
      ctx.fillText(`${post.minutes}m`, 30, cy + 6);
    }

    // running index marker: eases to the active row's live centre
    const activeRow = rows[activeIndex];
    if (activeRow) {
      const targetY = activeRow.top + activeRow.height / 2;
      if (reducedRef.current) markerYRef.current = targetY;
      else markerYRef.current += (targetY - markerYRef.current) * MARKER_LERP;
      ctx.fillStyle = accent;
      ctx.textAlign = "center";
      ctx.font = `12px "GeistMono", ui-monospace, monospace`;
      ctx.fillText("▸", ruleX + 8, markerYRef.current); // ▸
    }
  };

  const loop = () => {
    rafRef.current = 0;
    draw();
    const activeRow = rowRectsRef.current[activeIndex];
    const targetY = activeRow ? activeRow.top + activeRow.height / 2 : markerYRef.current;
    const markerSettled = Math.abs(targetY - markerYRef.current) < 0.3;
    const revealSettled = performance.now() - revealStartRef.current > REVEAL_MS;
    if (!reducedRef.current && (!markerSettled || !revealSettled)) {
      rafRef.current = requestAnimationFrame(loop);
    }
  };

  useEffect(() => {
    draw();
    wake();
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusIndex = (i: number) => {
    const clamped = Math.max(0, Math.min(n - 1, i));
    setActiveIndex(clamped);
    rowRefs.current[clamped]?.focus();
    const post = posts[clamped];
    if (post && liveRef.current) liveRef.current.textContent = `${post.title}, ${post.minutes} minute read`;
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
      e.preventDefault();
      focusIndex(activeIndex + 1);
    } else if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
      e.preventDefault();
      focusIndex(activeIndex - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusIndex(n - 1);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <span ref={liveRef} aria-live="polite" className="sr-only" />
      <div className="flex">
        <div className="relative shrink-0" style={{ width: GUTTER_W }}>
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        </div>
        <div ref={listRef} className="min-w-0 flex-1">
          {posts.map((post, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={post.id}
                type="button"
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                data-post-row={post.id}
                tabIndex={isActive ? 0 : -1}
                aria-current={isActive || undefined}
                aria-label={`${post.title}, ${post.date}, ${post.minutes} minute read`}
                onClick={() => focusIndex(i)}
                onFocus={() => setActiveIndex(i)}
                onKeyDown={onKeyDown}
                className={`block w-full border-b border-border/60 px-4 py-3 text-left transition-colors duration-150 last:border-b-0 hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent ${
                  isActive ? "bg-surface" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-foreground">{post.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-ns-muted">{post.date}</span>
                </div>
                <p className="mt-1 truncate text-xs text-ns-muted">{post.excerpt}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
