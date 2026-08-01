// Convex Auth's own HTTP routes: JWT verification (`/.well-known/*`) and
// OAuth sign-in/callback (`/api/auth/signin/*`, `/api/auth/callback/*`) —
// confirmed from node_modules/@convex-dev/auth/dist/server/implementation/
// index.d.ts's `addHttpRoutes` doc comment. Per §2 Phase 0, the GitHub and
// Google callback URLs registered with each provider are on this router's
// `.convex.site` origin, not the Next app's origin:
//   https://<deployment>.convex.site/api/auth/callback/github
//   https://<deployment>.convex.site/api/auth/callback/google
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
