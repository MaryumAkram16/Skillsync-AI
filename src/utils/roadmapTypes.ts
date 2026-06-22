/**
 * Types extracted from roadmap.tsx — pure type definitions, no runtime
 * code, zero dependency on component state.
 */

export interface TopicDetail {
  name: string;
  estimated_hours: number;
  subtopics: string[];
}

export interface MilestoneProject {
  name: string;
  description: string;
  deliverables: string[];
  estimated_hours: number;
}

export interface RoadmapPhase {
  phase_number?: number;
  name: string;
  duration: string;
  weekly_hours: number;
  focus_area: string;
  topics: TopicDetail[];
  tools: string[];
  milestone_project: MilestoneProject;
  skills_gained: string[];
  common_mistakes: string[];
  checkpoint: string;
}

export interface Roadmap {
  roadmap_id: string | number;
  title: string;
  description?: string;
  total_duration: string;
  weekly_hours: number;
  salary_range: string;
  job_titles: string[];
  summary: string;
  phases: RoadmapPhase[];
  career_outcomes: string[];
  industry_demand?: string;
  next_steps_after_roadmap: string[];
  prerequisites?: string[];
}

export interface ResourceItem {
  title?: string;
  name?: string;
  url?: string;
  link?: string;
  description?: string;
  why?: string;
}

export interface VideoItem extends ResourceItem {
  channel?: string;
  views?: string;
  duration?: string;
  thumbnail?: string;
}

export interface CourseItem extends ResourceItem {
  platform?: string;
}

export interface GithubItem extends ResourceItem {
  fullName?: string;
  stars?: number;
  starsLabel?: string;
  language?: string;
  topics?: string[];
}

export interface ArticleItem extends ResourceItem {
  source?: string;
  date?: string;
}

export interface ResourcePhase {
  phase_number?: number;
  phase_name: string;
  videos: VideoItem[];
  courses: CourseItem[];
  github: GithubItem[];
  articles: ArticleItem[];
}

export interface ResourcesData {
  phases?: ResourcePhase[];
  total_resources?: number;
  from_cache?: boolean;
}
