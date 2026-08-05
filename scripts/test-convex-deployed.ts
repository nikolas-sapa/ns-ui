// Guard against the failure that has hit this project three times: a Convex
// function exists in the REPO but was never `npx convex deploy`ed, so the
// deployment silently lacks it. `npm run build` is `registry:build && next
// build` — there is no `npx convex deploy` step anywhere in this repo, on
// Vercel, or in any workflow, so a schema/function change ships to Vercel and
// never reaches Convex. Twice now the symptom read as something else
// entirely: fetchQuery throws on a missing function, the caller's catch maps
// that to 401 ("unauthenticated"), or the route just says "Server Error".
//
// This enumerates every `api.<module>.<fn>` reference this app actually
// calls (grepped from source, never hardcoded — a hardcoded list rots the
// moment a route adds a call this script never learns about), classifies
// each against the convex/<module>.ts source that defines it, and for every
// PUBLIC QUERY issues a real HTTP POST to the deployment's /api/query.
// Mutations are enumerated and reported but never called — calling one to
// "test" it would write data, which is worse than the bug this guards
// against.
//
// THE DISCRIMINATOR, AND WHY IT IS NOT ERROR-MESSAGE TEXT:
// A production Convex deployment redacts every masked error the SAME way —
// measured against this repo's own deployment, a genuinely missing function,
// a malformed path, a mutation called via /api/query, and a query that
// throws a plain Error all come back byte-identical:
//   {"status":"error","errorMessage":"[Request ID: …] Server Error"}
// "Could not find public function for '…'" is what the Convex DASHBOARD LOG
// shows for that request id — never what this HTTP endpoint returns. Grepping
// the response body for that phrase is therefore a check that always passes,
// which is the exact failure mode this script exists to stop shipping again.
//
// What IS trustworthy over this endpoint:
//   - `status: "success"` — the function ran and returned. Exists.
//   - `status: "error"` WITH `errorData` present — a `ConvexError` the
//     function's OWN code threw on purpose (Convex does not mask these; it's
//     the mechanism apps use to hand callers a real error deliberately, and
//     `convex/testimonials.ts`'s `queue` does this for `not_authenticated`).
//     The handler had to run to throw it. Exists.
//   - `status: "error"` with NO `errorData` — indistinguishable from
//     "missing", "argument mismatch" and "threw a plain Error". Reported as a
//     FAIL naming the Request ID, because that ambiguity is exactly what let
//     three real outages read as something else — the honest response is to
//     surface it, not launder it into a pass.
//
// A query with a required argument (e.g. `profiles.publicProfile`'s
// `handle: v.string()`) would land in that last bucket on `{}` alone — an
// argument-validation error is masked identically to a missing function. So
// this script parses each function's `args: { … }` from its own source and,
// where every field is a plain `v.string()` (the only shape any function
// this app currently calls needs), supplies a harmless probe string. A field
// shape it cannot confidently infer is never guessed at; that function is
// reported UNVERIFIABLE, by name, rather than silently skipped or wrongly
// asserted.
//
// Usage: node scripts/test-convex-deployed.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "screenshots", ".next", "data"]);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(p);
  }
  return out;
}

// --- 1. the module names Convex actually deploys, from its own generated
// index. This allowlist is what keeps `api.github.com` / `api.emailoctopus.com`
// (real strings elsewhere in this codebase, not Convex references) from
// being read as convex modules — anything not declared here is not a
// deployed module, full stop.
const apiDts = readFileSync(join(ROOT, "convex", "_generated", "api.d.ts"), "utf8");
const modules = new Set(
  Array.from(apiDts.matchAll(/import type \* as (\w+) from "\.\.\/[\w./-]+\.js";/g), (m) => m[1]),
);
if (modules.size === 0) {
  throw new Error("convex/_generated/api.d.ts declared zero modules — generated file missing or malformed");
}

// --- 2. every `api.<module>.<fn>` this app calls, grepped from source. This
// is deliberately NOT a hardcoded function list: `app/**` and `lib/**` are the
// entire calling surface, and a route that starts calling a new function is
// caught the next time this runs, the same shape as this repo's existing
// category-coverage invariant.
const files = ["app", "lib"].flatMap((d) => walk(join(ROOT, d)));
const referenced = new Set<string>();
for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\bapi\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)\b/g)) {
    const [, mod, fn] = m;
    if (modules.has(mod)) referenced.add(`${mod}.${fn}`);
  }
}

if (referenced.size === 0) {
  console.log("convex deployment guard: 0 api.<module>.<fn> references found under app/**, lib/** — nothing to check");
  console.log("GATE: ERROR found zero references; this almost certainly means the grep broke, not that the app calls nothing");
  process.exit(1);
}

// --- 3. classify each reference against the convex source that defines it,
// and — for queries — extract its `args: { … }` shape so a probe call can
// supply values a required string field will accept rather than tripping
// argument validation (masked identically to a missing function, see header).
type Kind = "query" | "mutation" | "internalQuery" | "internalMutation" | "action" | "internalAction" | "unknown";
type ArgShape = { probe: Record<string, unknown> } | { unverifiable: string };

const moduleSource = new Map<string, string>();
function sourceOf(mod: string): string {
  if (!moduleSource.has(mod)) {
    try {
      moduleSource.set(mod, readFileSync(join(ROOT, "convex", `${mod}.ts`), "utf8"));
    } catch {
      moduleSource.set(mod, "");
    }
  }
  return moduleSource.get(mod)!;
}

// Balanced-brace extractor, same idea as test-source-invariants.ts's cssBlock:
// find `args: {` right after the export and read to its matching `}`.
function argsBlockOf(src: string, fn: string): string | null {
  const declAt = src.search(new RegExp(`export const ${fn}\\s*=\\s*(query|mutation|internalQuery|internalMutation|action|internalAction)\\(`));
  if (declAt < 0) return null;
  const argsAt = src.indexOf("args:", declAt);
  const braceAt = src.indexOf("{", argsAt);
  if (argsAt < 0 || braceAt < 0 || braceAt - argsAt > 20) return null; // args: must be the very next thing
  let depth = 0;
  for (let i = braceAt; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(braceAt + 1, i).trim();
  }
  return null;
}

// Top-level `key: expr` entries, splitting only on commas outside nested
// parens/braces — an arg block with a `v.union(...)` value has commas of its
// own that must not be mistaken for field separators.
function topLevelEntries(block: string): { key: string; expr: string }[] {
  const out: { key: string; expr: string }[] = [];
  let depth = 0;
  let start = 0;
  const push = (chunk: string) => {
    const m = /^\s*([A-Za-z_]\w*)\s*:\s*([\s\S]*?)\s*,?\s*$/.exec(chunk);
    if (m) out.push({ key: m[1], expr: m[2] });
  };
  for (let i = 0; i < block.length; i++) {
    const c = block[i];
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      push(block.slice(start, i));
      start = i + 1;
    }
  }
  if (block.slice(start).trim()) push(block.slice(start));
  return out;
}

function argShapeOf(mod: string, fn: string): ArgShape {
  const block = argsBlockOf(sourceOf(mod), fn);
  if (block === null) return { unverifiable: "could not locate this function's `args: { … }` in its source" };
  if (block === "" || block === "{}") return { probe: {} };
  const entries = topLevelEntries(block);
  const probe: Record<string, unknown> = {};
  for (const { key, expr } of entries) {
    if (/^v\.optional\(/.test(expr)) continue; // omit — optional is always safe to leave out
    if (/^v\.string\(\)$/.test(expr)) {
      probe[key] = "__ns_ui_convex_deploy_guard_probe__";
      continue;
    }
    return { unverifiable: `required arg \`${key}: ${expr}\` is not a plain v.string() — cannot construct a safe probe value` };
  }
  return { probe };
}

function classify(mod: string, fn: string): Kind {
  const m = new RegExp(`export const ${fn}\\s*=\\s*(query|mutation|internalQuery|internalMutation|action|internalAction)\\(`).exec(sourceOf(mod));
  return (m?.[1] as Kind) ?? "unknown";
}

const found = Array.from(referenced, (key) => {
  const [mod, fn] = key.split(".");
  return { mod, fn, kind: classify(mod, fn) };
}).sort((a, b) => (a.mod + a.fn).localeCompare(b.mod + b.fn));

console.log(`convex functions referenced by app/**, lib/**: ${found.length}`);
for (const { mod, fn, kind } of found) console.log(`  ${mod}:${fn} (${kind})`);

// --- 4. the deployment URL, read the same way the app reads it. `??` does
// not fall through on an EMPTY string, which is exactly how this env var
// broke the build once already (a set-but-empty value looked configured and
// was not) — check for blank explicitly rather than only undefined.
const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (url === undefined || url.trim() === "") {
  console.log("");
  console.log("convex deployment guard: SKIPPED — NEXT_PUBLIC_CONVEX_URL is unset (or empty) in this environment.");
  console.log("No deployment to check against, so nothing here can fail. This is not a pass — it is a skip.");
  process.exit(0);
}
const base = url.trim().replace(/\/+$/, "");

// --- 5. probe every PUBLIC query with a real POST to /api/query, using the
// exact wire format the Convex client itself sends
// (node_modules/convex/src/browser/http_client.ts): `path` is
// "module:function", `args` is a one-element array holding the args object.
// A UDF that errors still answers HTTP 200 with a JSON body; only a
// genuinely unreachable deployment fails to return parseable JSON at all.
type Outcome = "exists" | "fail" | "unreachable" | "unverifiable";
type ProbeResult = { mod: string; fn: string; outcome: Outcome; detail: string };

async function probe(mod: string, fn: string, probeArgs: Record<string, unknown>): Promise<ProbeResult> {
  const path = `${mod}:${fn}`;
  let res: Response;
  try {
    res = await fetch(`${base}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, format: "convex_encoded_json", args: [probeArgs] }),
    });
  } catch (err) {
    return { mod, fn, outcome: "unreachable", detail: `fetch to ${base}/api/query threw: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!res.ok) {
    return { mod, fn, outcome: "unreachable", detail: `HTTP ${res.status} from /api/query — deployment URL likely wrong` };
  }
  let body: { status?: string; errorMessage?: string; errorData?: unknown };
  try {
    body = await res.json();
  } catch {
    return { mod, fn, outcome: "unreachable", detail: "/api/query did not return parseable JSON" };
  }
  if (body.status === "success") return { mod, fn, outcome: "exists", detail: "resolved" };
  if (body.status === "error" && body.errorData !== undefined) {
    return { mod, fn, outcome: "exists", detail: `threw a ConvexError on purpose (${JSON.stringify(body.errorData)}) — proves the handler ran` };
  }
  return {
    mod,
    fn,
    outcome: "fail",
    detail: `${body.errorMessage ?? "no errorMessage"} — a masked error carries no distinguishing signal; look up this Request ID in the Convex dashboard log`,
  };
}

const queries = found.filter((f) => f.kind === "query");
const shapes = new Map(queries.map((q) => [`${q.mod}.${q.fn}`, argShapeOf(q.mod, q.fn)]));

const probeable = queries.filter((q) => "probe" in shapes.get(`${q.mod}.${q.fn}`)!);
const unverifiable = queries.filter((q) => "unverifiable" in shapes.get(`${q.mod}.${q.fn}`)!);

const results = await Promise.all(
  probeable.map((q) => probe(q.mod, q.fn, (shapes.get(`${q.mod}.${q.fn}`) as { probe: Record<string, unknown> }).probe)),
);

console.log("");
console.log("================ CONVEX DEPLOYMENT GUARD ================");
console.log(`deployment:              ${base}`);
console.log(`functions referenced:    ${found.length}`);
console.log(`public queries:          ${queries.length}`);
console.log(`probed over HTTP:        ${results.length}`);
console.log(`unverifiable (see below):${unverifiable.length ? "" : " none"}`);
for (const r of results) {
  const mark = r.outcome === "exists" ? "OK" : "FAIL";
  console.log(`  ${mark} ${r.mod}:${r.fn} — ${r.detail}`);
}
for (const q of unverifiable) {
  const reason = (shapes.get(`${q.mod}.${q.fn}`) as { unverifiable: string }).unverifiable;
  console.log(`  UNVERIFIABLE ${q.mod}:${q.fn} — ${reason}`);
}

const failing = results.filter((r) => r.outcome === "fail");
const unreachable = results.filter((r) => r.outcome === "unreachable");

if (failing.length) {
  console.log("");
  console.log(`GATE: FAIL ${failing.length} function(s) referenced by the app answered with an unresolvable masked error:`);
  for (const r of failing) console.log(`  ${r.mod}:${r.fn}`);
  console.log("Most likely fix: run `npx convex deploy`. `npm run build` does NOT do this — see AGENTS.md/CONTRIBUTING.md.");
}
if (unreachable.length) {
  console.log("");
  console.log(`GATE: FAIL ${unreachable.length} function(s) could not be checked — the deployment did not answer /api/query:`);
  for (const r of unreachable) console.log(`  ${r.mod}:${r.fn} — ${r.detail}`);
  console.log("Check NEXT_PUBLIC_CONVEX_URL points at a live deployment.");
}
if (!failing.length && !unreachable.length) {
  console.log("");
  console.log(
    `convex deployment guard: pass (${results.length} public queries confirmed present on the deployment` +
      (unverifiable.length ? `, ${unverifiable.length} unverifiable and named above` : "") +
      ")",
  );
}
console.log("==========================================================");

if (failing.length || unreachable.length) process.exit(1);
