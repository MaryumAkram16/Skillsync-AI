import OpenAI from "openai";

interface ExtractedResumeDetails {
  jobTitle: string;
  yearsOfExperience: string;
  skills: string[];
}

export async function extractResumeDetails(resumeText: string): Promise<ExtractedResumeDetails> {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_KEY || "").trim();
  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are an AI assistant that extracts facts from a resume. DO NOT INFER OR ESTIMATE.

Input: The raw text extracted from a resume.

Task:
1. Extract the user's current or most recent job title from the resume. If not stated, return "Not specified".
2. Extract ONLY the years of experience explicitly stated in the resume (e.g., "5 years experience", "worked for 3 years"). 
   - If the resume lists job dates (e.g., "2019-2024"), CALCULATE the duration from those dates.
   - If no explicit years or dates are mentioned, return "Not specified". DO NOT estimate or infer from skills/technologies mentioned.
3. Extract a list of professional skills (both technical and soft skills) that are explicitly mentioned in the resume.

IMPORTANT: Do not hallucinate experience. Only extract what is actually written.

Return ONLY a raw JSON object with no markdown or backticks. Schema:
{
  "jobTitle": "Frontend Developer",
  "yearsOfExperience": "3 years",
  "skills": ["JavaScript", "React", "TypeScript", "Communication"]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    max_tokens: 500,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: resumeText },
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
        throw new Error(`AI returned invalid JSON for resume details: ${err.message}`);
      }
    } else {
      throw new Error("AI returned invalid JSON for resume details — no JSON object found");
    }
  }

  return {
    jobTitle: parsed.jobTitle || "Not specified",
    yearsOfExperience: validateExperience(parsed.yearsOfExperience),
    skills: Array.isArray(parsed.skills) ? parsed.skills.filter(s => typeof s === 'string' && s.length > 0) : [],
  };
}

function validateExperience(exp: any): string {
  if (typeof exp !== 'string') return "Not specified";
  const match = exp.match(/(\d+)/);
  if (!match) return exp;
  const years = parseInt(match[1], 10);
  if (years > 60) {
    console.warn(`[ResumeExtractor] Caught unrealistic experience: ${years} years. Capping to "Not specified".`);
    return "Not specified";
  }
  return exp;
}