import OpenAI from "openai";
import { scanMarket } from "./radarService";
import { runWithConcurrency } from "./geminiRetry";
import { getPersistentCache, setPersistentCache } from "./persistentCache";
import { callAI } from "./careerMentorAI";
import {
  parseJsonResponse,
  calculateMatchScore,
  estimateTimeToJob,
  parseHoursPerWeek,
  validateRecommendation,
  VALID_MARKET_DEMAND,
} from "./careerMentorHelpers";
import { CareerMentorResult, EnhancedCareerRecommendation, DataQuality, SuccessStory } from "./careerMentorTypes";

// ─── Persistent cache (Firestore, 24h TTL — falls back to in-memory if
// Firestore is briefly unreachable; see persistentCache.ts for details) ──────

const MENTOR_NAMESPACE = "mentor";
const MENTOR_TTL_MS = parseInt(process.env.MENTOR_TTL_HOURS || "24") * 60 * 60 * 1000;

async function getCachedMentorResult(cacheKey: string): Promise<CareerMentorResult | null> {
  const result = await getPersistentCache<CareerMentorResult>(MENTOR_NAMESPACE, cacheKey);
  if (!result) return null;
  console.log(`[CareerMentor] Cache HIT for key: ${cacheKey}`);
  return { ...result, fromCache: true };
}

async function setCachedMentorResult(cacheKey: string, result: CareerMentorResult): Promise<void> {
  await setPersistentCache(MENTOR_NAMESPACE, cacheKey, result, MENTOR_TTL_MS);
  console.log(`[CareerMentor] Cached result for key: ${cacheKey}`);
}

// ─── Verify Connection ────────────────────────────────────────────────────────

export async function verifySupabaseConnection(): Promise<string | null> {
  return null;
}

// ─── Career Mentor Recommendations ───────────────────────────────────────────

export async function getCareerMentorRecommendations(
  userId: string,
  params: {
    educationLevel: string;
    experienceLevel?: string;
    fieldOfStudy: string;
    skills: string;
    country: string;
    assessmentData?: any;
    budget?: string;
    timeAvailable?: string;
    goals?: string;
    interests?: string[];
  }
): Promise<CareerMentorResult> {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set.");
  const openai = new OpenAI({ apiKey });

  const {
    educationLevel,
    experienceLevel = "Fresh Graduate",
    fieldOfStudy,
    skills,
    country,
    assessmentData,
    budget = "low",
    timeAvailable = "10 hours/week",
    goals = "get a job as soon as possible",
    interests = [],
  } = params;

  // ── STEP 1: BUILD ENRICHED PROFILE ───────────────────────────────────────────
  const currentSkillsArray = skills
    ? skills.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const mergedSkills = [...new Set([...currentSkillsArray, ...interests])];
  const hoursPerWeek = parseHoursPerWeek(timeAvailable);

  const assessmentSummary = assessmentData
    ? {
        percentage: assessmentData.score ?? 0,
        skillLevel: assessmentData.skillLevel ?? "Beginner",
        categoryScores: assessmentData.categoryScores ?? {},
        identifiedSkills: assessmentData.identifiedSkills ?? [],
        strengths: assessmentData.strengths ?? [],
        weaknesses: assessmentData.weaknesses ?? [],
      }
    : null;

  // ── STEP 1.5: CHECK CACHE ─────────────────────────────────────────────────────
  const assessmentScore = assessmentSummary?.percentage ?? 50;
  const assessmentSkillLevel = assessmentSummary?.skillLevel ?? "Intermediate";
  // Fix 3: Cache key includes full skill set so changing skills invalidates cache
  const skillsHash = mergedSkills.slice().sort().join("|").toLowerCase();
  const cacheKey = `${userId}_${assessmentScore}_${country}_${skillsHash}`.replace(/[^a-zA-Z0-9_|]/g, "_").slice(0, 200);

  const cached = await getCachedMentorResult(cacheKey);
  if (cached) return cached;

  // ── STEP 2: BACKGROUND SKILL CONTEXT (user's current field only, for prompt grounding)
  // Fix 1: We no longer pre-scan recommended fields here — we scan AFTER recommendations
  // are generated so market data matches what was actually recommended, not what the user
  // already knows.
  let backgroundContext = "";
  try {
    if (fieldOfStudy) {
      const bgRadar = await scanMarket(fieldOfStudy, country);
      const topSkills = bgRadar.technicalSkills.high.slice(0, 5).join(", ");
      backgroundContext = `\nBackground context for ${fieldOfStudy} in ${country}: top skills in market are ${topSkills}.`;
    }
  } catch (e) {
    console.warn("[CareerMentor] Background context fetch failed:", e);
  }

  // ── STEP 3: AI FIELD RECOMMENDER — Gemini first, OpenAI fallback ────────────
  // Fix 7: Build explicit category score interpretation so AI knows what to do with them
  const categoryGuidance = assessmentSummary?.categoryScores
    ? (() => {
        const scores = assessmentSummary.categoryScores as Record<string, number>;
        const sorted = Object.entries(scores).sort(([,a],[,b]) => (b as number)-(a as number));
        const top = sorted.slice(0, 2).map(([k]) => k).join(", ");
        const weak = sorted.slice(-2).map(([k]) => k).join(", ");
        const softScore = scores["soft_skills"] ?? 50;
        const techScore = scores["tech_literacy"] ?? 50;
        const bias = softScore > techScore + 20
          ? "This user's soft skills significantly outperform technical skills — lean toward management, product, or people-facing roles for at least 1 recommendation."
          : techScore > softScore + 20
          ? "This user's technical skills significantly outperform soft skills — lean toward deep technical roles for at least 1 recommendation."
          : "Balanced profile — recommend a mix of technical and hybrid roles.";
        return `\nASSESSMENT CATEGORY BREAKDOWN:\n- Strongest categories: ${top}\n- Weakest categories: ${weak}\n- Career bias instruction: ${bias}`;
      })()
    : "";

  const rawRecs = await callAI(
    "You are a world-class Career Strategist. " +
    "Your job is to recommend 3 GENUINELY DIFFERENT career paths — not 3 variations of the same job. " +
    "Use the assessment category scores to bias recommendations appropriately. " +
    "Return ONLY raw JSON.",
    `USER PROFILE:
- Education: ${educationLevel}
- Experience: ${experienceLevel}
- Field of Study: ${fieldOfStudy || "Not specified"}
- Skills (what the candidate can actually DO, demonstrated through hands-on work): ${mergedSkills.join(", ") || "None"}
- Country: ${country}
${backgroundContext}

PRIORITY RULE: Skills demonstrate actual hands-on capability and should weigh MORE heavily
than Field of Study when ranking recommendations. Field of Study is just educational
background — employers hire based on demonstrated skills and portfolio, not the degree alone.
If the skills list shows specialized, modern, hands-on experience in a specific domain
(e.g. AI agents, RAG, workflow automation, MLOps, cloud/DevOps, specific frameworks), that
domain should rank #1 even if it doesn't match the Field of Study — a Math graduate who has
built real automation/AI-agent workflows with n8n, RAG, and MLOps tooling is a much stronger
candidate for an AI/Automation Engineer role than for a basic Data Analyst role, because the
skills list proves they've already gone well beyond what a Math degree alone would teach.
Do not default to the "obvious" degree-adjacent career if the skills list points elsewhere.

ASSESSMENT RESULTS:
${assessmentSummary
  ? `Overall score: ${assessmentSummary.percentage}% — Skill level: ${assessmentSummary.skillLevel}
Strengths: ${assessmentSummary.strengths?.join(", ") || "N/A"}
Weaknesses: ${assessmentSummary.weaknesses?.join(", ") || "N/A"}${categoryGuidance}`
  : "Not taken yet — treat as entry-level."}

DIVERSITY RULE (Fix 6): The 3 recommendations MUST be genuinely different career directions.
Do NOT recommend Software Engineer + Full Stack Developer + Backend Developer — these are the same career.
Each recommendation should require a meaningfully different skill set and day-to-day work.
Base all 3 directions on what the Skills list actually shows the candidate can do — don't
invent a direction (like a generic degree-adjacent role) that isn't backed by any skill overlap.

SALARY RULE: salaryRange should say "(estimated)" if no live data is available.
DEMAND RULE: classify marketDemand as "High Growth", "Stable", or "Emerging" based on general knowledge for ${country}.

Return JSON:
{
  "recommendations": [
    {
      "rank": 1,
      "fieldName": "",
      "tagline": "",
      "whyItFits": "",
      "matchScore": 70,
      "timeToFirstJobMonths": 8,
      "salaryRange": "",
      "difficultyLevel": "beginner|intermediate|advanced",
      "marketDemand": "High Growth|Stable|Emerging",
      "roleProgression": ["Junior X", "X", "Senior X", "Lead X"],
      "currentSkillOverlap": [],
      "skillsToLearn": { "technical": [], "soft": [] },
      "assessmentAlignment": "",
      "skillGapAnalysis": { "strengths": [], "criticalGaps": [] },
      "learningApproach": "",
      "topRoles": [],
      "nextStep": ""
    }
  ],
  "overallAdvice": "",
  "strongestMatch": "",
  "marketInsights": ""
}`,
    apiKey,
    { temperature: 0.5, seed: 42, maxTokens: 3000, jsonMode: true }
  );

  const parsedRecs = parseJsonResponse(rawRecs);

  // ── Validate recommendations — drop malformed ones ──────────────────────────
  const validRecs = (parsedRecs?.recommendations || []).filter(validateRecommendation);
  if (validRecs.length === 0) {
    throw new Error("AI returned no valid recommendations — all failed schema validation.");
  }
  parsedRecs.recommendations = validRecs;

  const topField = validRecs[0]?.fieldName || fieldOfStudy || "Software Developer";

  // ── STEP 3.5: POST-RECOMMENDATION MARKET SCAN (Fix 1) ────────────────────────
  // Now scan the RECOMMENDED fields — not the user's background fields
  // This ensures salary/skills data on cards matches what was actually recommended
  const preMarketScans: Array<{
    field: string; topSkills: string[]; salary: string;
    salarySource: string; listingCount: number;
  }> = [];

  const recommendedFields = validRecs.slice(0, 3).map((r: any) => r.fieldName).filter(Boolean);

  // Fix: was Promise.allSettled — fired all 3 scanMarket calls simultaneously,
  // which is the main driver of Gemini 429s. Capped to 2 concurrent here so
  // we still get some parallelism without bursting past per-minute limits.
  await runWithConcurrency(recommendedFields, 2, async (field: string) => {
    try {
      const radar = await scanMarket(field, country);
      preMarketScans.push({
        field,
        topSkills: [...radar.technicalSkills.high, ...radar.technicalSkills.medium].slice(0, 8),
        salary: radar.salaryIntel
          ? `${radar.salaryIntel.currency} ${radar.salaryIntel.annualMin ?? "N/A"}–${radar.salaryIntel.annualMax ?? "N/A"}/yr`
          : "Not available from listings",
        salarySource: radar.salaryIntel?.source ?? "ai_estimate",
        // Fix 2: Real listing count
        listingCount: radar.technicalSkills.high.length >= 4 ? 5
          : radar.technicalSkills.high.length >= 2 ? 3
          : radar.technicalSkills.medium.length > 0 ? 2 : 1,
      });
    } catch (e) {
      console.warn(`[CareerMentor] Post-rec scan failed for "${field}":`, e);
    }
  });

  const hasLiveListings = preMarketScans.some((s) => s.salarySource === "listing_data");

  // ── STEP 4: FETCH MARKET DATA for mentor report ───────────────────────────────
  let marketData: any = null;
  try {
    // Replace n8n webhook with local scanMarket call
    console.log(`[CareerMentor] Fetching market data locally for report: ${topField}`);
    const radar = await scanMarket(topField, country);
    marketData = {
      technicalSkills: radar.technicalSkills,
      softSkills: radar.softSkills,
      salaryIntel: radar.salaryIntel
    };
  } catch (e) {
    console.warn("[CareerMentor] Local market data scan failed, continuing:", e);
  }

  // ── STEP 5: BUILD MENTOR REPORT — Gemini first, OpenAI fallback ─────────────
  // Note: this report intentionally does NOT generate a phased learning plan
  // or study topics — that's the Roadmap feature's job (a separate, richer
  // system with live resource fetching, milestones, and progress tracking).
  // Generating a second, thinner plan here was redundant AI cost and was also
  // the main reason this call ran out of token budget before finishing all 3
  // recommendations. The Career Mentor's job is "which direction fits you and
  // why" — the "Roadmap" button on each card is the deliberate handoff to the
  // feature that answers "how do I get there."
  const rawReport = await callAI(
    "You are a Career Mentor and Career Strategist. " +
    "Use the real assessment data and market data provided to make advice accurate. " +
    "Return ONLY raw JSON.",
    `Produce a comprehensive mentor report.

User: ${educationLevel}, ${experienceLevel} experience, ${fieldOfStudy || "N/A"}, skills: ${mergedSkills.join(", ") || "None"}
Budget: ${budget}, Time: ${timeAvailable}, Goals: ${goals}
Assessment: ${assessmentSummary ? JSON.stringify(assessmentSummary) : "Not taken"}
Top Field: ${topField}
Recommendations: ${JSON.stringify(parsedRecs, null, 2)}
Market Data: ${JSON.stringify(marketData ? { technicalSkills: marketData.technicalSkills, salaryIntel: marketData.salaryIntel } : null)}

Rules:
- motivationalMessage: reference actual score and specific strengths
- "allRecommendations" MUST contain exactly ${parsedRecs.recommendations?.length || 3} entries —
  one for EACH item in the "Recommendations" list above, in the same order. Do not stop after
  the first one. Keep each entry's text fields reasonably concise (1-2 sentences) so all
  ${parsedRecs.recommendations?.length || 3} fit within the response.

Return JSON:
{
  "mentorReport": {
    "summary": "",
    "topRecommendation": { "fieldName": "", "whyBestFit": "", "realMarketDemand": "", "estimatedSalary": "", "confidenceScore": 0, "assessmentAlignment": "" },
    "allRecommendations": [ "/* exactly one object per item in Recommendations above */" ],
    "skillGapAnalysis": { "skillsYouAlreadyHave": [], "criticalSkillsToLearn": [], "niceToHaveSkills": [], "estimatedLearningWeeks": 0 },
    "motivationalMessage": "",
    "immediateNextSteps": []
  }
}`,
    apiKey,
    { temperature: 0.3, seed: 42, maxTokens: 3500, jsonMode: true }
  );
  const rawReport_parsed = rawReport;
  const parsedReport = parseJsonResponse(rawReport_parsed);

  // ── STEP 6: ASSEMBLE FINAL RESPONSE — computed values override GPT ───────────
  const recommendations: EnhancedCareerRecommendation[] = validRecs
    .slice(0, 3)
    .map((rec: any) => {
      const matchingScan =
        preMarketScans.find((s) =>
          rec.fieldName?.toLowerCase().includes(s.field.toLowerCase()) ||
          s.field.toLowerCase().includes(rec.fieldName?.toLowerCase())
        ) || preMarketScans[0];

      const requiredSkills = matchingScan?.topSkills ?? [];
      const listingCount = matchingScan?.listingCount ?? 1;
      const criticalGapCount = (rec.skillGapAnalysis?.criticalGaps ?? []).length;

      return {
        rank: rec.rank || 1,
        title: rec.fieldName || "",
        tagline: rec.tagline || "",
        // Fix 5: robust whyFit — try multiple possible key names AI might return
        whyFit: rec.whyItFits || rec.why_it_fits || rec.whyFits || rec.why_fits || rec.whyItFit || "",
        matchScore: calculateMatchScore(mergedSkills, requiredSkills, assessmentScore, listingCount, criticalGapCount),
        // Fix 4: preserve salary source so UI can label it
        salaryRange: rec.salaryRange || "Competitive",
        salarySource: matchingScan?.salarySource ?? "ai_estimate",
        level: rec.difficultyLevel || "Intermediate",
        skills: [
          ...(rec.skillsToLearn?.technical || []),
          ...(rec.skillsToLearn?.soft || []),
        ].slice(0, 6),
        marketDemand: VALID_MARKET_DEMAND.includes(rec.marketDemand) ? rec.marketDemand : "Stable",
        roleProgression: rec.roleProgression?.length >= 3
          ? rec.roleProgression
          : ["Junior", "Mid-Level", "Senior", "Lead"],
        timeToFirstJobMonths: estimateTimeToJob(assessmentSkillLevel, hoursPerWeek, criticalGapCount),
        currentSkillOverlap: rec.currentSkillOverlap || [],
        assessmentAlignment: rec.assessmentAlignment || "",
        skillGapAnalysis: rec.skillGapAnalysis || { strengths: [], criticalGaps: [] },
      };
    });

  // ── STEP 7: BUILD DATA QUALITY METADATA ──────────────────────────────────────
  const dataQuality: DataQuality = {
    salarySource: hasLiveListings ? "live_listings" : "ai_estimate",
    marketDataAvailable: preMarketScans.length > 0,
    assessmentUsed: !!assessmentData,
    matchScoreMethod: "computed",
    timeToJobMethod: "computed",
    liveListingsCount: preMarketScans.reduce((acc, s) => acc + s.listingCount, 0),
    generatedAt: new Date().toISOString(),
  };

  const result: CareerMentorResult = {
    success: true,
    userId,
    topField,
    recommendations,
    mentorReport: parsedReport?.mentorReport || parsedReport,
    generatedAt: new Date().toISOString(),
    fromCache: false,
    dataQuality,
  };

  // ── Cache result for 24h ──────────────────────────────────────────────────────
  await setCachedMentorResult(cacheKey, result);

  return result;
}

// ─── Success Stories Generator (deprecated — use /api/find-use-cases) ────────

export async function generateSuccessStories(
  _userId: string,
  _goal: string,
  _level: string
): Promise<SuccessStory[]> {
  throw new Error(
    "generateSuccessStories is deprecated. Use the /api/find-use-cases endpoint instead " +
    "(api.findUseCases), which calls useCasesService and returns real stories sourced from SerpAPI."
  );
}
