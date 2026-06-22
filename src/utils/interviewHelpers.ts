import { LibraryCategory, OpenQuestion, HistoryResponse } from "./interviewTypes";

/**
 * Pure constants + helper functions extracted from interview.tsx — same
 * risk profile as the other extractions: explicit inputs, explicit
 * outputs, zero dependency on component state.
 */

export const QUIZ_QUESTION_COUNT = 10;
export const OPEN_QUESTION_COUNT = 8;

export const INPUT_LIMITS = {
  role: 120,
  skills: 400,
} as const;

/**
 * Trim and length-limit user input before sending to the backend.
 * Prevents accidental or intentional prompt-injection bloat and keeps
 * payloads predictable.
 */
export function sanitizeInput(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

/**
 * The question-library endpoint may return `categories` as either an array
 * (`[{ category, questions }]`) or an object keyed by category name
 * (`{ Technical: [...], Behavioral: [...] }`). Normalize to the array form
 * the UI expects.
 */
export function normalizeLibraryCategories(
  raw: LibraryCategory[] | Record<string, OpenQuestion[]> | undefined | null
): LibraryCategory[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (c): c is LibraryCategory =>
        !!c && typeof c.category === "string" && Array.isArray(c.questions)
    );
  }
  if (typeof raw === "object") {
    return Object.entries(raw)
      .filter(([, questions]) => Array.isArray(questions))
      .map(([category, questions]) => ({
        category,
        questions: questions as OpenQuestion[],
      }));
  }
  return [];
}

/**
 * Compute total questions practiced across history sessions using real data
 * from the backend rather than a fixed multiplier.
 */
export function computeTotalQuestions(history: HistoryResponse | null): number {
  if (!history) return 0;
  if (typeof history.summary?.total_questions === "number") {
    return history.summary.total_questions;
  }
  const sessions = history.sessions ?? [];
  return sessions.reduce(
    (total, session) => total + (session.total_questions ?? 0),
    0
  );
}
