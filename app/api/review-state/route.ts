/**
 * /api/review-state — local-only persistence for the /review console (see
 * app/review/page.tsx). Not part of the catalog or the public API surface:
 * it reads and writes a single JSON file on the developer's own machine so
 * notes and "Tested" flags survive reloads and are readable outside the
 * browser (`cat .review-state.json`).
 *
 * Guard: this route must never answer on a deployed site. If
 * `NODE_ENV === "production"` AND the request did not arrive over
 * localhost/loopback, it returns 404 (not 403 — a 403 confirms the route
 * exists; 404 makes it look like nothing is there) before touching the
 * filesystem. Vercel always runs with NODE_ENV=production, so in practice
 * this route is dead on every deployment and live only under `next dev` /
 * `next start` on the developer's own box.
 *
 * File shape: { "<slug>": { tested: boolean, note: string, verdict?:
 * "working" | "flagged", updatedAt: ISO } } stored at the repo root as
 * `.review-state.json` (gitignored). `verdict` is the one-click judgement
 * from /review's "Working" / "Needs work" control; `tested` stays true
 * whenever a verdict has been recorded (kept for any tooling that only
 * knows the old "have I looked at this" boolean — it no longer has its own
 * UI control, it's derived). `note` is unrelated free text, independent of
 * verdict, for explaining what's wrong on a flagged row. Every write is
 * read-modify-write of the whole object, then written atomically (temp
 * file in the same directory, renamed over the target) so a mid-write
 * reload or two overlapping requests can't leave truncated or clobbered
 * JSON.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const STATE_PATH = path.join(process.cwd(), ".review-state.json");

type Verdict = "working" | "flagged";
type RowState = { tested: boolean; note: string; verdict?: Verdict; updatedAt: string };
type StateFile = Record<string, RowState>;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function isLocalhostRequest(req: NextRequest): boolean {
  // Prefer the actual socket-adjacent signal over trusting a spoofable
  // header: Next's NextRequest doesn't expose the raw socket, so fall back
  // to the Host header, which for a genuinely local `next start`/`next dev`
  // process (no reverse proxy in front) is exactly "localhost:PORT" or
  // "127.0.0.1:PORT" — good enough for a dev-only guard, not a security
  // boundary against a hostile network.
  const host = req.headers.get("host") ?? "";
  const hostname = host.split(":")[0];
  return LOOPBACK_HOSTS.has(hostname);
}

function guard(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === "production" && !isLocalhostRequest(req)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return null;
}

async function readState(): Promise<StateFile> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    return JSON.parse(raw) as StateFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    // Malformed JSON (e.g. an interrupted write from before atomic renames
    // existed) — treat as empty rather than 500ing every request forever.
    console.error("review-state: failed to parse state file, treating as empty", err);
    return {};
  }
}

async function writeStateAtomic(state: StateFile): Promise<void> {
  const dir = path.dirname(STATE_PATH);
  await mkdir(dir, { recursive: true });
  const tmpPath = path.join(dir, `.review-state.${randomBytes(6).toString("hex")}.tmp.json`);
  await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
  try {
    await rename(tmpPath, STATE_PATH);
  } catch (err) {
    await unlink(tmpPath).catch(() => {});
    throw err;
  }
}

// Serializes writes within this process so two near-simultaneous POSTs
// (e.g. a debounced note-save firing right as a checkbox toggles) always
// read-modify-write in sequence instead of racing on the read.
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.catch(() => {});
  return result;
}

export async function GET(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;

  const state = await readState();
  return NextResponse.json(state);
}

export async function PUT(req: NextRequest) {
  return handleUpsert(req);
}

export async function POST(req: NextRequest) {
  return handleUpsert(req);
}

async function handleUpsert(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).slug !== "string" ||
    !(body as Record<string, unknown>).slug
  ) {
    return NextResponse.json({ error: "body must include a non-empty slug" }, { status: 400 });
  }

  const slug = (body as Record<string, unknown>).slug as string;
  const testedRaw = (body as Record<string, unknown>).tested;
  const noteRaw = (body as Record<string, unknown>).note;
  const verdictRaw = (body as Record<string, unknown>).verdict;
  // "unset" is an explicit clear (clicking an already-active verdict button
  // again) — distinct from the key being absent, which means "leave the
  // stored verdict alone" (e.g. a note-only PUT).
  const verdictProvided = verdictRaw === "working" || verdictRaw === "flagged" || verdictRaw === "unset";
  const verdict: Verdict | undefined =
    verdictRaw === "working" || verdictRaw === "flagged" ? verdictRaw : undefined;

  const result = await enqueueWrite(async () => {
    const state = await readState();
    const prev = state[slug] ?? { tested: false, note: "", updatedAt: new Date(0).toISOString() };
    const next: RowState = {
      // A verdict click always means "I judged this" (or, on clear,
      // explicitly un-judged) — takes precedence over an explicit tested
      // value in the same request.
      tested: verdictProvided ? !!verdict : typeof testedRaw === "boolean" ? testedRaw : prev.tested,
      note: typeof noteRaw === "string" ? noteRaw : prev.note,
      verdict: verdictProvided ? verdict : prev.verdict,
      updatedAt: new Date().toISOString(),
    };
    // Drop rows that carry no information at all — never a row a verdict
    // click or the legacy-localStorage migration already touched.
    if (!next.verdict && !next.tested && next.note.trim() === "") {
      delete state[slug];
    } else {
      state[slug] = next;
    }
    await writeStateAtomic(state);
    return state;
  });

  return NextResponse.json(result);
}
