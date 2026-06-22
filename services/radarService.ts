/**
 * radarService.ts
 *
 * Workflow steps:
 *  1. Validate role + country
 *  2. Check 24h persistent (Firestore + memory fallback) cache → return instantly if HIT
 *  3. Fetch live jobs from JSearch API (RapidAPI) with fallback key
 *  4. Extract job details (qualifications + responsibilities only — no full descriptions)
 *  5. Build a lean prompt (~60% fewer tokens than before)
 *  6. Try Gemini 2.0 Flash first (free tier) → fallback to OpenAI gpt-4o-mini on error/rate-limit
 *  7. Cache result for 24h, return structured JSON { technicalSkills, softSkills, salaryIntel }
 */

import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { withGeminiRetry } from "./geminiRetry";
import { getPersistentCache, setPersistentCache } from "./persistentCache";
import { singleFlight } from "./singleFlight";

// ─── AI Client Initialization ────────────────────────────────────────────────

const radarGeminiKey = (process.env.RADAR_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || "").trim();
if (process.env.RADAR_GEMINI_API_KEY) console.log("[Radar] Using RADAR_GEMINI_API_KEY");
else if (process.env.GEMINI_API_KEY) console.log("[Radar] Using default GEMINI_API_KEY");
const ai = new GoogleGenAI({
  apiKey: radarGeminiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// ─── Persistent cache (Firestore, 24h TTL — falls back to in-memory if
// Firestore is briefly unreachable; see persistentCache.ts for details) ──────

const RADAR_NAMESPACE = "radar";
const RADAR_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function radarCacheKey(role: string, country: string): string {
  return `${role.toLowerCase().trim()}|${country.toLowerCase().trim()}`;
}

async function getRadarCached(role: string, country: string): Promise<RadarResult | null> {
  const key = radarCacheKey(role, country);
  const result = await getPersistentCache<RadarResult>(RADAR_NAMESPACE, key);
  if (result) console.log(`[Radar] Cache HIT for: ${role} in ${country}`);
  return result;
}

async function setRadarCache(role: string, country: string, result: RadarResult): Promise<void> {
  const key = radarCacheKey(role, country);
  await setPersistentCache(RADAR_NAMESPACE, key, result, RADAR_TTL_MS);
  console.log(`[Radar] Cached result for: ${role} in ${country}`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillTiers {
  high: string[];
  medium: string[];
  low: string[];
}

interface SalaryIntel {
  currency: string;
  annualMin: number | null;
  annualMax: number | null;
  midpoint: number | null;
  confidence: "high" | "medium" | "low" | "none";
  source: "listing_data" | "ai_estimate";
  note: string;
}

export interface RadarResult {
  technicalSkills: SkillTiers;
  softSkills: SkillTiers;
  salaryIntel: SalaryIntel | null;
  jobs?: any[];
}

interface NormalizedJob {
  title: string;
  qualifications: string[];
  responsibilities: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string | null;
  salaryCurrency: string | null;
}

// ─── Step 1: Validate inputs ──────────────────────────────────────────────────

function validateInputs(role: string, country: string): void {
  if (!role || !role.trim()) throw new Error("role is required");
  if (!country || !country.trim()) throw new Error("country is required");
}

// ─── Step 2: Fetch jobs from JSearch (RapidAPI) with fallback keys ────────────

async function fetchJobs(role: string, country: string, isRetry: boolean = false): Promise<any[]> {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY;
  const RAPIDAPI_KEY_FALLBACK = process.env.RAPIDAPI_KEY_2 || process.env.RAPID_API_KEY_2;

  const keys = [RAPIDAPI_KEY, RAPIDAPI_KEY_FALLBACK].filter(Boolean);
  if (keys.length === 0) {
    throw new Error(
      "No JSearch API keys available. " +
      "Set RAPIDAPI_KEY and/or RAPIDAPI_KEY_2 in your .env file."
    );
  }

  // Optimize query string — if Worldwide, don't append "in Worldwide"
  let queryText = `${role} in ${country}`;
  if (country.toLowerCase() === "worldwide" || !country) {
    queryText = role;
  }

  const query = encodeURIComponent(queryText);
  const url =
    `https://jsearch.p.rapidapi.com/search` +
    `?query=${query}&num_pages=1&date_posted=all&results_per_page=10&job_details=true`;

  // Try each key until one succeeds or we run out
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    console.log(`[Radar] Trying JSearch key ${i + 1}/${keys.length}`);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": key!,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      });

      if (response.ok) {
        const json = await response.json();
        const jobs: any[] = json?.data ?? [];

        if (jobs.length === 0) {
          // If no jobs found in specific country, try Worldwide as a fallback
          if (!isRetry && country.toLowerCase() !== "worldwide") {
            console.log(`[Radar] No jobs found for "${role}" in "${country}". Retrying with role only.`);
            return fetchJobs(role, "Worldwide", true);
          }
          throw new Error(`No jobs found for "${role}" in "${country}". Try a broader role or different country.`);
        }

        console.log(`[Radar] JSearch key ${i + 1} succeeded`);
        return jobs;
      }

      const status = response.status;
      if (status === 429) {
        console.warn(`[Radar] JSearch key ${i + 1} rate limited (429)`);
        if (i < keys.length - 1) {
          console.log(`[Radar] Trying fallback key...`);
          continue;
        }
        throw new Error("All JSearch API keys are rate limited. Please wait and try again later.");
      }

      if (status === 403) {
        console.warn(`[Radar] JSearch key ${i + 1} invalid (403)`);
        if (i < keys.length - 1) {
          console.log(`[Radar] Trying fallback key...`);
          continue;
        }
        throw new Error("All JSearch API keys are invalid. Check your RAPIDAPI_KEY and RAPIDAPI_KEY_2.");
      }

      throw new Error(`Job search API error: ${status}`);
    } catch (error: any) {
      if (error.message.includes("All JSearch")) throw error;
      console.error(`[Radar] JSearch key ${i + 1} failed:`, error.message);
      if (i < keys.length - 1) {
        console.log(`[Radar] Trying next key...`);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to fetch jobs from JSearch with all available keys.");
}

// ─── Step 3: Extract and normalise job details ────────────────────────────────
// FIX: We no longer send full job descriptions — only qualifications +
// responsibilities which are already extracted. This cuts token usage ~65%.

function extractSection(text: string, startKeywords: string[], endKeywords: string[] = []): string[] {
  if (!text) return [];
  const lowerText = text.toLowerCase();

  for (const keyword of startKeywords) {
    const startIndex = lowerText.indexOf(keyword.toLowerCase());
    if (startIndex === -1) continue;

    let section = text.slice(startIndex + keyword.length);
    let endIndex = section.length;

    for (const endKeyword of endKeywords) {
      const idx = section.toLowerCase().indexOf(endKeyword.toLowerCase());
      if (idx !== -1) endIndex = Math.min(endIndex, idx);
    }

    return section
      .slice(0, endIndex)
      .split(/\n|•|-/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }
  return [];
}

function normalizeJobs(rawJobs: any[]): NormalizedJob[] {
  return rawJobs.map((job) => {
    const desc = job.job_description || "";
    const highlights = job.job_highlights || {};

    let qualifications: string[] = highlights.Qualifications || [];
    let responsibilities: string[] = highlights.Responsibilities || [];

    if (!qualifications.length) {
      qualifications = extractSection(
        desc,
        ["requirements", "qualifications", "basic requirements", "what you need"],
        ["responsibilities", "what you will do", "about the role", "working with us"]
      );
    }
    if (!responsibilities.length) {
      responsibilities = extractSection(
        desc,
        ["responsibilities", "what you will do", "key responsibilities", "your role"],
        ["requirements", "qualifications", "basic requirements", "about the role"]
      );
    }

    // Trim to top 8 bullet points each to further reduce tokens
    return {
      title: job.job_title || "",
      qualifications: qualifications.slice(0, 8),
      responsibilities: responsibilities.slice(0, 8),
      salaryMin: job.job_min_salary ?? null,
      salaryMax: job.job_max_salary ?? null,
      salaryPeriod: job.job_salary_period ?? null,
      salaryCurrency: job.job_salary_currency ?? null,
    };
  });
}

// ─── Step 4: Build lean prompt (no full descriptions) ─────────────────────────

function buildPromptText(jobs: NormalizedJob[]): string {
  return jobs
    .map(
      (job, i) =>
        `Job ${i + 1}: ${job.title}\n` +
        `Requirements: ${job.qualifications.join(" | ")}\n` +
        `Responsibilities: ${job.responsibilities.join(" | ")}\n` +
        `Salary: ${
          job.salaryMin && job.salaryMax
            ? `${job.salaryMin}-${job.salaryMax} ${job.salaryCurrency || "USD"}/${job.salaryPeriod || "YEAR"}`
            : "Not disclosed"
        }`
    )
    .join("\n\n");
}

// ─── Step 5: AI analysis — Gemini first, OpenAI fallback ─────────────────────

const AI_SYSTEM_PROMPT = (role: string, country: string) =>
  `You are an AI assistant that analyses job market data and extracts required skills.
Target Role: ${role} | Target Country: ${country}

Tasks:
1. Extract technical skills (languages, frameworks, tools) and soft skills from the job data below.
2. If no job data is provided, use your knowledge to estimate top skills for this role/country.
3. Rank skills into three demand tiers: high (top 33%), medium (middle 33%), low (bottom 33%).
4. Include exactly the top 5 skills per tier (or fewer if less than 5 exist).
5. Analyse salary: normalize to annual figures. If listings have salary data set source="listing_data", else set source="ai_estimate" and confidence="none".

Return ONLY raw JSON — no markdown, no backticks. Schema:
{
  "technicalSkills": { "high": [], "medium": [], "low": [] },
  "softSkills": { "high": [], "medium": [], "low": [] },
  "salaryIntel": {
    "currency": "USD",
    "annualMin": null,
    "annualMax": null,
    "midpoint": null,
    "confidence": "none",
    "source": "ai_estimate",
    "note": ""
  }
}`;

function parseAIResponse(raw: string): RadarResult {
  let cleaned = raw.trim();
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```+(?:json)?/i, "").replace(/```+$/i, "").trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const maybeJson = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        parsed = JSON.parse(maybeJson);
      } catch (err: any) {
        throw new Error(`AI returned invalid JSON for skill analysis: ${err.message}`);
      }
    } else {
      throw new Error("AI returned invalid JSON for skill analysis — no JSON object found");
    }
  }

  return {
    technicalSkills: {
      high: parsed?.technicalSkills?.high ?? [],
      medium: parsed?.technicalSkills?.medium ?? [],
      low: parsed?.technicalSkills?.low ?? [],
    },
    softSkills: {
      high: parsed?.softSkills?.high ?? [],
      medium: parsed?.softSkills?.medium ?? [],
      low: parsed?.softSkills?.low ?? [],
    },
    salaryIntel: parsed?.salaryIntel ?? null,
  };
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const result = await withGeminiRetry(
    () =>
      ai.models.generateContent({
        model: "gemini-2.0-flash-thinking-exp",
        contents: `${systemPrompt}\n\n${userPrompt}`,
        config: {
          temperature: 0.3,
          maxOutputTokens: 3000,
          responseMimeType: "application/json",
          // Enable thinking for market trend analysis
          thinkingConfig: { thinkingBudget: 1500 },
        },
      }),
    // maxRetries: 1 (was default 2) — this is a user-facing, time-sensitive
    // request. If Gemini is rate-limited, fail over to OpenAI after one
    // retry instead of waiting through a longer exponential backoff first.
    { label: "[Radar]", maxRetries: 1 }
  );

  const candidate = result.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("Gemini response was truncated (MAX_TOKENS) — increase maxOutputTokens or shorten the prompt");
  }

  const text = result.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function callOpenAI(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 1200,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

// ─── Fallback: Fetch salary data from SerpAPI (for countries like Pakistan) with fallback key ─

import { searchSerp } from "./serpClient";

async function fetchSalaryFromSerpAPI(role: string, country: string): Promise<{ min: number | null; max: number | null; currency: string; note: string } | null> {
    try {
      const results = await searchSerp(`${role} salary ${country}`, 5);
      
      const fullSearchText = results.map(r => r.snippet).join(" | ");
      if (!fullSearchText) return null;

      let minVal: number | null = null;
      let maxVal: number | null = null;

      // 1. Try to match standard range patterns (e.g., "Rs. 100,000 - 250,000" or "80k - 150k")
      const regexRange = /(?:rs\.?|pkr|usd|\$)?\s*([\d.,]+[kmM]?)\s*(?:-|–|to)\s*(?:rs\.?|pkr|usd|\$)?\s*([\d.,]+[kmM]?)/i;
      const matchRange = fullSearchText.match(regexRange);

      const parseValue = (valStr: string): number | null => {
        let clean = valStr.toLowerCase().replace(/,/g, "").trim();
        let multiplier = 1;
        if (clean.endsWith("k")) {
          multiplier = 1000;
          clean = clean.slice(0, -1);
        } else if (clean.endsWith("m")) {
          multiplier = 1000000;
          clean = clean.slice(0, -1);
        }
        const num = parseFloat(clean);
        return isNaN(num) ? null : num * multiplier;
      };

      if (matchRange) {
        const parsedMin = parseValue(matchRange[1]);
        const parsedMax = parseValue(matchRange[2]);
        if (parsedMin !== null && parsedMax !== null) {
          minVal = parsedMin;
          maxVal = parsedMax;
        }
      }

      // 2. If range fails, try to match single average salaries (e.g., "average of Rs. 150,000") and build a bracket
      if (minVal === null || maxVal === null) {
        const regexSingle = /(?:average|median|midpoint)?\s*(?:salary|pay)?\s*(?:is|of|around)?\s*(?:rs\.?|pkr|usd|\$)?\s*([\d.,]+[kmM]?)\s*(?:per|\/)\s*(?:month|year|annum)/i;
        const matchSingle = fullSearchText.match(regexSingle);
        if (matchSingle) {
          const val = parseValue(matchSingle[1]);
          if (val !== null) {
            minVal = Math.round(val * 0.85);
            maxVal = Math.round(val * 1.15);
          }
        }
      }

      if (minVal !== null && maxVal !== null) {
        const isPakistan = country.toLowerCase().includes("pakistan");
        const currency = isPakistan ? "PKR" : "USD";
        
        let isMonthly = false;
        // PKR monthly salary usually falls below 1,200,000 PKR, whereas annual does not.
        if (isPakistan && maxVal < 1200000) {
          isMonthly = true;
        } else if (fullSearchText.toLowerCase().includes("per month") || fullSearchText.toLowerCase().includes("/month") || fullSearchText.toLowerCase().includes("monthly")) {
          if (maxVal < 2000000) {
            isMonthly = true;
          }
        }

        if (isMonthly) {
          minVal = minVal * 12;
          maxVal = maxVal * 12;
          console.log(`[Radar] Detected monthly salary for Pakistan, automatically scaled to annual PKR: ${minVal} - ${maxVal}`);
        }

        console.log(`[Radar] Salary data found: ${minVal} - ${maxVal} ${currency}`);
        return {
          min: minVal,
          max: maxVal,
          currency,
          note: `Salary intel sourced from SerpAPI search for ${country}${isMonthly ? " (automatically normalized to annual PKR rate)" : ""}`
        };
      }
    } catch (err: any) {
      console.error(`[Radar] SerpAPI salary fetch failed:`, err.message);
    }

  return null;
}

async function analyseWithAI(jobsText: string, role: string, country: string): Promise<RadarResult> {
  const geminiKey = radarGeminiKey;
  const openaiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();

  const systemPrompt = AI_SYSTEM_PROMPT(role, country);
  const userPrompt = jobsText || "No live job data available. Please provide an AI estimate.";

  // Try Gemini first (flash-latest recommended)
  if (geminiKey) {
    try {
      const raw = await callGemini(systemPrompt, userPrompt);
      console.log(`[Radar] Gemini used ✓ for: ${role} in ${country}`);
      return parseAIResponse(raw);
    } catch (err: any) {
      console.warn(`[Radar] Gemini failed (${err.message}) — falling back to OpenAI`);
    }
  }

  // Fallback: OpenAI
  if (!openaiKey) throw new Error("No AI key available. Set GEMINI_API_KEY or OPENAI_API_KEY.");
  console.log(`[Radar] OpenAI fallback used for: ${role} in ${country}`);
  const raw = await callOpenAI(systemPrompt, userPrompt, openaiKey);
  return parseAIResponse(raw);
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * scanMarket — full replacement for the SkillSync Radar n8n workflow.
 * Now with 24h caching + lean prompts + Gemini-first AI to minimise costs.
 *
 * @param role    Target job role, e.g. "Frontend Developer"
 * @param country Country name, e.g. "Worldwide"
 */
export async function scanMarket(role: string, country: string): Promise<RadarResult> {
  // Step 1 – validate
  validateInputs(role, country);

  // Step 2 – check cache first (free!)
  const cached = await getRadarCached(role, country);
  if (cached) return cached;

  // Step 3 – fetch live jobs AND kick off the SerpAPI salary lookup at the
  // same time. SerpAPI only needs role+country — it never depended on the
  // AI analysis result — but it was previously only started AFTER the AI
  // call finished, stacking its full ~3-10s network latency on top of
  // JSearch + AI sequentially. Running them concurrently means SerpAPI's
  // latency overlaps with (and is mostly "free" relative to) the
  // JSearch+AI critical path instead of adding to it.
  const serpSalaryPromise = fetchSalaryFromSerpAPI(role, country).catch((err) => {
    console.warn(`[Radar] SerpAPI salary fetch failed: ${err?.message || err}`);
    return null;
  });

    let rawJobs: any[] = [];
  try {
    rawJobs = await singleFlight(`jsearch-${role}-${country}`, () => fetchJobs(role, country));
  } catch (err: any) {
    console.warn(`[Radar] fetchJobs failed: ${err.message}. Falling back to AI estimate.`);
  }

  // Step 4 – normalise (qualifications + responsibilities only, no full descriptions)
  const jobs = normalizeJobs(rawJobs);

  // Step 5 – build lean prompt
  const promptText = buildPromptText(jobs);

  // Step 6 – AI analysis (Gemini → OpenAI fallback)
    let result = await singleFlight(`ai-analysis-${role}-${country}-${promptText.substring(0, 50)}`, () => analyseWithAI(promptText, role, country));

  // Step 7 – ENHANCEMENT: If salary is not found from JSearch, use the SerpAPI
  // result that's been fetching in the background this whole time — by now
  // it has very likely already resolved, so this `await` rarely adds any
  // extra wait at all.
  if (!result.salaryIntel || result.salaryIntel.source === "ai_estimate" && result.salaryIntel.confidence === "none") {
    const serpSalary = await serpSalaryPromise;
    if (serpSalary) {
      result.salaryIntel = {
        currency: serpSalary.currency,
        annualMin: serpSalary.min,
        annualMax: serpSalary.max,
        midpoint: serpSalary.min && serpSalary.max ? Math.round((serpSalary.min + serpSalary.max) / 2) : null,
        confidence: "medium",
        source: "listing_data", // Mark as sourced data (not pure AI estimate)
        note: serpSalary.note
      };
      console.log(`[Radar] Enhanced with SerpAPI salary data for ${role} in ${country}`);
    }
  }

  // Step 8 – Map rawJobs into result.jobs for frontend use
  if (rawJobs && rawJobs.length > 0) {
    result.jobs = rawJobs.slice(0, 6).map((job: any) => ({
      jobTitle: job.job_title || "Job Listing",
      company: job.employer_name || "Company",
      location: job.job_city
        ? `${job.job_city}, ${job.job_country || ""}`
        : job.job_country || "Remote",
      isRemote: job.job_is_remote || false,
      employmentType: job.job_employment_type || "Full-time",
      applyLink: job.job_apply_link || "",
      matchScore: 90
    }));
  } else {
    result.jobs = [];
  }

  // Step 9 – cache for 24h
  await setRadarCache(role, country, result);

  return result;
}