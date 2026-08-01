"use client";

import { LitmusWick, type LitmusOutcome } from "./component";

const TAKEN_TEAMS = new Set(["acme", "vercel", "openai"]);

function validateHandle(value: string): LitmusOutcome {
  const spaceIndex = value.indexOf(" ");
  if (spaceIndex !== -1) {
    return { valid: false, index: spaceIndex, reason: "space not allowed" };
  }
  const chars = Array.from(value);
  const badIndex = chars.findIndex((ch) => !/[a-z0-9_]/i.test(ch));
  if (badIndex !== -1) {
    return {
      valid: false,
      index: badIndex,
      reason: "only letters, numbers, underscore",
    };
  }
  return { valid: true };
}

// Simulates a server round-trip (uniqueness check) so the "still checking"
// diffusion — slower, tentative, pulsing — has something real to show,
// distinct from validateHandle's instant "definitely wrong" path above.
function checkTeamName(value: string): Promise<LitmusOutcome> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const spaceIndex = value.indexOf(" ");
      if (spaceIndex !== -1) {
        resolve({ valid: false, index: spaceIndex, reason: "space not allowed" });
        return;
      }
      if (TAKEN_TEAMS.has(value.toLowerCase())) {
        resolve({ valid: false, index: 0, reason: "name already taken" });
        return;
      }
      resolve({ valid: true });
    }, 900);
  });
}

export default function LitmusWickDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm">
        <p className="font-mono text-xs tracking-widest text-muted">
          ns-ui / validation-inline-wick
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          The border tells you where.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          No instant red flash. The tint diffuses in from the exact character
          that broke the rule, slower and paler while still checking, faster
          and decisive once it's certain — and wicks back out the moment you
          fix it.
        </p>

        <form
          onSubmit={(e) => e.preventDefault()}
          noValidate
          className="mt-10 space-y-8"
        >
          <LitmusWick
            label="Handle"
            name="handle"
            placeholder="jane_doe"
            autoComplete="off"
            validate={validateHandle}
          />

          <LitmusWick
            label="Team name"
            name="team"
            placeholder="try “acme” or a space"
            autoComplete="off"
            validate={checkTeamName}
          />
        </form>
      </div>
    </main>
  );
}
