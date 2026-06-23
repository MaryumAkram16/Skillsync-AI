import express from "express";
import type { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
dotenv.config();

import firebaseConfig from "./firebase-applet-config.json";

// Force Firebase project ID for Admin SDK globally early
if (firebaseConfig.projectId) {
  process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
  process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
}

import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import admin from "firebase-admin";
import { FirestoreRateLimitStore, selectRateLimitKey } from "./firestoreRateLimitStore";
import { scanMarket } from "./services/radarService";
import { extractResumeDetails } from "./services/resumeExtractor";
import { parseResumeAndFindJobs } from "./services/parserService";
import { askChatbot } from "./services/chatbotService";
import { adminDb } from "./services/firebaseAdmin";

// ── Firebase Admin SDK init (for server-side token verification) ──────────────
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

// ── Auth middleware: verifies Firebase ID token from Authorization header ─────
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: missing token" });
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    // Inject verified uid into request — overrides anything from body
    (req as any).verifiedUid = decoded.uid;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: invalid or expired token" });
  }
}

// ── Optional Auth middleware: verifies token if present, but doesn't block if missing ─────
async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    (req as any).verifiedUid = decoded.uid;
  } catch (err) {
    // Token was present but invalid/expired — distinct from "no token sent".
    // Flag it so downstream code (e.g. rate limiter keying) doesn't fall
    // back to trusting a client-supplied body.userId for this request.
    (req as any).authTokenInvalid = true;
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const allowedOrigins = process.env.NODE_ENV === "production"
    ? (process.env.ALLOWED_ORIGINS || "").split(",").map(o => o.trim()).filter(Boolean)
    : ["http://localhost:3000", "http://localhost:5173"];

  app.use(cors({
    origin: (origin, callback) => {
      // In development or if ALLOWED_ORIGINS is not set, allow all
      if (process.env.NODE_ENV !== "production" || !process.env.ALLOWED_ORIGINS) {
        return callback(null, true);
      }
      
      const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map(o => o.trim()).filter(Boolean);
      if (!origin || allowed.includes(origin)) {
        return callback(null, true);
      }
      
      // Fallback for AI Studio preview URLs
      if (origin.includes("run.app") || origin.includes("google_aistudio")) {
        return callback(null, true);
      }

      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }));
  app.use(helmet({
    contentSecurityPolicy: false,
  }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Trust proxy is required for Cloud Run/container environments to get real IP
  app.set("trust proxy", 1);

  // ── Rate limiters — prevent API budget drain ──────────────────────────────
  // Backed by Firestore (FirestoreRateLimitStore) instead of the default
  // in-memory Map, so limits hold across Cloud Run autoscaling/restarts —
  // an in-memory store resets per instance, which silently defeats the
  // whole point of these limiters under any real traffic.
  const makeRateLimiter = (max: number, windowMinutes: number, label: string) =>
    rateLimit({
      windowMs: windowMinutes * 60 * 1000,
      max,
      store: new FirestoreRateLimitStore(label.replace(/\s+/g, "_")),
      keyGenerator: (req, res) => {
        return selectRateLimitKey({
          verifiedUid: (req as any).verifiedUid,
          authTokenInvalid: (req as any).authTokenInvalid,
          bodyUserId: req.body?.userId,
          ip: req.ip ? ipKeyGenerator(req.ip) : undefined,
        });
      },
      validate: { ip: false },
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === "/api/health";
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        console.warn(`[RateLimit] ${label} limit hit for ${req.body?.userId || req.ip}`);
        res.status(429).json({
          error: "Rate limit reached",
          message: `You've used this feature too many times. Please wait ${windowMinutes} minutes before trying again.`,
          retryAfter: windowMinutes,
        });
      },
    });

  // Expensive AI routes — 5 per hour per user
  const heavyLimiter   = makeRateLimiter(5,  60, "heavy AI");
  // Medium routes — 20 per hour
  const mediumLimiter  = makeRateLimiter(20, 60, "medium AI");
  // Light routes — 60 per hour
  const lightLimiter   = makeRateLimiter(60, 60, "light");

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // 🚀 Supabase Service Caller (Specifically for CareerAI Roadmap)
  const callSupabaseService = async (url: string, payload: any) => {
    const token = process.env.SUPABASE_ANON_KEY;
    if (!token) {
      throw new Error("SUPABASE_ANON_KEY environment variable is not set on the server.");
    }
    
    console.log(`Calling Supabase service: ${url}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": token
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const responseText = await response.text();
      clearTimeout(timeout);

      if (!response.ok) {
        console.error(`Supabase error (${url}):`, responseText);
        throw new Error(`Supabase Error: ${response.status} ${responseText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { rawText: responseText };
      }

      return Array.isArray(data) && data.length === 1 ? data[0] : data;
    } catch (error: any) {
      clearTimeout(timeout);
      throw error;
    }
  };

  // ================= ROUTES =================
  
  app.post("/api/resume-tools", requireAuth, mediumLimiter, async (req, res) => {
    req.socket.setTimeout(300000);
    res.setTimeout(300000);
    try {
      const { processResumeTools } = await import("./services/resumeToolsService");
      const { mode, resumeText, jobDescription, jobTitle, company, tone, userName } = req.body;
      const userId = (req as any).verifiedUid;

      if (!resumeText || !jobDescription || !mode) {
        return res.status(400).json({ error: "Missing required fields: resumeText, jobDescription, mode" });
      }

      console.log(`[ResumeTools] Processing mode="${mode}" for userId="${userId}"`);

      const result = await processResumeTools(resumeText, jobDescription, mode, jobTitle, company, tone, userName);
      res.json(result);
    } catch (error: any) {
      console.error("Resume tools route error:", error);
      res.status(500).json({ error: "Failed to process resume", message: error.message });
    }
  });

  app.post("/api/trending-skills", requireAuth, mediumLimiter, async (req, res) => {
    try {
      const { role, country } = req.body;
      console.log(`[Radar] scanMarket called for role="${role}" country="${country}"`);
      const data = await scanMarket(role, country);
      res.json(data);
    } catch (error: any) {
      console.error("Trending skills route error:", error);
      res.status(500).json({ 
        error: "Failed to fetch market data",
        message: error.message || "Unknown error"
      });
    }
  });

  app.post("/api/extract-resume-details", requireAuth, async (req, res) => {
    try {
      const { resumeText } = req.body;
      if (!resumeText) throw new Error("resumeText is required");
      
      console.log(`[ResumeExtractor] Extracting details (text length: ${resumeText.length})`);
      const details = await extractResumeDetails(resumeText);
      res.json(details);
    } catch (error: any) {
      console.error("Extract resume details error:", error);
      res.status(500).json({ 
        error: "Failed to extract resume details",
        message: error.message || "Unknown error"
      });
    }
  });

  app.post("/api/parse-resume", requireAuth, mediumLimiter, async (req, res) => {
    // Increase timeout for the AI + job-fetch pipeline
    req.socket.setTimeout(300000);
    res.setTimeout(300000);

    try {
      const { resumeText, role, country, employmentType = "Full-time", locationType = "Remote" } = req.body;
      const userId = (req as any).verifiedUid;
      if (!resumeText) throw new Error("resumeText is required");
      if (!role) throw new Error("role is required");

      console.log(`[ParserService] parseResumeAndFindJobs called — role="${role}" country="${country}" employmentType="${employmentType}" locationType="${locationType}"`);
      const data = await parseResumeAndFindJobs(
        userId,
        resumeText,
        role,
        country || "Worldwide",
        employmentType,
        locationType
      );
      res.json(data);
    } catch (error: any) {
      console.error("Parse resume route error:", error);
      res.status(500).json({ 
        error: "Failed to parse resume",
        message: error.message || "Unknown error"
      });
    }
  });

  app.post("/api/supabase/:function", requireAuth, lightLimiter, async (req, res) => {
    try {
      const func = req.params.function;
      const url = `https://ctkwpwpprnxgytifimzh.supabase.co/functions/v1/${func}`;
      const data = await callSupabaseService(url, { ...req.body, userId: (req as any).verifiedUid });
      res.json(data);
    } catch (error: any) {
      console.error(`Supabase function error (${req.params.function}):`, error);
      res.status(500).json({ error: `Failed to call Supabase feature: ${req.params.function}`, message: error.message });
    }
  });

  app.post("/api/generate-roadmap", requireAuth, heavyLimiter, async (req, res) => {
    try {
      const url = "https://ctkwpwpprnxgytifimzh.supabase.co/functions/v1/generate-roadmap";
      const data = await callSupabaseService(url, { ...req.body, userId: (req as any).verifiedUid });
      res.json(data);
    } catch (error: any) {
      console.error("Generate roadmap error:", error);
      res.status(500).json({ error: "Failed to generate roadmap", message: error.message });
    }
  });

  app.post("/api/suggest-resources", requireAuth, mediumLimiter, async (req, res) => {
    try {
      const url = "https://ctkwpwpprnxgytifimzh.supabase.co/functions/v1/suggest-resources";
      const data = await callSupabaseService(url, { ...req.body, userId: (req as any).verifiedUid });
      res.json(data);
    } catch (error: any) {
      console.error("Suggest resources error:", error);
      res.status(500).json({ error: "Failed to suggest resources", message: error.message });
    }
  });

  // ── Explain Phase — light limiter, Gemini first then OpenAI fallback ─────
  app.post("/api/explain-phase", requireAuth, lightLimiter, async (req, res) => {
    try {
      const { phaseName, topics, tools, milestoneProject, checkpoint, phaseNumber, totalPhases } = req.body;
      if (!phaseName) return res.status(400).json({ error: "phaseName is required" });

      const topicList = Array.isArray(topics) ? topics.join(", ") : topics || "";
      const toolList = Array.isArray(tools) ? tools.join(", ") : tools || "";

      // Cache key: roadmap phases are mostly templated, so many different
      // users end up requesting an explanation for the *exact same* phase
      // content. Caching by a hash of the phase inputs means most requests
      // become free cache hits instead of fresh AI calls — this is the real
      // cost lever here, not trimming an already-small 350-token response.
      const { getPersistentCache, setPersistentCache } = await import("./services/persistentCache");
      const cacheKey = [phaseName, topicList, toolList, milestoneProject, checkpoint]
        .join("|").toLowerCase().replace(/\s+/g, " ").trim();
      const PHASE_EXPLAIN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — phase content rarely changes

      const cached = await getPersistentCache<{ whatYoullLearn: string; whatYoullBuild: string; topTip: string }>(
        "phase_explain", cacheKey
      );
      if (cached) {
        return res.json({ explanation: cached, fromCache: true });
      }

      const prompt = `You are explaining a specific learning phase to a student. Be specific — reference the actual topics and tools listed. Use simple, clear language but do NOT oversimplify to the point of being vague or childish.

Phase ${phaseNumber} of ${totalPhases}: "${phaseName}"
Topics covered: ${topicList || "not specified"}
Tools used: ${toolList || "not specified"}
Milestone project: ${milestoneProject || "not specified"}
Checkpoint goal: ${checkpoint || "not specified"}

Return ONLY raw JSON (no markdown, no backticks) with exactly these 3 fields, one sentence each:
{
  "whatYoullLearn": "Mention the actual topics by name and explain in one sentence what they do and why employers care about them. Example: 'You'll learn TensorFlow and Keras — the tools most companies actually use to build AI — and understand how CNNs can recognize images and RNNs handle sequences like text or audio.'",
  "whatYoullBuild": "Describe the actual milestone project specifically. What will the student make, what does it do, and what does completing it prove? Be concrete.",
  "topTip": "One practical, specific tip for THIS phase — something about the actual topics or tools listed. NOT generic advice like 'make mistakes' or 'keep going.' Something a senior developer would tell a junior starting this exact phase."
}

Rules:
- Every sentence must reference something specific from the phase data above
- Simple words but not dumbed down — the student is smart, just new to this
- No generic motivational advice
- Each field is ONE sentence only`;

      let parsed: { whatYoullLearn: string; whatYoullBuild: string; topTip: string } | null = null;

      // Try Gemini first
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const geminiKey = (
          process.env.CAREER_MENTOR_GEMINI_API_KEY ||
          process.env.GEMINI_API_KEY ||
          process.env.VITE_GEMINI_KEY || ""
        ).trim();
        if (!geminiKey) throw new Error("No Gemini key");

        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });
        const result = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            temperature: 0.4,
            maxOutputTokens: 1000,
            responseMimeType: "application/json",
            // Thinking is less critical for short explanations, using standard flash for speed
          },
        });
        const raw = result.text?.trim() || "";
        if (!raw) throw new Error("Empty Gemini response");
        parsed = JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim());
        console.log("[ExplainPhase] Gemini used ✓");
      } catch (geminiErr: any) {
        console.warn("[ExplainPhase] Gemini failed, falling back to OpenAI:", geminiErr.message);
        const openaiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
        if (!openaiKey) throw new Error("No AI key available — set GEMINI_API_KEY or OPENAI_API_KEY");
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: openaiKey });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.4,
          max_tokens: 350,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You explain learning roadmap phases clearly and specifically. Always reference the actual topics and tools. Simple language but never vague or generic. Return ONLY raw JSON."
            },
            { role: "user", content: prompt },
          ],
        });
        const raw = completion.choices[0]?.message?.content?.trim() || "";
        parsed = JSON.parse(raw);
        console.log("[ExplainPhase] OpenAI fallback used ✓");
      }

      const explanation = {
        whatYoullLearn: parsed?.whatYoullLearn || "",
        whatYoullBuild: parsed?.whatYoullBuild || "",
        topTip: parsed?.topTip || "",
      };

      // Cache for next time — most roadmap phases are shared across many users.
      await setPersistentCache("phase_explain", cacheKey, explanation, PHASE_EXPLAIN_TTL_MS);

      res.json({ explanation });
    } catch (error: any) {
      console.error("[ExplainPhase] Error:", error.message);
      res.status(500).json({ error: "Failed to explain phase", message: error.message });
    }
  });

  // ── Explain Gap Summary — light limiter, Gemini first then OpenAI fallback ─
  app.post("/api/explain-gaps", requireAuth, lightLimiter, async (req, res) => {
    try {
      const { highGaps, mediumGaps, lowGaps, missingSkills, currentSkills, targetRole } = req.body;

      const highList = Array.isArray(highGaps) ? highGaps.slice(0, 8).join(", ") : "";
      const mediumList = Array.isArray(mediumGaps) ? mediumGaps.slice(0, 6).join(", ") : "";
      const missingList = Array.isArray(missingSkills) ? missingSkills.slice(0, 8).join(", ") : "";
      const currentList = Array.isArray(currentSkills) ? currentSkills.slice(0, 8).join(", ") : "";

      const prompt = `You are helping a job seeker understand their skill gaps. Always reference the actual skill names listed below — never give generic advice that could apply to anyone.

Target role: ${targetRole || "their target role"}
Skills they already have: ${currentList || "not specified"}
Critical skills they are missing: ${highList || missingList || "not specified"}
Nice-to-have skills they are missing: ${mediumList || "not specified"}

Write EXACTLY this format — 4 lines, nothing more:

**Where you stand:** Name 2-3 of their strongest existing skills and say what kind of candidate that makes them for this role specifically.

**Your biggest gap:** Name the single most critical missing skill by name and explain in one sentence why that specific skill is a blocker for getting hired in this role — not just "it's important" but what it actually does that employers need.

**Quick wins:** Name 1-2 specific skills from the nice-to-have list that are fastest to learn and explain why adding them to a resume would help.

**Your action plan:** Give one concrete next step that names a specific skill or tool from the lists above — for example "spend 2 weeks on [specific skill] using the official docs or a free course on YouTube" — not "start learning today."

Rules:
- Every sentence MUST mention actual skill names from the data above
- Simple language but specific — the person is smart, just needs direction
- No generic phrases like "keep going", "stay consistent", "you're on the right track"
- No extra sections`;

      let explanation = "";

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const geminiKey = (
          process.env.CAREER_MENTOR_GEMINI_API_KEY ||
          process.env.GEMINI_API_KEY ||
          process.env.VITE_GEMINI_KEY || ""
        ).trim();
        if (!geminiKey) throw new Error("No Gemini key");

        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });
        const result = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            temperature: 0.3,
            maxOutputTokens: 1000,
          },
        });
        explanation = result.text?.trim() || "";
        if (!explanation) throw new Error("Empty Gemini response");
        console.log("[ExplainGaps] Gemini used ✓");
      } catch (geminiErr: any) {
        console.warn("[ExplainGaps] Gemini failed, falling back to OpenAI:", geminiErr.message);
        const openaiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
        if (!openaiKey) throw new Error("No AI key available — set GEMINI_API_KEY or OPENAI_API_KEY");
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: openaiKey });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 300,
          messages: [
            { role: "system", content: "You explain skill gaps to job seekers in simple, everyday English. No jargon. Short sentences. Be encouraging." },
            { role: "user", content: prompt },
          ],
        });
        explanation = completion.choices[0]?.message?.content?.trim() || "";
        console.log("[ExplainGaps] OpenAI fallback used ✓");
      }

      res.json({ explanation: explanation || "Focus on your highest priority gaps first — they'll have the biggest impact on your job applications." });
    } catch (error: any) {
      console.error("[ExplainGaps] Error:", error.message);
      res.status(500).json({ error: "Failed to explain gaps", message: error.message });
    }
  });

  // ── Explain Skill Gap — per-skill explanation for GapMap's "Explain this
  // gap" button. Structured JSON (no markdown) + content-hash caching, same
  // pattern as /api/explain-phase: many users share the same target role and
  // the same missing skill, so most requests become free cache hits. ───────
  app.post("/api/explain-skill-gap", requireAuth, lightLimiter, async (req, res) => {
    try {
      const { skill, priority, targetRole } = req.body;
      if (!skill) return res.status(400).json({ error: "skill is required" });

      const { getPersistentCache, setPersistentCache } = await import("./services/persistentCache");
      const cacheKey = [skill, priority || "unspecified", targetRole || "unspecified"]
        .join("|").toLowerCase().replace(/\s+/g, " ").trim();
      const SKILL_GAP_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

      const cached = await getPersistentCache<{ whyItMatters: string; ifYouSkipIt: string }>(
        "skill_gap_explain", cacheKey
      );
      if (cached) return res.json({ explanation: cached, fromCache: true });

      const prompt = `A job seeker is missing the skill "${skill}" for their target role: ${targetRole || "their target role"}.
This skill was flagged as a ${priority || "notable"} priority gap based on a scan of real job listings for this role.

Return ONLY raw JSON (no markdown, no backticks) with exactly these 2 fields, one sentence each:
{
  "whyItMatters": "Explain specifically what '${skill}' is used for in this role and why employers actually require it — not generic advice, something concrete about what the skill does on the job.",
  "ifYouSkipIt": "Explain concretely what happens if they apply without this skill — e.g. what they'd struggle with in interviews, ATS screening, or on the job itself."
}

Rules:
- Reference the actual skill name and role
- Simple language, no jargon, but specific and concrete — not vague
- Each field is ONE sentence only`;

      let parsed: { whyItMatters: string; ifYouSkipIt: string } | null = null;

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const geminiKey = (
          process.env.CAREER_MENTOR_GEMINI_API_KEY ||
          process.env.GEMINI_API_KEY ||
          process.env.VITE_GEMINI_KEY || ""
        ).trim();
        if (!geminiKey) throw new Error("No Gemini key");

        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });
        const result = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            temperature: 0.3,
            maxOutputTokens: 1000,
            responseMimeType: "application/json",
          },
        });
        const raw = result.text?.trim() || "";
        if (!raw) throw new Error("Empty Gemini response");
        parsed = JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim());
        console.log("[ExplainSkillGap] Gemini used ✓");
      } catch (geminiErr: any) {
        console.warn("[ExplainSkillGap] Gemini failed, falling back to OpenAI:", geminiErr.message);
        const openaiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
        if (!openaiKey) throw new Error("No AI key available — set GEMINI_API_KEY or OPENAI_API_KEY");
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: openaiKey });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 250,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You explain skill gaps to job seekers concretely and specifically. Return ONLY raw JSON." },
            { role: "user", content: prompt },
          ],
        });
        const raw = completion.choices[0]?.message?.content?.trim() || "";
        parsed = JSON.parse(raw);
        console.log("[ExplainSkillGap] OpenAI fallback used ✓");
      }

      const explanation = {
        whyItMatters: parsed?.whyItMatters || "",
        ifYouSkipIt: parsed?.ifYouSkipIt || "",
      };

      await setPersistentCache("skill_gap_explain", cacheKey, explanation, SKILL_GAP_TTL_MS);
      res.json({ explanation });
    } catch (error: any) {
      console.error("[ExplainSkillGap] Error:", error.message);
      res.status(500).json({ error: "Failed to explain skill gap", message: error.message });
    }
  });

  // ── Explain Trend — per-skill explanation for Radar's "Explain this trend"
  // button. Same structured JSON + caching pattern. ─────────────────────────
  app.post("/api/explain-trend", requireAuth, lightLimiter, async (req, res) => {
    try {
      const { skill, tier, role, country } = req.body;
      if (!skill) return res.status(400).json({ error: "skill is required" });

      const { getPersistentCache, setPersistentCache } = await import("./services/persistentCache");
      const cacheKey = [skill, tier || "unspecified", role || "unspecified", country || "unspecified"]
        .join("|").toLowerCase().replace(/\s+/g, " ").trim();
      const TREND_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — market trends shift faster than roadmap content

      const cached = await getPersistentCache<{ whyTrending: string; whatsDrivingDemand: string }>(
        "trend_explain", cacheKey
      );
      if (cached) return res.json({ explanation: cached, fromCache: true });

      const prompt = `"${skill}" was flagged as a ${tier || "notable"}-demand skill for ${role || "this role"} in ${country || "the current market"}, based on a scan of real job listings.

Return ONLY raw JSON (no markdown, no backticks) with exactly these 2 fields, one sentence each:
{
  "whyTrending": "Explain specifically why '${skill}' is in demand for ${role || "this role"} right now — what problem it solves or what shift in the industry is driving employers to ask for it.",
  "whatsDrivingDemand": "Name a concrete factor behind the demand — e.g. a specific industry trend, tooling shift, or business need — not a vague statement like 'technology is evolving'."
}

Rules:
- Reference the actual skill name and role
- Simple language, no jargon, but specific and concrete — not vague
- Each field is ONE sentence only`;

      let parsed: { whyTrending: string; whatsDrivingDemand: string } | null = null;

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const geminiKey = (
          process.env.RADAR_GEMINI_API_KEY ||
          process.env.GEMINI_API_KEY ||
          process.env.VITE_GEMINI_KEY || ""
        ).trim();
        if (!geminiKey) throw new Error("No Gemini key");

        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });
        const result = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            temperature: 0.3,
            maxOutputTokens: 1000,
            responseMimeType: "application/json",
          },
        });
        const raw = result.text?.trim() || "";
        if (!raw) throw new Error("Empty Gemini response");
        parsed = JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim());
        console.log("[ExplainTrend] Gemini used ✓");
      } catch (geminiErr: any) {
        console.warn("[ExplainTrend] Gemini failed, falling back to OpenAI:", geminiErr.message);
        const openaiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
        if (!openaiKey) throw new Error("No AI key available — set GEMINI_API_KEY or OPENAI_API_KEY");
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: openaiKey });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 250,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You explain job-market skill trends concretely and specifically. Return ONLY raw JSON." },
            { role: "user", content: prompt },
          ],
        });
        const raw = completion.choices[0]?.message?.content?.trim() || "";
        parsed = JSON.parse(raw);
        console.log("[ExplainTrend] OpenAI fallback used ✓");
      }

      const explanation = {
        whyTrending: parsed?.whyTrending || "",
        whatsDrivingDemand: parsed?.whatsDrivingDemand || "",
      };

      await setPersistentCache("trend_explain", cacheKey, explanation, TREND_TTL_MS);
      res.json({ explanation });
    } catch (error: any) {
      console.error("[ExplainTrend] Error:", error.message);
      res.status(500).json({ error: "Failed to explain trend", message: error.message });
    }
  });

  // Use Cases / Success Stories (local service — same pattern as radarService)
  app.post("/api/find-use-cases", requireAuth, heavyLimiter, async (req, res) => {
    req.socket.setTimeout(300000);
    res.setTimeout(300000);
    try {
      const { findUseCases } = await import("./services/useCasesService");
      const { goal, level = "beginner", forceRefresh = false, userBackground } = req.body;
      const userId = (req as any).verifiedUid;
      if (!goal) return res.status(400).json({ error: "goal is required" });
      console.log(`[UseCases] goal="${goal}" level="${level}" userBackground="${userBackground || 'unknown'}" userId="${userId}"`);
      const data = await findUseCases(userId, goal, level, forceRefresh, userBackground);
      res.json(data);
    } catch (error: any) {
      console.error("[UseCases] Error:", error.message);
      res.status(500).json({ error: "Failed to find use cases", message: error.message });
    }
  });

  // Career Mentor Routes
  app.post("/api/skill-assessment", requireAuth, mediumLimiter, async (req, res) => {
    try {
      const { generateAssessment } = await import("./services/careerMentorService");
      const { interests, educationLevel, country } = req.body;
      const userId = (req as any).verifiedUid;
      const data = await generateAssessment(userId, interests, educationLevel, country);
      res.json(data);
    } catch (error: any) {
      console.error("Error generating assessment:", error);
      res.status(500).json({ error: "Failed to generate skill assessment", message: error.message });
    }
  });

  app.post("/api/submit-assessment", requireAuth, async (req, res) => {
    try {
      const { submitAssessment } = await import("./services/careerMentorService");
      const { answers, quiz } = req.body;
      const userId = (req as any).verifiedUid;
      const data = await submitAssessment(userId, answers, quiz);
      res.json(data);
    } catch (error: any) {
      console.error("Error submitting assessment:", error);
      res.status(500).json({ error: "Failed to submit assessment answers", message: error.message });
    }
  });

  // ── Tier 3: Adaptive (multi-stage) Assessment Routes ──────────────────────
  // Stage 1: generate baseline questions. Stage 2: grade Stage 1 + generate
  // branched questions. Submit: merge both stages and grade everything.
  // userId always comes from the verified token, never the request body —
  // same trust boundary as the legacy routes above.

  app.post("/api/skill-assessment/stage1", requireAuth, mediumLimiter, async (req, res) => {
    try {
      const { generateAssessmentStage1 } = await import("./services/careerMentorService");
      const { interests, educationLevel, country } = req.body;
      const userId = (req as any).verifiedUid;
      const data = await generateAssessmentStage1(userId, interests, educationLevel, country);
      res.json(data);
    } catch (error: any) {
      console.error("Error generating Stage 1 assessment:", error);
      res.status(500).json({ error: "Failed to generate Stage 1 assessment", message: error.message });
    }
  });

  app.post("/api/skill-assessment/stage2", requireAuth, mediumLimiter, async (req, res) => {
    try {
      const { analyzeStage1AndGenerateStage2 } = await import("./services/careerMentorService");
      const { stage1Answers } = req.body;
      const userId = (req as any).verifiedUid;
      const data = await analyzeStage1AndGenerateStage2(userId, stage1Answers);
      res.json(data);
    } catch (error: any) {
      console.error("Error generating Stage 2 assessment:", error);
      // Session-expiry is a recoverable client error, not a server failure —
      // surface it as 400 so the frontend can show "please restart" instead
      // of a generic failure toast.
      const status = /session/i.test(error.message) ? 400 : 500;
      res.status(status).json({ error: "Failed to generate Stage 2 assessment", message: error.message });
    }
  });

  app.post("/api/submit-adaptive-assessment", requireAuth, async (req, res) => {
    try {
      const { submitAdaptiveAssessment } = await import("./services/careerMentorService");
      const { stage2Quiz, stage2Answers } = req.body;
      const userId = (req as any).verifiedUid;
      const data = await submitAdaptiveAssessment(userId, stage2Quiz, stage2Answers);
      res.json(data);
    } catch (error: any) {
      console.error("Error submitting adaptive assessment:", error);
      const status = /session/i.test(error.message) ? 400 : 500;
      res.status(status).json({ error: "Failed to submit adaptive assessment", message: error.message });
    }
  });

  app.get("/api/verify-database", requireAuth, lightLimiter, async (req, res) => {
    try {
      const { verifySupabaseConnection } = await import("./services/careerMentorService");
      const error = await verifySupabaseConnection();
      if (error) {
        console.error("[VerifyDatabase] Supabase connection check failed:", error);
        res.status(503).json({ ok: false });
      } else {
        res.json({ ok: true });
      }
    } catch (error: any) {
      console.error("[VerifyDatabase] Unexpected error:", error);
      res.status(500).json({ ok: false });
    }
  });

  // Career Mentor — slow route, allow up to 5 minutes (300s)
  app.post("/api/career-mentor", requireAuth, heavyLimiter, async (req, res) => {
    // Extend socket + response timeout for this slow AI workflow
    req.socket.setTimeout(300000);
    res.setTimeout(300000);

    try {
      const { getCareerMentorRecommendations } = await import("./services/careerMentorService");
      const { ...formData } = req.body;
      const userId = (req as any).verifiedUid;

      console.log(`[CareerMentor] Generating local recommendations for userId="${userId}"`);
      const data = await getCareerMentorRecommendations(userId, formData);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching career mentor report:", error);
      res.status(500).json({ 
        error: "Failed to get career mentor report",
        message: error.message || "Unknown error"
      });
    }
  });

  app.post("/api/chatbot", optionalAuth, lightLimiter, async (req, res) => {
    try {
      const data = await askChatbot(req.body);
      res.json(data);
    } catch (error) {
      console.error("Chatbot Error:", error);
      res.status(500).json({ error: "Chatbot service unavailable" });
    }
  });

  // ── Administrative APIs (Admin-Only Actions) ──────────────────────────────────
  const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: missing token" });
    }
    const idToken = authHeader.split("Bearer ")[1];
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err: any) {
      console.error("[AdminAuthError] ID Token verification failed:", err.message);
      return res.status(401).json({ error: "Unauthorized: invalid or expired token" });
    }

    try {
      const uid = decoded.uid;
      (req as any).verifiedUid = uid;

      const docSnap = await adminDb.collection("users").doc(uid).get();
      const docData = docSnap.exists ? docSnap.data() : null;
      const isAdminUser = docData?.isAdmin === true || docData?.role === "admin";

      if (!isAdminUser) {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }
      next();
    } catch (err: any) {
      console.error("[AdminAuthError] Firestore or role verification failed:", err);
      return res.status(500).json({ error: "Internal Server Error: Failed to verify administrative permissions" });
    }
  };

  app.get("/api/admin/data", requireAdmin, async (req, res) => {
    try {
      const dbInstance = adminDb;

      const usersSnap = await dbInstance.collection("users").get();
      const usersList = usersSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      const platformFeedbackSnap = await dbInstance.collection("platformFeedback").get();
      const platformFeedbackList = platformFeedbackSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      const userFeedbackSnap = await dbInstance.collection("userFeedback").get();
      const userFeedbackList = userFeedbackSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      const activityLogSnap = await dbInstance.collection("activityLog")
        .orderBy("timestamp", "desc")
        .limit(100)
        .get()
        .catch(() => ({ docs: [] }) as any);

      const activityList = activityLogSnap.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      }));

      res.json({
        users: usersList,
        platformFeedback: platformFeedbackList,
        userFeedback: userFeedbackList,
        activityLog: activityList
      });
    } catch (error: any) {
      console.error("[ApiAdminDataError]", error);
      res.status(500).json({ error: "Failed to load admin data", message: error.message });
    }
  });

  app.post("/api/admin/update-user", requireAdmin, async (req, res) => {
    const { targetUid, updates } = req.body;
    if (!targetUid) {
      return res.status(400).json({ error: "Missing targetUid" });
    }
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Missing or invalid updates object" });
    }

    try {
      const allowedUpdates: Record<string, any> = {};
      
      if (typeof updates.tier === "string" && ["Free", "Pro"].includes(updates.tier)) {
        allowedUpdates.tier = updates.tier;
      }
      if (typeof updates.isAdmin === "boolean") {
        allowedUpdates.isAdmin = updates.isAdmin;
      }
      if (typeof updates.role === "string") {
        allowedUpdates.role = updates.role;
      }
      if (typeof updates.assessmentCount === "number") {
        allowedUpdates["metadata.assessmentCount"] = updates.assessmentCount;
      }

      if (Object.keys(allowedUpdates).length === 0) {
        return res.status(400).json({ error: "No valid update fields specified" });
      }

      const userRef = adminDb.collection("users").doc(targetUid);
      await userRef.update(allowedUpdates);

      res.json({ success: true, message: `Successfully updated user ${targetUid}` });
    } catch (error: any) {
      console.error("[ApiAdminUpdateUserError]", error);
      res.status(500).json({ error: "Failed to update user", message: error.message });
    }
  });

  // ================= FRONTEND =================

  if (process.env.NODE_ENV !== "production") {
    // Development: use Vite dev server with HMR
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve pre-built static files from dist/
    const distPath = path.join(process.cwd(), "dist");

    if (fs.existsSync(distPath)) {
      console.log(`[Server] Serving static files from: ${distPath}`);
      app.use(express.static(distPath));
      app.get("*", (_, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      // dist/ not found — server still binds to port so Cloud Run health check passes
      console.error(
        "[Server] WARNING: dist/ folder not found. The frontend was not built. " +
        "Ensure 'npm run build' runs before 'npm start'."
      );
      app.get("*", (_, res) => {
        res
          .status(503)
          .send(
            "Frontend not built. Run 'npm run build' before starting the server."
          );
      });
    }
  }

  // Global error handler — registered correctly before app.listen
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[GlobalError]", err);
    res.status(500).json({
      error: "Internal Server Error",
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});