import { useState, useEffect } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { Card } from "../components/Card";
import { SkillTag } from "../components/SkillTag";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { ArrowRight, AlertCircle, CheckCircle2, MessageSquare, Star, Sparkles, Compass, Plus, Trash2, Circle, Rocket, Brain, Map, TrendingUp, Clock, Activity, Printer, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useUser } from "../context/UserContext";
import { SkillGrowthChart } from "../components/SkillGrowthChart";
import { ProgressTracker } from "../components/ProgressTracker"; // <-- ADDED
import { DashboardSkeleton } from "../components/SkeletonLoaders";
import { exportDashboardPDF } from "../utils/pdfExport";

const DEFAULT_TASKS = [
  { id: "1", text: "Update resume with latest skills", completed: false },
  { id: "2", text: "Take skill assessment", completed: false },
  { id: "3", text: "Complete practice module", completed: false },
];

// ── Onboarding steps ──────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    step: 1,
    icon: Brain,
    title: "Take Skill Assessment",
    description: "Answer 10 questions to discover your skill level and get personalized results",
    cta: "Start Assessment",
    path: "/skill-assessment",
    color: "accent",
  },
  {
    step: 2,
    icon: Compass,
    title: "Get Career Recommendations",
    description: "AI analyzes your assessment + live job market to recommend the best career paths for you",
    cta: "View Career Paths",
    path: "/career-mentor",
    color: "primary-blue",
  },
  {
    step: 3,
    icon: Map,
    title: "Generate Your Roadmap",
    description: "Get a step-by-step learning plan with resources tailored to your goals and budget",
    cta: "Build Roadmap",
    path: "/roadmap",
    color: "primary-purple",
  },
];

export default function Dashboard() {
  const { user, firstName, updateProfile } = useUser();

  const [tasks, setTasks] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [lastOutputs, setLastOutputs] = useState<any[]>([]);

  // Determine onboarding progress from user data
  const hasAssessment = user && user.score && user.score > 0;
  const hasCareerReport = user && (user as any).savedCareerReports?.length > 0;
  const hasRoadmap = user && (user as any).savedRoadmaps?.length > 0;
  const isNewUser = !hasAssessment;
  const onboardingComplete = hasAssessment && hasCareerReport && hasRoadmap;

  const currentStep = !hasAssessment ? 1 : !hasCareerReport ? 2 : !hasRoadmap ? 3 : null;

  useEffect(() => {
    if (!user) return;
    const saved = (user as any).actionItems;
    if (saved && Array.isArray(saved) && saved.length > 0) {
      setTasks(saved);
    } else {
      setTasks(DEFAULT_TASKS);
    }
    setTasksLoaded(true);

    const refreshOutputs = () => {
      // Load last outputs from localStorage
      const keys = [
        "skillsync_last_roadmap",
        "skillsync_last_skill-assessment",
        "skillsync_last_radar",
        "skillsync_last_career-mentor",
        "skillsync_last_interview"
      ];
      let outputs = keys
        .map(k => {
          try {
            const item = localStorage.getItem(k);
            return item ? JSON.parse(item) : null;
          } catch (e) { return null; }
        })
        .filter(Boolean);
        
      // Add chatbot history if exists with > 1 messages
      try {
        const chatHistoryStr = localStorage.getItem("skillsync_chatbot_history");
        if (chatHistoryStr) {
          const chatHistory = JSON.parse(chatHistoryStr);
          if (Array.isArray(chatHistory) && chatHistory.length > 1) {
            outputs.push({
              feature: "career-mentor-chat",
              title: "Career Mentor Conversation",
              timestamp: new Date().toISOString(), // This will be dynamic next time
              path: "#chat", // Special path indicating chatbot action
            });
          }
        }
      } catch(e) {}

      outputs = outputs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLastOutputs(outputs);
    };
    
    refreshOutputs();
    window.addEventListener("chatbot-history-updated", refreshOutputs);
    return () => window.removeEventListener("chatbot-history-updated", refreshOutputs);
  }, [user?.uid]);

  useEffect(() => {
    if (!tasksLoaded || !user) return;
    updateProfile({ actionItems: tasks } as any);
  }, [tasks, tasksLoaded]);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    setTasks(prev => [{ id: Date.now().toString(), text: newTaskText.trim(), completed: false }, ...prev]);
    setNewTaskText("");
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  if (!user) {
    return (
      <DashboardLayout title="Dashboard">
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard">
      <style>{`
        @media print {
          /* Force light-mode like appearance on printing */
          body, html, #root, [id="root"], #main-content, main {
            background: #ffffff !important;
            color: #111827 !important;
            height: auto !important;
            overflow: visible !important;
            position: static !important;
            width: 100% !important;
          }

          /* Hide UI Chrome / Interactive elements */
          aside,
          header,
          nav,
          button,
          .no-print,
          .print-hidden,
          .chatbot-widget,
          #chatbot-widget,
          [data-tour],
          .feedback-button,
          iframe {
            display: none !important;
          }

          /* Ensure container uses full page and removes grid limitations */
          #main-content,
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          /* Printable Header Layout */
          .print-header {
            display: block !important;
            margin-bottom: 24px !important;
          }

          /* Soft page break rules */
          .card, [class*="bg-bg-card"] {
            background: #ffffff !important;
            color: #111827 !important;
            border: 1px solid #e5e7eb !important;
            box-shadow: none !important;
            border-radius: 8px !important;
            padding: 16px !important;
            margin-bottom: 20px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            transform: none !important;
          }

          /* Layout adjustments for stacking grids */
          .grid {
            display: block !important;
          }
          
          .grid > * {
            margin-bottom: 20px !important;
            width: 100% !important;
          }

          /* Fix charts for printing */
          .recharts-responsive-container {
            width: 100% !important;
            height: 300px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          svg {
            max-width: 100% !important;
          }

          /* Lighten colors and backgrounds */
          h1, h2, h3, h4, h5, h6 {
            color: #000000 !important;
          }

          p, span, div, li {
            color: #374151 !important;
          }

          /* Stylize Skill tags for print */
          .skill-tag, [class*="SkillTag"] {
            background: #f3f4f6 !important;
            color: #111827 !important;
            border: 1px solid #d1d5db !important;
            border-radius: 4px !important;
            font-size: 11px !important;
            padding: 2px 8px !important;
            display: inline-block !important;
            margin: 2px !important;
          }

          /* Ensure check icons or lists are clean */
          .text-success {
            color: #059669 !important;
          }

          .text-warning {
            color: #d97706 !important;
          }

          .text-danger {
            color: #dc2626 !important;
          }
        }

        /* Standard view hides print header */
        .print-header {
          display: none;
        }
      `}</style>

      <div className="print-header">
        <div className="border-b-[4px] border-double border-gray-300 pb-4 mb-6">
          <h1 className="text-3xl font-black uppercase tracking-tight text-black mb-1">SkillSync AI — Profile Summary & Dashboard Report</h1>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
            Generated on: {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • Candidate: {user.firstName} {user.lastName} ({user.email})
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 relative overflow-hidden rounded-[2rem] border border-border bg-bg-card p-6 sm:p-8"
      >
        {/* Landing-page signature: scanline texture + violet glow */}
        <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-60" />
        <div className="absolute -top-24 -right-16 w-[420px] h-[320px] bg-primary-violet/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary-purple bg-primary-purple/10 border border-primary-purple/20 rounded-full px-3.5 py-1.5 mb-5 no-print">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-purple animate-pulse-violet" />
            Career dashboard live
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-accent/10 rounded-lg shrink-0">
                <Sparkles className="h-6 w-6 text-accent animate-pulse" />
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-semibold text-text-heading uppercase tracking-tight m-0">Welcome back, {firstName}!</h2>
            </div>
            <div className="flex items-center gap-2 no-print self-start sm:self-auto shrink-0">
              <Button
                variant="outline"
                onClick={() => exportDashboardPDF(user)}
                className="flex items-center gap-2 border border-border bg-bg-card hover:bg-card-hover text-text-primary font-black uppercase text-xs tracking-widest px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] shadow-lg cursor-pointer"
              >
                <Download className="h-4 w-4" /> Export PDF
              </Button>
              <Button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-primary-blue hover:bg-primary-blue/80 text-white font-black uppercase text-xs tracking-widest px-4 py-2.5 rounded-xl border border-primary-blue/20 transition-all hover:scale-[1.02] shadow-lg shadow-primary-blue/10"
              >
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </div>
          <p className="text-text-body font-medium opacity-60 ml-10 sm:ml-12 text-sm sm:text-base">Here's what's happening with your career growth today.</p>
        </div>
      </motion.div>

      {/* ── ONBOARDING FLOW — shown until all 3 steps complete ───────────────── */}
      {!onboardingComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 no-print"
        >
          <Card className="p-5 sm:p-8 border-accent/30 bg-gradient-to-br from-accent/5 to-primary-blue/5 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-5">
              <Rocket className="h-32 w-32 sm:h-48 sm:w-48 text-accent" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-xl">
                  <Rocket className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-mono text-xs sm:text-sm text-text-heading uppercase tracking-widest">
                    {isNewUser ? "Start Here — Your Career Journey" : "Continue Your Journey"}
                  </h3>
                  <p className="text-[10px] text-text-body/60 font-medium">
                    {currentStep ? `Step ${currentStep} of 3` : "Almost there!"}
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="sm:ml-auto flex items-center gap-2">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-500 ${
                      (s === 1 && hasAssessment) || (s === 2 && hasCareerReport) || (s === 3 && hasRoadmap)
                        ? "w-8 bg-accent"
                        : s === currentStep
                        ? "w-8 bg-accent/40 animate-pulse"
                        : "w-4 bg-white/10"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ONBOARDING_STEPS.map(({ step, icon: Icon, title, description, cta, path, color }) => {
                const done =
                  (step === 1 && hasAssessment) ||
                  (step === 2 && hasCareerReport) ||
                  (step === 3 && hasRoadmap);
                const active = step === currentStep;

                return (
                  <div
                    key={step}
                    className={`p-5 rounded-2xl border transition-all ${
                      done
                        ? "bg-success/5 border-success/20 opacity-60"
                        : active
                        ? "bg-bg-card border-accent/40 shadow-lg shadow-accent/10"
                        : "bg-bg-primary/30 border-white/5 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-xl ${done ? "bg-success/10" : `bg-${color}/10`}`}>
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Icon className={`h-4 w-4 text-${color}`} />
                        )}
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-text-body/60">
                        Step {step}
                      </span>
                      {done && (
                        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-success bg-success/10 px-2 py-0.5 rounded-full">
                          Done
                        </span>
                      )}
                    </div>
                    <h4 className="font-display font-semibold text-text-heading text-sm mb-1">{title}</h4>
                    <p className="text-[11px] text-text-body/60 font-medium mb-4 leading-relaxed">{description}</p>
                    {!done && (
                      <Link to={path}>
                        <Button
                          className={`w-full h-9 text-[10px] font-black uppercase tracking-widest rounded-xl justify-between ${
                            active
                              ? "bg-accent hover:bg-accent/90 text-text-heading shadow-lg shadow-accent/20"
                              : "bg-white/5 text-text-body/40 cursor-not-allowed pointer-events-none"
                          }`}
                          disabled={!active}
                        >
                          {cta} {active && <ArrowRight className="h-3 w-3" />}
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── TOP STATS GRID — now 3 columns ───────────────────────────────────── */}
      <div className="grid gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-3 mb-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6 sm:p-8 bg-bg-card border-border shadow-2xl rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden h-full group hover:bg-bg-primary transition-all duration-300">
            <div className="absolute -top-12 -right-12 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <CheckCircle2 className="h-32 w-32 sm:h-48 sm:w-48 text-success" />
            </div>
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="p-2 sm:p-3 bg-success/10 rounded-2xl text-success border border-success/20">
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h3 className="font-mono text-[10px] sm:text-xs text-text-heading uppercase tracking-widest">Verified Skills</h3>
            </div>
            <p className="text-4xl sm:text-5xl font-black mb-2 text-text-heading tracking-tighter relative z-10">{user.skills?.length || 0}</p>
            {user.skills && user.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-4 relative z-10">
                {user.skills.slice(0, 3).map((skill, i) => (
                  <SkillTag key={i} name={skill} />
                ))}
                {user.skills.length > 3 && (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-body/40 flex items-center bg-bg-primary px-3 py-1.5 rounded-xl border border-white/5">
                    +{user.skills.length - 3} more
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm font-medium text-text-body/60 relative z-10">Upload resume to start</p>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6 sm:p-8 bg-bg-card border-border shadow-2xl rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden h-full flex flex-col group hover:bg-bg-primary transition-all duration-300">
            <div className="absolute -top-12 -right-12 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Compass className="h-32 w-32 sm:h-48 sm:w-48 text-primary-blue" />
            </div>
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="p-2 sm:p-3 bg-primary-blue/10 rounded-2xl text-primary-blue border border-primary-blue/20">
                <Compass className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h3 className="font-mono text-[10px] sm:text-xs text-text-heading uppercase tracking-widest">Career Mentor</h3>
            </div>
            <p className="text-xs sm:text-sm font-medium text-text-body/60 mb-8 italic relative z-10">
              "Get personalised career recommendations based on your skills and interests"
            </p>
            <div className="mt-auto relative z-10">
              {!user.score || user.score === 0 ? (
                <div className="space-y-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-warning flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> No assessment found
                  </p>
                  <Link to="/skill-assessment" className="no-print">
                    <Button className="w-full justify-between bg-accent hover:bg-accent/90 text-text-heading font-black uppercase tracking-widest text-xs h-12 rounded-xl shadow-xl shadow-accent/20">
                      Take Skill Assessment <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-success flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Assessment Complete
                    </p>
                    <span className="font-mono text-[10px] px-3 py-1 rounded-xl bg-success/10 text-success uppercase tracking-widest border border-success/20">
                      {user.score < 40 ? 'Beginner' : user.score < 75 ? 'Intermediate' : 'Advanced'}
                    </span>
                  </div>
                  <Link to="/career-mentor" className="no-print">
                    <Button className="w-full justify-between border-accent/30 text-accent hover:bg-accent/5 font-black uppercase tracking-widest text-[10px] h-12 rounded-xl" variant="outline">
                      View Career Report <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* ── PROGRESS TRACKER — new third card ──────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <ProgressTracker
            score={user.score ?? 0}
            hasAssessment={!!hasAssessment}
            hasCareerReport={!!hasCareerReport}
            hasRoadmap={!!hasRoadmap}
            skillCount={user.skills?.length ?? 0}
          />
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.4 }}
        className="mb-10"
      >
        <SkillGrowthChart 
          history={user.scoreHistory || []} 
          assessments={user.savedAssessments || []}
        />
      </motion.div>

      <div className="grid gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-2 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="p-6 sm:p-8 bg-bg-card border-border shadow-2xl rounded-[1.5rem] sm:rounded-[2rem] flex flex-col h-full group hover:bg-bg-primary transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-2">
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-text-heading uppercase tracking-tight">Interview Preparation</h2>
              <Link to="/interview" className="font-mono text-[10px] uppercase tracking-widest text-accent hover:underline">Start Prep</Link>
            </div>
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-bg-primary/50 border border-white/5 group-hover:border-white/10 transition-colors">
                <div className="p-3 bg-steel-blue/10 rounded-xl text-text-steel border border-steel-blue/20">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-mono text-[10px] text-text-heading uppercase tracking-widest">Mock Interview</p>
                  <p className="text-xs font-medium text-text-body opacity-60">Practice with AI questions</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-bg-primary/50 border border-white/5 group-hover:border-white/10 transition-colors">
                <div className="p-3 bg-primary-purple/10 rounded-xl text-primary-purple border border-primary-purple/20">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-mono text-[10px] text-text-heading uppercase tracking-widest">Answer Evaluation</p>
                  <p className="text-xs font-medium text-text-body opacity-60">Get instant feedback</p>
                </div>
              </div>
            </div>
            <div className="mt-auto pt-6 border-t border-white/5 no-print">
              <Link to="/interview">
                <Button variant="outline" className="w-full justify-between border-border text-text-body hover:bg-bg-primary hover:text-text-heading rounded-xl h-12 font-black uppercase tracking-widest text-[10px]">
                  Prepare for Interview <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="p-6 sm:p-8 bg-bg-card border-border shadow-2xl rounded-[1.5rem] sm:rounded-[2rem] flex flex-col h-full group hover:bg-bg-primary transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-2">
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-text-heading uppercase tracking-tight">Action Items</h2>
              <span className="font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded-xl bg-bg-primary border border-white/5 text-text-body/60 whitespace-nowrap w-fit">
                {tasks.filter(t => t.completed).length}/{tasks.length} Done
              </span>
            </div>
            
            <form onSubmit={addTask} className="flex gap-3 mb-8 no-print">
              <Input 
                placeholder="Add a new task..." 
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                className="flex-1 h-12 rounded-xl bg-bg-primary border-border focus:ring-accent text-text-heading font-medium"
              />
              <Button type="submit" size="icon" disabled={!newTaskText.trim()} className="h-12 w-12 bg-accent hover:bg-accent/90 text-text-heading rounded-xl shadow-lg shadow-accent/10">
                <Plus className="h-5 w-5" />
              </Button>
            </form>

            <div className="space-y-4 overflow-y-auto max-h-[280px] pr-2 flex-1 scrollbar-hide">
              {tasks.length === 0 ? (
                <p className="text-sm text-center text-text-body/40 py-8 font-medium italic">No pending tasks. Add one above!</p>
              ) : (
                tasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`flex items-start justify-between gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                      task.completed ? 'bg-success/5 border-success/10 opacity-60' : 'bg-bg-primary/50 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <button 
                      onClick={() => toggleTask(task.id)}
                      className="shrink-0 mt-0.5"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-6 w-6 text-success" />
                      ) : (
                        <Circle className="h-6 w-6 text-text-body/30 hover:text-accent transition-colors" />
                      )}
                    </button>
                    <span className={`text-sm flex-1 font-medium ${task.completed ? 'text-text-body line-through' : 'text-text-heading'}`}>
                      {task.text}
                    </span>
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="shrink-0 text-text-body/30 hover:text-danger hover:opacity-100 transition-all no-print"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {!tasks.every(t => t.completed) && tasks.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/5 no-print">
                <Button 
                  variant="ghost" 
                  className="w-full text-[10px] font-black uppercase tracking-widest text-text-body/40 hover:text-text-heading"
                  onClick={() => setTasks(prev => prev.map(t => ({ ...t, completed: true })))}
                >
                  Mark All Complete
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
      {/* ── CONTINUE WHERE YOU LEFT OFF ───────────────────────────────────── */}
      {lastOutputs.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.65 }} 
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-accent/10 rounded-xl text-accent border border-accent/20">
              <Clock className="h-5 w-5" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-text-heading uppercase tracking-tight">Continue Where You Left Off</h2>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lastOutputs.map((item, i) => (
              <Card key={i} className="p-5 border-border bg-bg-card hover:bg-bg-primary transition-all group relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded-lg bg-bg-primary border border-white/5">
                    {item.feature === "roadmap" && <Map className="h-4 w-4 text-accent" />}
                    {item.feature === "skill-assessment" && <Brain className="h-4 w-4 text-primary-blue" />}
                    {item.feature === "radar" && <TrendingUp className="h-4 w-4 text-success" />}
                    {item.feature === "career-mentor" && <Compass className="h-4 w-4 text-primary-purple" />}
                    {item.feature === "interview" && <MessageSquare className="h-4 w-4 text-warning" />}
                    {item.feature === "career-mentor-chat" && <MessageSquare className="h-4 w-4 text-accent" />}
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-text-body/40">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
                
                <h4 className="font-display font-semibold text-text-heading text-sm mb-1 uppercase tracking-tight truncate pr-2">
                  {item.title}
                </h4>
                <p className="font-mono text-[10px] text-text-body/60 uppercase tracking-widest mb-4">
                  {item.feature.replace("-", " ")}
                </p>
                
                {item.path === "#chat" ? (
                  <Button 
                    className="w-full h-9 text-[10px] font-black uppercase tracking-widest rounded-xl bg-accent text-near-black hover:bg-accent/90 shadow-lg shadow-accent/10 no-print"
                    onClick={() => window.dispatchEvent(new Event("open-chatbot"))}
                  >
                    Resume Chat <ArrowRight className="h-3 w-3 ml-2" />
                  </Button>
                ) : (
                  <Link to={item.path || `/${item.feature}`} state={{ autoResume: true }} className="no-print w-full block">
                    <Button className="w-full h-9 text-[10px] font-black uppercase tracking-widest rounded-xl bg-accent text-near-black hover:bg-accent/90 shadow-lg shadow-accent/10">
                      Resume <ArrowRight className="h-3 w-3 ml-2" />
                    </Button>
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── RECENT ACTIVITY FEED ───────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="pb-12">
        <Card className="p-8 bg-bg-card border-border shadow-2xl rounded-[2rem]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent/10 rounded-xl text-accent border border-accent/20">
                <Activity className="h-5 w-5" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-text-heading uppercase tracking-tight">Recent Activity</h2>
            </div>
          </div>
          {(() => {
            // Collect recent activity across all saved arrays
            const activities: { label: string; time: string; icon: string; path: string }[] = [];
            const fmt = (ts: string) => {
              try {
                const d = new Date(ts);
                const diff = Date.now() - d.getTime();
                const mins = Math.floor(diff / 60000);
                const hrs = Math.floor(diff / 3600000);
                const days = Math.floor(diff / 86400000);
                if (mins < 1) return "Just now";
                if (mins < 60) return `${mins}m ago`;
                if (hrs < 24) return `${hrs}h ago`;
                return `${days}d ago`;
              } catch { return "Recently"; }
            };
            const sa = (user as any)?.savedAssessments?.[0];
            if (sa?.timestamp) activities.push({ label: "Completed Skill Assessment", time: fmt(sa.timestamp), icon: "🧠", path: "/skill-assessment" });
            const cr = (user as any)?.savedCareerReports?.[0];
            if (cr?.timestamp) activities.push({ label: "Generated Career Report", time: fmt(cr.timestamp), icon: "🧭", path: "/career-mentor" });
            const rm = (user as any)?.savedRoadmaps?.[0];
            if (rm?.timestamp) activities.push({ label: "Created Career Roadmap", time: fmt(rm.timestamp), icon: "🗺️", path: "/roadmap" });
            const rd = (user as any)?.savedRadarAnalyses?.[0];
            if (rd?.timestamp) activities.push({ label: `Scanned Market: ${rd.role || "Role"}`, time: fmt(rd.timestamp), icon: "📡", path: "/radar" });
            const rt = (user as any)?.savedResumeItems?.[0];
            if (rt?.timestamp) activities.push({ label: "Optimized Resume", time: fmt(rt.timestamp), icon: "✍️", path: "/resume-tools" });
            const ga = (user as any)?.savedGapAnalyses?.[0];
            if (ga?.timestamp) activities.push({ label: "Ran Gap Analysis", time: fmt(ga.timestamp), icon: "🔍", path: "/gapmap" });

            // Sort by most recent
            const sorted = activities
              .filter(a => a.time)
              .sort((a, b) => {
                const ta = (user as any)?.savedAssessments?.[0]?.timestamp || "";
                return 0;
              })
              .slice(0, 5);

            if (sorted.length === 0) {
              return (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-text-body/20 mx-auto mb-3" />
                  <p className="text-sm text-text-body/40 font-medium">No activity yet — start with the Skill Assessment!</p>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {sorted.map((item, i) => (
                  <Link key={i} to={item.path} className="flex items-center gap-4 p-4 rounded-2xl bg-bg-primary/50 border border-white/5 hover:border-accent/30 hover:bg-accent/5 transition-all group">
                    <span className="text-xl">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text-heading truncate">{item.label}</p>
                    </div>
                    <span className="text-[11px] text-text-body/40 font-medium whitespace-nowrap">{item.time}</span>
                    <ArrowRight className="h-4 w-4 text-text-body/20 group-hover:text-accent transition-colors shrink-0 no-print" />
                  </Link>
                ))}
              </div>
            );
          })()}
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}