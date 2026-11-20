/**
 * Vercel entry point: every /api/* request is rewritten here (see vercel.json)
 * and handled by the same Express app that `npm run dev` and Cloud Run use.
 * The React frontend is served by Vercel's CDN from dist/, so the app is built
 * with frontend "none". The app is created once per function instance.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
// The server is bundled into api/_server.mjs by the build command in vercel.json
// (esbuild, like `npm run build`). Vercel compiles each .ts file on its own and
// Node's ESM loader needs explicit file extensions, which server.ts and its
// services don't use, so importing ../server directly fails at runtime.
// Files starting with "_" in api/ are not deployed as functions of their own.
import { createApp } from "./_server.mjs";

const appPromise = createApp("none");

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPromise;
  return app(req as any, res as any);
}
