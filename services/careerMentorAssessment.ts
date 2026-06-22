import OpenAI from "openai";
import admin, { adminDb } from "./firebaseAdmin";
import { callAI } from "./careerMentorAI";
import { parseJsonResponse, deriveStrengths, deriveWeaknesses } from "./careerMentorHelpers";
import { buildAssessmentProfile, generateAndValidateQuiz } from "./careerMentorQuizShared";
import { InterestWithProficiency, QuizQuestion } from "./careerMentorTypes";

/**
 * Checks the current user's document in Firestore for a 'metadata.assessmentCount' field
 * and prevents further assessments if it has reached or exceeded the threshold of 3.
 */
export async function checkAssessmentLimit(userId: string): Promise<void> {
  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (userDoc.exists) {
    const data = userDoc.data();
    const assessmentCount = data?.metadata?.assessmentCount ?? 0;
    if (assessmentCount >= 3) {
      throw new Error("Assessment limit reached. You can only perform up to 3 assessments.");
    }
  }
}

/**
 * Legacy single-pass quiz generation + grading — generates one 10-question
 * quiz and grades it immediately. This is the original (pre-adaptive) path;
 * the newer Tier 3 adaptive flow (careerMentorAdaptive.ts) is the
 * multi-stage version that branches Stage 2 difficulty on Stage 1
 * performance. Both share buildAssessmentProfile/generateAndValidateQuiz
 * from careerMentorQuizShared.ts.
 */

export async function generateAssessment(
  userId: string,
  interests: string[] | InterestWithProficiency[],
  educationLevel: string,
  country: string
): Promise<{ quiz: QuizQuestion[] }> {
  await checkAssessmentLimit(userId);

  const apiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set.");

  const { perSkillRules, softSkillLines, educationBaseline, marketContext } =
    await buildAssessmentProfile(interests, educationLevel, country);

  const systemMessage = `You are an expert Career Coach and Skills Assessor.
Generate a 10-question quiz that is STRICTLY personalised to this exact user.
Every question must feel like it was written specifically for them — not generic.

═══ USER PROFILE ═══
Education : ${educationLevel} — ${educationBaseline}
Country   : ${country}

═══ SKILL-BY-SKILL DIFFICULTY (follow these exactly) ═══
${perSkillRules || "• General technical interest [INTERMEDIATE] → real-world practical questions"}

═══ SOFT SKILLS ═══
${softSkillLines}

${marketContext
  ? marketContext
  : `No live market data. For career_awareness questions use general knowledge about in-demand skills and typical salary ranges for ${country}.`
}

  ═══ QUIZ DISTRIBUTION (exactly 10 questions) ═══
  1. logical_thinking  — 2 Qs — Reasoning/analytical problems scaled to education level above
  2. tech_literacy     — 3 Qs — Pick 3 DIFFERENT technical skills from the list. Match difficulty to THAT skill's level exactly. Never ask 2 questions about the same skill.
  3. problem_solving   — 2 Qs — Real-world job scenarios the user would face in ${country}. Use their actual technical skill set.
  4. soft_skills       — 2 Qs — Behavioural scenarios tied to their specific soft skills
  5. career_awareness  — 1 Q — Job market realities for ${country}: which skills are in demand, salary expectations, hiring trends

═══ DIFFICULTY → difficulty field mapping ═══
Beginner skill    → difficulty: "easy"
Intermediate skill → difficulty: "medium"
Expert skill      → difficulty: "hard"
logical_thinking / problem_solving → match education baseline above

═══ QUALITY RULES ═══
- Reference the user's actual skills by name in the question — never ask generic questions
- Wrong options must be common real-world misconceptions — not obviously silly
- Never test the same skill twice
- correct_answer must be factually verified — one of "A","B","C","D" only
- explanation: one sentence why that answer is correct (shown AFTER submission, not during)

Return ONLY raw JSON:
{
  "quiz": [
    {
      "question": "string",
      "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
      "correct_answer": "A",
      "category": "logical_thinking",
      "difficulty": "easy|medium|hard",
      "skillsInvolved": ["skill1"],
      "explanation": "Why this answer is correct"
    }
  ]
}`;

  // No seed here — every quiz should be unique even for the same profile
  const validatedQuiz = await generateAndValidateQuiz(systemMessage, apiKey);

  // Increment assessmentCount in user metadata
  await adminDb.collection("users").doc(userId).set({
    metadata: {
      assessmentCount: admin.firestore.FieldValue.increment(1)
    }
  }, { merge: true }).catch(err => {
    console.warn("Failed to increment user assessment count:", err.message);
  });

  return { quiz: validatedQuiz };
}

// ─── Submit & Grade Assessment ────────────────────────────────────────────────

export async function submitAssessment(
  userId: string,
  rawAnswers: string[],
  quiz: QuizQuestion[]
): Promise<any> {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set.");
  const openai = new OpenAI({ apiKey });

  // ── 1. Grade locally — deterministic, no AI ─────────────────────────────────
  const questionBreakdown = quiz.map((q, idx) => {
    const isCorrect = q.correct_answer === rawAnswers[idx];
    return {
      question: q.question,
      userAnswer: q.options[rawAnswers[idx] as keyof typeof q.options] || "No answer",
      correctAnswer: q.options[q.correct_answer as keyof typeof q.options] || "Unknown",
      isCorrect,
      category: q.category || "general",
      skillsInvolved: q.skillsInvolved || [],
      explanation: q.explanation || "",
    };
  });

  const numCorrect = questionBreakdown.filter((q) => q.isCorrect).length;
  const score = Math.round((numCorrect / quiz.length) * 100);

  // ── 2. Category scores — computed, not AI ────────────────────────────────────
  const categoryStats: Record<string, { total: number; correct: number }> = {};
  for (const q of questionBreakdown) {
    if (!categoryStats[q.category]) categoryStats[q.category] = { total: 0, correct: 0 };
    categoryStats[q.category].total++;
    if (q.isCorrect) categoryStats[q.category].correct++;
  }
  const categoryScores: Record<string, number> = {};
  for (const [cat, stats] of Object.entries(categoryStats)) {
    categoryScores[cat] = Math.round((stats.correct / stats.total) * 100);
  }

  // ── 3. Identified skills — from actual correct answers ───────────────────────
  const uniqueIdentifiedSkills = [
    ...new Set(
      questionBreakdown
        .filter((q) => q.isCorrect)
        .flatMap((q) => q.skillsInvolved)
    ),
  ];

  // ── 4. Strengths & weaknesses — computed from real scores, no AI ─────────────
  const computedStrengths = deriveStrengths(categoryScores);
  const computedWeaknesses = deriveWeaknesses(categoryScores);

  // ── 5. Skill level — derived from real score ─────────────────────────────────
  const skillLevel =
    score >= 90 ? "Expert" :
    score >= 70 ? "Advanced" :
    score >= 40 ? "Intermediate" : "Beginner";

  // ── 6. AI writes narrative ONLY — Gemini first, OpenAI fallback ─────────────
  const raw = await callAI(
    "You are a Career Mentor writing personalized assessment feedback. " +
    "You receive pre-computed scores and category data. " +
    "Your ONLY job: write (1) a 1-2 sentence encouraging message, " +
    "(2) a detailed feedback paragraph referencing specific categories, " +
    "(3) 3-5 recommendedSkills to learn next based on weak categories. " +
    "Do NOT recalculate or override score, skillLevel, strengths, or weaknesses. " +
    "Return ONLY JSON: { \"message\": \"\", \"feedback\": \"\", \"recommendedSkills\": [] }",
    JSON.stringify({ score, skillLevel, categoryScores, computedStrengths, computedWeaknesses }),
    apiKey,
    { temperature: 0.3, seed: 42, maxTokens: 1000, jsonMode: true }
  );
  const aiNarrative = parseJsonResponse(raw);

  // ── 7. Return — real data takes priority, AI only fills narrative ─────────────
  return {
    score,
    skillLevel,
    categoryScores,
    breakdown: questionBreakdown,
    identifiedSkills: uniqueIdentifiedSkills,
    strengths: computedStrengths.length > 0 ? computedStrengths : ["Completed the full assessment"],
    weaknesses: computedWeaknesses.length > 0 ? computedWeaknesses : ["Keep practicing all areas"],
    message: aiNarrative.message || `You scored ${score}% — ${skillLevel} level.`,
    feedback: aiNarrative.feedback || "Keep building on your strengths.",
    recommendedSkills: aiNarrative.recommendedSkills || [],
  };
}
