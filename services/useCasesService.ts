import { GoogleGenAI } from "@google/genai";
import { withGeminiRetry } from "./geminiRetry";
import { getPersistentCache, setPersistentCache } from "./persistentCache";
import { singleFlight } from "./singleFlight";
import { searchSerp, SerpResult } from "./serpClient";

// useCasesService.ts
// Local port of the find-use-cases Supabase edge function.
// Same logic, same output — runs on your Express server using your own .env keys.
// Pattern: identical to radarService.ts

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Story {
  headline?: string;
  previous_role?: string;
  background_type?: string;
  skills_before?: string;
  learning_path?: string;
  tools_used?: string[];
  duration_months?: number;
  current_role?: string;
  current_company?: string;
  salary_change?: string;
  key_advice?: string;
  source_url?: string | null;
  source_platform?: string;
  source_verified?: boolean;
  credibility_score?: number;
}

export interface UseCasesResult {
  success: boolean;
  goal: string;
  stories: Story[];
  stories_md: string;
  from_cache: boolean;
}

// ─── Persistent cache (Firestore, 12h TTL — falls back to in-memory if
// Firestore is briefly unreachable; see persistentCache.ts for details) ──────

const USECASES_NAMESPACE = "usecases";
const USECASES_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function makeCacheKey(goal: string, level: string, userBackground?: string): string {
  const bg = (userBackground || "unknown").toLowerCase().trim();
  return `${goal.toLowerCase().trim()}|${level.toLowerCase().trim()}|${bg}`;
}

async function getCached(key: string): Promise<UseCasesResult | null> {
  const result = await getPersistentCache<UseCasesResult>(USECASES_NAMESPACE, key);
  if (!result) return null;
  return { ...result, from_cache: true };
}

async function setCache(key: string, result: UseCasesResult): Promise<void> {
  await setPersistentCache(USECASES_NAMESPACE, key, result, USECASES_TTL_MS);
}

// ─── URL liveness check (3s timeout) ─────────────────────────────────────────

async function isLive(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(url, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    return r.status < 400;
  } catch {
    return false;
  }
}

// ─── Build broad multi-layer search queries ───────────────────────────────────

function buildBroadQueries(goal: string, level: string, userBackground?: string): string[] {
  const g = goal.trim();
  const lower = g.toLowerCase();
  const goalVariants = [g];

  if (lower.includes("ai engineer"))     goalVariants.push("machine learning engineer", "ML engineer", "AI developer");
  if (lower.includes("data scientist"))  goalVariants.push("data science", "ML researcher");
  if (lower.includes("full stack"))      goalVariants.push("full stack developer", "web developer", "software developer");
  if (lower.includes("devops"))          goalVariants.push("cloud engineer", "site reliability engineer", "SRE");
  if (lower.includes("frontend"))        goalVariants.push("React developer", "UI developer", "web developer");
  if (lower.includes("backend"))         goalVariants.push("backend developer", "software engineer", "API developer");
  if (lower.includes("cybersecurity"))   goalVariants.push("security engineer", "penetration tester", "infosec");
  if (lower.includes("product manager")) goalVariants.push("PM role", "product management career");

  const year = new Date().getFullYear();
  const queries: string[] = [];

  // CONTEXT-AWARE: If we know the user's background, search for specific transitions
  if (userBackground && userBackground.trim().toLowerCase() !== "unknown") {
    const bg = userBackground.trim();
    const bgLower = bg.toLowerCase();
    
    // Specific background transitions (highest priority)
    for (const v of goalVariants.slice(0, 2)) {
      queries.push(`"${bg}" to "${v}" career transition success story`);
      queries.push(`how I went from "${bg}" to "${v}" career change`);
      queries.push(`${bg} background became "${v}" career journey`);
    }
    
    // Field-specific transitions
    if (bgLower.includes("biology") || bgLower.includes("science")) {
      queries.push(`biology science background to "${g}" career transition`);
      queries.push(`scientist transitioned to tech "${g}" career story`);
    }
    if (bgLower.includes("business") || bgLower.includes("mba")) {
      queries.push(`business background switched to "${g}" career pivot`);
    }
    if (bgLower.includes("design") || bgLower.includes("art")) {
      queries.push(`designer artist transitioned to "${g}" career story`);
    }
    if (bgLower.includes("teacher") || bgLower.includes("education")) {
      queries.push(`teacher educator career change to "${g}" success story`);
    }
  }

  // Layer 1 — Direct transition stories (fallback if no background)
  for (const v of goalVariants.slice(0, 2)) {
    queries.push(`"${v}" career transition success story how I got hired`);
    queries.push(`how I became a "${v}" career change story`);
    queries.push(`"${v}" career pivot from non-tech background`);
  }

  // Layer 2 — Reddit
  queries.push(`reddit "${g}" career change success self taught got job`);
  queries.push(`reddit "how I broke into" "${g}" career story ${year}`);
  queries.push(`reddit "${g}" "I got hired" OR "landed a job" career journey`);

  // Layer 3 — Blog posts, Medium, dev.to
  queries.push(`"${g}" career transition blog post personal story ${year}`);
  queries.push(`"how I landed my first ${g} job" story`);
  queries.push(`"from ${level}" to "${g}" career journey`);

  // Layer 4 — Non-tech specific
  queries.push(`non-technical background career change to "${g}" success`);
  queries.push(`teacher nurse accountant marketer career change to tech "${g}"`);
  queries.push(`"no CS degree" "${g}" got hired self taught story`);
  queries.push(`bootcamp graduate "${g}" job story ${year}`);

  // Layer 5 — Generic articles
  queries.push(`career change into tech "${g}" real story interview`);
  queries.push(`"${g}" success story LinkedIn OR Medium OR dev.to ${year}`);

  return queries;
}

// ─── GPT-4o extraction system prompt ─────────────────────────────────────────

const EXTRACTOR_SYSTEM = `You are a career story analyst. Extract real career transition stories from web search results.

STRICT RULES:
1. ONLY extract information explicitly stated in the search results — NEVER invent details
2. source_url MUST be the exact URL from the result. Reddit URLs must have /comments/ in the path
3. If no specific URL exists, set source_url to null and source_verified to false
4. learning_path: list SPECIFIC resources mentioned — if none, say "Not specified in source"
5. background_type: "non-tech" = previous job had NO coding. "tech" = had some coding/IT background
6. credibility_score: 1-4=vague, 5-7=has some specifics, 8-10=specific course names + duration + salary + company
7. Extract EVERY story you can find — even sparse ones. credibility 4 is better than nothing
8. Return ONLY valid JSON

Return format:
{
  "stories": [
    {
      "headline": "Teacher → ML Engineer in 14 months",
      "previous_role": "High School Math Teacher",
      "background_type": "non-tech",
      "skills_before": "Excel, basic statistics",
      "learning_path": "Andrew Ng ML Specialization on Coursera, fast.ai Part 1",
      "tools_used": ["Python", "TensorFlow", "Jupyter"],
      "duration_months": 14,
      "current_role": "ML Engineer",
      "current_company": "Google",
      "salary_change": "$52k → $145k",
      "key_advice": "Do Kaggle competitions from month 3",
      "source_url": "https://reddit.com/r/learnmachinelearning/comments/abc123/",
      "source_platform": "reddit",
      "source_verified": true,
      "credibility_score": 9
    }
  ]
}`;

// ─── AI caller — Gemini first, gpt-4o-mini fallback ─────────────────────────

async function callGPT4o(system: string, user: string, apiKey: string): Promise<string> {
  const geminiKey = (process.env.USE_CASES_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || "").trim();
  if (process.env.USE_CASES_GEMINI_API_KEY) console.log("[UseCases] Using USE_CASES_GEMINI_API_KEY");
  else if (process.env.GEMINI_API_KEY) console.log("[UseCases] Using default GEMINI_API_KEY");

  // Try Gemini first
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      const result = await withGeminiRetry(
        () =>
          ai.models.generateContent({
            model: "gemini-2.0-flash-thinking-exp",
            contents: `${system}\n\n${user}`,
            config: {
              temperature: 0.15,
              maxOutputTokens: 8000,
              responseMimeType: "application/json",
              // Enable thinking for extracting career stories
              thinkingConfig: { thinkingBudget: 2000 },
            },
          }),
        { label: "[UseCases]" }
      );
      const candidate = result.candidates?.[0];
      if (candidate?.finishReason === "MAX_TOKENS") {
        throw new Error("Gemini response was truncated (MAX_TOKENS) — increase maxOutputTokens or shorten the prompt");
      }
      const text = result.text;
      if (!text) throw new Error("Gemini empty response");
      console.log("[UseCases] Gemini used ✓");
      return text;
    } catch (err: any) {
      console.warn(`[UseCases] Gemini failed (${err.message}) — falling back to OpenAI`);
    }
  }

  // Fallback: OpenAI gpt-4o-mini (was gpt-4o — downgraded to save ~20x cost)
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.15,
      max_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content ?? "";
}

// ─── Safe JSON parser ─────────────────────────────────────────────────────────

function safeJSON<T>(text: string, fallback: T): T {
  let cleaned = text.trim();
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```+(?:json)?/i, "").replace(/```+$/i, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let start = -1;
    let end = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || (firstBrace < firstBracket))) {
      start = firstBrace;
      end = cleaned.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = cleaned.lastIndexOf(']');
    }

    if (start !== -1 && end !== -1 && end > start) {
      const maybeJson = cleaned.substring(start, end + 1);
      try {
        return JSON.parse(maybeJson) as T;
      } catch {
        return fallback;
      }
    }
  }
  return fallback;
}

// ─── Markdown formatter ───────────────────────────────────────────────────────

function storyBlock(s: Story): string {
  let md = `---\n\n### ${s.headline ?? `${s.previous_role} → ${s.current_role}`}\n\n`;
  if (s.previous_role)      md += `**Previous Role:** ${s.previous_role}\n\n`;
  if (s.skills_before)      md += `**Skills Before:** ${s.skills_before}\n\n`;
  if (s.learning_path)      md += `**Learning Path:** ${s.learning_path}\n\n`;
  if (s.tools_used?.length) md += `**Tools Used:** ${s.tools_used.join(", ")}\n\n`;
  if (s.duration_months)    md += `**Time to Transition:** ${s.duration_months} months\n\n`;
  if (s.current_role)       md += `**Current Role:** ${s.current_role}${s.current_company ? ` at **${s.current_company}**` : ""}\n\n`;
  if (s.salary_change)      md += `**Salary Change:** ${s.salary_change}\n\n`;
  if (s.key_advice)         md += `**Key Advice:** *"${s.key_advice}"*\n\n`;
  if (s.source_url) {
    md += `**[📎 Read full story on ${s.source_platform ?? "source"} →](${s.source_url})**`;
    if (!s.source_verified) md += ` *(link unverified)*`;
    md += `\n\n`;
  }
  if (s.credibility_score)  md += `*Credibility: ${s.credibility_score}/10*\n\n`;
  return md;
}

function toMarkdown(stories: Story[], goal: string): string {
  if (!stories.length) {
    return `# Career Transition Stories — ${goal}\n\nNo verified stories found at this time. Try refreshing or searching a broader goal.`;
  }
  let md = `# Real Career Transition Stories — ${goal}\n\n`;
  md += `> ${stories.length} real stor${stories.length === 1 ? "y" : "ies"} sourced from Reddit, Dev.to, Medium, and career blogs.\n\n`;

  const nonTech = stories.filter((s) => s.background_type === "non-tech");
  const tech    = stories.filter((s) => s.background_type !== "non-tech");

  if (nonTech.length) { md += `## From Non-Tech Backgrounds\n\n`; for (const s of nonTech) md += storyBlock(s); }
  if (tech.length)    { md += `## From Tech Backgrounds\n\n`;     for (const s of tech)    md += storyBlock(s); }
  return md;
}

// ─── Main exported function (same pattern as scanMarket in radarService.ts) ───

export async function findUseCases(
  userId: string,
  goal: string,
  level: string = "beginner",
  forceRefresh: boolean = false,
  userBackground?: string
): Promise<UseCasesResult> {
  const serpKey  = (process.env.SERP_API_KEY  || process.env.SERPAPI_KEY || "").trim();
  const serpKey2 = (process.env.SERP_API_KEY_2 || process.env.SERPAPI_KEY_2 || "").trim();
  const openaiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();

  if (!serpKey && !serpKey2)   throw new Error("SERP_API_KEY or SERP_API_KEY_2 is not set in environment variables.");
  if (!openaiKey) throw new Error("OPENAI_API_KEY is not set in environment variables.");
  if (!goal)      throw new Error("goal is required.");

  // Use primary key for cache lookup
  // ── Cache check ───────────────────────────────────────────────────────────────
  const cacheKey = makeCacheKey(goal, level, userBackground);
  if (!forceRefresh) {
    const cached = await getCached(cacheKey);
    if (cached) {
      console.log(`[UseCases] Cache HIT for: ${goal}`);
      return cached;
    }
  }

  console.log(`[UseCases] Searching stories for goal="${goal}" level="${level}" background="${userBackground || 'unknown'}"`);

  // ── Build and fire all search queries in parallel ─────────────────────────────
    const allQueries = buildBroadQueries(goal, level, userBackground);
  console.log(`[UseCases] Running ${allQueries.length} queries...`);

  // Deduplicate in-flight SerpAPI calls using the new serpClient
  const searchBatches = await Promise.allSettled(
    allQueries.map((q) => searchSerp(q, 7))
  );

  const seen = new Set<string>();
  const allResults: SerpResult[] = [];

  for (const batch of searchBatches) {
    if (batch.status !== "fulfilled") continue;
    for (const item of batch.value) {
      if (item.url && !seen.has(item.url)) {
        seen.add(item.url);
        allResults.push(item);
      }
    }
  }

  console.log(`[UseCases] ${allResults.length} unique results collected`);

  // ── Emergency fallback if results are thin ────────────────────────────────────
  let finalResults = allResults;
  if (allResults.length < 15) {
    console.log("[UseCases] Results thin — running fallback searches");
    const fallbackQueries = [
      `career change into ${goal} success story`,
      `how to become ${goal} success story real person`,
      `${goal} career journey story 2023 2024`,
      `career pivot technology ${goal} story`,
      `breaking into tech ${goal} experience`,
    ];
    const fallbackBatches = await Promise.allSettled(
      fallbackQueries.map((q) => searchSerp(q, 10))
    );
    for (const batch of fallbackBatches) {
      if (batch.status !== "fulfilled") continue;
      for (const item of batch.value) {
        if (item.url && !seen.has(item.url)) {
          seen.add(item.url);
          finalResults.push(item);
        }
      }
    }
    console.log(`[UseCases] After fallback: ${finalResults.length} results`);
  }

  if (finalResults.length === 0) {
    throw new Error("SerpAPI returned no results. Check SERP_API_KEY in your secrets panel.");
  }

  // ── GPT-4o extraction — two parallel passes ───────────────────────────────────
  const techPrompt = `The user wants to become: "${goal}" (level: ${level}).
Find and extract 3-4 stories of people who transitioned INTO "${goal}" or a closely related tech role.
These can be from ANY background. Even sparse details are fine.
Search results (${finalResults.length} total):
${JSON.stringify(finalResults.slice(0, 30), null, 2)}`;

  const nonTechPrompt = `The user wants to become: "${goal}" (level: ${level}).
Find and extract 2-3 stories of people from NON-TECH backgrounds (teachers, nurses, accountants, marketers, designers) who transitioned into "${goal}" or similar tech roles.
If you find zero non-tech stories, return { "stories": [] } — DO NOT fabricate.
Search results (${finalResults.length} total):
${JSON.stringify(finalResults.slice(0, 30), null, 2)}`;

  // Fix: these two calls used to fire in the exact same instant. Each one
  // tries Gemini first internally, so a simultaneous burst of 2 was part of
  // the rate-limit problem. A small stagger (plus the retry/backoff now
  // inside callGPT4o) smooths this out without doubling latency the way a
  // fully sequential await would.
    // Deduplicate in-flight AI calls using singleFlight
  const techCallPromise = singleFlight(`gpt4o-tech-${goal}-${level}-${userBackground}`, () => callGPT4o(EXTRACTOR_SYSTEM, techPrompt, openaiKey));
  const nonTechCallPromise = new Promise<string>((resolve, reject) => {
    setTimeout(() => {
      singleFlight(`gpt4o-nontech-${goal}-${level}-${userBackground}`, () => callGPT4o(EXTRACTOR_SYSTEM, nonTechPrompt, openaiKey)).then(resolve, reject);
    }, 600);
  });

  const [techRaw, nonTechRaw] = await Promise.allSettled([
    techCallPromise,
    nonTechCallPromise,
  ]);

  const techStories: Story[] = techRaw.status === "fulfilled"
    ? (safeJSON<{ stories: Story[] }>(techRaw.value, { stories: [] }).stories ?? [])
    : [];

  const nonTechStories: Story[] = nonTechRaw.status === "fulfilled"
    ? (safeJSON<{ stories: Story[] }>(nonTechRaw.value, { stories: [] }).stories ?? [])
    : [];

  techStories.forEach((s)    => { s.background_type = "tech"; });
  nonTechStories.forEach((s) => { s.background_type = "non-tech"; });

  // ── URL verification ──────────────────────────────────────────────────────────
  const allExtracted = [...nonTechStories, ...techStories];
  console.log(`[UseCases] Extracted ${allExtracted.length} stories — verifying URLs...`);

  const withVerification = await Promise.all(
    allExtracted.map(async (s) => {
      if (!s.source_url) return { ...s, source_verified: false };
      const alive = await isLive(s.source_url);
      return { ...s, source_verified: alive };
    })
  );

  // Sort: verified first, then by credibility
  const finalStories = withVerification
    .sort((a, b) => {
      if (a.source_verified && !b.source_verified) return -1;
      if (!a.source_verified && b.source_verified) return 1;
      return (b.credibility_score ?? 0) - (a.credibility_score ?? 0);
    })
    .slice(0, 8);

  const verifiedCount = finalStories.filter((s) => s.source_verified).length;
  console.log(`[UseCases] Final: ${finalStories.length} stories (${verifiedCount} verified)`);

  const stories_md = toMarkdown(finalStories, goal);

  const result: UseCasesResult = {
    success: true,
    goal,
    stories: finalStories,
    stories_md,
    from_cache: false,
  };

  // Cache result
  await setCache(cacheKey, result);

  return result;
}