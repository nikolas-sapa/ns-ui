# 21st.dev Builder subscription — refund position for an EU consumer

Researched 2026-08-01 by fetching their live pages. Information, not legal advice.

Sources: <https://21st.dev/terms> and <https://21st.dev/pricing>, both fetched 2026-08-01. There is
no separate `/refund`, `/billing` or `/legal` page — `/terms` is the only thing pricing links to for
refund information, and the footer exposes nothing else.

**Note the scope.** A separate audit (`docs/shader-port-licensing.md`) already established that even
*with* a subscription, their terms prohibit republishing components to another registry — so the
subscription does not unlock the thing it was originally being considered for. This document is only
about the money if it is bought anyway.

## What their terms actually say

**There is an explicit no-refund clause** — this is not silence, which would have been a different
analysis. From "Paid Plans, Billing, and Refunds":

> "Payments for paid plans and credit packs are non-refundable. Except where required by applicable
> law..."
> "we do not provide refunds, credits, or prorated refunds for amounts already paid"

The pricing page repeats it at the point of purchase: **"Payments are non-refundable."**

The "except where required by applicable law" clause creates nothing. It declines to override a right
you would have had regardless.

**Cancelling a yearly plan mid-term returns nothing:**

> "Cancellation stops future renewals and takes effect at the end of the then-current billing period."

So cancelling in month two of twelve keeps access for the remaining ten and refunds none of it.
"Cancel anytime" on the pricing page governs renewal, not the current term.

**There is no EU-specific language anywhere.** Searched for EU, European Union, withdrawal, 14-day,
cooling-off, Consumer Rights Directive, immediate performance, express consent — zero hits. The only
adjacent text is generic GDPR data-protection boilerplate, which is about personal data, not about
withdrawing from a purchase.

**Contracting entity and forum:** 21st Labs Inc., Dover, Delaware, USA. Terms name Delaware law and
give Delaware state and federal courts exclusive jurisdiction.

## The EU position

- **CRD 2011/83/EU Art. 9** — 14-day withdrawal right on distance contracts, no reason needed.
- **Art. 16(m), the digital-content exception** — that right is lost only if the trader obtained,
  before the contract concluded, both (a) express consent to immediate performance and (b) an
  acknowledgment that the consumer thereby loses the withdrawal right.
- **Art. 14(3) / 16(a), the services rule** — where performance was requested inside the window and
  the consumer then withdraws, they owe a proportionate amount for what was actually supplied. So
  even a valid withdrawal is not automatically a full refund.
- **Art. 10, information failure** — if the trader never disclosed the withdrawal right at all, the
  period extends to 12 months and 14 days.

A US choice-of-law clause does not by itself strip an EU consumer's mandatory statutory rights
(Rome I Art. 6, Brussels Ia Art. 18). Their terms do not even attempt to claim otherwise. Enforcing
such a right against a Delaware entity with no named EU presence is a separate practical problem
from having it.

## The one fact that decides it, and it could not be verified

**Whether their checkout presents the Art. 16(m) consent** — the "I agree to immediate performance
and acknowledge I lose my withdrawal right" mechanism. That screen sits behind account creation and
a payment flow, so it was not observed. Guessing either way would be worthless.

Two branches follow:

- **If that consent is absent** — and their published terms disclose the withdrawal right nowhere at
  all — the digital-content exception likely never validly triggers, and the statutory right plausibly
  survives their "non-refundable" clause, because mandatory consumer rights are not waivable by a
  contract term. In that branch a refund is a right worth asserting, not a favour.
- **If that consent is present and correctly implemented**, the right is validly waived at purchase
  and a refund becomes purely discretionary — unlikely, given how explicit the terms are.

## Bottom line

21st.dev will not voluntarily refund this. Their contract language flatly refuses it, on both the
terms page and the pricing page.

Whether a statutory entitlement survives anyway turns on an unobservable fact. So the honest position
is: a plausible legal entitlement may exist, it is not provable without seeing the checkout, and it
would have to be asserted affirmatively — a written withdrawal notice citing Directive 2011/83/EU, or
a card chargeback — rather than expected as a refund granted on request.

Given that the subscription does not grant redistribution rights in the first place, the cleanest
answer remains not to buy it.
