const RULES = [
  "Write from real use. Say what you built and what the component did for you.",
  "One submission per person. Edits and reposts are not extra entries.",
  "No promotion. No links beyond your profile, no SEO copy, no referral pitches.",
  "Be civil. Hate speech, slurs, and harassment are removed and the account is blocked.",
  "Your name, role, company, and profile link are published as written. Do not submit anyone else's details.",
];

export function CommunityGuidelines() {
  return (
    <section aria-labelledby="guidelines-heading">
      <h2
        id="guidelines-heading"
        className="text-lg font-medium tracking-[-0.02em] text-foreground"
      >
        What we publish
      </h2>
      <p className="mt-2 text-sm leading-6 text-ns-muted">
        Every submission is read by a person before it appears. Submitting does
        not guarantee publication.
      </p>
      <ul className="mt-5 flex flex-col gap-2.5">
        {RULES.map((rule) => (
          <li
            key={rule}
            className="flex gap-2.5 text-sm leading-6 text-ns-muted"
          >
            <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-border" />
            {rule}
          </li>
        ))}
      </ul>
    </section>
  );
}
