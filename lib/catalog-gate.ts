// Pre-hydration gate for the homepage catalog (app/_components/showcase.tsx).
//
// Showcase always mounts with `filter="all"`, `category=null`, `query=""`,
// `sort="featured"` — the server-rendered defaults — then reads
// `location.search` inside a `useEffect` and flips state to match a shared
// URL (?q=, ?collection=, ?category=, ?new=, ?sort=). Any visitor who arrives on
// such a URL therefore gets two renders: the default one the server painted,
// then the corrected one seconds later once React hydrates. Two blocks are
// only present in the default render — the Featured rail and the "All
// components" heading above the catalog grid — so when they disappear on the
// corrected render, everything below (including the grid) jumps up. That
// jump is a layout shift by construction — read `filtered` and the two
// gates at app/_components/showcase.tsx:548 and the blocks it guards — but
// it is UNQUANTIFIED, and this comment used to claim otherwise.
//
// It previously read "this repo's worst measured CLS
// (docs/perf-audit-2026-07.md)". Both halves were false. That document's
// CLS row reads `| CLS | 0 | 0 |`, and its methodology loads a plain
// homepage, which never visits a `?q=`/`?category=` URL — so it could not
// have observed this shift even in principle. The worst CLS actually on
// record is the footer selector at 0.11 across 6 samples, up to 0.13
// per-route (docs/perf-goal.md, "### CLS"), which belongs to
// app/_components/site-auth.tsx, not to the catalog.
//
// No audit here samples a filtered URL, which is likely why: one only
// arrives when a visitor shares it, so the shift can be large per
// occurrence while contributing nothing visible to a field P75. The gate
// below is therefore justified on cost, not on magnitude — an inline
// <head> script adding two classes, firing only on URLs carrying params.
//
// This script runs in <head>, before hydration (same idiom as
// lib/theme.ts's NO_FLASH_SCRIPT and lib/sidebar.ts's
// NO_FLASH_SIDEBAR_SCRIPT), and marks <html> with the same two conditions
// Showcase itself branches on, so app/globals.css can hide those blocks in
// the very first paint instead of waiting for React to remove them. The
// predicates below are a plain copy of showcase.tsx's `filtered` variable and
// its `sort !== "featured"` check — if either one changes there, this must
// change with it, or the two disagree and the shift comes back.
//
// `catalog-filtered` and `catalog-sorted` are intentionally two separate
// classes rather than one: CatalogControls' "Clear" button is gated on
// `filtered` alone (a sort-only URL leaves nothing to clear), while the
// Featured rail and "All components" heading are gated on `filtered ||
// sort !== "featured"` (see app/globals.css). Collapsing them into one class
// would make the Clear button appear for a plain ?sort=newest link, which
// Showcase itself never does.
//
// ponytail: the `filtered` predicate stays duplicated here and in
// showcase.tsx rather than shared. Ceiling: the two can silently diverge when
// a filter is added — the `new` toggle is the second one that had to be
// written in both places. Upgrade path: export one predicate taking a
// URLSearchParams, import it in Showcase and stringify it into this script;
// worth doing once a third filter lands.
export const CATALOG_GATE_SCRIPT = `(function(){try{var p=new URLSearchParams(window.location.search);var collection=p.get("collection");var filtered=collection==="core"||collection==="loud"||p.get("new")==="1"||!!p.get("category")||!!p.get("q");var sort=p.get("sort");var sorted=sort==="newest"||sort==="oldest";var cl=document.documentElement.classList;if(filtered)cl.add("catalog-filtered");if(sorted)cl.add("catalog-sorted");}catch(e){}})();`;
