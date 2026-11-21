/**
 * Live evaluation of the AI scoring step (analyzeWithAI in
 * services/parserService.ts) on the labelled pairs. Makes real model calls,
 * one per resume (20 in total), through services/aiClient.ts: Gemini when
 * GEMINI_API_KEY is set, otherwise OpenAI.
 *
 *   GEMINI_API_KEY=... npx tsx evals/matching/live.ts
 *
 * Prints a Markdown summary and writes it to reports/matching-live-YYYY-MM-DD.md
 * (git-ignored). It refuses to run without a key, so no score is ever produced
 * from a stub. The job postings go in exactly as the pipeline would send them:
 * code-extracted requirements, with no Gemini fallback.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  analyzeWithAI,
  detectResumeExperienceYears,
  extractJobRequirementsFromCode,
  extractResumeSkills,
  type NormalizedJob,
} from "../../services/parserService";
import { aiKeyAvailable, aiProvider, chatModel } from "../../services/aiClient";
import type { Dataset } from "./evaluate";
import { formatLiveReport, scoreLive, type LiveRating } from "./liveScore";

async function main() {
  if (!aiKeyAvailable()) {
    console.error("No AI key (GEMINI_API_KEY or OPENAI_API_KEY): the live evaluation needs a real model, so it will not run.");
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(new URL("./dataset.json", import.meta.url), "utf8")) as Dataset;
  const jobs = new Map(data.jobs.map((j) => [j.id, j]));
  const ratings: LiveRating[] = [];

  for (const resume of data.resumes) {
    const pairs = data.pairs.filter((p) => p.resume === resume.id);
    if (pairs.length < 2) continue;
    const normalized: NormalizedJob[] = pairs.map((p) => {
      const j = jobs.get(p.job)!;
      return {
        job_id: j.id,
        job_title: j.title,
        employer_name: "Example Co",
        employment_type: "FULLTIME",
        is_remote: true,
        apply_link: "https://example.com/jobs",
        description: j.text,
        location: "Remote",
        country: null,
        min_salary: null,
        max_salary: null,
      };
    });
    const results = await analyzeWithAI(
      normalized,
      normalized.map((n) => extractJobRequirementsFromCode(n.description)),
      extractResumeSkills(resume.text),
      resume.text,
      // Neutral on purpose: a job title here would hint at the expected match.
      { role: "software or data role", country: "Pakistan", jobType: "full-time" },
      detectResumeExperienceYears(resume.text),
    );
    for (const p of pairs) {
      const title = jobs.get(p.job)!.title.toLowerCase();
      const hit = results.find((r) => r.jobTitle.toLowerCase() === title);
      ratings.push({ ...p, matchScore: hit ? hit.matchScore : null });
    }
    console.error(`[live] ${resume.id}: ${pairs.length} jobs rated`);
  }

  const date = new Date().toISOString().slice(0, 10);
  const markdown = formatLiveReport(scoreLive(ratings), { model: `${chatModel()} (${aiProvider()})`, date });
  console.log(markdown);
  mkdirSync("reports", { recursive: true });
  writeFileSync(`reports/matching-live-${date}.md`, `${markdown}\n\n<details><summary>Ratings</summary>\n\n\`\`\`json\n${JSON.stringify(ratings, null, 2)}\n\`\`\`\n</details>\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
