"use client";

import { DovetailRun, type DovetailStep } from "./component";

const steps: DovetailStep[] = [
  {
    id: "contact",
    title: "Contact",
    fields: [
      { id: "name", label: "Full name", required: true, autoComplete: "name" },
      { id: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
    ],
  },
  {
    id: "shipping",
    title: "Shipping",
    fields: [
      { id: "address", label: "Address", required: true, autoComplete: "street-address" },
      { id: "city", label: "City", required: true, autoComplete: "address-level2" },
    ],
  },
  {
    id: "payment",
    title: "Payment",
    fields: [
      {
        id: "card",
        label: "Card number",
        required: true,
        placeholder: "4242 4242 4242 4242",
        validate: (v) => (v.replace(/\s/g, "").length < 12 ? "Card number looks too short." : null),
      },
      { id: "zip", label: "Billing ZIP", required: true, autoComplete: "postal-code" },
    ],
  },
];

// Contact is pre-filled and valid: the first Next always seats cleanly.
// Shipping and Payment start empty, so working through them honestly shows
// both mechanisms — a clean join, and a reject/error pass on whichever
// field still needs filling in.
const defaultValues = {
  name: "Priya Achari",
  email: "priya@example.com",
};

export default function DovetailRunDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">ns-ui / dovetail-run</p>
        <h1 className="text-lg font-semibold text-foreground">Checkout</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Each completed step joins the rail as a physical dovetail chip. Submit clean and it
          seats with a spring; submit with a gap left in a field and the chip bounces off the
          joint instead of a red asterisk doing the talking.
        </p>

        <div className="mt-5">
          <DovetailRun
            steps={steps}
            defaultValues={defaultValues}
            submitLabel="Place order"
            onComplete={(values) => console.log("dovetail-run complete", values)}
          />
        </div>
      </div>
    </main>
  );
}
