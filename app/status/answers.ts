/**
 * The four questions at the top of /status.
 *
 * They are organised by what a consumer is trying to DO, not by system. That
 * is deliberate and it is the whole point of the page: both real incidents
 * this registry has had (72 preview videos named with pre-rename slugs, a
 * published CLI index behind the site) returned HTTP 200 from every system
 * involved. A board reading "Site / Convex / MCP / CLI" would have been green
 * through both of them. A board reading "can I see a component move before I
 * install it?" would not. The service strips now above these questions are
 * that first board, kept honest by recording only what happened — these
 * questions are what it still cannot see, which is why they did not move.
 *
 * Nothing is derived here that lib/status-checks.ts already decides. An answer
 * takes the checks it rests on, adopts the worst state among them, and states
 * that state in prose. It never invents a number and never softens one: if the
 * evidence is absent the answer opens with "Not measured", at the same weight
 * as every other answer.
 */
import type { CheckState, StatusBuild, StatusCheck } from "@/lib/status-checks";

export type Answer = {
  id: string;
  question: string;
  state: CheckState;
  /**
   * One sentence. Its first word IS the state word — "Yes", "No",
   * "Not measured" — so the answer survives being read with no colour at all.
   */
  answer: string;
};

const RANK: Record<CheckState, number> = { down: 0, degraded: 1, unknown: 2, ok: 3 };

const worst = (...states: CheckState[]): CheckState =>
  states.reduce((a, b) => (RANK[a] <= RANK[b] ? a : b), "ok");

const find = (checks: StatusCheck[], id: string): StatusCheck | undefined =>
  checks.find((c) => c.id === id);

/**
 * `integrity` and `services` are the arrays lib/status-checks.ts produced for
 * this render; `build` is the generated file, read directly only for the three
 * agent-artifact counts no ledger row covers (llms.txt, llms-full.txt, the MCP
 * snapshot).
 */
export function answers(
  build: StatusBuild,
  integrity: StatusCheck[],
  services: StatusCheck[]
): Answer[] {
  return [
    installAnswer(build, integrity, services),
    agentAnswer(build),
    previewAnswer(integrity),
    accountAnswer(services),
  ];
}

// --- 1 -------------------------------------------------------------------
// Payloads are a build fact; what production is serving is a live read. Both
// are named, because a green payload count on a build nobody deployed is the
// exact shape of this repo's second incident.
function installAnswer(
  build: StatusBuild,
  integrity: StatusCheck[],
  services: StatusCheck[]
): Answer {
  const payloads = find(integrity, "install-payloads");
  const origin = find(services, "live-origin");
  const question = "Can I install a component right now?";

  if (!payloads || !origin) {
    return {
      id: "install",
      question,
      state: "unknown",
      answer: "Not measured — the install checks did not run for this render.",
    };
  }

  const built = `${build.payloadsOk} of ${build.payloadsTotal} install payloads in this build parse and carry real file contents`;

  if (payloads.state !== "ok") {
    return {
      id: "install",
      question,
      state: payloads.state,
      answer: `No — only ${built}, so the rest resolve to nothing a package manager can write to disk.`,
    };
  }

  if (origin.state === "unknown") {
    return {
      id: "install",
      question,
      state: "unknown",
      answer: `Not measured — all ${build.payloadsTotal} install payloads in this build parse and carry real file contents, but the live registry index could not be read, so what production is serving right now is unknown.`,
    };
  }

  // `live-origin` reports `<n> items`; the read-back is the comparison the
  // services row deliberately leaves to this section.
  const live = Number.parseInt(origin.value, 10);
  if (Number.isFinite(live) && live !== build.components) {
    const behind = live < build.components;
    return {
      id: "install",
      question,
      state: behind ? "down" : "degraded",
      answer: behind
        ? `No — the live registry index serves ${live} components while this build measured ${build.components}, so ${build.components - live} of the components described here cannot be installed from it.`
        : `Yes — every one of the ${build.components} components in this build installs, though the live registry index is ahead of it at ${live}, so production is describing components this page has not measured.`,
    };
  }

  return {
    id: "install",
    question,
    state: "ok",
    answer: `Yes — all ${build.payloadsTotal} install payloads parse and carry real file contents, and the live registry index serves the same ${build.components} components.`,
  };
}

// --- 2 -------------------------------------------------------------------
// The three agent-facing artifacts, each a count that must equal the component
// count. A null is a file the generator could not read, which is UNKNOWN — not
// a zero, and not a failure.
function agentAnswer(build: StatusBuild): Answer {
  const question = "Can my agent read the registry?";
  const parts: { label: string; count: number | null }[] = [
    { label: "llms.txt", count: build.llmsBlocks },
    { label: "llms-full.txt", count: build.llmsFullBlocks },
    { label: "the MCP snapshot", count: build.snapshotComponents },
  ];

  const unread = parts.filter((p) => p.count === null);
  if (unread.length > 0) {
    return {
      id: "agents",
      question,
      state: "unknown",
      answer: `Not measured — ${list(unread.map((p) => p.label))} could not be read at build time, so how much of the registry an agent actually sees is unknown.`,
    };
  }

  const short = parts.filter((p) => p.count !== build.components);
  if (short.length > 0) {
    return {
      id: "agents",
      question,
      state: "degraded",
      answer: `Partly — ${list(
        short.map((p) => `${p.label} describes ${p.count} of ${build.components} components`)
      )}, so an agent reading it is working from an incomplete registry.`,
    };
  }

  return {
    id: "agents",
    question,
    state: "ok",
    answer: `Yes — llms.txt, llms-full.txt and the MCP snapshot each describe all ${build.components} components in this build.`,
  };
}

// --- 3 -------------------------------------------------------------------
// The question the preview incident would have answered. Posters and preview
// videos are separate artifacts and both are named, because "the card renders"
// and "the card shows the component moving" are different promises.
function previewAnswer(integrity: StatusCheck[]): Answer {
  const previews = find(integrity, "featured-previews");
  const posters = find(integrity, "featured-posters");
  const question = "Can I see a component move before I install it?";

  if (!previews || !posters) {
    return {
      id: "previews",
      question,
      state: "unknown",
      answer: "Not measured — the featured-card checks did not run for this render.",
    };
  }

  const state = worst(previews.state, posters.state);
  if (state === "ok") {
    return {
      id: "previews",
      question,
      state,
      answer: `Yes — every featured card has both its preview videos and both its posters (${previews.value} cards, ${posters.value} poster files).`,
    };
  }

  if (posters.state !== "ok") {
    return {
      id: "previews",
      question,
      state,
      answer: `No — ${previews.value} featured cards resolve a preview video and only ${posters.value} poster files are present, so some cards render an empty frame.`,
    };
  }

  // Phrased as the shortfall rather than the coverage: "0 / 36 cards resolve a
  // preview" makes the reader do the subtraction, and at 0 it reads as a
  // fraction of a thing rather than as every card on the page.
  const [resolved, total] = previews.value.split(" / ").map(Number);
  const broken = total - resolved;
  return {
    id: "previews",
    question,
    state,
    answer: !Number.isFinite(broken)
      ? `No — ${previews.detail}.`
      : resolved === 0
        ? `No — not one of the ${total} featured cards has a preview video that resolves, so every one of them silently falls back to a still poster and never moves.`
        : `No — ${broken} of the ${total} featured cards have no preview video that resolves, so they silently fall back to a still poster and never move.`,
  };
}

// --- 4 -------------------------------------------------------------------
// Permanently UNKNOWN, and rendered at full weight rather than as a footnote.
// The one Convex read this repo can make is public and unauthenticated, which
// is evidence about reachability and about nothing a signed-in visitor does.
function accountAnswer(services: StatusCheck[]): Answer {
  const convex = find(services, "convex-read-path");
  const question = "Can I sign in and save components?";
  const reachable = convex?.state === "ok";
  return {
    id: "accounts",
    question,
    state: "unknown",
    answer: reachable
      ? "Not measured — one public, unauthenticated Convex query answers, which proves the backend can be read and nothing more; sign-in, saving and every authenticated path are unproven here."
      : "Not measured — the public Convex query threw, and a real outage is indistinguishable from an unset connection URL; sign-in and saving are unproven either way.",
  };
}

/** "a, b and c" — Oxford-free, matching the prose voice of the check details. */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
