/**
 * Copy for `/categories` and `/categories/[id]` only — kept out of
 * `lib/search-categories.ts` deliberately. That module is imported by
 * `showcase.tsx`, a client component rendered on `/`, so anything added
 * there ships into `/`'s bundle. This file is imported only by the
 * `app/categories/**` route tree.
 *
 * `h1` is the search-language heading ("React navigation components"), not
 * the sidebar/chip label ("Navigation"). `intro` is one or two factual
 * sentences: what the category contains and when to reach for it — no
 * marketing language, matching the team-lead brief.
 */
export const CATEGORY_COPY: Record<string, { h1: string; intro: string }> = {
  heroes: {
    h1: "React hero section components",
    intro:
      "Full-width openers for a landing page — headline, supporting copy and a primary action, often paired with generative or animated backdrops. Reach for one when a page needs a first screen that states what it is before anything else loads.",
  },
  actions: {
    h1: "React button components",
    intro:
      "Buttons and other single-action controls, including destructive actions that need a deliberate confirmation step. Use these where a click or tap triggers an immediate, named effect rather than navigation.",
  },
  forms: {
    h1: "React form and input components",
    intro:
      "Text fields, selects, switches, steppers, date pickers, file drops and the other controls a form is built from. Reach for these when a page needs to collect or edit structured input, not just display it.",
  },
  navigation: {
    h1: "React navigation components",
    intro:
      "Menus, tabs, breadcrumbs, docks, command palettes and tree views — the controls that move a visitor between views. Use these for wayfinding inside an app or site, as opposed to actions that change data.",
  },
  data: {
    h1: "React chart and data display components",
    intro:
      "Charts, sparklines, tables, KPIs, timelines and other components that render a data set or a live feed. Reach for one when the job is showing numbers or records, not collecting them.",
  },
  feedback: {
    h1: "React feedback and status components",
    intro:
      "Toasts, progress bars, loaders, empty states, alerts and other components that report what the system is doing right now. Use these to confirm an action succeeded, show that something is in progress, or explain why a view is empty.",
  },
  scroll: {
    h1: "React scroll-triggered story components",
    intro:
      "Sections built around scroll position — parallax, scroll-triggered reveals and step-through narratives. Reach for these when content should unfold as a visitor scrolls, rather than all at once.",
  },
  text: {
    h1: "React text and typography effect components",
    intro:
      "Headlines and body text with a reveal, distortion or other typographic treatment applied to them. Use these where the words themselves are the visual focus of a section.",
  },
  surfaces: {
    h1: "React overlay components",
    intro:
      "Dialogs, popovers, tooltips, hover cards and onboarding tours — surfaces that sit above the page rather than in its flow. Reach for one when content needs to interrupt or float over what's already on screen.",
  },
  media: {
    h1: "React media and gallery components",
    intro:
      "Image galleries, coverflows, comparison sliders and other components built around a photo or video. Use these when the content itself is visual media rather than text or data.",
  },
  backgrounds: {
    h1: "React background components",
    intro:
      "Full-bleed canvas and generative backdrops — terrain, topographic lines, ASCII fields — meant to sit behind other content rather than carry it. Reach for one to add ambient motion or texture without competing with the foreground.",
  },
  sections: {
    h1: "React page section components",
    intro:
      "Larger layout blocks — pricing tables, changelogs, kanban boards, accordions and split panes — that structure a page rather than perform one action. Use these as the building blocks between a hero and a footer.",
  },
};
