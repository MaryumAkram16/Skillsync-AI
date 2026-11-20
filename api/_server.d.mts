// Types for api/_server.mjs, which the Vercel build generates by bundling
// server.ts with esbuild (see vercel.json). Keep in step with createApp in server.ts.
import type { Express } from "express";

export type FrontendMode = "vite" | "static" | "none";
export declare function createApp(frontend?: FrontendMode): Promise<Express>;
