import { describe, it, expect } from "vitest";
import { sanitize, getItemLabel, getItemUrl, normalizeRoadmap, getErrorInfo } from "../src/utils/roadmapHelpers";

/**
 * Tests for roadmapHelpers.tsx — extracted from roadmap.tsx. The two
 * highest-value targets here are normalizeRoadmap() and getErrorInfo():
 * normalizeRoadmap is the safety net that absorbs whatever inconsistent
 * shape the AI returns, and getErrorInfo is what decides which
 * troubleshooting card a user sees on failure. Both are pure functions
 * with real edge cases worth pinning down.
 */

describe("sanitize", () => {
  it("trims whitespace and truncates to maxLength", () => {
    expect(sanitize("  hello world  ", 5)).toBe("hello");
  });

  it("leaves short strings untouched (after trim)", () => {
    expect(sanitize("  hi  ", 10)).toBe("hi");
  });
});

describe("getItemLabel / getItemUrl", () => {
  it("prefers title over name", () => {
    expect(getItemLabel({ title: "A", name: "B" })).toBe("A");
  });

  it("falls back to name if no title", () => {
    expect(getItemLabel({ name: "B" })).toBe("B");
  });

  it("falls back to 'Resource' if neither is present", () => {
    expect(getItemLabel({})).toBe("Resource");
  });

  it("prefers url over link", () => {
    expect(getItemUrl({ url: "https://a.com", link: "https://b.com" })).toBe("https://a.com");
  });

  it("falls back to '#' if neither url nor link is present", () => {
    expect(getItemUrl({})).toBe("#");
  });
});

describe("normalizeRoadmap", () => {
  it("returns null for null/undefined input", () => {
    expect(normalizeRoadmap(null, "goal")).toBeNull();
    expect(normalizeRoadmap(undefined, "goal")).toBeNull();
  });

  it("returns null for a primitive (non-object, non-array) input", () => {
    expect(normalizeRoadmap("just a string", "goal")).toBeNull();
    expect(normalizeRoadmap(42, "goal")).toBeNull();
  });

  it("wraps a bare array of phases into a full roadmap shape", () => {
    const result = normalizeRoadmap([{ name: "Phase 1" }], "Become a developer");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Become a developer");
    expect(result!.phases).toHaveLength(1);
    expect(result!.phases[0].name).toBe("Phase 1");
  });

  it("fills in defensible defaults for missing fields, never fabricating real data", () => {
    const result = normalizeRoadmap({}, "My Goal");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("My Goal"); // falls back to goal, not invented
    expect(result!.salary_range).toBe(""); // empty, not a made-up number
    expect(result!.job_titles).toEqual([]);
    expect(result!.phases).toEqual([]);
  });

  it("accepts alternate key names the AI might use (name/title/phase_name)", () => {
    const result = normalizeRoadmap({ phases: [{ title: "Alt Name Phase" }] }, "goal");
    expect(result!.phases[0].name).toBe("Alt Name Phase");
  });

  it("defaults an unnamed phase to 'Phase N' using its index", () => {
    const result = normalizeRoadmap({ phases: [{}, {}] }, "goal");
    expect(result!.phases[0].name).toBe("Phase 1");
    expect(result!.phases[1].name).toBe("Phase 2");
  });

  it("normalizes milestone_project from either 'milestone_project' or 'milestone' key", () => {
    const viaFullKey = normalizeRoadmap(
      { phases: [{ milestone_project: { name: "Build X" } }] },
      "goal"
    );
    expect(viaFullKey!.phases[0].milestone_project.name).toBe("Build X");

    const viaShortKey = normalizeRoadmap(
      { phases: [{ milestone: { name: "Build Y" } }] },
      "goal"
    );
    expect(viaShortKey!.phases[0].milestone_project.name).toBe("Build Y");
  });

  it("does not crash on deeply malformed phase data (wrong types for arrays)", () => {
    const result = normalizeRoadmap(
      { phases: [{ tools: "not an array", topics: "also not an array" }] },
      "goal"
    );
    expect(result!.phases[0].tools).toEqual([]);
    expect(result!.phases[0].topics).toEqual([]);
  });
});

describe("getErrorInfo", () => {
  it("classifies network errors", () => {
    expect(getErrorInfo("Network request failed").type).toBe("Network Connection");
    expect(getErrorInfo("failed to fetch").type).toBe("Network Connection");
  });

  it("classifies auth/session errors", () => {
    expect(getErrorInfo("Unauthorized: invalid token").type).toBe("Session Expired");
    expect(getErrorInfo("Your session has expired").type).toBe("Session Expired");
  });

  it("classifies rate-limit errors", () => {
    expect(getErrorInfo("Daily limit reached").type).toBe("System Limit Reached");
    expect(getErrorInfo("too many requests").type).toBe("System Limit Reached");
  });

  it("classifies timeout errors", () => {
    expect(getErrorInfo("Request timeout exceeded").type).toBe("Request Timeout");
    expect(getErrorInfo("the operation timed out").type).toBe("Request Timeout");
  });

  it("falls back to a generic Generation Error for unrecognized messages", () => {
    const result = getErrorInfo("Something completely unexpected happened");
    expect(result.type).toBe("Generation Error");
    expect(result.description).toBe("Something completely unexpected happened");
  });

  it("uses word-boundary matching, not substring matching (the 'belong' vs 'long' case)", () => {
    // "belong" contains "long" but should NOT match the rate-limit ("limit"/"quota") classifier,
    // and definitely shouldn't be misclassified by accidental substring matches.
    const result = getErrorInfo("This task does not belong to any known category");
    expect(result.type).toBe("Generation Error");
  });

  it("every branch returns the required shape (type, icon, description, tips)", () => {
    const messages = ["network issue", "unauthorized", "rate limit", "timeout", "??"];
    for (const msg of messages) {
      const info = getErrorInfo(msg);
      expect(info).toHaveProperty("type");
      expect(info).toHaveProperty("icon");
      expect(info).toHaveProperty("description");
      expect(Array.isArray(info.tips)).toBe(true);
      expect(info.tips.length).toBeGreaterThan(0);
    }
  });
});
