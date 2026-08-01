// Convex Auth JWT provider config. CONVEX_SITE_URL is injected automatically
// by the Convex deployment; JWT_PRIVATE_KEY / JWKS / SITE_URL are set as
// deployment environment variables per §5 step 4 (`npx convex env set`, not
// `.env.local`). Required for Convex Auth to mint and verify session tokens.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
