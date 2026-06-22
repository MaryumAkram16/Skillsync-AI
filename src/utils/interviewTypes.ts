/**
 * Types extracted from interview.tsx — pure type definitions, no runtime
 * code, zero dependency on component state.
 */

export type Mode = "selection" | "quiz" | "questions" | "library" | "history";
export type Difficulty = "easy" | "medium" | "hard" | "mixed";
export type Level = "junior" | "mid" | "senior";
export type PracticeMode = "quiz" | "questions" | "library";

export interface QuizQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: string;
  explanation: string;
  study_tip: string;
  focus_area: string;
  difficulty: string;
}

export interface OpenQuestion {
  question: string;
  category: string;
  difficulty: string;
  focus_area: string;
  ideal_answer: string;
  what_interviewer_looks_for: string;
  follow_up: string;
  red_flags: string;
}

export interface LibraryCategory {
  category: string;
  questions: OpenQuestion[];
}

export interface LibraryResponse {
  total_questions?: number;
  library?: {
    topic?: string;
    role?: string;
    total_questions?: number;
    categories?: LibraryCategory[] | Record<string, OpenQuestion[]>;
  };
}

export interface HistorySession {
  role?: string;
  level?: string;
  session_type?: string;
  difficulty?: string;
  score_percent?: number;
  total_questions?: number;
  created_at?: string;
}

export interface HistoryResponse {
  summary?: {
    total_sessions?: number;
    total_questions?: number;
    avg_score?: number;
    roles_practiced?: string[];
    top_weak_topics?: string[];
  };
  sessions?: HistorySession[];
  score_trend?: Array<{
    date: string;
    score: number;
    role: string;
    session_type: string;
  }>;
}
