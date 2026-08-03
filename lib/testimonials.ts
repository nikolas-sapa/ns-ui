export type TestimonialStatus = "pending" | "approved" | "rejected";

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  company: string;
  profileUrl: string;
  photoUrl?: string;
  status: TestimonialStatus;
}

export const ALEX_TESTIMONIAL: Testimonial = {
  id: "alex-lekkas",
  quote:
    "I love using this design system whenever I need inspiration for primarily abstract features in our internal products, things that add some flare. I love it",
  name: "Alex Lekkas",
  role: "Founding Engineer",
  company: "Spawn Partners",
  profileUrl: "https://www.linkedin.com/in/alexandros-lekkas/",
  photoUrl: "/testimonials/alex-lekkas.png",
  status: "approved",
};

export const TESTIMONIALS: Testimonial[] = [ALEX_TESTIMONIAL];
