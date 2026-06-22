import { WifiOff, UserX, ShieldAlert, RefreshCw, AlertCircle } from "lucide-react";
import { ResourceItem, Roadmap, RoadmapPhase } from "./roadmapTypes";

/**
 * Pure constants + helper functions extracted from roadmap.tsx. All take
 * explicit inputs and return values with zero dependency on component
 * state — same risk profile as the other extractions done tonight.
 */

export const INPUT_LIMITS = {
  goal: 200,
  skills: 500,
  industry: 100,
  targetRole: 120,
  timeCommitment: 60,
} as const;

export const sanitize = (value: string, maxLength: number): string =>
  value.trim().slice(0, maxLength);

export const getItemLabel = (item: ResourceItem): string =>
  item.title || item.name || "Resource";

export const getItemUrl = (item: ResourceItem): string =>
  item.url || item.link || "#";

/**
 * Normalize a roadmap response into the canonical shape the UI expects.
 * The backend may return inconsistent structures depending on how the AI
 * formatted its output — this layer absorbs that variation in one place.
 *
 * Note: this is a SAFETY NET. It only fills in defensible defaults
 * (empty arrays, "TBD") — it NEVER fabricates user-facing values like
 * salary ranges, career outcomes, or prerequisites that the AI did not
 * actually produce. Missing fields render as empty rather than as
 * invented data.
 */
export function normalizeRoadmap(raw: unknown, goal: string): Roadmap | null {
  if (!raw) return null;

  // The AI sometimes returns an array of phases at the top level. Wrap it.
  let data: Record<string, unknown>;
  if (Array.isArray(raw)) {
    data = {
      phases: raw,
      title: goal,
      total_duration: "",
      weekly_hours: 0,
      salary_range: "",
      job_titles: [],
      summary: "",
    };
  } else if (typeof raw === "object") {
    data = raw as Record<string, unknown>;
  } else {
    return null;
  }

  const ensureArray = <T,>(val: unknown): T[] => (Array.isArray(val) ? (val as T[]) : []);
  const ensureString = (val: unknown, fallback = ""): string =>
    typeof val === "string" ? val : fallback;
  const ensureNumber = (val: unknown, fallback = 0): number =>
    typeof val === "number" ? val : fallback;

  const phasesRaw = ensureArray<Record<string, unknown>>(data.phases);
  const phases: RoadmapPhase[] = phasesRaw.map((p, i) => {
    const milestoneRaw =
      (p.milestone_project as Record<string, unknown>) ||
      (p.milestone as Record<string, unknown>) ||
      {};
    return {
      phase_number: ensureNumber(p.phase_number, i + 1),
      name: ensureString(p.name || p.title || p.phase_name, `Phase ${i + 1}`),
      duration: ensureString(p.duration, "TBD"),
      weekly_hours: ensureNumber(p.weekly_hours, 0),
      focus_area: ensureString(p.focus_area, ""),
      topics: ensureArray<Record<string, unknown>>(p.topics).map((t) => ({
        name: ensureString(t.name || t.topic || t.title, "Topic"),
        estimated_hours: ensureNumber(t.estimated_hours || t.hours, 0),
        subtopics: ensureArray<string>(t.subtopics || t.details),
      })),
      tools: ensureArray<string>(p.tools || p.stack),
      skills_gained: ensureArray<string>(p.skills_gained || p.outcomes),
      common_mistakes: ensureArray<string>(p.common_mistakes || p.traps),
      milestone_project: {
        name: ensureString(milestoneRaw.name, ""),
        description: ensureString(milestoneRaw.description, ""),
        deliverables: ensureArray<string>(milestoneRaw.deliverables),
        estimated_hours: ensureNumber(
          milestoneRaw.estimated_hours || milestoneRaw.hours,
          0
        ),
      },
      checkpoint: ensureString(p.checkpoint, ""),
    };
  });

  return {
    roadmap_id: (data.roadmap_id as string | number) || (data.id as string | number) || "",
    title: ensureString(data.title, goal),
    description: ensureString(data.description, ""),
    total_duration: ensureString(data.total_duration, ""),
    weekly_hours: ensureNumber(data.weekly_hours, 0),
    salary_range: ensureString(data.salary_range, ""),
    job_titles: ensureArray<string>(data.job_titles),
    summary: ensureString(data.summary, ""),
    phases,
    career_outcomes: ensureArray<string>(data.career_outcomes),
    next_steps_after_roadmap: ensureArray<string>(data.next_steps_after_roadmap),
    prerequisites: ensureArray<string>(data.prerequisites),
    industry_demand: ensureString(data.industry_demand, ""),
  };
}

/**
 * Map a raw error message into a user-friendly card. Uses word-boundary
 * matching to avoid false positives like matching "long" inside "belong".
 */
export function getErrorInfo(err: string) {
  const lc = err.toLowerCase();
  const hasWord = (word: string) =>
    new RegExp(`\\b${word}\\b`, "i").test(err);

  if (hasWord("network") || hasWord("fetch") || lc.includes("failed to fetch")) {
    return {
      type: "Network Connection",
      icon: <WifiOff className="h-5 w-5" />,
      description:
        "We're having trouble connecting to the AI service. This is usually temporary.",
      tips: [
        "Check your internet connection",
        "Disable VPN or proxy if active",
        "Try again in a few moments",
        "Ensure your ad-blocker isn't interfering with the API",
      ],
    };
  }

  if (hasWord("unauthorized") || hasWord("session") || hasWord("token")) {
    return {
      type: "Session Expired",
      icon: <UserX className="h-5 w-5" />,
      description:
        "Your session appears to have expired or your account is no longer authenticated.",
      tips: [
        "Refresh the page and log in again",
        "Check if you're signed in on another tab",
        "Clear your browser cookies and try again",
      ],
    };
  }

  if (hasWord("limit") || hasWord("quota") || lc.includes("too many requests")) {
    return {
      type: "System Limit Reached",
      icon: <ShieldAlert className="h-5 w-5" />,
      description:
        "The AI service is currently processing a high volume of requests or you've reached a daily limit.",
      tips: [
        "Wait for 1–5 minutes before trying again",
        "Try a slightly different goal description",
        "Upgrade your plan for higher usage limits",
      ],
    };
  }

  if (hasWord("timeout") || lc.includes("timed out")) {
    return {
      type: "Request Timeout",
      icon: <RefreshCw className="h-5 w-5 animate-spin-slow" />,
      description:
        "The generation took too long to complete. Complex roadmaps can sometimes time out.",
      tips: [
        "Try making your goal more specific",
        "Refresh and try again — the previous generation might have partially succeeded",
        "Ensure you have a stable connection",
      ],
    };
  }

  return {
    type: "Generation Error",
    icon: <AlertCircle className="h-5 w-5" />,
    description: err || "Something went wrong while generating your roadmap.",
    tips: [
      "Simplify your learning goal",
      "Try another current level setting",
      "If it persists, contact support with your goal details",
    ],
  };
}
