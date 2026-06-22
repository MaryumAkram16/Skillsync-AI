import { Navbar } from "../components/Navbar";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Link, useNavigate } from "react-router-dom";
import {
  Radar,
  FileText,
  Map,
  ArrowRight,
  ChevronRight,
  BrainCircuit,
  X,
  LogIn,
  UserPlus,
  MessageSquare,
  Briefcase,
  Brain,
  Compass,
  BookOpen,
  Lock,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useUser } from "../context/UserContext";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useState, useEffect } from "react";
import { ChatbotWidget } from "../components/ChatbotWidget";
import { FeatureHoverDemo } from "../components/FeatureHoverDemo";

// ── Tool groups: organized by when a person would reach for each one ───────
// (Discover where you stand → Build your materials → Prove it in the room)

const discoverTools = [
  {
    name: "Radar",
    fullName: "SkillSync Radar",
    icon: Radar,
    path: "/radar",
    description: "Type in a target role and see the skills hiring managers are actually asking for right now, pulled from live job postings instead of a static list.",
    demoVideoUrl: "/demos/radar_final.mp4",
    videoZoom: 1.5,
  },
  {
    name: "Parser",
    fullName: "SkillSync Parser",
    icon: FileText,
    path: "/parser",
    description: "Upload your resume and get back a clean read of what skills you already have — plus what the market wants that you don't, yet.",
    demoVideoUrl: "/demos/parser_final.mp4",
    videoZoom: 1.5,
  },
  {
    name: "GapMap",
    fullName: "SkillSync GapMap",
    icon: Map,
    path: "/gapmap",
    description: "A visual heatmap of your profile against your target role, so the gap between where you are and where you're going is something you can see.",
    demoVideoUrl: "/demos/gapmap_final.mp4",
    videoZoom: 1.5,
  },
  {
    name: "Assessment",
    fullName: "Skill Assessment",
    icon: Brain,
    path: "/skill-assessment",
    description: "Don't know where to start? A short, adaptive quiz places you on the map and points to the roles your strengths already fit.",
    demoVideoUrl: "/demos/skill_assessment_final.mp4",
    videoZoom: 1.5,
  },
];

const buildTools = [
  {
    name: "Mentor",
    fullName: "Career Mentor",
    icon: Compass,
    path: "/career-mentor",
    description: "Personalized career path recommendations weighed against your skills, education, and where the market is actually moving.",
    demoVideoUrl: "/demos/career_mentor_final.mp4",
    videoZoom: 1.5,
  },
  {
    name: "Roadmap",
    fullName: "Roadmap",
    icon: BookOpen,
    path: "/roadmap",
    description: "Turns a career goal into a step-by-step plan — courses, projects, and milestones you can check off, not just a reading list.",
    demoVideoUrl: "/demos/roadmap_final.mp4",
    videoZoom: 1.5,
  },
  {
    name: "Resume Tools",
    fullName: "Resume Tools",
    icon: Briefcase,
    path: "/resume-tools",
    description: "Rewrites vague bullets into achievement language, scores your ATS match, and drafts a cover letter tailored to the job description.",
    demoVideoUrl: "/demos/resume_tools_final.mp4",
    videoZoom: 1.5,
  },
];

const proveItTools = [
  {
    name: "Interview Prep",
    fullName: "Interview Prep",
    icon: MessageSquare,
    path: "/interview",
    description: "Mock quizzes generated from real listing data, instant feedback on your answers, and a searchable bank of past questions.",
    demoVideoUrl: "/demos/interview_prep_final.mp4",
    videoZoom: 1.5,
  },
];

const stats = [
  { label: "job market data", value: "Real-time", mono: "LIVE" },
  { label: "career tools", value: "8", mono: "TOOLS" },
  { label: "resume stored on our servers", value: "0", mono: "ZERO" },
  { label: "during launch", value: "Free", mono: "$0" },
];

const howItWorks = [
  {
    step: "01",
    title: "Scan",
    desc: "Upload your resume or take the assessment. Radar and Parser read your real skills against live market demand.",
  },
  {
    step: "02",
    title: "Locate the gap",
    desc: "GapMap shows exactly what's missing for your target role — not generic advice, your specific shortfall.",
  },
  {
    step: "03",
    title: "Close it",
    desc: "Mentor and Roadmap turn that gap into a plan. Resume Tools rewrites your materials to match what you're applying for.",
  },
  {
    step: "04",
    title: "Walk in ready",
    desc: "Interview Prep runs you through the questions for that role before a hiring manager does.",
  },
];

const testimonials = [
  {
    quote:
      "GapMap flagged missing TypeScript and Next.js for senior roles — specific enough to act on the same afternoon.",
    name: "Frontend Developer",
    role: "Illustrative scenario",
    initials: "FD",
  },
  {
    quote:
      "Resume Tools turned a wall of duties into bullets that actually lead with the outcome. The ATS score jumped and I could see why.",
    name: "Data Scientist",
    role: "Illustrative scenario",
    initials: "DS",
  },
  {
    quote:
      "Interview Prep's questions came straight from listings I was actually applying to, not a generic question bank.",
    name: "ML Engineer",
    role: "Illustrative scenario",
    initials: "ML",
  },
];

const faqs = [
  {
    q: "Is SkillSync AI free to use?",
    a: "Yes — every tool is free during our launch phase. A Pro tier with deeper analytics is on the way.",
  },
  {
    q: "What resume formats are supported?",
    a: "PDF, DOCX, TXT, and image files (JPG/PNG) read via OCR.",
  },
  {
    q: "How current is the job market data?",
    a: "Radar pulls from live job postings, so the skills data reflects what's being hired for right now, not last quarter.",
  },
  {
    q: "Is my resume data stored?",
    a: "No raw resume text touches our servers permanently. It's sent to the AI model for analysis, then discarded — only the extracted skills list is saved, to power your recommendations.",
  },
];

// ── Radar signature visual ──────────────────────────────────────────────────
// A live scan: market-demand blips (cyan) sweep against the user's current
// skill points (violet), visualizing the actual gap-detection mechanic.

function RadarSignature() {
  const ringRadii = [60, 100, 140];
  const blips = [
    { x: 38, cy: -22, color: "var(--primary-cyan-light)", delay: 0 },
    { x: -55, cy: 40, color: "var(--primary-cyan-light)", delay: 0.6 },
    { x: 90, cy: 55, color: "var(--primary-cyan-light)", delay: 1.2 },
    { x: -20, cy: -88, color: "var(--primary-violet-light)", delay: 0.3 },
    { x: -100, cy: -30, color: "var(--primary-violet-light)", delay: 0.9 },
    { x: 15, cy: 110, color: "var(--primary-violet-light)", delay: 1.5 },
  ];

  return (
    <div className="relative h-[320px] w-[320px] sm:h-[420px] sm:w-[420px] mx-auto select-none" aria-hidden="true">
      <svg viewBox="-160 -160 320 320" className="absolute inset-0 h-full w-full overflow-visible">
        {ringRadii.map((r) => (
          <circle key={r} cx="0" cy="0" r={r} fill="none" stroke="var(--border)" strokeWidth="1" />
        ))}
        <line x1="-160" y1="0" x2="160" y2="0" stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1="-160" x2="0" y2="160" stroke="var(--border)" strokeWidth="1" />

        {/* Sweep */}
        <g className="animate-radar-sweep" style={{ transformOrigin: "0px 0px" }}>
          <defs>
            <linearGradient id="sweepGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--primary-cyan)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--primary-cyan)" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          <path d="M 0 0 L 160 0 A 160 160 0 0 0 113 -113 Z" fill="url(#sweepGradient)" />
          <line x1="0" y1="0" x2="160" y2="0" stroke="var(--primary-cyan-light)" strokeWidth="1.5" />
        </g>

        {/* Blips */}
        {blips.map((b, i) => (
          <circle
            key={i}
            cx={b.x}
            cy={b.cy}
            r="5"
            fill={b.color}
            className="animate-radar-blip"
            style={{ animationDelay: `${b.delay}s` }}
          />
        ))}

        {/* Center node */}
        <circle cx="0" cy="0" r="6" fill="var(--text-primary)" />
      </svg>

      {/* Legend */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-4 font-mono text-[10px] sm:text-xs tracking-widest uppercase whitespace-nowrap">
        <span className="flex items-center gap-1.5 text-primary-purple">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-purple" /> Market demand
        </span>
        <span className="flex items-center gap-1.5 text-primary-blue">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-blue" /> Your skills
        </span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { isLoggedIn } = useUser();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [realReviews, setRealReviews] = useState<any[]>([]);

  // Fetch top-rated platform feedback to show on landing page
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const q = query(
          collection(db, "platformFeedback"),
          where("rating", ">=", 4),
          orderBy("rating", "desc"),
          limit(3)
        );
        const snap = await getDocs(q);
        const reviews = snap.docs
          .map((doc) => doc.data())
          .filter((r) => r.liked && r.liked.trim().length > 20);
        setRealReviews(reviews);
      } catch {
        // silently fail — fall back to illustrative scenarios
      }
    };
    fetchReviews();
  }, []);

  const handleGetStarted = () => {
    if (isLoggedIn) {
      navigate("/dashboard");
    } else {
      setShowAuthModal(true);
    }
  };

  const renderToolCard = (tool: (typeof discoverTools)[number], i: number) => {
    const Icon = tool.icon;
    const card = (
      <Card className="p-6 h-full hover:scale-100 border-border/60 hover:border-primary-purple/40 transition-colors flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-lg bg-primary-purple/10 text-primary-purple flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <ChevronRight className="h-4 w-4 text-text-secondary/40 group-hover:text-primary-purple group-hover:translate-x-0.5 transition-all" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold mb-1.5">{tool.fullName}</h3>
          <p className="text-sm text-text-secondary leading-relaxed">{tool.description}</p>
        </div>
      </Card>
    );

    return (
      <motion.div
        key={tool.path}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: i * 0.06, duration: 0.35 }}
      >
        {tool.demoVideoUrl ? (
          <FeatureHoverDemo 
            featureName={tool.fullName} 
            description={tool.description}
            demoVideoUrl={tool.demoVideoUrl}
            videoZoom={tool.videoZoom}
          >
            <Link to={tool.path} className="group block h-full">
              {card}
            </Link>
          </FeatureHoverDemo>
        ) : (
          <Link to={tool.path} className="group block h-full">
            {card}
          </Link>
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-primary-blue/30 font-sans">
      <Navbar />

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="absolute inset-0 bg-scanlines pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary-violet/10 rounded-full blur-[140px] pointer-events-none" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-8 items-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center lg:text-left"
              >
                <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary-purple bg-primary-purple/10 border border-primary-purple/20 rounded-full px-3.5 py-1.5 mb-7">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-purple animate-pulse-violet" />
                  Scanning live job market data
                </span>
                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 leading-[1.08]">
                  Find the gap between
                  <br />
                  you and the job.
                </h1>
                <p className="text-lg text-text-secondary max-w-xl mx-auto lg:mx-0 mb-9 leading-relaxed">
                  SkillSync reads live job postings, compares them against your actual resume, and shows you
                  precisely what's missing — then helps you close it, materials and all.
                </p>
                <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
                  <Button size="lg" className="w-full sm:w-auto gap-2" onClick={handleGetStarted}>
                    Scan your resume <ArrowRight className="h-5 w-5" />
                  </Button>
                  <Link to="/radar" className="w-full sm:w-auto">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto">
                      See Radar live
                    </Button>
                  </Link>
                </div>
                <p className="mt-5 text-xs text-text-secondary/70 font-mono uppercase tracking-wider">
                  Free during launch · No credit card
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.15 }}
              >
                <RadarSignature />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Auth Modal ── */}
        <AnimatePresence>
          {showAuthModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-md relative"
              >
                <Card className="p-8 shadow-2xl border-primary-blue/20 hover:scale-100">
                  <button
                    onClick={() => setShowAuthModal(false)}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-border/50 text-text-secondary transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="text-center mb-8">
                    <div className="h-12 w-12 bg-primary-blue/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <BrainCircuit className="h-6 w-6 text-primary-blue" />
                    </div>
                    <h2 className="font-display text-2xl font-semibold mb-2">Get started</h2>
                    <p className="text-text-secondary text-sm">Choose how you want to continue with SkillSync AI</p>
                  </div>
                  <div className="grid gap-4">
                    <Button size="lg" className="w-full justify-between group" onClick={() => navigate("/signin?mode=signin")}>
                      <div className="flex items-center gap-3">
                        <LogIn className="h-5 w-5" />
                        <span>Sign in</span>
                      </div>
                      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </Button>
                    <Button size="lg" variant="outline" className="w-full justify-between group" onClick={() => navigate("/signin?mode=signup")}>
                      <div className="flex items-center gap-3">
                        <UserPlus className="h-5 w-5" />
                        <span>Create account</span>
                      </div>
                      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </Button>
                  </div>
                  <p className="mt-8 text-[10px] text-center text-text-secondary">
                    By continuing, you agree to our{" "}
                    <Link to="/terms-of-service" className="underline hover:text-text-primary">Terms</Link>
                    {" "}and{" "}
                    <Link to="/privacy-policy" className="underline hover:text-text-primary">Privacy Policy</Link>.
                  </p>
                </Card>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Stats Strip ── */}
        <section className="border-y border-border bg-card/40">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-border/60 py-4 sm:py-0">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="py-7 px-4 text-center"
                >
                  <p className="font-mono text-2xl sm:text-3xl font-semibold text-text-primary mb-1">{stat.value}</p>
                  <p className="text-xs text-text-secondary uppercase tracking-wider">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Tools: Discover ── */}
        <section className="py-20 sm:py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mb-12">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary-purple mb-3 block">01 · Discover</span>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-3">See where you actually stand</h2>
              <p className="text-text-secondary leading-relaxed">
                Before you can close a gap, you need to see it. These four tools read the live market and your real
                resume, side by side.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {discoverTools.map((tool, i) => renderToolCard(tool, i))}
            </div>
          </div>
        </section>

        {/* ── Tools: Build ── */}
        <section className="py-20 sm:py-24 bg-card/30 border-y border-border">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mb-12">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary-blue mb-3 block">02 · Build</span>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-3">Turn the gap into a plan</h2>
              <p className="text-text-secondary leading-relaxed">
                Once you know what's missing, these tools build the path and the paperwork to close it.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              {buildTools.map((tool, i) => renderToolCard(tool, i))}
            </div>
          </div>
        </section>

        {/* ── Tools: Prove it + Privacy ── */}
        <section className="py-20 sm:py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-[1fr_1fr] gap-8">
              <div>
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-success mb-3 block">03 · Prove it</span>
                <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-3">Walk into the interview ready</h2>
                <p className="text-text-secondary leading-relaxed mb-6 max-w-md">
                  The last mile. Practice with questions pulled from real listings, not a generic bank.
                </p>
                {proveItTools.map((tool, i) => renderToolCard(tool, i))}
              </div>

              <Card className="p-7 hover:scale-100 bg-gradient-to-br from-card to-background border-border/60 flex flex-col">
                <div className="h-10 w-10 rounded-lg bg-primary-blue/10 text-primary-blue flex items-center justify-center mb-5">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">Your resume isn't our product</h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-5">
                  Raw resume text is never stored on our servers. It's sent to the model for analysis, then
                  discarded. Only the extracted skills list is saved, to power your recommendations.
                </p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {["Firebase Auth", "Firestore", "No raw storage"].map((tag) => (
                    <span
                      key={tag}
                      className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-primary-blue/10 text-primary-blue border border-primary-blue/20 uppercase tracking-wider"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Card>
            </div>

            {/* ── Chatbot Banner ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-14"
            >
              <FeatureHoverDemo
                featureName="Syncy AI Assistant"
                description="Ask Syncy anything about your resume, skills, or which tool fits what you're trying to do — it reads the live market and your saved results to give a real answer, then points you to the right feature."
                demoVideoUrl="/demos/syncy_final.mp4"
                videoZoom={1.1}
                videoPosition="75% 50%"
              >
              <Card className="p-7 sm:p-8 hover:scale-100 bg-gradient-to-r from-primary-blue/10 via-primary-purple/10 to-primary-blue/10 border-primary-blue/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-purple/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                  <div className="h-14 w-14 rounded-2xl bg-primary-blue flex items-center justify-center shrink-0 shadow-lg shadow-primary-blue/30">
                    <MessageSquare className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      <span className="font-mono text-[11px] font-semibold text-success uppercase tracking-widest">
                        Online now
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-semibold mb-1.5">Not sure where to start?</h3>
                    <p className="text-text-secondary text-sm">
                      Ask the SkillSync assistant about your resume, skills, or which tool fits what you're trying
                      to do — it'll point you to the right one.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Button onClick={() => window.dispatchEvent(new Event("open-chatbot"))} className="gap-2 px-6">
                      Chat with it <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
              </FeatureHoverDemo>
            </motion.div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="py-20 sm:py-24 bg-card/30 border-y border-border">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-xl mx-auto mb-16">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-3">From resume to offer</h2>
              <p className="text-text-secondary leading-relaxed">
                The four tool groups above, in the order most people actually move through them.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border">
              {howItWorks.map((step, i) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-card p-7"
                >
                  <span className="font-mono text-xs text-primary-purple tracking-widest">{step.step}</span>
                  <h3 className="font-display font-semibold text-lg mt-3 mb-2">{step.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials / User Reviews ── */}
        <section className="py-20 sm:py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-xl mx-auto mb-16">
              {realReviews.length > 0 ? (
                <>
                  <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-3">What people are saying</h2>
                  <p className="text-text-secondary">Real feedback from people who've tried SkillSync during launch.</p>
                </>
              ) : (
                <>
                  <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-3">What each tool is built to do</h2>
                  <p className="text-text-secondary">Illustrative scenarios grounded in how each feature actually works — not invented reviews.</p>
                </>
              )}
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {(realReviews.length > 0 ? realReviews : testimonials).map((t: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className="p-6 h-full hover:scale-100 flex flex-col border-border/60">
                    {realReviews.length > 0 ? (
                      <>
                        <div className="flex gap-1 mb-4">
                          {Array.from({ length: 5 }).map((_, si) => (
                            <span key={si} className={`text-base ${si < t.rating ? "text-warning" : "text-border"}`}>★</span>
                          ))}
                        </div>
                        <p className="text-text-primary leading-relaxed flex-1 mb-6">"{t.liked}"</p>
                        <div className="flex items-center gap-3 border-t border-border pt-4">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-blue to-primary-purple flex items-center justify-center text-white font-display font-semibold text-sm">
                            {(t.userName || "U")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{t.userName || "SkillSync User"}</p>
                            <p className="text-xs text-text-secondary">Verified user</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-primary-purple mb-4">
                          Feature spotlight
                        </span>
                        <p className="text-text-primary leading-relaxed flex-1 mb-6">"{t.quote}"</p>
                        <div className="flex items-center gap-3 border-t border-border pt-4">
                          <div className="h-9 w-9 rounded-full bg-primary-purple/15 text-primary-purple flex items-center justify-center font-display font-semibold text-sm">
                            {t.initials}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{t.name}</p>
                            <p className="text-xs text-text-secondary">{t.role}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-20 sm:py-24 bg-card/30 border-y border-border">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-14">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-3">Questions before you start</h2>
            </div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card
                    className="overflow-hidden cursor-pointer hover:scale-100 hover:border-primary-blue/30 transition-colors border-border/60"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <div className="flex items-center justify-between px-6 py-4">
                      <span className="font-medium">{faq.q}</span>
                      <ChevronRight
                        className={`h-5 w-5 text-text-secondary transition-transform shrink-0 ml-4 ${openFaq === i ? "rotate-90" : ""}`}
                      />
                    </div>
                    <AnimatePresence>
                      {openFaq === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <p className="px-6 pb-4 text-text-secondary text-sm leading-relaxed">{faq.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-20 sm:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-60" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-primary-violet/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="container mx-auto px-4 relative z-10 text-center">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <Sparkles className="h-7 w-7 text-primary-purple mx-auto mb-5" />
              <h2 className="font-display text-3xl sm:text-5xl font-semibold mb-5">Run the scan.</h2>
              <p className="text-lg text-text-secondary max-w-xl mx-auto mb-9">
                Two minutes to upload a resume. One clear picture of the gap between you and the role you want.
              </p>
              <Button size="lg" className="px-8 gap-2" onClick={handleGetStarted}>
                Create free account <ArrowRight className="h-5 w-5" />
              </Button>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 bg-card/40">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-primary-blue" />
              <span className="font-display text-lg font-semibold text-text-primary">SkillSync AI</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-secondary">
              <Link to="/radar" className="hover:text-text-primary transition-colors">Radar</Link>
              <Link to="/parser" className="hover:text-text-primary transition-colors">Parser</Link>
              <Link to="/gapmap" className="hover:text-text-primary transition-colors">GapMap</Link>
              <Link to="/skill-assessment" className="hover:text-text-primary transition-colors">Assessment</Link>
              <Link to="/career-mentor" className="hover:text-text-primary transition-colors">Career Mentor</Link>
              <Link to="/roadmap" className="hover:text-text-primary transition-colors">Roadmap</Link>
              <Link to="/resume-tools" className="hover:text-text-primary transition-colors">Resume Tools</Link>
              <Link to="/interview" className="hover:text-text-primary transition-colors">Interview Prep</Link>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1.5 text-sm text-text-secondary">
              <p>© 2026 SkillSync AI. All rights reserved.</p>
              <div className="flex gap-4 text-xs">
                <Link to="/terms-of-service" className="hover:text-text-primary transition-colors underline text-text-secondary">Terms of Service</Link>
                <Link to="/privacy-policy" className="hover:text-text-primary transition-colors underline text-text-secondary">Privacy Policy</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
      <ChatbotWidget />
    </div>
  );
}