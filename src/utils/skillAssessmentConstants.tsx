import React from "react";
import {
  Cpu,
  Globe,
  Brain,
  Lightbulb,
  TrendingUp,
  Zap,
  Users,
  Compass,
  Target,
} from "lucide-react";

/**
 * Static reference data extracted from skill-assessment.tsx — these are all
 * fixed lookup tables/config with zero dependency on component state, so
 * pulling them out is a pure file-size reduction with no behavior change.
 */

export const LEVEL_COLORS: Record<string, string> = {
  Beginner: "bg-success/10 text-success border-success/20",
  Intermediate: "bg-warning/10 text-warning border-warning/20",
  Expert: "bg-primary-blue/10 text-primary-blue border-primary-blue/20",
};

export const LEVEL_ORDER: Array<"Beginner" | "Intermediate" | "Expert"> = [
  "Beginner",
  "Intermediate",
  "Expert",
];

export function defaultLevelFromEducation(edu: string): "Beginner" | "Intermediate" | "Expert" {
  const e = (edu || "").toLowerCase();
  if (e.includes("master") || e.includes("phd")) return "Expert";
  if (e.includes("bachelor")) return "Intermediate";
  return "Beginner";
}

export const INTEREST_CATEGORIES = [
  {
    title: "Programming & Development",
    icon: <Cpu className="h-4 w-4" />,
    skills: [
      "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust",
      "PHP", "Swift", "Kotlin", "R", "MATLAB", "SQL", "Bash / Shell Scripting",
    ],
  },
  {
    title: "Web & Mobile",
    icon: <Globe className="h-4 w-4" />,
    skills: [
      "React", "Next.js", "Vue.js", "Angular", "Node.js", "Express.js",
      "React Native", "Flutter", "HTML & CSS", "Tailwind CSS", "REST APIs",
      "GraphQL", "Firebase", "Supabase", "WordPress",
    ],
  },
  {
    title: "Data, AI & Cloud",
    icon: <Brain className="h-4 w-4" />,
    skills: [
      "Machine Learning", "Deep Learning", "Data Analysis", "Data Visualisation",
      "TensorFlow", "PyTorch", "Pandas & NumPy", "Power BI", "Tableau",
      "AWS", "Google Cloud", "Azure", "Docker", "Kubernetes", "CI/CD & DevOps",
    ],
  },
  {
    title: "Design & Product",
    icon: <Lightbulb className="h-4 w-4" />,
    skills: [
      "UI/UX Design", "Figma", "Adobe XD", "Photoshop", "Illustrator",
      "Wireframing", "Prototyping", "User Research", "Product Management",
      "Agile / Scrum", "Jira", "Notion",
    ],
  },
  {
    title: "Business & Finance",
    icon: <TrendingUp className="h-4 w-4" />,
    skills: [
      "Financial Analysis", "Accounting", "Excel & Spreadsheets",
      "Business Analysis", "Project Management", "Strategic Planning",
      "Market Research", "E-commerce", "Supply Chain", "Operations Management",
      "Human Resources", "Entrepreneurship",
    ],
  },
  {
    title: "Marketing & Sales",
    icon: <Zap className="h-4 w-4" />,
    skills: [
      "Digital Marketing", "SEO & SEM", "Social Media Marketing",
      "Content Marketing", "Email Marketing", "Google Ads", "Meta Ads",
      "Copywriting", "Sales", "CRM Tools", "Brand Strategy",
    ],
  },
  {
    title: "Soft Skills",
    icon: <Users className="h-4 w-4" />,
    skills: [
      "Communication", "Leadership", "Critical Thinking", "Problem Solving",
      "Team Collaboration", "Public Speaking", "Time Management",
      "Emotional Intelligence", "Adaptability", "Attention to Detail",
      "Conflict Resolution", "Decision Making", "Active Listening",
      "Negotiation", "Creativity & Innovation", "Self-Motivation",
      "Stress Management", "Networking", "Mentoring & Coaching",
      "Cultural Awareness", "Work Ethic", "Accountability",
      "Growth Mindset", "Persuasion", "Analytical Thinking",
    ],
  },
];

export const COUNTRIES = [
  "Pakistan", "USA", "UK", "Canada", "Australia",
  "Germany", "France", "India", "UAE", "Saudi Arabia",
  "Singapore", "Malaysia", "Turkey", "Brazil", "Japan",
  "Nigeria", "South Africa", "Egypt", "Bangladesh", "Philippines",
].sort();

export const CATEGORY_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string; description: string }> = {
  logical_thinking:  { color: "text-primary-blue",   bg: "bg-primary-blue/10",   icon: <Lightbulb className="h-5 w-5" />, label: "Logical Thinking",  description: "How you reason through structured problems step by step." },
  tech_literacy:     { color: "text-primary-purple",  bg: "bg-primary-purple/10", icon: <Cpu className="h-5 w-5" />,       label: "Tech Literacy",     description: "Comfort with core technical concepts and tools." },
  problem_solving:   { color: "text-success",          bg: "bg-success/10",         icon: <Zap className="h-5 w-5" />,        label: "Problem Solving",   description: "Ability to break down and solve unfamiliar challenges." },
  soft_skills:       { color: "text-warning",          bg: "bg-warning/10",         icon: <Users className="h-5 w-5" />,      label: "Soft Skills",       description: "Communication, collaboration, and workplace judgment." },
  career_awareness:  { color: "text-danger",           bg: "bg-danger/10",          icon: <Compass className="h-5 w-5" />,    label: "Career Awareness",  description: "How well your answers matched current job-market realities — not a measure of skill, just market knowledge." },
};
