export interface AssessmentResult {
  id: string;
  type: 'skill-assessment';
  title: string;
  score: number;
  skillLevel: string;
  categoryScores: Record<string, number>;
  timestamp: string;
  data: any;
}

export interface CareerReportResult {
  id: string;
  type: 'career-mentor';
  title: string;
  topField: string;
  recommendations: any[];
  timestamp: string;
  data: any;
}

export interface RoadmapResult {
  id: string;
  type: 'roadmap';
  title: string;
  goal: string;
  phases: any[];
  timestamp: string;
  data: any;
}

export interface RadarAnalysisResult {
  id: string;
  type: 'radar';
  title: string;
  role: string;
  skills: any[];
  timestamp: string;
  data: any;
}

export interface ResumeItemResult {
  id: string;
  type: 'resume-tool';
  subType: 'resume' | 'cover-letter' | 'bullets';
  title: string;
  jobTitle: string;
  company: string;
  timestamp: string;
  data: any;
}

export interface GapAnalysisResult {
  id: string;
  type: 'gap-map';
  title: string;
  targetRole: string;
  gaps: any[];
  timestamp: string;
  data: any;
}

export type SavedResult = 
  | AssessmentResult 
  | CareerReportResult 
  | RoadmapResult 
  | RadarAnalysisResult 
  | ResumeItemResult 
  | GapAnalysisResult
  | InterviewResult;

export interface InterviewResult {
  id: string;
  type: 'interview-training';
  title: string;
  role: string;
  score: number;
  mode: 'quiz' | 'questions';
  timestamp: string;
  data: any;
}

export interface ScoreHistoryEntry {
  timestamp: string;
  score: number;
  change: number;
  reason: string;
}

export interface SkillSyncScore {
  total: number;
  categories: {
    assessment: number;
    careerMentor: number;
    roadmap: number;
    radar: number;
    resume: number;
    gapMap: number;
    interview: number;
  };
}

export interface UserProfileExtensions {
  savedAssessments: AssessmentResult[];
  savedCareerReports: CareerReportResult[];
  savedRoadmaps: RoadmapResult[];
  savedRadarAnalyses: RadarAnalysisResult[];
  savedResumeItems: ResumeItemResult[];
  savedGapAnalyses: GapAnalysisResult[];
  savedInterviewSessions: InterviewResult[];
  savedJobs: SavedJob[];
  hasGivenPlatformFeedback: boolean;
  skillSyncScore: SkillSyncScore;
  scoreHistory: ScoreHistoryEntry[];
  metadata?: {
    assessmentCount?: number;
    [key: string]: any;
  };
}

export interface SavedJob {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  applyLink: string;
  matchScore: number;
  isRemote: boolean;
  employmentType: string;
  savedAt: string; // ISO timestamp
  status: "saved" | "applied" | "interviewing" | "offer" | "rejected";
}