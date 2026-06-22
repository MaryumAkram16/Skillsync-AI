/**
 * careerMentorService.ts — barrel file.
 *
 * This used to be a single 1475-line file containing three distinct
 * features (quiz generation, the adaptive multi-stage assessment, and
 * career mentor recommendations). It's now split into focused files:
 *
 *   careerMentorAI.ts             — shared Gemini/OpenAI calling layer
 *   careerMentorTypes.ts          — shared types
 *   careerMentorHelpers.ts        — pure, stateless scoring/parsing helpers
 *   careerMentorQuizShared.ts     — profile-building + quiz generation logic
 *                                   shared by the legacy and adaptive paths
 *   careerMentorAssessment.ts     — legacy single-pass quiz (generateAssessment,
 *                                   submitAssessment)
 *   careerMentorAdaptive.ts       — Tier 3 multi-stage adaptive assessment
 *                                   (generateAssessmentStage1,
 *                                   analyzeStage1AndGenerateStage2,
 *                                   submitAdaptiveAssessment)
 *   careerMentorRecommendations.ts — career mentor recommendations
 *                                    (getCareerMentorRecommendations,
 *                                    verifySupabaseConnection,
 *                                    generateSuccessStories)
 *
 * This file re-exports everything from those, so server.ts's existing
 * `await import("./services/careerMentorService")` calls keep working
 * completely unchanged — nothing in server.ts needed to be touched for
 * this split.
 *
 * If you're adding a NEW feature, prefer importing directly from the
 * specific file above rather than from this barrel — that keeps the
 * dependency graph clear. This barrel exists for backward compatibility
 * with server.ts's existing import paths, not as the long-term front door.
 */

export {
  generateAssessment,
  submitAssessment,
} from "./careerMentorAssessment";

export {
  generateAssessmentStage1,
  analyzeStage1AndGenerateStage2,
  submitAdaptiveAssessment,
} from "./careerMentorAdaptive";

export {
  getCareerMentorRecommendations,
  verifySupabaseConnection,
  generateSuccessStories,
} from "./careerMentorRecommendations";

export type {
  EnhancedCareerRecommendation,
  SuccessStory,
  DataQuality,
  CareerMentorResult,
} from "./careerMentorTypes";