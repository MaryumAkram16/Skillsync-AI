import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonical, evaluate, type Dataset } from '../evals/matching/evaluate';
import { scoreLive } from '../evals/matching/liveScore';
import { detectResumeExperienceYears, extractResumeSkills, skillPattern } from '../services/parserService';

const data = JSON.parse(readFileSync(new URL('../evals/matching/dataset.json', import.meta.url), 'utf8')) as Dataset;

// The vocabulary the extractor can return, read from the source so the labels
// can never use a skill name the code doesn't know.
const source = readFileSync(new URL('../services/parserService.ts', import.meta.url), 'utf8');
const knownSkills = new Set(
  [...source.slice(source.indexOf('const KNOWN_SKILLS'), source.indexOf('];', source.indexOf('const KNOWN_SKILLS'))).matchAll(/"([^"]+)"/g)].map((m) =>
    canonical(m[1]),
  ),
);

describe('matching evaluation dataset', () => {
  it('only labels skills from KNOWN_SKILLS', () => {
    const labels = [
      ...data.resumes.flatMap((r) => r.expected_skills),
      ...data.jobs.flatMap((j) => [...j.expected_skills, ...(j.expected_must_have ?? []), ...(j.expected_nice_to_have ?? [])]),
    ];
    expect(labels.filter((s) => !knownSkills.has(canonical(s)))).toEqual([]);
  });

  it('has consistent ids, labels and required/preferred splits', () => {
    const resumeIds = new Set(data.resumes.map((r) => r.id));
    const jobIds = new Set(data.jobs.map((j) => j.id));
    expect(resumeIds.size).toBe(data.resumes.length);
    expect(jobIds.size).toBe(data.jobs.length);
    for (const p of data.pairs) {
      expect(resumeIds.has(p.resume), p.resume).toBe(true);
      expect(jobIds.has(p.job), p.job).toBe(true);
      expect(['strong', 'partial', 'poor']).toContain(p.label);
    }
    for (const j of data.jobs) {
      if (!j.expected_must_have) continue;
      const split = [...j.expected_must_have, ...(j.expected_nice_to_have ?? [])].map(canonical).sort();
      expect(split, j.id).toEqual(j.expected_skills.map(canonical).sort());
    }
  });
});

describe('matching evaluation results (regression floor)', () => {
  // Floors are the results recorded in the README. Raise them when the code
  // improves; a drop below them fails CI.
  const report = evaluate(data);

  it('extracts skills from resumes and job postings', () => {
    expect(report.resumeSkills.precision).toBeGreaterThanOrEqual(0.99);
    expect(report.resumeSkills.recall).toBeGreaterThanOrEqual(0.98);
    expect(report.jobSkills.precision).toBeGreaterThanOrEqual(0.98);
    expect(report.jobSkills.recall).toBeGreaterThanOrEqual(0.98);
  });

  it('reads experience and required years', () => {
    expect(report.experienceDetection.accuracy).toBe(1);
    expect(report.jobYears.accuracy).toBe(1);
  });

  it('separates required from preferred skills', () => {
    expect(report.sectionClassification.accuracy).toBeGreaterThanOrEqual(0.95);
  });

  it('ranks strong fits above weaker ones and keeps them in the top-8 funnel', () => {
    expect(report.pairwiseOrdering.accuracy).toBeGreaterThanOrEqual(0.94);
    expect(report.meanPreScore.strong).toBeGreaterThan(report.meanPreScore.partial);
    expect(report.meanPreScore.partial).toBeGreaterThan(report.meanPreScore.poor);
    expect(report.strongRecallAtFunnel).toBe(1);
  });
});

describe('skillPattern', () => {
  it('matches whole words, case-insensitively, including plurals', () => {
    expect(skillPattern('rest api').test('Integrated REST APIs from a backend')).toBe(true);
    expect(skillPattern('webhook').test('webhooks and queues')).toBe(true);
    expect(skillPattern('websocket').test('WebSockets')).toBe(true);
    expect(skillPattern('data pipeline').test('build data pipelines')).toBe(true);
    expect(skillPattern('python').test('pythonic code')).toBe(false);
    expect(skillPattern('java').test('JavaScript')).toBe(false);
  });

  it('does not pluralise everyday words or very short keywords', () => {
    expect(skillPattern('make').test('this makes it easy')).toBe(false);
    expect(skillPattern('express').test('she expresses ideas')).toBe(false);
    expect(skillPattern('go').test('the role goes remote')).toBe(false);
    expect(skillPattern('r').test('rs')).toBe(false);
    expect(skillPattern('aws').test('AWS')).toBe(true); // already ends in s
  });

  it('is what extractResumeSkills uses', () => {
    expect(extractResumeSkills('Built REST APIs and webhooks')).toEqual(expect.arrayContaining(['rest api', 'webhook']));
  });
});

describe('detectResumeExperienceYears', () => {
  it('ignores date ranges that belong to a degree', () => {
    expect(detectResumeExperienceYears('BS Computer Science student (2022 - 2026). Projects in Python.')).toBe(0);
    expect(detectResumeExperienceYears('University of Lahore, 2019 – 2023. Seeking an internship.')).toBe(0);
  });

  it('reads month-name ranges', () => {
    expect(detectResumeExperienceYears('Backend Engineer, Acme — Mar 2020 – Feb 2025')).toBe(5);
    expect(detectResumeExperienceYears('Engineer, Jan 2018 - Dec 2021')).toBe(3);
  });

  it('still counts work ranges next to a degree on another line', () => {
    const text = 'BSc Mathematics (2014 – 2018)\nData Engineer, Acme (2018 – 2022)';
    expect(detectResumeExperienceYears(text)).toBe(4);
  });

  it('prefers an explicit "N years of experience"', () => {
    expect(detectResumeExperienceYears('7 years of experience. BS (2010 - 2014)')).toBe(7);
  });
});


describe('scoreLive (live AI evaluation scoring)', () => {
  it('measures ordering, means and the prompt thresholds, and counts left-out jobs', () => {
    const r = scoreLive([
      { resume: 'R1', job: 'A', label: 'strong', matchScore: 85 },
      { resume: 'R1', job: 'B', label: 'partial', matchScore: 60 },
      { resume: 'R1', job: 'C', label: 'poor', matchScore: 65 }, // above partial: one ordering error
      { resume: 'R2', job: 'D', label: 'strong', matchScore: 50 },
      { resume: 'R2', job: 'E', label: 'poor', matchScore: 50 }, // tie counts half
      { resume: 'R2', job: 'F', label: 'partial', matchScore: null },
    ]);
    expect(r.rated).toBe(5);
    expect(r.missing).toBe(1);
    expect(r.pairwiseOrdering).toEqual({ correct: 2.5, total: 4, accuracy: 0.625 });
    expect(r.meanMatchScore).toEqual({ strong: 67.5, partial: 60, poor: 57.5 });
    expect(r.strongAtLeast70).toEqual({ count: 1, total: 2 });
    expect(r.poorBelow50).toEqual({ count: 0, total: 2 });
  });
});
