/**
 * Scores the AI step's job ratings against the labelled pairs. Pure, so it is
 * unit-tested offline; evals/matching/live.ts supplies real model output.
 */
import type { FitLabel } from "./evaluate";

export interface LiveRating {
  resume: string;
  job: string;
  label: FitLabel;
  /** analyzeWithAI's matchScore, or null if the model left the job out. */
  matchScore: number | null;
}

export interface LiveReport {
  rated: number;
  missing: number;
  /** Same-resume pairs with different labels ordered correctly (ties count half). */
  pairwiseOrdering: { correct: number; total: number; accuracy: number };
  meanMatchScore: Record<FitLabel, number | null>;
  /** The prompt tells the model to score a job below 50 when core skills are missing. */
  poorBelow50: { count: number; total: number };
  strongAtLeast70: { count: number; total: number };
}

const RANK: Record<FitLabel, number> = { strong: 2, partial: 1, poor: 0 };

export function scoreLive(ratings: LiveRating[]): LiveReport {
  const rated = ratings.filter((r) => r.matchScore !== null) as (LiveRating & { matchScore: number })[];

  let correct = 0;
  let total = 0;
  const byResume = new Map<string, typeof rated>();
  for (const r of rated) byResume.set(r.resume, [...(byResume.get(r.resume) ?? []), r]);
  for (const list of byResume.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        if (list[a].label === list[b].label) continue;
        const [hi, lo] = RANK[list[a].label] > RANK[list[b].label] ? [list[a], list[b]] : [list[b], list[a]];
        total++;
        if (hi.matchScore > lo.matchScore) correct++;
        else if (hi.matchScore === lo.matchScore) correct += 0.5;
      }
    }
  }

  const mean = (label: FitLabel) => {
    const xs = rated.filter((r) => r.label === label).map((r) => r.matchScore);
    return xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null;
  };
  const poor = rated.filter((r) => r.label === "poor");
  const strong = rated.filter((r) => r.label === "strong");

  return {
    rated: rated.length,
    missing: ratings.length - rated.length,
    pairwiseOrdering: { correct, total, accuracy: total ? correct / total : 1 },
    meanMatchScore: { strong: mean("strong"), partial: mean("partial"), poor: mean("poor") },
    poorBelow50: { count: poor.filter((r) => r.matchScore < 50).length, total: poor.length },
    strongAtLeast70: { count: strong.filter((r) => r.matchScore >= 70).length, total: strong.length },
  };
}

export function formatLiveReport(r: LiveReport, meta: { model: string; date: string }): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return [
    `Live AI evaluation — ${meta.date} — model ${meta.model}`,
    "",
    "| Metric | Result |",
    "|---|---|",
    `| Pairs rated | ${r.rated} (${r.missing} left out by the model) |`,
    `| Pairs ordered correctly | ${r.pairwiseOrdering.correct}/${r.pairwiseOrdering.total} (${pct(r.pairwiseOrdering.accuracy)}) |`,
    `| Mean matchScore, strong / partial / poor | ${r.meanMatchScore.strong ?? "—"} / ${r.meanMatchScore.partial ?? "—"} / ${r.meanMatchScore.poor ?? "—"} |`,
    `| Strong fits scored 70+ | ${r.strongAtLeast70.count}/${r.strongAtLeast70.total} |`,
    `| Poor fits scored below 50 | ${r.poorBelow50.count}/${r.poorBelow50.total} |`,
  ].join("\n");
}
