/**
 * StarPrompt's browse-trigger rule, as a pure function.
 *
 * It lives here rather than inside the component for one reason: the test for
 * it has to drive the SAME code the site runs. The first version of
 * `scripts/test-star-prompt.ts` reimplemented this rule inside the test, and a
 * mutation that deleted the distinct-slug guard from the component passed
 * green — the test was checking its own copy. Exporting the rule removes the
 * copy.
 *
 * No React, no "use client": importable from a plain node script.
 */

/**
 * Distinct component pages opened in one tab before the ask fires without a
 * copy. Three, because two is a glance (arrive, click one thing, click back)
 * and three is the shape of someone comparing options.
 */
export const VISITS_BEFORE_ASK = 3;

/**
 * sessionStorage, not localStorage: this measures one visit's engagement, so
 * it resets when the tab closes rather than slowly accumulating until someone
 * who looked at one component a month for three months gets asked.
 */
export const VISITED_KEY = "ns-ui-star-prompt-visited";

/** Only the component detail page counts. Not the catalog, not a sub-route. */
const COMPONENT_PAGE = /^\/components\/([^/]+)$/;

export type VisitOutcome = {
  /** The visit set after this navigation. Unchanged if it did not count. */
  seen: string[];
  /** Whether this navigation is the one that earns the ask. */
  ask: boolean;
};

/**
 * Records one navigation.
 *
 * Returns `ask: true` only on the navigation that first reaches
 * VISITS_BEFORE_ASK distinct component pages. Deliberately never true on
 * arrival: a visitor who has just landed has demonstrated nothing, does not
 * yet know whether the library is any good, and interrupting them costs more
 * than a star is worth — it also trains people to dismiss the card on sight,
 * which burns the copy trigger too.
 */
export function recordVisit(pathname: string, seen: readonly string[]): VisitOutcome {
  const slug = COMPONENT_PAGE.exec(pathname)?.[1];
  if (!slug) return { seen: [...seen], ask: false };
  if (seen.includes(slug)) return { seen: [...seen], ask: false };
  const next = [...seen, slug];
  return { seen: next, ask: next.length >= VISITS_BEFORE_ASK };
}

/** Reads the visit set, tolerating blocked storage and values other tabs mangled. */
export function readVisits(): string[] {
  try {
    const raw = sessionStorage.getItem(VISITED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}
