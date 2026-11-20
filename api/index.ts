/**
 * Vercel entry point: every /api/* request is rewritten here (see vercel.json)
 * and handled by the same Express app that `npm run dev` and Cloud Run use.
 * The React frontend is served by Vercel's CDN from dist/, so the app is built
 * with frontend "none". The app is created once per function instance.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server";

const appPromise = createApp("none");

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPromise;
  return app(req as any, res as any);
}
