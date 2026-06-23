// Lightweight response validation — no external dependencies

export function validateResponse<T>(
  data: unknown,
  validator: (d: unknown) => d is T
): { success: true; data: T } | { success: false; error: string } {
  if (validator(data)) return { success: true, data };
  return { success: false, error: "Response validation failed" };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasStringKeys(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((k) => typeof obj[k] === "string");
}

// --- ExplainPhaseResponse ---

export interface ExplainPhaseResponse {
  whatYoullLearn: string;
  whatYoullBuild: string;
  topTip: string;
}

export function isExplainPhaseResponse(d: unknown): d is ExplainPhaseResponse {
  return isObject(d) && hasStringKeys(d, ["whatYoullLearn", "whatYoullBuild", "topTip"]);
}

// --- ExplainGapResponse ---

export interface ExplainGapResponse {
  whyItMatters: string;
  ifYouSkipIt: string;
}

export function isExplainGapResponse(d: unknown): d is ExplainGapResponse {
  return isObject(d) && hasStringKeys(d, ["whyItMatters", "ifYouSkipIt"]);
}

// --- TrendExplainResponse ---

export interface TrendExplainResponse {
  whyTrending: string;
  whatsDrivingDemand: string;
}

export function isTrendExplainResponse(d: unknown): d is TrendExplainResponse {
  return isObject(d) && hasStringKeys(d, ["whyTrending", "whatsDrivingDemand"]);
}
