import OpenAI from "openai";

interface ResumeToolsResult {
  success: boolean;
  mode: string;
  error?: string;
  rewrite?: any;
  coverLetter?: any;
}

const ACTION_VERB_PATTERN = /^(migrated|built|led|developed|designed|implemented|architected|improved|reduced|increased|managed|created|delivered|collaborated|worked|overhauled|maintained|partnered|used|participated|engineered|launched|optimized|automated|deployed|integrated|spearheaded|drove|established|streamlined|coordinated|produced|authored|executed|achieved|generated|mentored|trained)/i;
const IMPACT_PATTERN = /\d+%|\d+x|\$[\d,]+|\d+ (users|members|team|clients|engineers|projects|services)/i;
const SECTION_HEADER_PATTERN = /^(education|experience|skills|summary|objective|references|projects|certifications|awards)$/i;
const ALL_CAPS_PATTERN = /^[A-Z\s\d,.|]{4,}$/;

function cleanResumeText(text: string): string {
  let cleaned = text.replace(/[^\x00-\x7F]/g, "");
  // Preserve meaningful newlines for bullet extraction, but collapse multiple spaces on same line
  cleaned = cleaned.replace(/ +/g, " ");
  // Collapse multiple consecutive newlines into single newline
  cleaned = cleaned.replace(/\n\n+/g, "\n");
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2");
  return cleaned;
}

// ── Extract ALL skills + certifications from resume for context ───────────────
function extractSkillsAndCerts(resumeText: string): {
  skills: string[];
  certifications: string[];
  yearsOfExperience: string;
  experienceLevel: string;
} {
  const text = resumeText;

  // Extract skills section
  const skillsMatch = text.match(
    /(?:skills?|technical skills?|core competencies)[:\s\n]+([\s\S]*?)(?=\n(?:experience|education|certif|project|summary|$))/i
  );
  const skillsRaw = skillsMatch?.[1] || "";
  const skills = skillsRaw
    .split(/[,•|\n\/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 60);

  // Extract certifications
  const certMatch = text.match(
    /(?:certif\w*)[:\s\n]+([\s\S]*?)(?=\n(?:skills|experience|education|project|$))/i
  );
  const certifications = (certMatch?.[1] || "")
    .split(/[\n•]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  // ── Experience level detection — multiple strategies ──────────────────────

  // Strategy 1: explicit "X years" phrase
  const explicitYears = text.match(/(\d+)\+?\s*years?\s*(?:of\s+)?(?:experience|exp)/i);
  if (explicitYears) {
    const n = parseInt(explicitYears[1], 10);
    return {
      skills, certifications,
      yearsOfExperience: `${n}+ years`,
      experienceLevel: n >= 5 ? "senior" : n >= 3 ? "mid-level" : "early-career",
    };
  }

  // Strategy 2: early-career / junior signals in resume text
  const earlyCareerSignals = [
    /early.career/i, /entry.level/i, /junior/i, /fresher/i,
    /new graduate/i, /recent graduate/i, /currently deepening/i,
    /portfolio project/i, /personal project/i, /hackathon/i,
    /available for.*freelance/i, /agency collaboration/i,
  ];
  const hasEarlyCareerSignal = earlyCareerSignals.some((r) => r.test(text));

  // Strategy 3: count distinct project entries (each = roughly one project period)
  const projectCount = (text.match(/(?:^|\n)\s*(?:GitHub|Project:|•)[^\n]{10,}/gi) || []).length;

  // Strategy 4: education graduation year → infer experience
  const gradYearMatch = text.match(/20(\d{2})(?:\s*[-–]\s*20\d{2})?/g);
  let yearsFromEducation = "";
  let experienceLevel = "";

  if (gradYearMatch) {
    const years = gradYearMatch.map((y) => parseInt(y.slice(0, 4), 10)).filter((y) => y <= 2026);
    const mostRecentGrad = Math.max(...years);
    const yearsSinceGrad = 2026 - mostRecentGrad;

    // Diploma in Digital Marketing 2024 → 2 years since, but that's a diploma not work experience
    // BS Mathematics 2018 → 8 years since but no work experience listed
    // So we cap at detected project experience
    if (yearsSinceGrad <= 2) {
      yearsFromEducation = "less than 2 years";
      experienceLevel = "early-career";
    } else if (yearsSinceGrad <= 4) {
      yearsFromEducation = "2-4 years";
      experienceLevel = "early-career to mid-level";
    }
  }

  if (hasEarlyCareerSignal) {
    return {
      skills, certifications,
      yearsOfExperience: yearsFromEducation || "early-career (portfolio projects)",
      experienceLevel: "early-career",
    };
  }

  if (projectCount > 0 && projectCount <= 5) {
    return {
      skills, certifications,
      yearsOfExperience: yearsFromEducation || `approximately ${projectCount} portfolio projects`,
      experienceLevel: experienceLevel || "early-career",
    };
  }

  return {
    skills, certifications,
    yearsOfExperience: yearsFromEducation || "not explicitly stated",
    experienceLevel: experienceLevel || "unspecified",
  };
}

function parseResumeIntoBullets(fields: any): any {
  const resumeText = fields.resumeText;
  const cleanText = cleanResumeText(resumeText);

  let lines = cleanText.split("\n");
  lines = lines.map((line) => line.replace(/^[+\-•*►▪▸◦]\s*/, "").trim());
  lines = lines.filter((l) => l.length > 20); // lowered from 25 to catch short bullets
  lines = lines.filter((l) => !ALL_CAPS_PATTERN.test(l));
  lines = lines.filter((l) => /[a-z]/.test(l));
  // Only filter exact section headers, not lines that contain those words
  lines = lines.filter((l) => !SECTION_HEADER_PATTERN.test(l.trim()));

  // Strong bullets: action verbs OR measurable impact
  let bullets = lines
    .filter((l) => ACTION_VERB_PATTERN.test(l) || IMPACT_PATTERN.test(l))
    .slice(0, 15);

  // Fallback: take longest lines
  if (bullets.length < 4) {
    bullets = [...lines].sort((a, b) => b.length - a.length).slice(0, 12);
  }

  const bulletObjects = bullets.map((text, i) => ({ id: i + 1, text }));

  // Extract skills and certs to inject into prompts
  const { skills, certifications, yearsOfExperience, experienceLevel } = extractSkillsAndCerts(resumeText);

  return {
    ...fields,
    resumeText: cleanText,
    bullets: bulletObjects,
    extractedSkills: skills,
    extractedCerts: certifications,
    yearsOfExperience,
    experienceLevel,
  };
}

// ─── REWRITE PROMPT ───────────────────────────────────────────────────────────

const REWRITE_SYSTEM_PROMPT = `You are an expert ATS resume coach and technical writer specializing in maximizing job application success rates.

You receive:
- A job title and company name
- A full job description
- A list of resume bullet points from the candidate
- The candidate's ACTUAL skills list extracted from their resume
- The candidate's certifications (if any)
- The candidate's actual years of experience

ABSOLUTE RULES — violating these makes the output harmful:
- NEVER inflate or change years of experience. Use ONLY what is stated in the resume. If the resume says 1 year, write 1 year. Never write "5+ years" if the resume says 1 year.
- NEVER remove or replace technical skills, tools, or technologies the candidate actually has. If they know Python, n8n, RAG, Retell AI — keep ALL of these in the output.
- NEVER drop certifications. If they have Microsoft Certified Azure AI Fundamentals — it MUST appear.
- NEVER invent companies, job titles, degrees, or tools the candidate did not list.
- The skillsToHighlight array MUST include ALL technical tools from the resume, not a vague summary.
- "Add quantified impact" means reasonable estimates for EXISTING work — it does NOT mean inventing new experience.

Your tasks:

1. ANALYZE the job description to extract:
   - Top 15 ATS keywords and phrases (exact wording employers use)
   - Must-have skills vs nice-to-have
   - Key responsibilities they care about most

2. REWRITE each bullet point:
   - Naturally insert matching ATS keywords where the candidate's background genuinely supports it
   - Add quantified impact where absent (reasonable estimates based on what the candidate already did)
   - Start every bullet with a strong past-tense action verb
   - Keep each bullet to 1-2 lines maximum
   - Only insert keywords that are TRUTHFUL given the candidate's actual background

3. GENERATE a tailored professional summary (3-4 sentences):
   - Use the candidate's REAL years of experience
   - Mention their ACTUAL tools and skills
   - Frame their real experience toward the job requirements — do not fabricate new experience

4. IDENTIFY:
   - skillsToHighlight: ALL technical skills from the candidate's resume that are relevant — list every tool/technology they actually have
   - skillsToRemove: skills that are clearly irrelevant to this specific role
   - redFlags: honest gaps between candidate and job requirements
   - formatTips: concrete formatting improvements

5. SCORE each bullet 0-100 before and after rewrite based on ATS keyword density and impact

OUTPUT FORMAT - return ONLY raw JSON, no markdown, no backticks, no explanations:
{
  "bullets": [
    {
      "id": 1,
      "original": "exact original text here",
      "rewritten": "improved ATS-optimized version",
      "keywordsAdded": ["keyword1", "keyword2"],
      "scoreBefore": 35,
      "scoreAfter": 82
    }
  ],
  "tailoredSummary": "3-4 sentence professional summary using candidate's REAL experience",
  "skillsToHighlight": ["every technical tool they actually have"],
  "skillsToRemove": ["outdated1", "irrelevant2"],
  "redFlags": ["honest gap1", "honest gap2"],
  "formatTips": ["tip1", "tip2"],
  "topJobKeywords": ["keyword1", "keyword2"],
  "atsScoreBefore": 42,
  "atsScoreAfter": 78,
  "atsScoreDelta": 36
}

CRITICAL: Start response with { and end with }. No markdown. No preamble.`;

// ─── COVER LETTER PROMPT ──────────────────────────────────────────────────────

const COVER_LETTER_SYSTEM_PROMPT = `You are an expert cover letter writer with 15+ years helping candidates land jobs at top companies.

You receive:
- Job title, company, and applicant name
- A requested tone (professional, conversational, or bold)
- The full job description
- The candidate resume text including their REAL skills, tools, and years of experience

ABSOLUTE RULES:
- NEVER claim more years of experience than the resume states
- NEVER mention tools or technologies the candidate does not have
- Base all achievement claims ONLY on what is in the resume
- Be honest about experience level — frame it positively but accurately

TONE GUIDE:
- professional: formal, structured, corporate-friendly
- conversational: warm, human, startup-friendly, first-person natural voice
- bold: confident, direct, makes strong claims, slightly provocative opener

WRITE a complete cover letter with these sections:
- subject: email subject line for the application
- opening: compelling first paragraph that hooks immediately, NO generic "I am writing to apply"
- whyThisRole: why this specific role excites them based on their REAL background
- whyThisCompany: why this specific company, be specific to the company's mission
- proofParagraph: 2-3 achievements FROM THE RESUME proving they can do the job
- closing: confident, action-oriented closing paragraph
- fullText: the complete assembled letter 400 words max
- keywordsCovered: list of JD keywords naturally used in the letter
- matchScore: 0-100, how well the letter addresses JD requirements given their actual background
- wordCount: total words in fullText

OUTPUT FORMAT - return ONLY raw JSON, no markdown, no backticks:
{
  "tone": "professional",
  "subject": "Application for [Job Title] at [Company]",
  "opening": "...",
  "whyThisRole": "...",
  "whyThisCompany": "...",
  "proofParagraph": "...",
  "closing": "...",
  "fullText": "...complete letter...",
  "keywordsCovered": ["keyword1", "keyword2"],
  "matchScore": 85,
  "wordCount": 342
}

CRITICAL: Start response with { and end with }. No markdown. No preamble.`;

// ─── BOTH PROMPT ──────────────────────────────────────────────────────────────

const BOTH_SYSTEM_PROMPT = `You are an expert ATS resume coach AND cover letter writer. You will do BOTH tasks in a single response.

ABSOLUTE RULES FOR BOTH TASKS:
- NEVER inflate years of experience beyond what the resume states
- NEVER remove or replace the candidate's actual technical skills/tools/certifications
- NEVER invent experience, companies, or technologies not in the resume
- skillsToHighlight MUST list ALL technical tools the candidate actually has
- Certifications from the resume MUST be preserved and mentioned

TASK 1 - REWRITE RESUME BULLETS:
For each bullet: naturally insert matching ATS keywords (only where truthful), add quantified impact based on existing work, start with strong past-tense action verb, keep to 1-2 lines, track keywords inserted, score before and after 0-100.
Generate tailoredSummary using candidate's REAL years of experience and REAL tools.
Generate skillsToHighlight (ALL actual technical skills), skillsToRemove (irrelevant ones), redFlags (honest gaps), formatTips, topJobKeywords, atsScoreBefore, atsScoreAfter, atsScoreDelta.

TASK 2 - WRITE COVER LETTER:
Tone guide: professional = formal corporate, conversational = warm startup, bold = confident direct.
Write subject, opening (no generic phrases), whyThisRole, whyThisCompany (specific to company mission), proofParagraph with 2-3 REAL achievements from resume, closing, fullText 400 words max, keywordsCovered, matchScore 0-100, wordCount.

OUTPUT FORMAT - return ONLY raw JSON, no markdown, no backticks:
{
  "rewrite": {
    "bullets": [{ "id": 1, "original": "...", "rewritten": "...", "keywordsAdded": [], "scoreBefore": 0, "scoreAfter": 0 }],
    "tailoredSummary": "...",
    "skillsToHighlight": [],
    "skillsToRemove": [],
    "redFlags": [],
    "formatTips": [],
    "topJobKeywords": [],
    "atsScoreBefore": 0,
    "atsScoreAfter": 0,
    "atsScoreDelta": 0
  },
  "coverLetter": {
    "tone": "...",
    "subject": "...",
    "opening": "...",
    "whyThisRole": "...",
    "whyThisCompany": "...",
    "proofParagraph": "...",
    "closing": "...",
    "fullText": "...",
    "keywordsCovered": [],
    "matchScore": 0,
    "wordCount": 0
  }
}

CRITICAL: Start with { and end with }. No markdown. No preamble.`;

// ─── OpenAI caller ────────────────────────────────────────────────────────────

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set.");

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 3000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return completion.choices[0]?.message?.content || "";
}

function parseJsonResponse(raw: string): any {
  let cleaned = raw.trim();
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```+(?:json)?/i, "").replace(/```+$/i, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let start = -1;
    let end = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || (firstBrace < firstBracket))) {
      start = firstBrace;
      end = cleaned.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = cleaned.lastIndexOf(']');
    }

    if (start !== -1 && end !== -1 && end > start) {
      const maybeJson = cleaned.substring(start, end + 1);
      try {
        return JSON.parse(maybeJson);
      } catch (e: any) {
        throw new Error(`AI returned invalid JSON: ${e.message}`);
      }
    }
    throw new Error("AI returned invalid JSON — no JSON object or array found in response");
  }
}

// ─── Main exported function ───────────────────────────────────────────────────

export async function processResumeTools(
  resumeText: string,
  jobDescription: string,
  mode: string,
  jobTitle: string = "",
  company: string = "",
  tone: string = "Professional",
  userName: string = ""
): Promise<ResumeToolsResult> {
  if (!resumeText?.trim() || !jobDescription?.trim() || !mode?.trim()) {
    return { success: false, mode, error: "Missing required fields" };
  }

  const validModes = ["rewrite", "cover_letter", "both"];
  if (!validModes.includes(mode.toLowerCase().trim())) {
    return { success: false, mode, error: "Invalid mode" };
  }

  let fields: any = {
    resumeText: resumeText.trim(),
    jobDescription: jobDescription.trim(),
    mode: mode.trim().toLowerCase(),
    jobTitle: jobTitle.trim(),
    company: company.trim(),
    tone: tone.trim() || "Professional",
    userName: userName.trim(),
  };

  fields = parseResumeIntoBullets(fields);
  const modeKey = fields.mode;

  // Build skill/cert context to inject into every prompt
  const skillContext = fields.extractedSkills?.length
    ? `\nCANDIDATE'S ACTUAL SKILLS (MUST preserve all of these): ${fields.extractedSkills.join(", ")}`
    : "";
  const certContext = fields.extractedCerts?.length
    ? `\nCANDIDATE'S CERTIFICATIONS (MUST mention these): ${fields.extractedCerts.join(", ")}`
    : "";
  const yearsContext = fields.yearsOfExperience
    ? [
        `\nCANDIDATE'S EXPERIENCE LEVEL: ${fields.experienceLevel || "early-career"} — this is FIXED, do not upgrade`,
        `CANDIDATE'S ACTUAL EXPERIENCE: ${fields.yearsOfExperience}`,
        `HARD RULE: The professional summary MUST reflect "${fields.yearsOfExperience}" of experience.`,
        `HARD RULE: Do NOT write "5+ years", "over 5 years", or any number not derived from the resume.`,
        `HARD RULE: If the candidate is early-career, say "early-career AI Engineer" or "emerging AI Engineer" in the summary — NOT "seasoned" or "senior" or "experienced".`,
      ].join("\n")
    : [
        `\nCANDIDATE'S EXPERIENCE LEVEL: early-career — this is FIXED, do not upgrade`,
        `HARD RULE: The professional summary MUST NOT claim years of experience not stated in the resume.`,
        `HARD RULE: Do NOT write "5+ years" or any specific years unless the resume states it.`,
        `HARD RULE: Use "emerging AI Engineer" or "AI Engineer with portfolio experience" instead of claiming senior experience.`,
      ].join("\n");

  const candidateContext = `${skillContext}${certContext}${yearsContext}`.trim();

  let parsed: any;

  try {
    if (modeKey === "rewrite") {
      const bulletsText = fields.bullets.map((b: any) => `${b.id}. ${b.text}`).join("\n");
      const userPrompt =
        `JOB TITLE: ${fields.jobTitle || "Not specified"}\n` +
        `COMPANY: ${fields.company || "Not specified"}\n` +
        (candidateContext ? `\n${candidateContext}\n` : "") +
        `\nJOB DESCRIPTION:\n${fields.jobDescription}\n` +
        `\nRESUME BULLETS:\n${bulletsText}`;

      const raw = await callOpenAI(REWRITE_SYSTEM_PROMPT, userPrompt);
      const output = parseJsonResponse(raw);
      if (!output.bullets) throw new Error("No bullets in rewrite AI response");

      parsed = {
        success: true,
        mode: "rewrite",
        rewrite: {
          bullets: output.bullets || [],
          tailoredSummary: output.tailoredSummary || "",
          skillsToHighlight: output.skillsToHighlight || [],
          skillsToRemove: output.skillsToRemove || [],
          redFlags: output.redFlags || [],
          formatTips: output.formatTips || [],
          topJobKeywords: output.topJobKeywords || [],
          atsScoreBefore: output.atsScoreBefore || 0,
          atsScoreAfter: output.atsScoreAfter || 0,
          atsScoreDelta: output.atsScoreDelta || 0,
        },
      };
    } else if (modeKey === "cover_letter") {
      const userPrompt =
        `JOB TITLE: ${fields.jobTitle || "Not specified"}\n` +
        `COMPANY: ${fields.company || "Not specified"}\n` +
        `APPLICANT NAME: ${fields.userName || "the applicant"}\n` +
        `REQUESTED TONE: ${fields.tone || "professional"}\n` +
        (candidateContext ? `\n${candidateContext}\n` : "") +
        `\nJOB DESCRIPTION:\n${fields.jobDescription}\n` +
        `\nRESUME TEXT:\n${fields.resumeText}`;

      const raw = await callOpenAI(COVER_LETTER_SYSTEM_PROMPT, userPrompt);
      const output = parseJsonResponse(raw);
      if (!output.fullText) throw new Error("No fullText in cover letter AI response");

      parsed = {
        success: true,
        mode: "cover_letter",
        coverLetter: {
          tone: output.tone || "professional",
          subject: output.subject || "",
          opening: output.opening || "",
          whyThisRole: output.whyThisRole || "",
          whyThisCompany: output.whyThisCompany || "",
          proofParagraph: output.proofParagraph || "",
          closing: output.closing || "",
          fullText: output.fullText || "",
          keywordsCovered: output.keywordsCovered || [],
          matchScore: output.matchScore || 0,
          wordCount: output.wordCount || 0,
        },
      };
    } else if (modeKey === "both") {
      const bulletsText = fields.bullets.map((b: any) => `${b.id}. ${b.text}`).join("\n");
      const userPrompt =
        `JOB TITLE: ${fields.jobTitle || "Not specified"}\n` +
        `COMPANY: ${fields.company || "Not specified"}\n` +
        `APPLICANT NAME: ${fields.userName || "the applicant"}\n` +
        `REQUESTED TONE: ${fields.tone || "professional"}\n` +
        (candidateContext ? `\n${candidateContext}\n` : "") +
        `\nJOB DESCRIPTION:\n${fields.jobDescription}\n` +
        `\nRESUME TEXT:\n${fields.resumeText}\n` +
        `\nRESUME BULLETS:\n${bulletsText}`;

      const raw = await callOpenAI(BOTH_SYSTEM_PROMPT, userPrompt);
      const output = parseJsonResponse(raw);

      const rw = output.rewrite || {};
      const cl = output.coverLetter || {};

      parsed = {
        success: true,
        mode: "both",
        rewrite: {
          bullets: rw.bullets || [],
          tailoredSummary: rw.tailoredSummary || "",
          skillsToHighlight: rw.skillsToHighlight || [],
          skillsToRemove: rw.skillsToRemove || [],
          redFlags: rw.redFlags || [],
          formatTips: rw.formatTips || [],
          topJobKeywords: rw.topJobKeywords || [],
          atsScoreBefore: rw.atsScoreBefore || 0,
          atsScoreAfter: rw.atsScoreAfter || 0,
          atsScoreDelta: rw.atsScoreDelta || 0,
        },
        coverLetter: {
          tone: cl.tone || "professional",
          subject: cl.subject || "",
          opening: cl.opening || "",
          whyThisRole: cl.whyThisRole || "",
          whyThisCompany: cl.whyThisCompany || "",
          proofParagraph: cl.proofParagraph || "",
          closing: cl.closing || "",
          fullText: cl.fullText || "",
          keywordsCovered: cl.keywordsCovered || [],
          matchScore: cl.matchScore || 0,
          wordCount: cl.wordCount || 0,
        },
      };
    }
  } catch (err: any) {
    parsed = { success: false, mode: modeKey, error: err.message || String(err) };
  }

  if (!parsed.success) return { success: false, mode: modeKey, error: parsed.error };

  const response: ResumeToolsResult = { success: true, mode: parsed.mode };
  if (parsed.rewrite) response.rewrite = parsed.rewrite;
  if (parsed.coverLetter) response.coverLetter = parsed.coverLetter;

  return response;
}