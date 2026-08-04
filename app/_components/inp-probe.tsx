"use client";

import { useEffect } from "react";

/**
 * Diagnostic probe for the /writing-attributed 624ms INP regression (Speed
 * Insights, production, real users). Soft-navigation samples get attributed
 * to whichever route is current when the report fires, so the blamed
 * selectors are actually homepage (`/`) markup — this probe therefore lives
 * at the root layout, not on any one route, and records what actually
 * happens on `/` while comparison interactions on other routes go through
 * the same log.
 *
 * Zero-cost unless explicitly armed: every branch below the opt-in check is
 * skipped entirely, so this cannot itself contribute to INP or CLS in the
 * field. Arm with `?inpdebug=1` (persists via localStorage across the
 * client-side navigations this site's links do) or by setting
 * `localStorage.inp-probe = "1"` directly. Never enabled by default, and
 * only the top frame runs it — a card's own `/preview/<name>/embed` iframe
 * would otherwise double-count itself the way SiteAnalytics used to (see
 * that component's docblock).
 *
 * Findings land on `window.__inp` for a profiling script to read; nothing is
 * sent anywhere. This module is scratch instrumentation for one profiling
 * pass, not a permanent addition — see the Track A report for whether it
 * should be removed.
 */
export function InpProbe() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.self !== window.top) return;

    const params = new URLSearchParams(window.location.search);
    const queryFlag = params.get("inpdebug");
    if (queryFlag === "1") localStorage.setItem("inp-probe", "1");
    if (queryFlag === "0") localStorage.removeItem("inp-probe");
    const armed = localStorage.getItem("inp-probe") === "1";
    if (!armed) return;

    type LafScript = {
      sourceURL: string;
      sourceFunctionName: string;
      duration: number;
      forcedStyleAndLayoutDuration: number;
      invokerType?: string;
      invoker?: string;
    };
    type LafEntry = {
      t: number;
      duration: number;
      blockingDuration: number;
      renderStart: number;
      styleAndLayoutStart: number;
      scripts: LafScript[];
    };
    type IframeEvent = { t: number; added: number; removed: number };
    type KeyEvent = { t: number; key: string; targetId: string };

    const w = window as unknown as {
      __inp?: { laf: LafEntry[]; iframes: IframeEvent[]; keys: KeyEvent[] };
    };
    w.__inp = { laf: [], iframes: [], keys: [] };
    const log = w.__inp;

    // Long Animation Frames: the actual attribution mechanism. `scripts[]`
    // entries with real `duration` point at a specific function; time spent
    // in `styleAndLayoutStart..renderStart+duration` that is NOT inside any
    // script's own duration is forced layout/reflow work the browser did on
    // the frame's behalf (the 266-item layout thrash hypothesis).
    const lafObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as unknown as {
          startTime: number;
          duration: number;
          blockingDuration: number;
          renderStart: number;
          styleAndLayoutStart: number;
          scripts: LafScript[];
        };
        log.laf.push({
          t: e.startTime,
          duration: e.duration,
          blockingDuration: e.blockingDuration,
          renderStart: e.renderStart,
          styleAndLayoutStart: e.styleAndLayoutStart,
          scripts: (e.scripts ?? []).map((s) => ({
            sourceURL: s.sourceURL,
            sourceFunctionName: s.sourceFunctionName,
            duration: s.duration,
            forcedStyleAndLayoutDuration: s.forcedStyleAndLayoutDuration,
            invokerType: (s as unknown as { invokerType?: string }).invokerType,
            invoker: (s as unknown as { invoker?: string }).invoker,
          })),
        });
      }
    });
    try {
      lafObserver.observe({ type: "long-animation-frame", buffered: true } as PerformanceObserverInit);
    } catch {
      /* not supported */
    }

    // Names the hypothesis directly: does a keystroke in #component-search
    // change the mounted-iframe set (MOUNT_CAP eviction/re-mount)? Counts
    // preview iframes added/removed on every mutation batch, independent of
    // which component owns that markup — this only reads the DOM.
    const mutationObserver = new MutationObserver((records) => {
      let added = 0;
      let removed = 0;
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (n instanceof HTMLIFrameElement && n.src.includes("/preview/")) added += 1;
          else if (n instanceof HTMLElement) {
            added += n.querySelectorAll('iframe[src*="/preview/"]').length;
          }
        }
        for (const n of r.removedNodes) {
          if (n instanceof HTMLIFrameElement && n.src.includes("/preview/")) removed += 1;
          else if (n instanceof HTMLElement) {
            removed += n.querySelectorAll('iframe[src*="/preview/"]').length;
          }
        }
      }
      if (added || removed) {
        log.iframes.push({ t: performance.now(), added, removed });
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Per-keystroke marker for the search input specifically (any input, not
    // just #component-search, since the sidebar has its own search too — see
    // catalog-controls.tsx's comment on that distinction).
    const onInput = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName !== "INPUT") return;
      log.keys.push({ t: performance.now(), key: "input", targetId: target.id });
      performance.mark(`inp-probe:keystroke:${target.id}`);
    };
    document.addEventListener("input", onInput, true);

    return () => {
      lafObserver.disconnect();
      mutationObserver.disconnect();
      document.removeEventListener("input", onInput, true);
    };
  }, []);

  return null;
}
