/**
 * Offline evaluation of SkillSync's code-based matching (services/parserService.ts):
 * skill extraction, experience detection, required/preferred classification,
 * and the pre-score that decides which 8 jobs reach the AI step.
 *
 * Pure and deterministic: no network, no API keys. The labelled data is in
 * evals/matching/dataset.json; tests/matchingEval.test.ts runs this in CI and
 * `npx tsx evals/matching/run.ts` prints the full report.
 */
import {
  detectResumeExperienceYears,
  extractJobRequirementsFromCode,
  extractResumeSkills,
  preScoreMatch,
} from "../../services/parserService";

export type FitLabel = "strong" | "partial" | "poor";

export interface Dataset {
  resumes: { id: string; kind: string; expected_years: number | null; text: string; expected_skills: string[] }[];
  jobs: {
    id: string;
    title: string;
    expected_years: number;
    text: string;
    expected_skills: string[];
    expected_must_have?: string[];
    expected_nice_to_have?: string[];
  }[];
  pairs: { resume: string; job: string; label: FitLabel }[];
}

/** How many jobs the pipeline sends on to the AI step (analyzeWithAI). */
export const AI_FUNNEL_SIZE = 8;

// Keywords the extractor can return in more than one spelling, folded to one
// name so "llm" + "llms" counts as one skill, not a false positive.
const SYNONYMS: Record<string, string> = {
  llms: "llm",
  "fine tuning": "fine-tuning",
  "express.js": "express",
  "retell ai": "retell",
  "aws bedrock": "bedrock",
  "gpt-4": "gpt",
  "gpt-4o": "gpt",
  "agentic workflows": "agentic",
  "bash scripting": "bash",
  "google cloud": "gcp",
  "data analytics": "data analysis",
};

export const canonical = (skill: string) => SYNONYMS[skill.toLowerCase()] ?? skill.toLowerCase();
const canonSet = (skills: string[]) => new Set(skills.map(canonical));

export interface PrecisionRecall {
  precision: number;
  recall: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

function precisionRecall(items: { expected: string[]; predicted: string[] }[], misses: Map<string, number>, extras: Map<string, number>): PrecisionRecall {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const { expected, predicted } of items) {
    const e = canonSet(expected);
    const p = canonSet(predicted);
    for (const s of p) {
      if (e.has(s)) tp++;
      else {
        fp++;
        extras.set(s, (extras.get(s) ?? 0) + 1);
      }
    }
    for (const s of e) {
      if (!p.has(s)) {
        fn++;
        misses.set(s, (misses.get(s) ?? 0) + 1);
      }
    }
  }
  return {
    precision: tp + fp === 0 ? 1 : tp / (tp + fp),
    recall: tp + fn === 0 ? 1 : tp / (tp + fn),
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
  };
}

export interface EvaluationReport {
  counts: { resumes: number; jobs: number; pairs: number; strong: number; partial: number; poor: number };
  resumeSkills: PrecisionRecall;
  jobSkills: PrecisionRecall;
  /** Labelled resumes whose detected years are within one year of the label. */
  experienceDetection: { correct: number; total: number; accuracy: number; errors: { id: string; expected: number; detected: number }[] };
  /** Job postings whose required years are read exactly. */
  jobYears: { correct: number; total: number; accuracy: number };
  /** Labelled required/preferred skills that land in the right bucket. */
  sectionClassification: { correct: number; total: number; accuracy: number };
  /** Same-resume pairs with different labels ordered correctly by pre-score (ties count half). */
  pairwiseOrdering: { correct: number; total: number; accuracy: number };
  meanPreScore: Record<FitLabel, number>;
  /** Expected share of strong fits that make the top-8 cut when each resume is scored against all jobs. */
  strongRecallAtFunnel: number;
  topMisses: [string, number][];
  topFalsePositives: [string, number][];
}

const ratio = (a: number, b: number) => (b === 0 ? 1 : a / b);
const top = (m: Map<string, number>, n = 8) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);

export function evaluate(data: Dataset): EvaluationReport {
  const misses = new Map<string, number>();
  const extras = new Map<string, number>();

  const resumeSkills = new Map(data.resumes.map((r) => [r.id, extractResumeSkills(r.text)]));
  const resumeYears = new Map(data.resumes.map((r) => [r.id, detectResumeExperienceYears(r.text)]));
  const jobReqs = new Map(data.jobs.map((j) => [j.id, extractJobRequirementsFromCode(j.text)]));

  const resumeSkillPR = precisionRecall(
    data.resumes.map((r) => ({ expected: r.expected_skills, predicted: resumeSkills.get(r.id)! })),
    misses,
    extras,
  );
  const jobSkillPR = precisionRecall(
    data.jobs.map((j) => ({ expected: j.expected_skills, predicted: jobReqs.get(j.id)!.skills })),
    misses,
    extras,
  );

  const labelledYears = data.resumes.filter((r) => r.expected_years !== null);
  const yearErrors = labelledYears
    .map((r) => ({ id: r.id, expected: r.expected_years as number, detected: resumeYears.get(r.id)! }))
    .filter((e) => Math.abs(e.expected - e.detected) > 1);
  const expCorrect = labelledYears.length - yearErrors.length;

  const jobYearsCorrect = data.jobs.filter((j) => jobReqs.get(j.id)!.yearsRequired === j.expected_years).length;

  let classCorrect = 0;
  let classTotal = 0;
  for (const j of data.jobs) {
    if (!j.expected_must_have) continue;
    const reqs = jobReqs.get(j.id)!;
    const must = canonSet(reqs.mustHave);
    const nice = canonSet(reqs.niceToHave);
    for (const s of j.expected_must_have) {
      classTotal++;
      if (must.has(canonical(s))) classCorrect++;
    }
    for (const s of j.expected_nice_to_have ?? []) {
      classTotal++;
      if (nice.has(canonical(s))) classCorrect++;
    }
  }

  const preScore = (resumeId: string, jobId: string) =>
    preScoreMatch(resumeSkills.get(resumeId)!, jobReqs.get(jobId)!, resumeYears.get(resumeId)!);

  const rank: Record<FitLabel, number> = { strong: 2, partial: 1, poor: 0 };
  let orderCorrect = 0;
  let orderTotal = 0;
  const byResume = new Map<string, { job: string; label: FitLabel; score: number }[]>();
  for (const p of data.pairs) {
    const list = byResume.get(p.resume) ?? [];
    list.push({ job: p.job, label: p.label, score: preScore(p.resume, p.job) });
    byResume.set(p.resume, list);
  }
  for (const list of byResume.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        if (list[a].label === list[b].label) continue;
        const [hi, lo] = rank[list[a].label] > rank[list[b].label] ? [list[a], list[b]] : [list[b], list[a]];
        orderTotal++;
        if (hi.score > lo.score) orderCorrect++;
        else if (hi.score === lo.score) orderCorrect += 0.5;
      }
    }
  }

  const sums: Record<FitLabel, [number, number]> = { strong: [0, 0], partial: [0, 0], poor: [0, 0] };
  for (const list of byResume.values()) for (const e of list) (sums[e.label][0] += e.score), (sums[e.label][1] += 1);
  const meanPreScore = Object.fromEntries(
    (Object.keys(sums) as FitLabel[]).map((k) => [k, sums[k][1] ? Math.round((sums[k][0] / sums[k][1]) * 10) / 10 : 0]),
  ) as Record<FitLabel, number>;

  // Score every resume against every job, as the pipeline scores every fetched
  // posting. A strong fit survives if fewer than 8 jobs outscore it; ties at the
  // cut are shared, since the API's order (not merit) breaks them.
  let survived = 0;
  let strongTotal = 0;
  for (const [resumeId, list] of byResume) {
    const all = data.jobs.map((j) => preScore(resumeId, j.id));
    for (const e of list.filter((x) => x.label === "strong")) {
      strongTotal++;
      const higher = all.filter((s) => s > e.score).length;
      const tied = all.filter((s) => s === e.score).length;
      survived += Math.min(1, Math.max(0, (AI_FUNNEL_SIZE - higher) / tied));
    }
  }

  return {
    counts: {
      resumes: data.resumes.length,
      jobs: data.jobs.length,
      pairs: data.pairs.length,
      strong: data.pairs.filter((p) => p.label === "strong").length,
      partial: data.pairs.filter((p) => p.label === "partial").length,
      poor: data.pairs.filter((p) => p.label === "poor").length,
    },
    resumeSkills: resumeSkillPR,
    jobSkills: jobSkillPR,
    experienceDetection: { correct: expCorrect, total: labelledYears.length, accuracy: ratio(expCorrect, labelledYears.length), errors: yearErrors },
    jobYears: { correct: jobYearsCorrect, total: data.jobs.length, accuracy: ratio(jobYearsCorrect, data.jobs.length) },
    sectionClassification: { correct: classCorrect, total: classTotal, accuracy: ratio(classCorrect, classTotal) },
    pairwiseOrdering: { correct: orderCorrect, total: orderTotal, accuracy: ratio(orderCorrect, orderTotal) },
    meanPreScore,
    strongRecallAtFunnel: ratio(survived, strongTotal),
    topMisses: top(misses),
    topFalsePositives: top(extras),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Markdown summary for the README and the CLI. */
export function formatReport(r: EvaluationReport): string {
  return [
    `Dataset: ${r.counts.resumes} resumes, ${r.counts.jobs} job postings, ${r.counts.pairs} labelled pairs (${r.counts.strong} strong, ${r.counts.partial} partial, ${r.counts.poor} poor).`,
    "",
    "| Stage | Metric | Result |",
    "|---|---|---|",
    `| Resume skills | precision / recall | ${pct(r.resumeSkills.precision)} / ${pct(r.resumeSkills.recall)} |`,
    `| Job skills | precision / recall | ${pct(r.jobSkills.precision)} / ${pct(r.jobSkills.recall)} |`,
    `| Resume experience | within ±1 year | ${r.experienceDetection.correct}/${r.experienceDetection.total} (${pct(r.experienceDetection.accuracy)}) |`,
    `| Job years required | exact | ${r.jobYears.correct}/${r.jobYears.total} (${pct(r.jobYears.accuracy)}) |`,
    `| Required vs preferred | skills in the right bucket | ${r.sectionClassification.correct}/${r.sectionClassification.total} (${pct(r.sectionClassification.accuracy)}) |`,
    `| Pre-score | pairs ordered correctly | ${r.pairwiseOrdering.correct}/${r.pairwiseOrdering.total} (${pct(r.pairwiseOrdering.accuracy)}) |`,
    `| Pre-score | mean, strong / partial / poor | ${r.meanPreScore.strong} / ${r.meanPreScore.partial} / ${r.meanPreScore.poor} |`,
    `| Top-${AI_FUNNEL_SIZE} cut | strong fits that reach the AI step | ${pct(r.strongRecallAtFunnel)} |`,
    "",
    `Most-missed skills: ${r.topMisses.map(([s, n]) => `${s} (${n})`).join(", ") || "none"}`,
    `Most common false positives: ${r.topFalsePositives.map(([s, n]) => `${s} (${n})`).join(", ") || "none"}`,
    r.experienceDetection.errors.length
      ? `Experience errors: ${r.experienceDetection.errors.map((e) => `${e.id} expected ${e.expected}, got ${e.detected}`).join("; ")}`
      : "Experience errors: none",
  ].join("\n");
}
