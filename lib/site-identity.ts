import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// The site's identity graph, rendered into <head> by app/layout.tsx.
//
// It lived in app/page.tsx next to the CollectionPage listing until an agent
// audit reported "No JSON-LD structured data found on homepage" — the listing
// is ~55KB and has to render after the content, and the identity block went
// down with it, past the point where the auditing fetch stops reading a
// 2.3MB document. Split out here so the two can sit at opposite ends of the
// page: this one early and small, the catalog late and large.
//
// `CollectionPage` (app/page.tsx) says what that PAGE is, and an agent
// reading it still cannot tell what ns-ui IS or who stands behind it. SoftwareApplication + Organization are the two
// types that answer those, linked by @id so the three read as one graph
// rather than three unrelated blocks.
//
// `address` carries a country and nothing else: there is no published street
// address for this project, schema.org does not require one, and an invented
// street would be worse markup than an honest partial.
export const identityJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${REGISTRY_ORIGIN}/#software`,
      name: "ns-ui",
      alternateName: "ns ui",
      url: REGISTRY_ORIGIN,
      description:
        "A registry of React components you install by URL — each built around a single interaction, each installed as plain source with no runtime package.",
      applicationCategory: "DeveloperApplication",
      applicationSubCategory: "React component registry",
      operatingSystem: "Any",
      softwareRequirements: "React 19+, Tailwind CSS v4",
      license: "https://opensource.org/licenses/MIT",
      // Free, and saying so in the field agents actually read for price.
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      codeRepository: "https://github.com/nikolas-sapa/ns-ui",
      author: { "@id": `${REGISTRY_ORIGIN}/#organization` },
      publisher: { "@id": `${REGISTRY_ORIGIN}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${REGISTRY_ORIGIN}/#organization`,
      name: "ns-ui",
      // Both spellings, because people search the spaced one: "ns ui" is what
      // gets typed, "ns-ui" is what the package and the domain are called.
      alternateName: ["ns ui", "ns-ui component registry"],
      url: REGISTRY_ORIGIN,
      logo: `${REGISTRY_ORIGIN}/opengraph-image`,
      description:
        "The maintainer of ns-ui, an open-source (MIT) registry of React components for shadcn-compatible tooling.",
      founder: { "@type": "Person", name: "Nikolas Sapalidis" },
      // Country only. There is no published street address for this project,
      // and a schema.org PostalAddress does not require one — an invented
      // street is worse markup than an honest partial address.
      address: { "@type": "PostalAddress", addressCountry: "GR" },
      sameAs: [
        "https://github.com/nikolas-sapa/ns-ui",
        "https://www.npmjs.com/package/@nikolas.sapa/ns-ui",
        "https://www.npmjs.com/package/@nikolas.sapa/ns-ui-mcp",
      ],
      // The same address SECURITY.md and CODE_OF_CONDUCT.md already publish —
      // not a new one invented for this markup.
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "technical support",
          email: "nikolas.sapalidis@gmail.com",
          url: `${REGISTRY_ORIGIN}/about`,
          availableLanguage: ["English"],
        },
        {
          "@type": "ContactPoint",
          contactType: "security",
          email: "nikolas.sapalidis@gmail.com",
          url: "https://github.com/nikolas-sapa/ns-ui/security/advisories/new",
        },
      ],
    },
  ],
};
