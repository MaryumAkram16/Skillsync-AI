import { scanMarket } from "./radarService";
import { callAI, AICallOptions } from "./careerMentorAI";
import { parseJsonResponse } from "./careerMentorHelpers";
import { InterestWithProficiency, QuizQuestion, BuiltProfile } from "./careerMentorTypes";

/**
 * Shared profile-building + quiz-generation logic used by BOTH the legacy
 * single-pass assessment (careerMentorAssessment.ts) and the Tier 3
 * multi-stage adaptive assessment (careerMentorAdaptive.ts) — kept in one
 * place so the personalisation logic doesn't drift between the two paths.
 */

export async function buildAssessmentProfile(
  interests: string[] | InterestWithProficiency[],
  educationLevel: string,
  country: string
): Promise<BuiltProfile> {
  const normalisedInterests: InterestWithProficiency[] = (interests as any[]).map((i) =>
    typeof i === "string"
      ? { name: i, level: "Beginner" as const }
      : { name: i.name ?? i, level: i.level ?? "Beginner" }
  );

  const softSkillKeywords = [
    "communication", "leadership", "teamwork", "problem solving",
    "critical thinking", "public speaking", "emotional intelligence",
    "time management", "collaboration", "soft skills",
  ];
  const softSkills = normalisedInterests.filter((i) =>
    softSkillKeywords.some((kw) => i.name.toLowerCase().includes(kw))
  );
  const technicalInterests = normalisedInterests.filter(
    (i) => !softSkillKeywords.some((kw) => i.name.toLowerCase().includes(kw))
  );

  const softSkillLines = softSkills.length > 0
    ? softSkills.map((s) => `- ${s.name}`).join("\n")
    : "General workplace communication and collaboration";

  // ── Fetch real market data for career_awareness questions ──────────────────
  let marketContext = "";
  try {
    const primaryInterest = technicalInterests[0]?.name || normalisedInterests[0]?.name;
    if (primaryInterest) {
      const radar = await scanMarket(primaryInterest, country);
      const topSkills = radar.technicalSkills.high.slice(0, 5).join(", ");
      const salary = radar.salaryIntel
        ? `${radar.salaryIntel.currency} ${radar.salaryIntel.annualMin ?? "N/A"}–${radar.salaryIntel.annualMax ?? "N/A"}/yr (${radar.salaryIntel.source})`
        : "varies by company";
      marketContext = `
### REAL MARKET DATA FOR ${country.toUpperCase()} (from live job listings):
- Top demanded skills right now: ${topSkills}
- Typical salary range: ${salary}
Use this data to ground career_awareness questions in real market facts.`;
    }
  } catch (e) {
    console.warn("[Assessment] Market fetch failed, continuing:", e);
  }

  // ── Per-skill difficulty rules (the core of dynamic quiz) ──────────────────
  const perSkillRules = technicalInterests.map((i) => {
    const rules: Record<string, string> = {
      Beginner:     `• ${i.name} [BEGINNER]     → definitions, basic syntax, "what does X do" — no internals`,
      Intermediate: `• ${i.name} [INTERMEDIATE] → real-world usage, patterns, debugging, "why use X over Y"`,
      Expert:       `• ${i.name} [EXPERT]       → architecture, performance trade-offs, advanced internals at scale`,
    };
    return rules[i.level] || rules["Beginner"];
  }).join("\n");

  // ── Education-level baseline ─────────────────────────────────────────────────
  const educationBaseline = (() => {
    const e = (educationLevel || "").toLowerCase();
    if (e.includes("phd"))      return "PhD — strong theoretical background. Questions can be academic and deeply technical.";
    if (e.includes("master"))   return "Master's — advanced concepts and research-level thinking are appropriate.";
    if (e.includes("bachelor")) return "Bachelor's — mix theory and practical. Industry-standard scenarios are correct depth.";
    if (e.includes("bootcamp")) return "Bootcamp — practical hands-on skills only. Avoid heavy theory or academic language.";
    return "High School / early learner — keep questions simple, practical, real-world. Zero jargon.";
  })();

  return { technicalInterests, softSkillLines, perSkillRules, educationBaseline, marketContext };
}

// ── Shared two-pass call: generate quiz, then fact-check it ─────────────────
// (Pass 1 generates, Pass 2 validates correct answers at temperature 0.
// Used identically by the legacy single-stage path and both Tier 3 stages.)
//
// Provider split (cost control): generation defaults to "gemini-first" so
// it still falls back to OpenAI if Gemini is briefly down — generation is
// the step where you most want uptime. Validation defaults to "gemini"
// ONLY — no OpenAI fallback — because it's a narrow, deterministic
// fact-check task that doesn't need GPT, and callers already tolerate a
// failed validation pass by shipping the unvalidated quiz (see catch
// block below). In the common case (Gemini healthy) this means a full
// assessment — generation AND validation, for both stages — touches
// OpenAI zero times.

export async function generateAndValidateQuiz(
  systemMessage: string,
  apiKey: string,
  userPrompt: string = "Generate the personalized assessment now.",
  opts: { generationProvider?: AICallOptions["provider"]; validationProvider?: AICallOptions["provider"] } = {}
): Promise<QuizQuestion[]> {
  const { generationProvider = "gemini-first", validationProvider = "gemini" } = opts;

  const raw = await callAI(systemMessage, userPrompt, apiKey, {
    temperature: 0.7, maxTokens: 2500, jsonMode: true, provider: generationProvider,
  });
  const generated = parseJsonResponse(raw) as { quiz: QuizQuestion[] };

  let validatedQuiz = generated.quiz ?? [];
  try {
    const vRaw = await callAI(
      "You are a strict fact-checker for quiz questions. " +
      "Review each question. If correct_answer is factually wrong, fix it. " +
      "If all 4 options are wrong, rewrite the options so exactly one is correct. " +
      "Return ONLY JSON: { \"quiz\": [...same structure...] }",
      `Validate these questions:\n${JSON.stringify(generated.quiz, null, 2)}`,
      apiKey,
      { temperature: 0, seed: 42, maxTokens: 2500, jsonMode: true, provider: validationProvider }
    );
    const vParsed = parseJsonResponse(vRaw);
    validatedQuiz = Array.isArray(vParsed) ? vParsed : vParsed.quiz ?? generated.quiz;
  } catch (e) {
    console.warn("[Assessment] Validation pass failed (Gemini-only, no OpenAI fallback by design), using unvalidated generated quiz:", e);
  }

  // ── Structural safety: drop any question with invalid correct_answer ────────
  return validatedQuiz.filter(
    (q: QuizQuestion) =>
      q.correct_answer && ["A", "B", "C", "D"].includes(q.correct_answer)
  );
}

// ─── Local, deterministic grading (no AI) — mirrors submitAssessment's logic,
// shared by the legacy path and both adaptive-assessment stages ───────────────

export function gradeQuizLocally(quiz: QuizQuestion[], rawAnswers: string[]) {
  const questionBreakdown = quiz.map((q, idx) => {
    const isCorrect = q.correct_answer === rawAnswers[idx];
    const userAnswerKey = rawAnswers[idx] as keyof typeof q.options | undefined;
    return {
      question: q.question,
      userAnswer: userAnswerKey ? q.options[userAnswerKey] ?? "No answer" : "No answer",
      correctAnswer: q.options[q.correct_answer as keyof typeof q.options] || "Unknown",
      isCorrect,
      category: q.category || "general",
      skillsInvolved: q.skillsInvolved || [],
      explanation: q.explanation || "",
    };
  });

  const numCorrect = questionBreakdown.filter((q) => q.isCorrect).length;
  const score = quiz.length > 0 ? Math.round((numCorrect / quiz.length) * 100) : 0;

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

  return { questionBreakdown, numCorrect, score, categoryScores };
}
