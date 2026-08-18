"use client";

import { RouteSlip, type RouteSlipApprover } from "./component";

// Same three-person chain reused by both cards, so the only variable between
// them is who has actually signed and in what order — the whole point of the
// component.
const APPROVERS: RouteSlipApprover[] = [
  { id: "priya", name: "Priya Shah", role: "Engineering" },
  { id: "legal", name: "Legal Review", role: "Legal" },
  { id: "marcus", name: "Marcus Webb", role: "Release Mgmt" },
];

export default function RoutingSlipDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / routing-slip — routed order vs. actual order
      </p>

      <div className="flex w-full max-w-xl flex-col gap-8">
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Live — you are Marcus Webb (Release Mgmt)
          </p>
          {/* Nobody has signed yet. Marcus is last in the routed chain but
              the only row with a real Sign button belongs to whoever is
              `currentApproverId` — signing here, before Priya or Legal,
              is the out-of-turn case landing live rather than pre-seeded. */}
          <RouteSlip
            className="ns-rs-live"
            approvers={APPROVERS}
            quorum={2}
            currentApproverId="marcus"
            docLabel="PR #482 — Search relevance rewrite"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            At rest — fully signed, mixed order, quorum met
          </p>
          {/* No currentApproverId, so no row here ever renders a Sign
              button — this card is read-only, showing the resolved state:
              Legal and Marcus both signed before Priya (who is routed
              first and therefore can never read as out of turn herself),
              so both their chops carry the out-of-turn skew and note while
              hers doesn't, even though she signed last. */}
          <RouteSlip
            approvers={APPROVERS}
            quorum={3}
            docLabel="RFC-114 — Rollout policy"
            initialSignatures={[
              { approverId: "legal", at: new Date(2026, 7, 17, 9, 12) },
              { approverId: "marcus", at: new Date(2026, 7, 17, 9, 40) },
              { approverId: "priya", at: new Date(2026, 7, 17, 10, 5) },
            ]}
          />
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Rows stay in routed order no matter who actually signs first. An
        early signature is permitted, not blocked — it lands with an 8deg
        skew and an &ldquo;out of turn&rdquo; note instead. Publish reads
        signed count against quorum, which can unblock before every name is
        stamped.
      </p>
    </div>
  );
}
