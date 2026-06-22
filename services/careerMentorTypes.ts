/**
 * Shared types used across the three career-mentor features (quiz
 * generation, the adaptive multi-stage assessment, and mentor
 * recommendations) — split out so each feature file can import just the
 * types it needs without depending on the others.
 */

export interface InterestWithProficiency {
  name: string;
  level: "Beginner" | "Intermediate" | "Expert";
}

export interface QuizQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer?: string;
  category?: string;
  difficulty?: string;
  skillsInvolved?: string[];
  explanation?: string;
}

export interface EnhancedCareerRecommendation {
  rank: number;
  title: string;
  tagline: string;
  whyFit: string;
  matchScore: number;
  salaryRange: string;
  salarySource: "live_listings" | "listing_data" | "ai_estimate";
  level: string;
  skills: string[];
  marketDemand: string;
  roleProgression: string[];
  timeToFirstJobMonths: number;
  currentSkillOverlap: string[];
  assessmentAlignment: string;
  skillGapAnalysis: { strengths: string[]; criticalGaps: string[] };
}

export interface SuccessStory {
  headline: string;
  previous_role: string;
  current_role: string;
  current_company: string;
  salary_change: string;
  background_type: "non-tech" | "tech";
  learning_path: string;
  tools_used: string;
  key_advice: string;
  source_platform: string;
  source_url: string;
}

export interface DataQuality {
  salarySource: "live_listings" | "ai_estimate";
  marketDataAvailable: boolean;
  assessmentUsed: boolean;
  matchScoreMethod: "computed";
  timeToJobMethod: "computed";
  liveListingsCount: number;
  generatedAt: string;
}

export interface CareerMentorResult {
  success: boolean;
  userId: string;
  topField: string;
  recommendations: EnhancedCareerRecommendation[];
  mentorReport: any;
  generatedAt: string;
  fromCache: boolean;
  dataQuality: DataQuality;
}

export interface BuiltProfile {
  technicalInterests: InterestWithProficiency[];
  softSkillLines: string;
  perSkillRules: string;
  educationBaseline: string;
  marketContext: string;
}

export interface AdaptiveSessionState {
  userId: string;
  stage1Quiz: QuizQuestion[];
  stage1Answers: string[];
  stage1CategoryScores: Record<string, number>;
  stage1Score: number;
  educationLevel: string;
  country: string;
  interests: string[] | InterestWithProficiency[];
  createdAt: number;
}
