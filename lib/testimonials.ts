export type TestimonialStatus = "pending" | "approved" | "rejected";

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  company: string;
  profileUrl: string;
  /** Optional link for `company`. Not a submitted field and not in the
   *  `testimonials` table — only the built-in seed below can carry one, and
   *  it renders as plain text when absent. */
  companyUrl?: string;
  photoUrl?: string;
  status: TestimonialStatus;
}

/** Exactly the submittable fields — the same shape `validateSubmission` takes,
 *  which is why `companyUrl` is deliberately absent: it is display-only data
 *  the built-in testimonial carries, never something a submitter can set. */
export interface TestimonialSeed {
  quote: string;
  name: string;
  role: string;
  company: string;
  profileUrl: string;
}

export const ALEX_TESTIMONIAL_SEED: TestimonialSeed = {
  quote:
    "I love using this design system whenever I need inspiration for primarily abstract features in our internal products, things that add some flare. I love it",
  name: "Alex Lekkas",
  role: "Founding Engineer",
  company: "Spawn Partners",
  profileUrl: "https://www.linkedin.com/in/alexandros-lekkas/",
};

export const ALEX_TESTIMONIAL: Testimonial = {
  id: "alex-lekkas",
  ...ALEX_TESTIMONIAL_SEED,
  companyUrl: "https://spawnpartners.com/",
  photoUrl: "/testimonials/alex-lekkas.png",
  status: "approved",
};

export const TESTIMONIALS: Testimonial[] = [ALEX_TESTIMONIAL];
