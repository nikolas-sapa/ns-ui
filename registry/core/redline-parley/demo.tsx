"use client";

import { RedlineParley, type RedlineSpan } from "./component";

function dropPII(span: RedlineSpan): RedlineSpan {
  return {
    ...span,
    flagged: "the account under review, referenced by ticket ID only",
  };
}

function publicOnly(span: RedlineSpan): RedlineSpan {
  return {
    ...span,
    flagged: "only the details already published in the public case summary",
  };
}

function summaryOnly(span: RedlineSpan): RedlineSpan {
  return {
    ...span,
    flagged: "a one-paragraph summary of the investigation's findings",
  };
}

function anonymizeTeam(span: RedlineSpan): RedlineSpan {
  return {
    ...span,
    flagged: "the affected staff, referenced by role and shift only",
  };
}

function scheduleOnly(span: RedlineSpan): RedlineSpan {
  return {
    ...span,
    flagged: "the shift schedule, without contact details",
  };
}

export default function RedlineParleyDemo() {
  return (
    <main className="flex min-h-screen justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg space-y-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          ns-ui / redline-parley — negotiated refusal
        </p>

        <section>
          <h2 className="text-sm font-medium text-foreground">
            Board note — refused
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            The draft tripped a data-handling guardrail. Flip a lever to see
            the flagged clause rewrite itself and the send button unlock.
          </p>
          <div className="mt-4">
            <RedlineParley
              span={{
                before: "Could you draft a note to the board that includes ",
                flagged:
                  "the customer's full name, account number, and home address from the complaint",
                after: " so they have full context before Friday's meeting?",
              }}
              reason="Contains a customer's personally identifying details, which can't leave this workspace as free text."
              remedies={[
                { id: "anonymize", label: "anonymize names", rewrite: dropPII },
                {
                  id: "public-only",
                  label: "restrict to public data",
                  rewrite: publicOnly,
                },
                {
                  id: "summary",
                  label: "summary instead of full text",
                  rewrite: summaryOnly,
                },
              ]}
              onResend={(resolution) =>
                console.log("redline-parley resend", resolution)
              }
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-foreground">
            Roster export — refused
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            A second, independent negotiation over a different clause and a
            smaller lever set.
          </p>
          <div className="mt-4">
            <RedlineParley
              span={{
                before: "Export tonight's roster with ",
                flagged: "each nurse's home phone number and address",
                after: " attached for the shift supervisor.",
              }}
              reason="Home contact details for staff can't be included in an export outside the scheduling system."
              remedies={[
                {
                  id: "anonymize-staff",
                  label: "anonymize names",
                  rewrite: anonymizeTeam,
                },
                {
                  id: "schedule-only",
                  label: "summary instead of full text",
                  rewrite: scheduleOnly,
                },
              ]}
              onResend={(resolution) =>
                console.log("redline-parley resend", resolution)
              }
            />
          </div>
        </section>
      </div>
    </main>
  );
}
