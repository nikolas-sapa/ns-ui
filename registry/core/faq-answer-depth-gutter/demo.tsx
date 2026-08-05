"use client";

import { FaqDepthGutter, type FaqDepthItem } from "./component";

const ITEMS: FaqDepthItem[] = [
  {
    id: "trial",
    question: "Is there a free trial?",
    answer: <p>Fourteen days on any plan, no card required.</p>,
  },
  {
    id: "seats",
    question: "How does seat billing work when my team changes mid-month?",
    answer: (
      <p>
        Seats are counted daily and billed at the end of the cycle, so adding
        someone on the twentieth costs a third of a seat rather than a full one.
        Removing a seat credits the remainder against your next invoice.
      </p>
    ),
  },
  {
    id: "data",
    question: "Where is my data stored, and who can reach it?",
    answer: (
      <>
        <p>
          Primary storage is in eu-central-1, with encrypted backups replicated
          to eu-west-1. Nothing leaves the European Union at rest or in transit.
        </p>
        <p>
          Access is scoped per project. Support engineers cannot read project
          contents without a time-boxed grant that you approve in the audit
          panel, and every grant is logged with the ticket that justified it.
        </p>
        <p>
          Deleting a project removes it from primary storage immediately and
          from backups within thirty days, which is the window the retention
          policy holds for point-in-time recovery.
        </p>
      </>
    ),
  },
  {
    id: "sso",
    question: "Do you support SAML single sign-on?",
    answer: (
      <p>
        SAML 2.0 and SCIM provisioning ship on the Business plan and above.
        Okta, Entra ID and Google Workspace are covered by setup guides.
      </p>
    ),
  },
  {
    id: "cancel",
    question: "Can I cancel at any time?",
    answer: <p>Yes. Access runs to the end of the paid period.</p>,
  },
];

export default function FaqDepthGutterDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / faq-answer-depth-gutter
      </p>

      <div className="w-full max-w-2xl">
        {/* One answer open at rest, so the idle frame reads as an FAQ. */}
        <FaqDepthGutter items={ITEMS} defaultOpen={["data"]} />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        An FAQ accordion. One answer is open at a time.
      </p>
    </div>
  );
}
