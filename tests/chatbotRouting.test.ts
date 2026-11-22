import { describe, expect, it, vi } from "vitest";
import { CANONICAL_ROUTES, INTENT_GUIDE, KNOWN_ROUTES, enforceKnownRoute } from "../services/chatbotService";

describe("chatbot routing guard", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});

  it("replaces the real bad reply: an invented 'Job Match feature' with no link", () => {
    const bad = "You can find job opportunities that match your resume by using the Job Match feature, which compares your top skills against current openings.";
    expect(enforceKnownRoute(bad, "PARSER_HELP")).toBe("Upload your resume in Parser to match it against live job listings. [Go to /parser]");
    // Even when the classifier picked the wrong intent, the reply is a real feature with a real link.
    const out = enforceKnownRoute(bad, "RESUME_TOOLS_HELP");
    expect(out).toMatch(/\[Go to \/resume-tools\]$/);
    expect(out).not.toMatch(/Job Match/);
  });

  it("keeps a good, personalised reply untouched", () => {
    const good = "Since you know Python, upload your resume in Parser to match it against live job listings. [Go to /parser]";
    expect(enforceKnownRoute(good, "PARSER_HELP")).toBe(good);
    const radar = "Radar shows which skills are trending for Data Scientist roles right now. [Go to /radar?role=Data Scientist]";
    expect(enforceKnownRoute(radar, "RADAR_HELP")).toBe(radar);
  });

  it("allows real feature names written as 'X tool' or 'the X page'", () => {
    const ok = "Open the Resume Tools page to rewrite your bullets. [Go to /resume-tools]";
    expect(enforceKnownRoute(ok, "RESUME_TOOLS_HELP")).toBe(ok);
  });

  it("drops links to pages that don't exist", () => {
    expect(enforceKnownRoute("Try our matcher. [Go to /job-match]", "PARSER_HELP")).toBe(
      "Upload your resume in Parser to match it against live job listings. [Go to /parser]",
    );
  });

  it("uses a safe default for intents without a fixed route", () => {
    const out = enforceKnownRoute("Use the Career Compass tool to get started.", "ONBOARDING");
    expect(out).toMatch(/\[Go to \/dashboard\]$/);
  });

  it("every canonical route is a real page", () => {
    for (const r of Object.values(CANONICAL_ROUTES)) expect(KNOWN_ROUTES.has(r.path)).toBe(true);
  });

  it("tells the classifier that finding jobs with a resume is the Parser, not Resume Tools", () => {
    expect(INTENT_GUIDE).toMatch(/PARSER_HELP: find or match JOBS using their resume/);
    expect(INTENT_GUIDE).toMatch(/RESUME_TOOLS_HELP: improve or rewrite their resume itself/);
  });
});
