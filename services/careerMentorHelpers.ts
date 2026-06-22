/**
 * Pure, stateless helper functions extracted from careerMentorService.ts.
 *
 * These have zero dependency on AI calls, Firestore, or any other part of
 * careerMentorService.ts — they're plain functions of their inputs, used
 * across all three features in that file (quiz generation, adaptive
 * assessment, and career mentor recommendations). Extracting them shrinks
 * the main file and makes them independently testable/reusable, with no
 * behavior change — every function body here is identical to the original.
 *
 * NOTE: careerMentorService.ts itself still contains three large,
 * feature-specific blocks (quiz generation, the multi-stage adaptive
 * assessment, and mentor recommendations) that share some of THESE helpers
 * but aren't yet split from each other — that's a bigger, separate task.
 */

// ─── Category labels ──────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  logical_thinking: "Logical Thinking",
  tech_literacy: "Tech Literacy",
  problem_solving: "Problem Solving",
  soft_skills: "Soft Skills",
  career_awareness: "Career Awareness",
};

export const VALID_MARKET_DEMAND = ["High Growth", "Stable", "Emerging"] as const;

// ─── Helper: derive strengths/weaknesses from real category scores ────────────

export function deriveStrengths(categoryScores: Record<string, number>): string[] {
  return Object.entries(categoryScores)
    .filter(([, score]) => score >= 70)
    .sort(([, a], [, b]) => b - a)
    .map(([cat]) => `Strong ${CATEGORY_LABELS[cat] ?? cat}`);
}

export function deriveWeaknesses(categoryScores: Record<string, number>): string[] {
  return Object.entries(categoryScores)
    .filter(([, score]) => score < 50)
    .sort(([, a], [, b]) => a - b)
    .map(([cat]) => `Develop ${CATEGORY_LABELS[cat] ?? cat}`);
}

// ─── Helper: compute matchScore from real data ────────────────────────────────
// Produces a score that varies meaningfully between recommendations:
// - Skill overlap (up to 40pts): how many of the role's required skills the user has
// - Assessment contribution (up to 30pts): their assessment score scaled down
// - Demand bonus (up to 20pts): how many live listings exist for this role
// - Gap penalty (up to -15pts): deducted for every critical skill gap the user is missing
// Net range: ~25–100. Min floor of 30 so no recommendation looks hopeless.

export function calculateMatchScore(
  userSkills: string[],
  requiredSkills: string[],
  assessmentScore: number,
  listingCount: number,
  criticalGapCount: number = 0
): number {
  const normalizedRequired = requiredSkills.map((s) => s.toLowerCase());
  const overlap = userSkills.filter((s) =>
    normalizedRequired.some(
      (r) => r.includes(s.toLowerCase()) || s.toLowerCase().includes(r)
    )
  ).length;
  // Skill overlap: up to 40 points
  const overlapScore = normalizedRequired.length > 0
    ? Math.min(40, (overlap / normalizedRequired.length) * 40)
    : 20; // neutral if no required skills known
  // Assessment: up to 30 points
  const assessmentContrib = (assessmentScore / 100) * 30;
  // Demand: up to 20 points
  const demandScore = listingCount >= 10 ? 20 : listingCount >= 5 ? 15 : listingCount >= 2 ? 10 : 5;
  // Gap penalty: -5 per critical gap, up to -15
  const gapPenalty = Math.min(15, criticalGapCount * 5);
  return Math.round(Math.max(30, Math.min(100, overlapScore + assessmentContrib + demandScore - gapPenalty)));
}

// ─── Helper: estimate timeToFirstJob from real inputs ────────────────────────

export function estimateTimeToJob(
  skillLevel: string,
  hoursPerWeek: number,
  criticalGapCount: number
): number {
  const baseWeeks: Record<string, number> = {
    Beginner: 52, Intermediate: 26, Advanced: 12, Expert: 6,
  };
  const base = baseWeeks[skillLevel] ?? 26;
  const hoursFactor = hoursPerWeek >= 20 ? 0.6 : hoursPerWeek >= 10 ? 1.0 : 1.4;
  const gapFactor = 1 + criticalGapCount * 0.08;
  return Math.max(2, Math.round((base * hoursFactor * gapFactor) / 4.33));
}

// ─── Helper: parse hours/week from string ────────────────────────────────────

export function parseHoursPerWeek(timeAvailable: string): number {
  const match = timeAvailable.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 10;
}

// ─── Helper: validate a recommendation object ─────────────────────────────────

export function validateRecommendation(rec: any): boolean {
  return (
    typeof rec.fieldName === "string" && rec.fieldName.length > 0 &&
    typeof rec.salaryRange === "string" &&
    VALID_MARKET_DEMAND.includes(rec.marketDemand) &&
    Array.isArray(rec.roleProgression) && rec.roleProgression.length >= 3
  );
}

// ─── JSON Parser ──────────────────────────────────────────────────────────────
// AI responses are sometimes wrapped in markdown code fences, or have stray
// text before/after the actual JSON — this extracts the JSON regardless.

/**
 * Finds the end index of a JSON value (object or array) starting at
 * `start`, by walking forward and tracking nesting depth — string-aware,
 * so braces/brackets inside string values don't throw off the count.
 * Returns -1 if no balanced close is found.
 *
 * This replaces a previous `lastIndexOf('}')`/`lastIndexOf(']')` approach,
 * which could grab the WRONG closing brace if the AI added trailing text
 * containing a stray brace after the real JSON (e.g. "...} Hope that
 * helps! }"  — lastIndexOf would have grabbed the second one).
 */
function findBalancedEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escapeNext = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Last-resort cleanup for the most common LLM JSON mistake: trailing
 * commas before a closing brace/bracket (e.g. `{"a": 1,}` or `[1, 2,]`),
 * which JSON.parse rejects outright. Only used as a fallback when a
 * direct parse already failed — never silently applied to valid JSON.
 */
function stripTrailingCommas(text: string): string {
  return text.replace(/,(\s*[}\]])/g, "$1");
}

export function parseJsonResponse(raw: string): any {
  let cleaned = raw.trim();
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```+(?:json)?/i, "").replace(/```+$/i, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let start = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
    } else if (firstBracket !== -1) {
      start = firstBracket;
    }

    if (start !== -1) {
      const end = findBalancedEnd(cleaned, start);
      if (end !== -1) {
        const maybeJson = cleaned.substring(start, end + 1);
        try {
          return JSON.parse(maybeJson);
        } catch {
          // Most common remaining failure: trailing commas. Try once more
          // before giving up.
          try {
            return JSON.parse(stripTrailingCommas(maybeJson));
          } catch (e: any) {
            throw new Error(`AI returned invalid JSON: ${e.message}`);
          }
        }
      }
    }
    throw new Error("AI returned invalid JSON — no JSON object or array found in response");
  }
}