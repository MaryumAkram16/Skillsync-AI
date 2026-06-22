import admin, { adminDb } from "./firebaseAdmin";
import { callAI } from "./careerMentorAI";
import {
  parseJsonResponse,
  deriveStrengths,
  deriveWeaknesses,
  CATEGORY_LABELS,
} from "./careerMentorHelpers";
import {
  buildAssessmentProfile,
  generateAndValidateQuiz,
  gradeQuizLocally,
} from "./careerMentorQuizShared";
import { QuizQuestion, BuiltProfile, AdaptiveSessionState, InterestWithProficiency } from "./careerMentorTypes";

// ═══════════════════════════════════════════════════════════════════════════
// ─── TIER 3: ADAPTIVE ASSESSMENT (multi-stage, performance-branched) ───────
// ═══════════════════════════════════════════════════════════════════════════
//
// Flow:
//   1. generateAssessmentStage1()   → 5 baseline questions, saved to Firestore
//   2. analyzeStage1AndGenerateStage2() → grades Stage 1 locally (no AI),
//      then asks the AI for 5 Stage 2 questions branched on that performance.
//      Retries once on failure; on a second failure, falls back to a fixed
//      (non-adaptive) Stage 2 so the user is never stranded mid-assessment.
//   3. submitAdaptiveAssessment()   → merges Stage 1 + Stage 2 answers,
//      grades everything locally, adds misconception tracking, AI writes
//      narrative only (same "AI never touches the score" pattern as the
//      legacy submitAssessment).
//
// Session persistence uses firebase-admin directly (NOT persistentCache's
// client SDK). Why: ai_cache_assessment_session has owner-restricted rules
// (`isOwner(sessionId)` requiring request.auth.uid == userId), because this
// is real per-user session state, not a disposable shared AI-response cache
// like the other ai_cache_* collections. persistentCache.ts's client SDK
// instance is never signed in (by design — that's correct for the genuinely
// public caches), so request.auth is always null there and every write to
// an owner-restricted collection would be silently rejected by the rules,
// falling back to the per-instance in-memory Map — which doesn't survive
// Cloud Run routing a later stage to a different instance. Admin SDK
// bypasses rules entirely, which is fine here because the caller (this
// file) only ever reaches these functions with a userId that's already been
// verified one layer up by requireAuth in server.ts.
const SESSION_COLLECTION = "ai_cache_assessment_session";

// In-memory fallback for the rare case Firestore/ADC is unreachable (e.g. no
// metadata server in a sandboxed/local dev environment). Same pattern as
// persistentCache.ts: this only matters for local/dev testing — on real
// Cloud Run infrastructure ADC resolves fine and this fallback never engages.
const sessionMemFallback = new Map<string, AdaptiveSessionState | null>();

async function saveAdaptiveSessionDoc(userId: string, value: AdaptiveSessionState | null, ttlMs: number): Promise<void> {
  sessionMemFallback.set(userId, value);
  try {
    await adminDb.collection(SESSION_COLLECTION).doc(userId).set({
      value,
      expiresAt: Date.now() + ttlMs,
      cachedAt: Date.now(),
    });
  } catch (err: any) {
    console.warn(`[AdaptiveSession] Firestore write failed, kept in memory only:`, err.message);
  }
}

async function getAdaptiveSessionDoc(userId: string): Promise<AdaptiveSessionState | null> {
  try {
    const snap = await adminDb.collection(SESSION_COLLECTION).doc(userId).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data || (data.expiresAt ?? 0) < Date.now()) return null;
    return (data.value ?? null) as AdaptiveSessionState | null;
  } catch (err: any) {
    console.warn(`[AdaptiveSession] Firestore read failed, falling back to memory:`, err.message);
    return sessionMemFallback.get(userId) ?? null;
  }
}

const ASSESSMENT_SESSION_TTL_MS = 60 * 60 * 1000; // 1h — enough to finish a quiz, not a permanent record

async function saveAdaptiveSession(userId: string, state: AdaptiveSessionState): Promise<void> {
  await saveAdaptiveSessionDoc(userId, state, ASSESSMENT_SESSION_TTL_MS);
}

async function getAdaptiveSession(userId: string): Promise<AdaptiveSessionState | null> {
  return getAdaptiveSessionDoc(userId);
}

// ─── Stage 1: baseline questions (5) ────────────────────────────────────────

export async function generateAssessmentStage1(
  userId: string,
  interests: string[] | InterestWithProficiency[],
  educationLevel: string,
  country: string
): Promise<{ quiz: QuizQuestion[]; stage: 1 }> {
  const { checkAssessmentLimit } = await import("./careerMentorAssessment");
  await checkAssessmentLimit(userId);

  const apiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
  const geminiKey = (process.env.CAREER_MENTOR_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || "").trim();
  // OpenAI is now only a fallback (generation) or unused entirely
  // (validation, which is Gemini-only by design) — so an OpenAI key alone
  // is no longer required as long as Gemini is configured. We still pass
  // `apiKey` through so the gemini-first fallback path works if Gemini
  // fails mid-flow and an OpenAI key happens to be available.
  if (!apiKey && !geminiKey) throw new Error("No AI key available. Set GEMINI_API_KEY or OPENAI_API_KEY.");

  const { perSkillRules, softSkillLines, educationBaseline, marketContext } =
    await buildAssessmentProfile(interests, educationLevel, country);

  const systemMessage = `You are an expert Career Coach and Skills Assessor running STAGE 1 of a two-stage adaptive assessment.
Generate exactly 5 BASELINE questions that establish the user's starting level. These should be
moderate difficulty — neither trivially easy nor expert-level — because Stage 2's difficulty will be
calibrated based on how well the user does here. Every question must feel personalised, not generic.

═══ USER PROFILE ═══
Education : ${educationLevel} — ${educationBaseline}
Country   : ${country}

═══ SKILL-BY-SKILL DIFFICULTY (follow these exactly) ═══
${perSkillRules || "• General technical interest [INTERMEDIATE] → real-world practical questions"}

═══ SOFT SKILLS ═══
${softSkillLines}

${marketContext || `No live market data. Use general knowledge about in-demand skills for ${country}.`}

═══ STAGE 1 DISTRIBUTION (exactly 5 questions) ═══
1. tech_literacy     — 2 Qs — Pick 2 DIFFERENT technical skills. Baseline difficulty for each.
2. logical_thinking  — 1 Q  — Reasoning scaled to education level above
3. problem_solving   — 1 Q  — Real-world scenario using their actual skill set
4. soft_skills       — 1 Q  — Behavioural scenario tied to their specific soft skills

═══ QUALITY RULES ═══
- Reference the user's actual skills by name — never generic questions
- Wrong options must be common real-world misconceptions, not obviously silly
- Never test the same skill twice
- correct_answer must be factually verified — one of "A","B","C","D" only
- explanation: one sentence why that answer is correct

Return ONLY raw JSON:
{
  "quiz": [
    {
      "question": "string",
      "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
      "correct_answer": "A",
      "category": "tech_literacy",
      "difficulty": "easy|medium|hard",
      "skillsInvolved": ["skill1"],
      "explanation": "Why this answer is correct"
    }
  ]
}`;

  const stage1Quiz = await generateAndValidateQuiz(systemMessage, apiKey);

  // Persist the session now — even if the user never reaches Stage 2 analysis,
  // we have a record. Stage1Answers/scores are filled in at analysis time.
  await saveAdaptiveSession(userId, {
    userId,
    stage1Quiz,
    stage1Answers: [],
    stage1CategoryScores: {},
    stage1Score: 0,
    educationLevel,
    country,
    interests,
    createdAt: Date.now(),
  });

  // Increment assessmentCount in user metadata
  await adminDb.collection("users").doc(userId).set({
    metadata: {
      assessmentCount: admin.firestore.FieldValue.increment(1)
    }
  }, { merge: true }).catch(err => {
    console.warn("Failed to increment user assessment count:", err.message);
  });

  return { quiz: stage1Quiz, stage: 1 };
}

// ─── Stage 2: analyze Stage 1, generate branched questions ─────────────────

function buildFallbackStage2Prompt(profile: BuiltProfile, educationLevel: string, country: string): string {
  // Non-adaptive fallback: same shape/difficulty distribution as Stage 1,
  // just without performance branching. Used only if AI generation for the
  // real adaptive Stage 2 fails twice in a row, so the user always gets a
  // complete 10-question assessment rather than getting stuck.
  return `You are an expert Career Coach and Skills Assessor running STAGE 2 of a two-stage assessment.
Generate exactly 5 questions at INTERMEDIATE difficulty covering different skills than would typically
appear in a baseline round. Every question must feel personalised, not generic.

═══ USER PROFILE ═══
Education : ${educationLevel} — ${profile.educationBaseline}
Country   : ${country}

═══ SKILL-BY-SKILL DIFFICULTY (follow these exactly) ═══
${profile.perSkillRules || "• General technical interest [INTERMEDIATE] → real-world practical questions"}

═══ SOFT SKILLS ═══
${profile.softSkillLines}

═══ STAGE 2 DISTRIBUTION (exactly 5 questions) ═══
1. tech_literacy     — 2 Qs — Different skills than typically tested in Stage 1
2. problem_solving   — 1 Q
3. soft_skills        — 1 Q
4. career_awareness  — 1 Q — ${profile.marketContext ? "Use the market data provided." : `General job market knowledge for ${country}.`}
${profile.marketContext}

═══ QUALITY RULES ═══
- Reference the user's actual skills by name — never generic questions
- Wrong options must be common real-world misconceptions, not obviously silly
- correct_answer must be factually verified — one of "A","B","C","D" only
- explanation: one sentence why that answer is correct

Return ONLY raw JSON:
{ "quiz": [ { "question": "string", "options": { "A": "string", "B": "string", "C": "string", "D": "string" }, "correct_answer": "A", "category": "tech_literacy", "difficulty": "medium", "skillsInvolved": ["skill1"], "explanation": "..." } ] }`;
}

export async function analyzeStage1AndGenerateStage2(
  userId: string,
  stage1Answers: string[]
): Promise<{
  quiz: QuizQuestion[];
  stage: 2;
  stage1Score: number;
  stage1CategoryScores: Record<string, number>;
  adaptive: boolean; // false if we had to fall back to the non-adaptive Stage 2
}> {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
  const geminiKey = (process.env.CAREER_MENTOR_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || "").trim();
  if (!apiKey && !geminiKey) throw new Error("No AI key available. Set GEMINI_API_KEY or OPENAI_API_KEY.");

  const session = await getAdaptiveSession(userId);
  if (!session || !session.stage1Quiz?.length) {
    throw new Error(
      "No active Stage 1 session found. The assessment session may have expired (1h limit) — please restart the assessment."
    );
  }

  // ── Grade Stage 1 locally — deterministic, no AI ───────────────────────────
  const { score: stage1Score, categoryScores: stage1CategoryScores } =
    gradeQuizLocally(session.stage1Quiz, stage1Answers);

  // Persist graded Stage 1 results so submitAdaptiveAssessment can merge later
  // even if this server instance restarts before Stage 2 finishes.
  await saveAdaptiveSession(userId, {
    ...session,
    stage1Answers,
    stage1Score,
    stage1CategoryScores,
  });

  const profile = await buildAssessmentProfile(session.interests, session.educationLevel, session.country);

  // ── Build branching instructions from real Stage 1 performance ────────────
  const weakCategories = Object.entries(stage1CategoryScores).filter(([, s]) => s < 50).map(([c]) => c);
  const strongCategories = Object.entries(stage1CategoryScores).filter(([, s]) => s >= 80).map(([c]) => c);

  const branchingInstructions = `
═══ STAGE 1 PERFORMANCE (use this to calibrate Stage 2 difficulty) ═══
Overall Stage 1 score: ${stage1Score}%
Category breakdown: ${JSON.stringify(stage1CategoryScores)}
${weakCategories.length > 0
    ? `Weak categories (<50%): ${weakCategories.join(", ")} → generate EASIER, foundational diagnostic questions in these categories to pinpoint the specific gap. Do not pile on more hard questions where the user is already struggling.`
    : ""}
${strongCategories.length > 0
    ? `Strong categories (≥80%): ${strongCategories.join(", ")} → generate HARDER questions in these categories (architecture, optimization, edge cases) to confirm genuine mastery vs. lucky guessing.`
    : ""}
${weakCategories.length === 0 && strongCategories.length === 0
    ? "Performance was middling across categories → generate INTERMEDIATE difficulty questions across the board."
    : ""}

═══ MISCONCEPTION-AWARE OPTIONS ═══
For each question, make wrong options represent plausible misconceptions a real learner at this level
would have — not random distractors. This lets later analysis tell "doesn't know" apart from "has a
specific wrong mental model."`;

  const systemMessage = `You are an expert Career Coach and Skills Assessor running STAGE 2 of a two-stage ADAPTIVE assessment.
Generate exactly 5 questions whose difficulty and focus are branched on the user's real Stage 1 performance below.
Every question must feel personalised, not generic.

═══ USER PROFILE ═══
Education : ${session.educationLevel} — ${profile.educationBaseline}
Country   : ${session.country}

═══ SKILL-BY-SKILL DIFFICULTY (follow these exactly) ═══
${profile.perSkillRules || "• General technical interest [INTERMEDIATE] → real-world practical questions"}

═══ SOFT SKILLS ═══
${profile.softSkillLines}

${branchingInstructions}

${profile.marketContext || `No live market data. Use general knowledge about in-demand skills for ${session.country}.`}

═══ STAGE 2 DISTRIBUTION (exactly 5 questions) ═══
1. tech_literacy     — 2 Qs — Branch difficulty per the performance data above. Different skills than Stage 1 covered.
2. problem_solving   — 1 Q  — Branch difficulty per the performance data above.
3. soft_skills       — 1 Q
4. career_awareness  — 1 Q  — Job market realities for ${session.country}

═══ QUALITY RULES ═══
- Reference the user's actual skills by name — never generic questions
- Never repeat a skill already tested in Stage 1: ${session.stage1Quiz.flatMap(q => q.skillsInvolved || []).join(", ") || "none recorded"}
- correct_answer must be factually verified — one of "A","B","C","D" only
- explanation: one sentence why that answer is correct

Return ONLY raw JSON:
{
  "quiz": [
    {
      "question": "string",
      "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
      "correct_answer": "A",
      "category": "tech_literacy",
      "difficulty": "easy|medium|hard",
      "skillsInvolved": ["skill1"],
      "explanation": "Why this answer is correct"
    }
  ]
}`;

  // ── Generate Stage 2 with one retry, then fall back to non-adaptive ───────
  // Cost note: attempts 1-2 use the default "gemini-first" provider (via
  // generateAndValidateQuiz's default), so they still fall back to OpenAI
  // if Gemini itself is down — we want the ADAPTIVE attempt to have the
  // best chance of succeeding. The final non-adaptive fallback is pinned
  // to Gemini-only: by this point we've already tried Gemini-then-OpenAI
  // twice, so trying OpenAI a third time buys nothing new: if Gemini is
  // down, Gemini-only fails fast and cheaply; if Gemini is actually fine
  // and it was the adaptive prompt/JSON that tripped validation, Gemini-only
  // succeeds without ever touching OpenAI.
  let stage2Quiz: QuizQuestion[] = [];
  let adaptive = true;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      stage2Quiz = await generateAndValidateQuiz(systemMessage, apiKey);
      if (stage2Quiz.length > 0) break;
      throw new Error("Stage 2 generation returned zero valid questions");
    } catch (e) {
      console.warn(`[Assessment] Stage 2 adaptive generation attempt ${attempt} failed:`, e);
      if (attempt === 2) {
        // Final fallback — non-adaptive but still a complete assessment.
        console.warn("[Assessment] Falling back to non-adaptive Stage 2 (Gemini-only) after 2 failed attempts");
        try {
          stage2Quiz = await generateAndValidateQuiz(
            buildFallbackStage2Prompt(profile, session.educationLevel, session.country),
            apiKey,
            "Generate the personalized assessment now.",
            { generationProvider: "gemini", validationProvider: "gemini" }
          );
          adaptive = false;
        } catch (fallbackErr) {
          console.error("[Assessment] Non-adaptive Stage 2 fallback also failed:", fallbackErr);
          throw new Error(
            "Could not generate Stage 2 questions after retries and fallback. Please try resuming the assessment."
          );
        }
      }
    }
  }

  return { quiz: stage2Quiz, stage: 2, stage1Score, stage1CategoryScores, adaptive };
}

// ─── Final submit: merge Stage 1 + Stage 2, grade, write narrative ─────────

export async function submitAdaptiveAssessment(
  userId: string,
  stage2Quiz: QuizQuestion[],
  stage2Answers: string[]
): Promise<any> {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
  const geminiKey = (process.env.CAREER_MENTOR_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || "").trim();
  if (!apiKey && !geminiKey) throw new Error("No AI key available. Set GEMINI_API_KEY or OPENAI_API_KEY.");

  const session = await getAdaptiveSession(userId);
  if (!session || !session.stage1Quiz?.length) {
    throw new Error(
      "No active assessment session found. The session may have expired (1h limit) — please restart the assessment."
    );
  }
  if (!session.stage1Answers?.length) {
    throw new Error("Stage 1 was never graded for this session — call analyzeStage1AndGenerateStage2 first.");
  }

  // ── Grade both stages locally, then merge ───────────────────────────────
  const stage1Graded = gradeQuizLocally(session.stage1Quiz, session.stage1Answers);
  const stage2Graded = gradeQuizLocally(stage2Quiz, stage2Answers);

  const combinedBreakdown = [...stage1Graded.questionBreakdown, ...stage2Graded.questionBreakdown];
  const totalQuestions = combinedBreakdown.length;
  const totalCorrect = combinedBreakdown.filter((q) => q.isCorrect).length;
  const score = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const categoryStats: Record<string, { total: number; correct: number }> = {};
  for (const q of combinedBreakdown) {
    if (!categoryStats[q.category]) categoryStats[q.category] = { total: 0, correct: 0 };
    categoryStats[q.category].total++;
    if (q.isCorrect) categoryStats[q.category].correct++;
  }
  const categoryScores: Record<string, number> = {};
  for (const [cat, stats] of Object.entries(categoryStats)) {
    categoryScores[cat] = Math.round((stats.correct / stats.total) * 100);
  }

  const uniqueIdentifiedSkills = [
    ...new Set(combinedBreakdown.filter((q) => q.isCorrect).flatMap((q) => q.skillsInvolved)),
  ];

  const computedStrengths = deriveStrengths(categoryScores);
  const computedWeaknesses = deriveWeaknesses(categoryScores);

  const skillLevel =
    score >= 90 ? "Expert" :
    score >= 70 ? "Advanced" :
    score >= 40 ? "Intermediate" : "Beginner";

  // ── Misconception tracking: which wrong answers weren't just "wrong" but
  // matched the question's intended-misconception slot. We don't have an
  // explicit "this option = misconception X" field from the AI, so we use a
  // practical proxy: any wrong answer is logged with its category/skill so
  // patterns (e.g. "user picked wrong tech_literacy answers 3x") are visible
  // in the narrative prompt below, without overclaiming structured psychometrics.
  const missedQuestions = combinedBreakdown.filter((q) => !q.isCorrect);
  const misconceptionPatterns = Object.entries(
    missedQuestions.reduce((acc: Record<string, number>, q) => {
      acc[q.category] = (acc[q.category] || 0) + 1;
      return acc;
    }, {})
  )
    .filter(([, count]) => count >= 2)
    .map(([cat, count]) => `Missed ${count} questions in ${CATEGORY_LABELS[cat] ?? cat} — likely a consistent gap, not a one-off mistake.`);

  // ── AI writes narrative only — same guardrail as legacy submitAssessment ──
  const raw = await callAI(
    "You are a Career Mentor writing personalized assessment feedback for a TWO-STAGE ADAPTIVE assessment. " +
    "You receive pre-computed scores, category data, and misconception patterns. " +
    "Your ONLY job: write (1) a 1-2 sentence encouraging message, " +
    "(2) a detailed feedback paragraph referencing specific categories and how Stage 2 difficulty was adapted, " +
    "(3) 3-5 recommendedSkills to learn next based on weak categories and misconception patterns. " +
    "Do NOT recalculate or override score, skillLevel, strengths, or weaknesses. " +
    "Return ONLY JSON: { \"message\": \"\", \"feedback\": \"\", \"recommendedSkills\": [] }",
    JSON.stringify({
      score, skillLevel, categoryScores, computedStrengths, computedWeaknesses,
      stage1Score: session.stage1Score, misconceptionPatterns,
    }),
    apiKey,
    { temperature: 0.3, seed: 42, maxTokens: 1000, jsonMode: true }
  );
  const aiNarrative = parseJsonResponse(raw);

  // ── Clean up session — assessment is complete, don't let it linger ────────
  await adminDb.collection(SESSION_COLLECTION).doc(userId).delete().catch(() => {});

  return {
    score,
    skillLevel,
    categoryScores,
    breakdown: combinedBreakdown,
    identifiedSkills: uniqueIdentifiedSkills,
    strengths: computedStrengths.length > 0 ? computedStrengths : ["Completed the full assessment"],
    weaknesses: computedWeaknesses.length > 0 ? computedWeaknesses : ["Keep practicing all areas"],
    message: aiNarrative.message || `You scored ${score}% — ${skillLevel} level.`,
    feedback: aiNarrative.feedback || "Keep building on your strengths.",
    recommendedSkills: aiNarrative.recommendedSkills || [],
    stage1Score: session.stage1Score,
    misconceptionPatterns,
    isAdaptive: true,
  };
}
