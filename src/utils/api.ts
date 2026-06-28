/**
 * Custom error class for API-related failures
 */
export class ApiError extends Error {
  status?: number;
  details?: any;
  url?: string;

  constructor(message: string, status?: number, details?: any, url?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.url = url;
  }
}

// Lazy import to avoid circular deps — only runs in browser
async function getFirebaseIdToken(): Promise<string | null> {
  try {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

/**
 * A robust helper function to perform API requests with timeout and standardized error handling.
 * Automatically attaches the Firebase ID token as a Bearer token when the user is signed in.
 */
async function fetchApi<T>(
  url: string, 
  body?: any, 
  options: { 
    timeoutMs?: number;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  } = {}
): Promise<T> {
  const { timeoutMs = 120000, method } = options;
  
  const headers: Record<string, string> = {};
  
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach Firebase ID token for all API calls
  const token = await getFirebaseIdToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions: RequestInit = {
    method: method || (body ? 'POST' : 'GET'),
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal
  };

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const responseText = await response.text();
    let data: any;
    
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { rawText: responseText };
    }

    if (!response.ok) {
      const errorMsg = data.message
        ? (data.error ? `${data.error}: ${data.message}` : data.message)
        : (data.details || data.error || `Request failed with status ${response.status}`);
      
      throw new ApiError(errorMsg, response.status, data, url);
    }
    
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeoutMs / 1000}s`, 408, null, url);
    }
    
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(error.message || 'An unexpected network error occurred', 500, error, url);
  }
}

export const api = {
  // Radar Feature
  getTrendingSkills: async (userId: string, role: string, country: string) => {
    return fetchApi<any>('/api/trending-skills', { userId, mode: "radar", role, country });
  },

  extractResumeDetails: async (resumeText: string) => {
    return fetchApi<any>('/api/extract-resume-details', { resumeText });
  },

  // Parser Feature
  parseResume: async (userId: string, resumeText: string, role: string, country: string, employmentType: string, locationType: string, city?: string) => {
    return fetchApi<any>('/api/parse-resume', { userId, mode: "parser", resumeText, role, country, employmentType, locationType, ...(city ? { city } : {}) }, { timeoutMs: 300000 });
  },

  // Resume Tools Feature
  resumeTools: async (userId: string, mode: string, resumeText: string, jobDescription: string, jobTitle: string, company: string, tone: string, userName: string) => {
    return fetchApi<any>('/api/resume-tools', { userId, mode, resumeText, jobDescription, jobTitle, company, tone, userName }, { timeoutMs: 300000 });
  },

  // Interview Preparation Features
  generateInterview: async (params: {
    userId: string;
    role: string;
    level: string;
    skills?: string;
    weak_areas?: string;
    mode: "quiz" | "questions";
    difficulty?: "easy" | "medium" | "hard" | "mixed";
    topic?: string;
  }) => {
    return fetchApi<any>('/api/supabase/generate-interview', params);
  },

  evaluateInterviewAnswer: async (params: {
    userId: string;
    sessionId: number;
    question: string;
    questionType: "mcq" | "open";
    focusArea: string;
    difficulty: string;
    userAnswer: string;
    correctAnswer?: string;
    role: string;
    timeTakenSecs?: number;
  }) => {
    return fetchApi<any>('/api/supabase/evaluate-answer', params);
  },

  getQuestionLibrary: async (params: {
    topic: string;
    role?: string;
    count?: number;
    difficulty?: "easy" | "medium" | "hard" | "mixed";
    forceRefresh?: boolean;
  }) => {
    return fetchApi<any>('/api/supabase/question-library', params);
  },

  getInterviewSessionHistory: async (params: {
    userId: string;
    role?: string;
    limit?: number;
  }) => {
    return fetchApi<any>('/api/supabase/session-history', params);
  },
  
  generateRoadmap: async (params: {
    userId: string;
    goal: string;
    level: string;
    timeCommitment: string;
    preference?: string;
    currentSkills?: string;
    targetRole?: string;
    industry?: string;
    forceRefresh?: boolean;
  }) => {
    return fetchApi<any>('/api/generate-roadmap', params, { timeoutMs: 180000 });
  },

  suggestResources: async (params: { 
    roadmap_id: number; 
    forceRefresh?: boolean;
  }) => {
    return fetchApi<any>('/api/suggest-resources', params);
  },

  findUseCases: async (params: {
    userId: string;
    goal: string;
    level?: string;
    forceRefresh?: boolean;
    userBackground?: string;
  }) => {
    return fetchApi<any>("/api/find-use-cases", params, { timeoutMs: 300000 });
  },

  // Career Mentor Features
  generateAssessment: async (userId: string, interests: string[], educationLevel: string, country: string) => {
    return fetchApi<any>('/api/skill-assessment', { userId, interests, educationLevel, country });
  },

  submitAssessment: async (userId: string, answers: string[], quiz: any[]) => {
    return fetchApi<any>('/api/submit-assessment', { userId, answers, quiz });
  },

  // ── Tier 3: Adaptive (multi-stage) Assessment ──────────────────────────
  generateAssessmentStage1: async (userId: string, interests: string[], educationLevel: string, country: string) => {
    return fetchApi<any>('/api/skill-assessment/stage1', { userId, interests, educationLevel, country });
  },

  analyzeStage1AndGenerateStage2: async (userId: string, stage1Answers: string[]) => {
    return fetchApi<any>('/api/skill-assessment/stage2', { userId, stage1Answers });
  },

  submitAdaptiveAssessment: async (userId: string, stage2Quiz: any[], stage2Answers: string[]) => {
    return fetchApi<any>('/api/submit-adaptive-assessment', { userId, stage2Quiz, stage2Answers });
  },

  // ── Explain Phase (Roadmap) ────────────────────────────────────────────
  explainPhase: async (payload: {
    phaseName: string;
    topics: string[];
    tools: string[];
    milestoneProject: string;
    checkpoint: string;
    phaseNumber: number;
    totalPhases: number;
  }) => {
    return fetchApi<{ explanation: { whatYoullLearn: string; whatYoullBuild: string; topTip: string } }>('/api/explain-phase', payload);
  },

  explainGaps: async (payload: {
    highGaps: string[];
    mediumGaps: string[];
    lowGaps: string[];
    missingSkills: string[];
    currentSkills: string[];
    targetRole: string;
  }) => {
    return fetchApi<{ explanation: string }>('/api/explain-gaps', payload);
  },

  // ── Explain Skill Gap (GapMap "Explain this gap" button) ──────────────
  explainSkillGap: async (payload: {
    skill: string;
    priority?: "high" | "medium" | "low";
    targetRole?: string;
  }) => {
    return fetchApi<{ explanation: { whyItMatters: string; ifYouSkipIt: string } }>('/api/explain-skill-gap', payload);
  },

  // ── Explain Trend (Radar "Explain this trend" button) ──────────────────
  explainTrend: async (payload: {
    skill: string;
    tier?: "high" | "medium" | "low";
    role?: string;
    country?: string;
  }) => {
    return fetchApi<{ explanation: { whyTrending: string; whatsDrivingDemand: string } }>('/api/explain-trend', payload);
  },

  verifyDatabase: async () => {
    try {
      return await fetchApi<any>('/api/verify-database');
    } catch (error) {
      console.error("Error verifying database:", error);
      return { ok: false, error: "Failed to connect to verification service" };
    }
  },

  getCareerMentorReport: async (userId: string, formData: any, forceRefresh: boolean = false) => {
    return fetchApi<any>('/api/career-mentor', { userId, ...formData, forceRefresh }, { timeoutMs: 300000 });
  },

  // Chatbot Assistant
  chatbot: async (payload: {
    userId: string;
    message: string;
    currentPage: string;
    userName: string;
    userScore: number;
    hasSkills: boolean;
    sessionId: string;
    history?: { role: "user" | "bot"; text: string }[];
    topSkills?: string[];
    targetRole?: string;
  }) => {
    return fetchApi<any>('/api/chatbot', payload);
  },

  // Administrative panel features
  getAdminData: async () => {
    return fetchApi<{
      users: any[];
      platformFeedback: any[];
      userFeedback: any[];
      activityLog: any[];
    }>('/api/admin/data');
  },

  updateUserProfile: async (targetUid: string, updates: {
    tier?: "Free" | "Pro";
    isAdmin?: boolean;
    role?: string;
    assessmentCount?: number;
  }) => {
    return fetchApi<{ success: boolean; message: string }>('/api/admin/update-user', { targetUid, updates });
  }
};