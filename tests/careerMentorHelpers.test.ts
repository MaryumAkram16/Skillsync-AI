import { describe, it, expect } from "vitest";
import {
  CATEGORY_LABELS,
  VALID_MARKET_DEMAND,
  deriveStrengths,
  deriveWeaknesses,
  calculateMatchScore,
  estimateTimeToJob,
  parseHoursPerWeek,
  validateRecommendation,
  parseJsonResponse,
} from "../services/careerMentorHelpers";

/**
 * Tests for careerMentorHelpers.ts — the pure, stateless functions extracted
 * from careerMentorService.ts. These need zero mocking (no Firestore, no AI
 * calls, no env vars) since they're plain functions of their inputs, which
 * is exactly why they're the right place to start a test suite: real
 * regression protection for the logic feeding quiz generation, the adaptive
 * assessment, and career mentor recommendations, with no setup cost.
 */

describe("deriveStrengths", () => {
  it("flags categories scoring 70 or above as strengths", () => {
    const result = deriveStrengths({ logical_thinking: 85, soft_skills: 40 });
    expect(result).toEqual([`Strong ${CATEGORY_LABELS.logical_thinking}`]);
  });

  it("orders strengths from highest score to lowest", () => {
    const result = deriveStrengths({ tech_literacy: 75, problem_solving: 95 });
    expect(result).toEqual([
      `Strong ${CATEGORY_LABELS.problem_solving}`,
      `Strong ${CATEGORY_LABELS.tech_literacy}`,
    ]);
  });

  it("returns an empty array when nothing qualifies", () => {
    expect(deriveStrengths({ soft_skills: 50 })).toEqual([]);
  });

  it("falls back to the raw category key if it's not in CATEGORY_LABELS", () => {
    expect(deriveStrengths({ some_unknown_category: 90 })).toEqual(["Strong some_unknown_category"]);
  });
});

describe("deriveWeaknesses", () => {
  it("flags categories scoring under 50 as weaknesses", () => {
    const result = deriveWeaknesses({ career_awareness: 30, tech_literacy: 80 });
    expect(result).toEqual([`Develop ${CATEGORY_LABELS.career_awareness}`]);
  });

  it("orders weaknesses from lowest score to highest", () => {
    const result = deriveWeaknesses({ soft_skills: 45, logical_thinking: 10 });
    expect(result).toEqual([
      `Develop ${CATEGORY_LABELS.logical_thinking}`,
      `Develop ${CATEGORY_LABELS.soft_skills}`,
    ]);
  });

  it("treats exactly 50 as not a weakness (boundary check)", () => {
    expect(deriveWeaknesses({ soft_skills: 50 })).toEqual([]);
  });
});

describe("calculateMatchScore", () => {
  it("never returns below the 30 floor, even with no overlap and a low score", () => {
    const score = calculateMatchScore([], ["Python", "SQL"], 0, 0, 5);
    expect(score).toBeGreaterThanOrEqual(30);
  });

  it("never exceeds 100", () => {
    const score = calculateMatchScore(
      ["Python", "SQL", "React"],
      ["Python", "SQL", "React"],
      100,
      50,
      0
    );
    expect(score).toBeLessThanOrEqual(100);
  });

  it("rewards higher skill overlap with a higher score, all else equal", () => {
    const lowOverlap = calculateMatchScore(["Python"], ["Python", "SQL", "React", "AWS"], 50, 5);
    const highOverlap = calculateMatchScore(["Python", "SQL", "React", "AWS"], ["Python", "SQL", "React", "AWS"], 50, 5);
    expect(highOverlap).toBeGreaterThan(lowOverlap);
  });

  it("applies a gap penalty that reduces the score", () => {
    const noGaps = calculateMatchScore(["Python"], ["Python"], 80, 10, 0);
    const withGaps = calculateMatchScore(["Python"], ["Python"], 80, 10, 3);
    expect(withGaps).toBeLessThan(noGaps);
  });
});

describe("estimateTimeToJob", () => {
  it("estimates longer for Beginner than Expert, all else equal", () => {
    const beginner = estimateTimeToJob("Beginner", 10, 0);
    const expert = estimateTimeToJob("Expert", 10, 0);
    expect(beginner).toBeGreaterThan(expert);
  });

  it("estimates shorter timelines for more hours/week", () => {
    const fewHours = estimateTimeToJob("Intermediate", 5, 0);
    const manyHours = estimateTimeToJob("Intermediate", 25, 0);
    expect(manyHours).toBeLessThan(fewHours);
  });

  it("never returns below the 2-month floor", () => {
    const result = estimateTimeToJob("Expert", 40, 0);
    expect(result).toBeGreaterThanOrEqual(2);
  });

  it("defaults unknown skill levels to the Intermediate baseline", () => {
    const unknown = estimateTimeToJob("SomethingWeird", 10, 0);
    const intermediate = estimateTimeToJob("Intermediate", 10, 0);
    expect(unknown).toBe(intermediate);
  });
});

describe("parseHoursPerWeek", () => {
  it("extracts the first number found in the string", () => {
    expect(parseHoursPerWeek("15-20 hours")).toBe(15);
  });

  it("defaults to 10 when no number is present", () => {
    expect(parseHoursPerWeek("a few hours")).toBe(10);
  });
});

describe("validateRecommendation", () => {
  const validRec = {
    fieldName: "Frontend Developer",
    salaryRange: "$60k-$90k",
    marketDemand: "High Growth",
    roleProgression: ["Junior", "Mid", "Senior"],
  };

  it("accepts a well-formed recommendation", () => {
    expect(validateRecommendation(validRec)).toBe(true);
  });

  it("rejects a missing fieldName", () => {
    expect(validateRecommendation({ ...validRec, fieldName: "" })).toBe(false);
  });

  it("rejects an invalid marketDemand value", () => {
    expect(validateRecommendation({ ...validRec, marketDemand: "Skyrocketing" })).toBe(false);
  });

  it("rejects roleProgression with fewer than 3 steps", () => {
    expect(validateRecommendation({ ...validRec, roleProgression: ["Junior", "Senior"] })).toBe(false);
  });

  it("accepts every value in VALID_MARKET_DEMAND", () => {
    for (const demand of VALID_MARKET_DEMAND) {
      expect(validateRecommendation({ ...validRec, marketDemand: demand })).toBe(true);
    }
  });
});

describe("parseJsonResponse", () => {
  it("parses clean JSON directly", () => {
    expect(parseJsonResponse('{"a": 1}')).toEqual({ a: 1 });
  });

  it("strips markdown code fences before parsing", () => {
    expect(parseJsonResponse('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("extracts a JSON object even with stray text around it", () => {
    expect(parseJsonResponse('Here is the result: {"a": 1} — hope that helps!')).toEqual({ a: 1 });
  });

  it("extracts a JSON array even with stray text around it", () => {
    expect(parseJsonResponse('Sure, here: [1, 2, 3] enjoy')).toEqual([1, 2, 3]);
  });

  it("throws a clear error when no JSON is present at all", () => {
    expect(() => parseJsonResponse("no json here")).toThrow(/AI returned invalid JSON/);
  });

  it("REGRESSION: doesn't grab a stray trailing brace in trailing text after the real JSON ends", () => {
    // The old lastIndexOf('}') approach would have grabbed the SECOND '}'
    // here, producing malformed JSON. The new string-aware depth scanner
    // correctly stops at the real end of the object.
    const raw = 'Here you go: {"a": 1, "b": {"nested": true}} Hope that helps! }';
    expect(parseJsonResponse(raw)).toEqual({ a: 1, b: { nested: true } });
  });

  it("doesn't get confused by braces inside string values", () => {
    const raw = '{"message": "use {curly braces} like this", "ok": true}';
    expect(parseJsonResponse(raw)).toEqual({ message: "use {curly braces} like this", ok: true });
  });

  it("recovers from a trailing comma before a closing brace (common LLM mistake)", () => {
    expect(parseJsonResponse('{"a": 1, "b": 2,}')).toEqual({ a: 1, b: 2 });
  });

  it("recovers from a trailing comma before a closing bracket", () => {
    expect(parseJsonResponse("[1, 2, 3,]")).toEqual([1, 2, 3]);
  });

  it("recovers from a trailing comma even when embedded in surrounding text", () => {
    const raw = 'The result is: {"items": [1, 2,], "done": true,} — enjoy!';
    expect(parseJsonResponse(raw)).toEqual({ items: [1, 2], done: true });
  });
});