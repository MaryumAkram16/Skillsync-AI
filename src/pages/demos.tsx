import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";
import { Link } from "react-router-dom";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Radar,
  FileText,
  Map,
  Brain,
  Compass,
  BookOpen,
  Briefcase,
  MessageSquare,
  Play,
  X,
  ArrowRight,
  Sparkles,
} from "lucide-react";

// Same names, descriptions, and paths used on the landing page (pages/index.tsx) —
// kept in sync intentionally so the gallery and the hover demos never drift apart.
const demos = [
  {
    name: "Radar",
    fullName: "SkillSync Radar",
    icon: Radar,
    path: "/radar",
    description: "Type in a target role and see the skills hiring managers are actually asking for right now, pulled from live job postings instead of a static list.",
    videoUrl: "/demos/radar_final.mp4",
  },
  {
    name: "Parser",
    fullName: "SkillSync Parser",
    icon: FileText,
    path: "/parser",
    description: "Upload your resume and get back a clean read of what skills you already have — plus what the market wants that you don't, yet.",
    videoUrl: "/demos/parser_final.mp4",
  },
  {
    name: "GapMap",
    fullName: "SkillSync GapMap",
    icon: Map,
    path: "/gapmap",
    description: "A visual heatmap of your profile against your target role, so the gap between where you are and where you're going is something you can see.",
    videoUrl: "/demos/gapmap_final.mp4",
  },
  {
    name: "Assessment",
    fullName: "Skill Assessment",
    icon: Brain,
    path: "/skill-assessment",
    description: "Don't know where to start? A short, adaptive quiz places you on the map and points to the roles your strengths already fit.",
    videoUrl: "/demos/skill_assessment_final.mp4",
  },
  {
    name: "Mentor",
    fullName: "Career Mentor",
    icon: Compass,
    path: "/career-mentor",
    description: "Personalized career path recommendations weighed against your skills, education, and where the market is actually moving.",
    videoUrl: "/demos/career_mentor_final.mp4",
  },
  {
    name: "Roadmap",
    fullName: "Roadmap",
    icon: BookOpen,
    path: "/roadmap",
    description: "Turns a career goal into a step-by-step plan — courses, projects, and milestones you can check off, not just a reading list.",
    videoUrl: "/demos/roadmap_final.mp4",
  },
  {
    name: "Resume Tools",
    fullName: "Resume Tools",
    icon: Briefcase,
    path: "/resume-tools",
    description: "Rewrites vague bullets into achievement language, scores your ATS match, and drafts a cover letter tailored to the job description.",
    videoUrl: "/demos/resume_tools_final.mp4",
  },
  {
    name: "Interview Prep",
    fullName: "Interview Prep",
    icon: MessageSquare,
    path: "/interview",
    description: "Mock quizzes generated from real listing data, instant feedback on your answers, and a searchable bank of past questions.",
    videoUrl: "/demos/interview_prep_final.mp4",
  },
  {
    name: "Syncy",
    fullName: "Syncy AI Assistant",
    icon: Sparkles,
    path: null, // opens the chatbot widget instead of navigating
    description: "Ask Syncy anything about your resume, skills, or which tool fits what you're trying to do — it reads the live market and your saved results to give a real answer.",
    videoUrl: "/demos/syncy_final.mp4",
  },
];

// ── Individual demo card ────────────────────────────────────────────────────
// Shows the video's first frame as a static thumbnail (muted, paused at 0s).
// Clicking the play button opens a focused modal and plays the clip inline —
// no autoplay-on-load, so loading 9 videos at once stays cheap.
function DemoCard({ demo, index }: { demo: typeof demos[number]; index: number }) {
  const [modalOpen, setModalOpen] = useState(false);
  const thumbRef = useRef<HTMLVideoElement>(null);
  const Icon = demo.icon;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.05, duration: 0.35 }}
      >
        <Card className="overflow-hidden p-0 group cursor-pointer" onClick={() => setModalOpen(true)}>
          <div className="relative aspect-video bg-slate-900 overflow-hidden">
            {/* Static first-frame thumbnail — muted, no controls, paused at 0s */}
            <video
              ref={thumbRef}
              src={demo.videoUrl}
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
            />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <div className="h-14 w-14 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/30 group-hover:scale-110 group-hover:bg-primary-blue/80 transition-all">
                <Play className="h-5 w-5 text-white fill-white" />
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-primary-blue/10 flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-primary-blue" />
              </div>
              <h3 className="font-display font-semibold text-base text-text-primary">{demo.fullName}</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{demo.description}</p>
          </div>
        </Card>
      </motion.div>

      {/* ── Playback modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl overflow-hidden rounded-2xl border border-primary-blue/30 bg-card shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2 bg-primary-blue/10 px-4 py-3 border-b border-primary-blue/20">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary-blue" />
                  <span className="text-xs font-bold uppercase tracking-widest text-primary-blue">
                    {demo.fullName}
                  </span>
                </div>
                <button onClick={() => setModalOpen(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="aspect-video bg-slate-950">
                <video
                  src={demo.videoUrl}
                  autoPlay
                  loop
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-text-secondary flex-1 min-w-[200px]">{demo.description}</p>
                {demo.path ? (
                  <Link to={demo.path}>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-blue text-white text-xs font-bold uppercase tracking-widest hover:bg-primary-blue/90 transition-colors shrink-0">
                      Try it <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      window.dispatchEvent(new Event("open-chatbot"));
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-blue text-white text-xs font-bold uppercase tracking-widest hover:bg-primary-blue/90 transition-colors shrink-0"
                  >
                    Try it <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function DemosPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-primary-blue/30 font-sans">
      <Navbar />

      <main>
        <section className="relative overflow-hidden pt-16 pb-12 sm:pt-20 sm:pb-16">
          <div className="absolute inset-0 bg-scanlines pointer-events-none" />
          <div className="container mx-auto px-4 relative z-10 text-center max-w-2xl">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary-purple bg-primary-purple/10 border border-primary-purple/20 rounded-full px-3.5 py-1.5 mb-6">
              <Sparkles className="h-3 w-3" />
              See it before you try it
            </span>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight mb-4 leading-[1.1]">
              Every feature, in motion.
            </h1>
            <p className="text-text-secondary leading-relaxed">
              Short clips of each tool doing exactly what it says — no sign-up required to watch.
            </p>
          </div>
        </section>

        <section className="pb-20 sm:pb-28">
          <div className="container mx-auto px-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {demos.map((demo, i) => (
                <DemoCard key={demo.name} demo={demo} index={i} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
