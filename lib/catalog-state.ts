// The homepage catalog's URL-derived state and the two predicates Showcase
// branches on. app/_components/showcase.tsx imports these for its own render,
// and scripts/test-catalog-gate.ts imports the same functions as the reference
// that lib/catalog-gate.ts's inline CATALOG_GATE_SCRIPT is checked against, so
// there is one implementation of "is anything filtered" / "is a non-default
// sort active" rather than a test-local copy that can go stale.
//
// Kept free of React and of other app modules so Node can run it directly
// (type stripping) from scripts/.

export type Filter = "all" | "core" | "loud";
export type Sort = "featured" | "newest" | "oldest";

export const SORT_PARAM = "sort";
export const FILTER_PARAM = "collection";
export const NEW_PARAM = "new";
export const CATEGORY_PARAM = "category";
export const QUERY_PARAM = "q";

export type CatalogState = {
  filter: Filter;
  newOnly: boolean;
  category: string | null;
  query: string;
  sort: Sort;
};

export const DEFAULT_CATALOG_STATE: CatalogState = {
  filter: "all",
  newOnly: false,
  category: null,
  query: "",
  sort: "featured",
};

/**
 * Reads a shared catalog URL into Showcase state. Unknown values fall back to
 * the defaults. `isKnownCategory` is injected because the category list lives
 * in lib/search-categories.ts; Showcase passes its real validator.
 */
export function catalogStateFromParams(
  params: URLSearchParams,
  isKnownCategory: (id: string) => boolean,
): CatalogState {
  const sortParam = params.get(SORT_PARAM);
  const sort: Sort =
    sortParam === "newest" || sortParam === "oldest" || sortParam === "featured"
      ? sortParam
      : DEFAULT_CATALOG_STATE.sort;
  const filterParam = params.get(FILTER_PARAM);
  const filter: Filter =
    filterParam === "core" || filterParam === "loud" ? filterParam : "all";
  const categoryParam = params.get(CATEGORY_PARAM);
  const category =
    categoryParam && isKnownCategory(categoryParam) ? categoryParam : null;
  return {
    filter,
    newOnly: params.get(NEW_PARAM) === "1",
    category,
    query: params.get(QUERY_PARAM) || "",
    sort,
  };
}

/** Anything narrowing the catalog — gates the Clear button and `catalog-filtered`. */
export function isCatalogFiltered(
  s: Pick<CatalogState, "filter" | "newOnly" | "category" | "query">,
): boolean {
  return s.filter !== "all" || s.newOnly || s.category !== null || s.query !== "";
}

/** A non-default sort is active — gates `catalog-sorted`. */
export function isCatalogSorted(sort: Sort): boolean {
  return sort !== "featured";
}
