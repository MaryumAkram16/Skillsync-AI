/**
 * parserService.ts — SkillSync Resume Parser + Job Matcher
 *
 * Architecture (cost-optimised, 3-tier):
 *
 *  1. Fetch jobs from JSearch (RapidAPI)
 *  2. Extract resume skills from plain text using CODE (free, no API)
 *  3. Extract job requirements from descriptions using CODE (free, no API)
 *     └─ If code extraction yields < 5 skills → fallback to Gemini Flash (cheap)
 *        └─ If Gemini fails → use raw description truncated to 800 chars (last resort)
 *  4. Score & match resume skills vs job requirements using CODE (free, no API)
 *  5. Send only the TOP 5 matched jobs + clean structured data to OpenAI
 *     for final scoring, ATS analysis, and missing skills (small prompt = cheap)
 *  6. Rank, compute gap score, fetch YouTube resources
 *
 * Token savings vs original: ~70-80% reduction in OpenAI usage
 */

import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { withGeminiRetry, runWithConcurrency } from "./geminiRetry";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedJob {
  jobTitle: string;
  company: string;
  location: string;
  isRemote: boolean;
  employmentType: string;
  applyLink: string;
  matchScore: number;
  atsScore: number;
  skillMatchScore: number;
  finalScore: number;
  missingSkills?: string[];
  candidateSkills?: string[];
  technicalSkills?: { high: string[]; medium: string[]; low: string[] };
  softSkills?: { high: string[]; medium: string[]; low: string[] };
}

export interface AggregatedSkills {
  jobSkills: { high: string[]; medium: string[]; low: string[] };
  candidateSkills: string[];
  gapScore: number;
}

export interface MissingSkillWithResource {
  skill: string;
  videoUrl: string;
  videoTitle: string;
}

export interface ParserResult {
  topJobs: ParsedJob[];
  aggregatedSkills: AggregatedSkills;
  missingSkills: MissingSkillWithResource[];
}

interface RawJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_website?: string;
  job_employment_type: string;
  job_is_remote: boolean;
  job_apply_link: string;
  job_description?: string;
  job_posted_at_datetime_utc?: string;
  job_location?: string;
  job_city?: string;
  job_country?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_period?: string;
}

interface NormalizedJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  employment_type: string;
  is_remote: boolean;
  apply_link: string;
  description: string;
  location: string;
  country: string | null;
  min_salary: number | null;
  max_salary: number | null;
}

// Structured extracted requirements for a single job
interface JobRequirements {
  skills: string[];         // all detected skills
  mustHave: string[];       // from "required" / "must have" sections
  niceToHave: string[];     // from "preferred" / "nice to have" sections
  ambiguous: string[];      // section unclear — weighted lower than mustHave
  yearsRequired: number;    // 0 if not found
  education: string;        // e.g. "Bachelor's", "Master's", ""
  extractionMethod: "code" | "gemini" | "raw";
}

interface AIJobResult {
  jobTitle: string;
  company: string;
  location: string;
  isRemote: boolean;
  employmentType: string;
  applyLink: string;
  matchScore: number;
  atsScore: number;
  keywordMatchScore: number;
  experienceMatchScore: number;
  skillMatchScore: number;
  missingSkills: string[];
  candidateSkills: string[];
  technicalSkills: { high: string[]; medium: string[]; low: string[] };
  softSkills: { high: string[]; medium: string[]; low: string[] };
}

// ─── Step 1: Validate inputs ──────────────────────────────────────────────────

function validateInputs(role: string, country: string): void {
  if (!role || !role.trim()) throw new Error("role is required");
  if (!country || !country.trim()) throw new Error("country is required");
  // Allow alphanumeric, spaces, and common job title characters: +, -, /, ., (, ), &, '
  if (!/^[a-zA-Z0-9\s+\-/.()&']+$/.test(role.trim()))
    throw new Error("Target role contains invalid characters. Allowed: alphanumeric, spaces, and +-./()'&");
}

// ─── Step 2: Fetch jobs from JSearch ─────────────────────────────────────────

function cleanRole(raw: string): string {
  return raw.trim().replace(/\bjobs?\b/gi, "").replace(/\s{2,}/g, " ").trim();
}

async function fetchJobsOnce(
  queryText: string,
  datePosted: string,
  employmentTypes: string,
  isRemote: string,
  keys: string[]
): Promise<RawJob[]> {
  const query = encodeURIComponent(queryText);
  const url =
    `https://jsearch.p.rapidapi.com/search` +
    `?query=${query}&num_pages=2&date_posted=${datePosted}&results_per_page=6` +
    `&job_details=true&remote_jobs_only=${isRemote}&employment_types=${employmentTypes}`;

  for (let i = 0; i < keys.length; i++) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": keys[i]!,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      });
      if (res.ok) {
        const json = await res.json();
        const jobs: RawJob[] = json?.data ?? [];
        if (jobs.length > 0) {
          console.log(`[Parser] JSearch key ${i + 1} returned ${jobs.length} jobs`);
          return jobs;
        }
        return [];
      }
      const status = res.status;
      if ((status === 429 || status === 403) && i < keys.length - 1) {
        console.warn(`[Parser] JSearch key ${i + 1} rejected (${status}), trying fallback...`);
        continue;
      }
      throw new Error(`JSearch API error: ${status}`);
    } catch (err: any) {
      if (i < keys.length - 1) continue;
      throw err;
    }
  }
  return [];
}

async function fetchJobs(
  role: string,
  country: string,
  employmentType: string,
  locationType: string,
  candidateYearsExperience: number = 0
): Promise<RawJob[]> {
  const keys = [
    process.env.RAPIDAPI_KEY,
    process.env.RAPID_API_KEY,
    process.env.RAPIDAPI_KEY_2,
    process.env.RAPID_API_KEY_2
  ].filter(Boolean) as string[];
  if (keys.length === 0) throw new Error("No JSearch API keys configured.");

  const cleanedRole = cleanRole(role);

  const isEntryLevel = candidateYearsExperience === 0;
  const roleQuery = isEntryLevel
    ? `entry level OR junior OR internship ${cleanedRole}`
    : cleanedRole;
  const isRemote = locationType.toLowerCase() === "remote" ? "true" : "false";
  const employmentTypes = (() => {
    const et = (employmentType || "Full-time").toUpperCase();
    if (et === "FULL-TIME") return isEntryLevel ? "FULLTIME,INTERN" : "FULLTIME";
    if (et === "PART-TIME") return isEntryLevel ? "PARTTIME,INTERN" : "PARTTIME";
    if (et === "FREELANCE" || et === "CONTRACT") return "CONTRACTOR";
    return isEntryLevel ? "FULLTIME,PARTTIME,CONTRACTOR,INTERN" : "FULLTIME,PARTTIME,CONTRACTOR";
  })();

  const countryLower = country.toLowerCase();
  const buildQuery = (c: string) =>
    c.toLowerCase() === "worldwide" || !c ? roleQuery : `${roleQuery} in ${c}`;

  // Tier 1: date_posted=month, original country
  const queryT1 = buildQuery(country);
  console.log(`[Parser] Tier 1: "${queryT1}" date_posted=month`);
  let jobs = await fetchJobsOnce(queryT1, "month", employmentTypes, isRemote, keys);
  if (jobs.length > 0) return jobs;

  // Tier 2: date_posted=all, same country
  console.log(`[Parser] Tier 1 empty — Tier 2: "${queryT1}" date_posted=all`);
  jobs = await fetchJobsOnce(queryT1, "all", employmentTypes, isRemote, keys);
  if (jobs.length > 0) return jobs;

  // Tier 3: date_posted=all, Worldwide
  if (countryLower !== "worldwide") {
    const queryT3 = roleQuery;
    console.log(`[Parser] Tier 2 empty — Tier 3: "${queryT3}" date_posted=all (Worldwide)`);
    jobs = await fetchJobsOnce(queryT3, "all", employmentTypes, isRemote, keys);
    if (jobs.length > 0) return jobs;
  }

  throw new Error(`No jobs found for "${cleanedRole}". Try a different or broader job title.`);
}

// ─── Step 3: Normalize jobs ───────────────────────────────────────────────────

function normalizeJobs(rawJobs: RawJob[]): NormalizedJob[] {
  return rawJobs
    .map((job) => ({
      job_id: job.job_id || "",
      job_title: job.job_title || "",
      employer_name: job.employer_name || "",
      employment_type: job.job_employment_type || "",
      is_remote: job.job_is_remote || false,
      apply_link: job.job_apply_link || "",
      description: (job.job_description || "").trim(),
      location: job.job_city
        ? `${job.job_city}, ${job.job_country || ""}`
        : job.job_country || "Remote",
      country: job.job_country || null,
      min_salary: job.job_min_salary || null,
      max_salary: job.job_max_salary || null,
    }))
    .filter((j) => j.description.length > 50); // skip jobs with no description
}

// ─── Step 4a: Extract resume skills from plain text (CODE — FREE) ─────────────

// Comprehensive skill keyword list covering tech, AI, cloud, soft skills
const KNOWN_SKILLS = [
  // Languages
  "python","javascript","typescript","java","c++","c#","go","rust","php","swift",
  "kotlin","r","matlab","sql","bash","scala","ruby","perl","dart","lua",
  // AI / ML
  "llm","llms","openai","gpt","gpt-4","gpt-4o","gemini","claude","anthropic",
  "langchain","langgraph","llamaindex","huggingface","transformers","bert","rag",
  "vector database","pgvector","pinecone","weaviate","chroma","faiss",
  "prompt engineering","fine-tuning","fine tuning","embeddings","semantic search",
  "ai agents","agentic","agentic workflows","multi-agent","autonomous agents",
  "mcp","agent sdk","amazon strands","bedrock","aws bedrock","azure openai",
  "machine learning","deep learning","nlp","computer vision","tensorflow",
  "pytorch","keras","scikit-learn","pandas","numpy","matplotlib","mlops",
  "model evaluation","inference","quantization",
  // Automation / Workflow
  "n8n","zapier","make","airflow","prefect","celery","webhook","workflow automation",
  "api integration","rest api","graphql","grpc","fastapi","flask","django","express",
  // Cloud / DevOps
  "aws","azure","gcp","google cloud","docker","kubernetes","terraform","pulumi",
  "ci/cd","github actions","jenkins","buildkite","helm","linux","bash scripting",
  "serverless","lambda","cloud functions","supabase","firebase","vercel","netlify",
  // Databases
  "postgresql","mysql","mongodb","redis","elasticsearch","sqlite","firestore",
  "dynamodb","cassandra","neo4j","snowflake","bigquery",
  // Frontend / Backend
  "react","next.js","vue","angular","tailwind","html","css","node.js","express.js",
  "vite","webpack","redux","graphql",
  // Voice / Real-time
  "retell ai","retell","twilio","websocket","real-time","webrtc","voip",
  // Marketing Tech (for marketing AI roles)
  "salesforce","marketo","hubspot","crm","seo","sem","google ads","meta ads",
  // Data
  "data analysis","data analytics","power bi","tableau","looker","dbt","spark",
  "kafka","etl","data pipeline","feature engineering",
  // Soft skills
  "communication","leadership","problem solving","teamwork","agile","scrum",
  "project management","cross-functional","stakeholder management",
  // Certs / Platforms
  "azure ai","google ai","aws certified","microsoft certified",
];

// Soft skills get lower weight in matching — a job needing Python that you
// don't have shouldn't score well just because you have "communication".
const SOFT_SKILLS = new Set([
  "communication","leadership","problem solving","teamwork","agile","scrum",
  "project management","cross-functional","stakeholder management",
]);

// ─── Resume experience-level detection (for entry-level/internship bias) ──────

function detectResumeExperienceYears(resumeText: string): number {
  const text = resumeText.toLowerCase();

  // Explicit "X years of experience" mention
  const explicit = text.match(/(\d+)\+?\s*years?\s*(?:of\s+)?(?:professional\s+)?experience/i);
  if (explicit) return parseInt(explicit[1], 10);

  // Look for date ranges in work-experience-style entries, e.g. "2019 - 2023",
  // "Jan 2020 – Present" and sum up rough duration. Cheap heuristic, not exact.
  const yearRanges = [...text.matchAll(/(20\d{2}|19\d{2})\s*[-–—]\s*(20\d{2}|19\d{2}|present|current)/gi)];
  if (yearRanges.length > 0) {
    const now = new Date().getFullYear();
    let totalYears = 0;
    for (const m of yearRanges) {
      const start = parseInt(m[1], 10);
      const end = /present|current/i.test(m[2]) ? now : parseInt(m[2], 10);
      if (end >= start) totalYears += end - start;
    }
    return totalYears;
  }

  // Strong "student / fresh graduate / no experience" signals → treat as 0
  if (/\b(fresh graduate|recent graduate|undergraduate|currently pursuing|no prior experience|seeking (an? )?(entry.level|internship))\b/i.test(text)) {
    return 0;
  }

  // Default: unknown — assume entry-level rather than penalizing unfairly,
  // since most resumes without explicit years are early-career.
  return 0;
}

function extractResumeSkills(resumeText: string): string[] {
  const lower = resumeText.toLowerCase();
  const found = new Set<string>();

  for (const skill of KNOWN_SKILLS) {
    // Match whole word or phrase
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
    if (regex.test(lower)) found.add(skill);
  }

  // Also extract capitalized acronyms (e.g. "RAG", "LLM", "MCP")
  const acronyms = resumeText.match(/\b[A-Z]{2,6}\b/g) || [];
  for (const a of acronyms) {
    const lower_a = a.toLowerCase();
    if (KNOWN_SKILLS.includes(lower_a)) found.add(lower_a);
  }

  return Array.from(found);
}

// ─── Step 4b: Extract job requirements from description (CODE — FREE) ─────────

function extractJobRequirementsFromCode(description: string): JobRequirements {
  const text = description.toLowerCase();
  const skills = new Set<string>();
  const mustHave: string[] = [];
  const niceToHave: string[] = [];
  const ambiguous: string[] = [];

  // Extract all known skills from description
  for (const skill of KNOWN_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
    if (regex.test(text)) skills.add(skill);
  }

  // Detect "required" vs "preferred" sections
  // Split by common section headers
  const requiredSection = text.match(
    /(?:required|must.have|basic qualifications?|minimum qualifications?|responsibilities)[:\s]+([\s\S]*?)(?=preferred|nice.to.have|bonus|what makes you|$)/i
  )?.[1] || "";

  const preferredSection = text.match(
    /(?:preferred|nice.to.have|bonus|what makes you stand out)[:\s]+([\s\S]*?)(?=\n\n|salary|compensation|$)/i
  )?.[1] || "";

  // Classify skills into must-have vs nice-to-have. When section detection
  // fails (very common — many postings don't use clean "Required:" headers),
  // we no longer force everything into must-have, since that unfairly tanks
  // match scores for jobs that just don't follow that formatting. Instead
  // unclear skills go into `ambiguous`, weighted partially in preScoreMatch.
  for (const skill of skills) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
    if (preferredSection && regex.test(preferredSection)) {
      niceToHave.push(skill);
    } else if (requiredSection && regex.test(requiredSection)) {
      mustHave.push(skill);
    } else {
      ambiguous.push(skill);
    }
  }

  // Extract years of experience
  const yearsMatch = text.match(/(\d+)\+?\s*years?\s*(?:of\s+)?(?:experience|exp)/i);
  const yearsRequired = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;

  // Extract education
  let education = "";
  if (/phd|doctorate/i.test(text)) education = "PhD";
  else if (/master'?s?|msc|mba/i.test(text)) education = "Master's";
  else if (/bachelor'?s?|bsc|bs |b\.s\.|undergraduate/i.test(text)) education = "Bachelor's";

  return {
    skills: Array.from(skills),
    mustHave: [...new Set(mustHave)],
    niceToHave: [...new Set(niceToHave)],
    ambiguous: [...new Set(ambiguous)],
    yearsRequired,
    education,
    extractionMethod: "code",
  };
}

// ─── Step 4c: Gemini fallback extraction (when code gets < 5 skills) ──────────

async function extractJobRequirementsWithGemini(
  description: string,
  geminiKey: string
): Promise<JobRequirements> {
  try {
    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `Extract job requirements from this description. Return ONLY raw JSON, no markdown.
{
  "skills": ["list all technical and soft skills mentioned"],
  "mustHave": ["skills marked as required/must-have"],
  "niceToHave": ["skills marked as preferred/nice-to-have"],
  "yearsRequired": 0,
  "education": "Bachelor's or Master's or PhD or empty string"
}

Job Description (first 1500 chars):
${description.slice(0, 1500)}`;

    const result = await withGeminiRetry(
      () =>
        ai.models.generateContent({
          model: "gemini-2.0-flash-thinking-exp",
          contents: prompt,
          config: {
            maxOutputTokens: 1500,
            responseMimeType: "application/json",
            // Enable thinking for complex resume parsing
            thinkingConfig: { thinkingBudget: 1000 },
          },
        }),
      { label: "[Parser]" }
    );
    const candidate = result.candidates?.[0];
    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new Error("Gemini response was truncated (MAX_TOKENS) — increase maxOutputTokens or shorten the prompt");
    }
    const raw = result.text.trim();
    let cleaned = raw.replace(/^```+(?:json)?/i, "").replace(/```+$/i, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const maybeJson = cleaned.substring(firstBrace, lastBrace + 1);
        parsed = JSON.parse(maybeJson);
      } else {
        throw new Error("Gemini returned invalid JSON — no JSON object found");
      }
    }

    return {
      skills: parsed.skills || [],
      mustHave: parsed.mustHave || [],
      niceToHave: parsed.niceToHave || [],
      ambiguous: [],
      yearsRequired: Number(parsed.yearsRequired) || 0,
      education: parsed.education || "",
      extractionMethod: "gemini",
    };
  } catch (err) {
    console.warn("[Parser] Gemini extraction failed, using raw fallback:", err);
    // Last resort — return empty so OpenAI handles it with truncated raw text
    return {
      skills: [],
      mustHave: [],
      niceToHave: [],
      ambiguous: [],
      yearsRequired: 0,
      education: "",
      extractionMethod: "raw",
    };
  }
}

// ─── Step 4d: Extract requirements for all jobs (orchestrator) ────────────────

async function extractAllJobRequirements(
  jobs: NormalizedJob[]
): Promise<JobRequirements[]> {
  const geminiKey = (process.env.RESUME_PARSER_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || "").trim();
  if (process.env.RESUME_PARSER_GEMINI_API_KEY) console.log("[Parser] Using RESUME_PARSER_GEMINI_API_KEY");
  else if (process.env.GEMINI_API_KEY) console.log("[Parser] Using default GEMINI_API_KEY");

  // Fix: was Promise.all — with up to ~12 jobs, every job that fails the
  // code-extraction threshold could fire a Gemini call simultaneously.
  // Capped to 2 concurrent (retry/backoff is also handled inside
  // extractJobRequirementsWithGemini via withGeminiRetry).
  const settled = await runWithConcurrency(jobs, 2, async (job) => {
    // Always try code extraction first (free)
    const codeResult = extractJobRequirementsFromCode(job.description);
    console.log(
      `[Parser] Code extracted ${codeResult.skills.length} skills for "${job.job_title}"`
    );

    // If code got enough skills, use it
    if (codeResult.skills.length >= 5) return codeResult;

    // Not enough — try Gemini if key is available
    if (geminiKey) {
      console.log(`[Parser] Code got < 5 skills for "${job.job_title}", trying Gemini...`);
      const geminiResult = await extractJobRequirementsWithGemini(job.description, geminiKey);
      if (geminiResult.skills.length >= 3) return geminiResult;
    }

    // Last resort — return code result with raw flag so OpenAI handles it
    console.warn(`[Parser] Low skill extraction for "${job.job_title}", using raw fallback`);
    return { ...codeResult, extractionMethod: "raw" as const };
  });

  // runWithConcurrency never rejects (errors are caught inside the task),
  // but guard anyway and fall back to a raw-flagged code result per job.
  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { ...extractJobRequirementsFromCode(jobs[i].description), extractionMethod: "raw" as const }
  );
}

// ─── Step 5: Code-based pre-scoring (filter bad matches before OpenAI) ────────

function preScoreMatch(
  resumeSkills: string[],
  jobReqs: JobRequirements,
  candidateYearsExperience: number = 0
): number {
  if (jobReqs.skills.length === 0) return 50; // unknown — let OpenAI decide

  const resumeSet = new Set(resumeSkills.map((s) => s.toLowerCase()));

  // Weighted skill scoring: technical skills count full weight, soft skills
  // count for less — a candidate shouldn't look like a great fit for a job
  // just because they have "communication" and "teamwork" while missing
  // every hard technical requirement.
  const weightOf = (skill: string) => (SOFT_SKILLS.has(skill.toLowerCase()) ? 0.4 : 1);

  const scoreBucket = (bucket: string[]) => {
    if (bucket.length === 0) return null;
    let earned = 0;
    let total = 0;
    for (const skill of bucket) {
      const w = weightOf(skill);
      total += w;
      if (resumeSet.has(skill.toLowerCase())) earned += w;
    }
    return total > 0 ? earned / total : null;
  };

  // mustHave and ambiguous skills both matter, but ambiguous skills (section
  // detection failed — could be a "nice to have" buried in a paragraph)
  // count for less than confirmed must-haves.
  const mustHaveSkills = jobReqs.mustHave.length > 0 ? jobReqs.mustHave : jobReqs.skills;
  const mustHaveRatio = scoreBucket(mustHaveSkills);
  const ambiguousRatio = scoreBucket(jobReqs.ambiguous);

  let coreScore: number;
  if (mustHaveRatio !== null && ambiguousRatio !== null) {
    coreScore = (mustHaveRatio * 0.75 + ambiguousRatio * 0.25) * 100;
  } else if (mustHaveRatio !== null) {
    coreScore = mustHaveRatio * 100;
  } else if (ambiguousRatio !== null) {
    coreScore = ambiguousRatio * 100;
  } else {
    coreScore = 50;
  }

  // Nice-to-have bonus
  const niceMatched = jobReqs.niceToHave.filter((s) => resumeSet.has(s.toLowerCase())).length;
  const niceBonus = jobReqs.niceToHave.length > 0
    ? (niceMatched / jobReqs.niceToHave.length) * 15
    : 0;

  // Experience-gap penalty: if the job wants significantly more years than
  // the candidate has, dock points proportionally (this is what surfaces
  // entry-level/internship-appropriate roles instead of senior postings).
  const experienceGap = Math.max(0, jobReqs.yearsRequired - candidateYearsExperience);
  const experiencePenalty = Math.min(30, experienceGap * 8);

  return Math.min(100, Math.max(0, Math.round(coreScore + niceBonus - experiencePenalty)));
}

// ─── Step 6: Send only TOP matched jobs to OpenAI for final scoring ───────────

async function analyzeWithAI(
  jobs: NormalizedJob[],
  jobRequirements: JobRequirements[],
  resumeSkills: string[],
  resumeText: string,
  applicant: { role: string; country: string; jobType: string },
  candidateYearsExperience: number = 0
): Promise<AIJobResult[]> {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  const openai = new OpenAI({ apiKey });

  // Pre-score all jobs with code — filter out poor matches before calling OpenAI
  const jobsWithPreScore = jobs.map((job, i) => ({
    job,
    reqs: jobRequirements[i],
    preScore: preScoreMatch(resumeSkills, jobRequirements[i], candidateYearsExperience),
  }));

  // Sort by pre-score, take top 8 (wider funnel than the final top-5 result —
  // gives OpenAI's stricter judgment a real pool to pick from instead of
  // just re-ordering the same 5 jobs the crude keyword pre-score already
  // committed to).
  const topCandidates = jobsWithPreScore
    .sort((a, b) => b.preScore - a.preScore)
    .slice(0, 8);

  console.log(
    `[Parser] Pre-scores: ${jobsWithPreScore.map(j => `${j.job.job_title}=${j.preScore}`).join(", ")}`
  );
  console.log(
    `[Parser] Sending top ${topCandidates.length} to OpenAI (candidate experience: ${candidateYearsExperience}yr, pre-score >= ${topCandidates[topCandidates.length-1]?.preScore || 0})`
  );

  // Build a LEAN prompt — structured data only, no raw descriptions
  const jobSummaries = topCandidates.map(({ job, reqs }, i) => {
    if (reqs.extractionMethod === "raw") {
      // Fallback: send short raw description for jobs where extraction failed
      return `Job ${i + 1}:
Title: ${job.job_title}
Company: ${job.employer_name}
Location: ${job.location}
Remote: ${job.is_remote}
EmploymentType: ${job.employment_type}
ApplyLink: ${job.apply_link}
Description: ${job.description.slice(0, 800)}`;
    }

    // Normal: send only structured extracted data (tiny)
    return `Job ${i + 1}:
Title: ${job.job_title}
Company: ${job.employer_name}
Location: ${job.location}
Remote: ${job.is_remote}
EmploymentType: ${job.employment_type}
ApplyLink: ${job.apply_link}
RequiredSkills: ${reqs.mustHave.join(", ") || reqs.skills.join(", ")}
AmbiguousSkills (mentioned but unclear if required): ${reqs.ambiguous.join(", ") || "None"}
PreferredSkills: ${reqs.niceToHave.join(", ")}
YearsRequired: ${reqs.yearsRequired || "Not specified"}
Education: ${reqs.education || "Not specified"}`;
  }).join("\n\n");

  // Resume summary — skills + a fuller excerpt (was 600 chars, too thin for
  // resumes where relevant experience sits further down the document).
  const resumeSummary = `
Candidate applying for: ${applicant.role} in ${applicant.country} (${applicant.jobType})
Candidate years of experience: ${candidateYearsExperience}
Detected skills from resume: ${resumeSkills.join(", ")}
Resume excerpt (first 2000 chars): ${resumeText.slice(0, 2000)}`.trim();

  const systemMessage = `You are an expert ATS resume evaluator. You receive pre-extracted structured job requirements and candidate skills.

Your job:
1. Score each job match (0-100) for: matchScore, atsScore, skillMatchScore
2. List missingSkills the candidate lacks for each job
3. Classify job skills into technicalSkills and softSkills buckets (high/medium/low demand)
4. Be STRICT — if candidate is missing core required skills, matchScore should be below 50
5. Be STRICT about experience level — if YearsRequired is significantly higher than the
   candidate's years of experience, treat this as a poor match (matchScore below 40) even
   if skills overlap, since the candidate likely won't be considered for that seniority.
   Conversely, if the candidate has 0 years of experience, prioritize/favor jobs explicitly
   labeled entry-level, junior, graduate, or internship.

Return ONLY raw JSON:
{
  "jobs": [
    {
      "jobTitle": "",
      "company": "",
      "location": "",
      "isRemote": false,
      "employmentType": "",
      "applyLink": "",
      "matchScore": 0,
      "atsScore": 0,
      "skillMatchScore": 0,
      "keywordMatchScore": 0,
      "experienceMatchScore": 0,
      "missingSkills": [],
      "candidateSkills": [],
      "technicalSkills": { "high": [], "medium": [], "low": [] },
      "softSkills": { "high": [], "medium": [], "low": [] }
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 2000,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: `CANDIDATE:\n${resumeSummary}\n\nJOBS:\n${jobSummaries}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let cleaned = raw.trim();
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```+(?:json)?/i, "").replace(/```+$/i, "").trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const maybeJson = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        parsed = JSON.parse(maybeJson);
      } catch (err: any) {
        throw new Error(`OpenAI returned invalid JSON: ${err.message}`);
      }
    } else {
      throw new Error("OpenAI returned invalid JSON — no JSON object found");
    }
  }

  if (!parsed?.jobs?.length) throw new Error("OpenAI returned no jobs");

  return parsed.jobs.map((job: any): AIJobResult => ({
    jobTitle: job.jobTitle || "",
    company: job.company || "",
    location: job.location || "",
    isRemote: job.isRemote || false,
    employmentType: job.employmentType || "",
    applyLink: job.applyLink || "",
    matchScore: Math.min(100, Math.max(0, Number(job.matchScore) || 0)),
    atsScore: Math.min(100, Math.max(0, Number(job.atsScore) || 0)),
    keywordMatchScore: Math.min(100, Math.max(0, Number(job.keywordMatchScore) || 0)),
    experienceMatchScore: Math.min(100, Math.max(0, Number(job.experienceMatchScore) || 0)),
    skillMatchScore: Math.min(100, Math.max(0, Number(job.skillMatchScore) || 0)),
    missingSkills: Array.isArray(job.missingSkills) ? job.missingSkills : [],
    candidateSkills: resumeSkills.slice(0, 20), // always from code extraction
    technicalSkills: {
      high: job.technicalSkills?.high || [],
      medium: job.technicalSkills?.medium || [],
      low: job.technicalSkills?.low || [],
    },
    softSkills: {
      high: job.softSkills?.high || [],
      medium: job.softSkills?.medium || [],
      low: job.softSkills?.low || [],
    },
  }));
}

// ─── Step 7: Rank + compute gap score ────────────────────────────────────────

function rankAndScore(aiJobs: AIJobResult[]): {
  topJobs: ParsedJob[];
  aggregatedSkills: AggregatedSkills;
  missingSkillsList: string[];
} {
  const allMissingSkills = new Set<string>();

  const scoredJobs = aiJobs.map((job) => {
    const finalScore =
      (job.matchScore || 0) * 0.5 +
      (job.atsScore || 0) * 0.3 +
      (job.skillMatchScore || 0) * 0.2;
    job.missingSkills.forEach((s) => allMissingSkills.add(s));
    return { ...job, finalScore };
  });

  const topJobs: ParsedJob[] = scoredJobs
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 5);

  const jobSkillBuckets: Record<"high"|"medium"|"low", Record<string,number>> = {
    high: {}, medium: {}, low: {},
  };
  for (const job of aiJobs) {
    for (const skill of job.technicalSkills.high || []) {
      const s = skill.toLowerCase().trim();
      jobSkillBuckets.high[s] = (jobSkillBuckets.high[s] || 0) + 1;
    }
    for (const skill of job.technicalSkills.medium || []) {
      const s = skill.toLowerCase().trim();
      jobSkillBuckets.medium[s] = (jobSkillBuckets.medium[s] || 0) + 1;
    }
    for (const skill of job.technicalSkills.low || []) {
      const s = skill.toLowerCase().trim();
      jobSkillBuckets.low[s] = (jobSkillBuckets.low[s] || 0) + 1;
    }
  }

  const sortedJobSkills = {
    high: Object.entries(jobSkillBuckets.high).sort((a,b)=>b[1]-a[1]).map(([s])=>s).slice(0,5),
    medium: Object.entries(jobSkillBuckets.medium).sort((a,b)=>b[1]-a[1]).map(([s])=>s).slice(0,5),
    low: Object.entries(jobSkillBuckets.low).sort((a,b)=>b[1]-a[1]).map(([s])=>s).slice(0,5),
  };

  const candidateSkillSet = new Set<string>();
  for (const job of aiJobs) {
    (job.candidateSkills || []).forEach((s) => candidateSkillSet.add(s.toLowerCase().trim()));
  }

  const requiredSkills = sortedJobSkills.high;
  const matched = requiredSkills.filter((s) => candidateSkillSet.has(s)).length;
  const gapScore = requiredSkills.length
    ? Math.round((matched / requiredSkills.length) * 100)
    : 0;

  return {
    topJobs,
    aggregatedSkills: {
      jobSkills: sortedJobSkills,
      candidateSkills: Array.from(candidateSkillSet),
      gapScore,
    },
    missingSkillsList: Array.from(allMissingSkills).slice(0, 10),
  };
}

// ─── Step 8: Fetch YouTube learning resources ─────────────────────────────────

async function fetchLearningResources(
  missingSkills: string[]
): Promise<MissingSkillWithResource[]> {
  const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY;

  const fetchSingle = async (skill: string): Promise<MissingSkillWithResource> => {
    if (!YOUTUBE_KEY) {
      return {
        skill,
        videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + " tutorial for beginners")}`,
        videoTitle: `Search: ${skill} tutorial`,
      };
    }
    try {
      const q = encodeURIComponent(skill + " tutorial for beginners");
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=1&key=${YOUTUBE_KEY}`
      );
      if (!res.ok) throw new Error("YouTube error");
      const json = await res.json();
      const video = json.items?.[0];
      if (video?.id?.videoId) {
        return {
          skill,
          videoUrl: `https://www.youtube.com/watch?v=${video.id.videoId}`,
          videoTitle: video.snippet?.title || skill,
        };
      }
    } catch { /* fall through */ }
    return {
      skill,
      videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + " tutorial")}`,
      videoTitle: `Search: ${skill} tutorial`,
    };
  };

  return Promise.all(missingSkills.map(fetchSingle));
}

// ─── Main exported function ───────────────────────────────────────────────────

export async function parseResumeAndFindJobs(
  userId: string,
  resumeText: string,
  role: string,
  country: string,
  employmentType: string,
  locationType: string
): Promise<ParserResult> {
  // 1. Validate
  validateInputs(role, country);

  // 1b. Detect candidate experience level from resume — drives entry-level/
  // internship bias in the job search and the experience-gap penalty below.
  const candidateYearsExperience = detectResumeExperienceYears(resumeText);
  console.log(`[Parser] Detected candidate experience: ${candidateYearsExperience} years`);

  // 2. Fetch live jobs from JSearch (entry-level/internship-biased if candidateYearsExperience === 0)
  const rawJobs = await fetchJobs(role, country, employmentType, locationType, candidateYearsExperience);

  // 3. Normalize + filter
  const validJobs = normalizeJobs(rawJobs);
  if (validJobs.length === 0)
    throw new Error(`No valid jobs found for "${role}" in "${country}". Try a different role.`);

  // 4. Extract resume skills from text using CODE (free)
  const resumeSkills = extractResumeSkills(resumeText);
  console.log(`[Parser] Extracted ${resumeSkills.length} resume skills from text`);

  // 5. Extract job requirements using CODE → Gemini fallback → raw fallback
  const jobRequirements = await extractAllJobRequirements(validJobs);

  // 6. Pre-score with code, filter top matches, send lean prompt to OpenAI
  const aiResults = await analyzeWithAI(
    validJobs,
    jobRequirements,
    resumeSkills,
    resumeText,
    { role, country, jobType: employmentType },
    candidateYearsExperience
  );

  // 7. Rank + compute gap score
  const { topJobs, aggregatedSkills, missingSkillsList } = rankAndScore(aiResults);

  // 8. Fetch YouTube resources for missing skills
  const missingSkills = await fetchLearningResources(missingSkillsList);

  return { topJobs, aggregatedSkills, missingSkills };
}