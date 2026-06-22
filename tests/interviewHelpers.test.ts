import { describe, it, expect } from "vitest";
import { sanitizeInput, normalizeLibraryCategories, computeTotalQuestions } from "../src/utils/interviewHelpers";

/**
 * Tests for interviewHelpers.ts — extracted from interview.tsx.
 * normalizeLibraryCategories and computeTotalQuestions are the two
 * functions worth real test coverage: both absorb inconsistent shapes
 * from the backend, same reasoning as the roadmap/career-mentor tests.
 */

describe("sanitizeInput", () => {
  it("trims whitespace and truncates to maxLength", () => {
    expect(sanitizeInput("  Senior Backend Engineer  ", 10)).toBe("Senior Bac");
  });
});

describe("normalizeLibraryCategories", () => {
  it("returns an empty array for null/undefined", () => {
    expect(normalizeLibraryCategories(null)).toEqual([]);
    expect(normalizeLibraryCategories(undefined)).toEqual([]);
  });

  it("passes through a well-formed array, filtering out malformed entries", () => {
    const input = [
      { category: "Technical", questions: [{ question: "Q1" }] },
      { category: "Bad Entry" }, // missing `questions` — should be dropped
      { questions: [] }, // missing `category` — should be dropped
    ];
    const result = normalizeLibraryCategories(input as any);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Technical");
  });

  it("converts an object keyed by category name into the array form", () => {
    const input = {
      Technical: [{ question: "Q1" }],
      Behavioral: [{ question: "Q2" }],
    };
    const result = normalizeLibraryCategories(input as any);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.category).sort()).toEqual(["Behavioral", "Technical"]);
  });

  it("drops object keys whose value isn't an array", () => {
    const input = { Technical: [{ question: "Q1" }], Broken: "not an array" };
    const result = normalizeLibraryCategories(input as any);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Technical");
  });

  it("returns an empty array for a primitive input", () => {
    expect(normalizeLibraryCategories("just a string" as any)).toEqual([]);
  });
});

describe("computeTotalQuestions", () => {
  it("returns 0 for null history", () => {
    expect(computeTotalQuestions(null)).toBe(0);
  });

  it("prefers summary.total_questions when present", () => {
    const history = { summary: { total_questions: 42 }, sessions: [{ total_questions: 5 }] };
    expect(computeTotalQuestions(history as any)).toBe(42);
  });

  it("falls back to summing sessions when summary.total_questions is absent", () => {
    const history = { sessions: [{ total_questions: 5 }, { total_questions: 3 }] };
    expect(computeTotalQuestions(history as any)).toBe(8);
  });

  it("treats sessions missing total_questions as 0, not a crash", () => {
    const history = { sessions: [{ total_questions: 5 }, {}] };
    expect(computeTotalQuestions(history as any)).toBe(5);
  });

  it("returns 0 when there are no sessions and no summary count", () => {
    expect(computeTotalQuestions({} as any)).toBe(0);
  });
});
