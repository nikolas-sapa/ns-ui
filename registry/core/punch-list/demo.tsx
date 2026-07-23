"use client";

import { PunchList, type PunchListField } from "./component";

const FIELDS: PunchListField[] = [
  {
    id: "pl-name",
    label: "Full name",
    placeholder: "Jordan Reyes",
    defaultValue: "",
    validate: (v) => (v.trim().length < 2 ? "Enter your full name." : null),
  },
  {
    id: "pl-email",
    label: "Email",
    type: "email",
    placeholder: "jordan@example.com",
    defaultValue: "jordan@",
    validate: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter a valid email address."),
  },
  {
    id: "pl-phone",
    label: "Phone",
    type: "tel",
    placeholder: "(555) 010-1000",
    defaultValue: "555-01",
    validate: (v) => (v.replace(/\D/g, "").length < 7 ? "Enter a valid phone number." : null),
  },
  {
    id: "pl-details",
    label: "Project details",
    type: "textarea",
    placeholder: "What needs fixing, and by when?",
    defaultValue: "",
    validate: (v) => (v.trim().length < 10 ? "Add a few details about the job." : null),
  },
];

export default function PunchListDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">ns-ui / punch-list</p>
        <PunchList
          title="Request a quote"
          submitLabel="Send request"
          fields={FIELDS}
          onSubmit={(values) => console.log("punch-list submit", values)}
        />
        <p className="mt-3 font-mono text-[11px] text-muted">
          submit with the defaults to fail — pick an item to see the leader line, fix a field to
          strike it off
        </p>
      </div>
    </main>
  );
}
