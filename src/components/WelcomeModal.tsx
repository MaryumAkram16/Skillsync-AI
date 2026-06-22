import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Radar, FileText, Map, Briefcase, MessageSquare, 
  Brain, Compass, ArrowRight, Sparkles, CheckCircle2, Play
} from "lucide-react";
import { useUser } from "../context/UserContext";
import { useNavigate } from "react-router-dom";

const features = [
  { icon: Brain, label: "Skill Assessment", desc: "10-question AI quiz that identifies your strengths and skill level", color: "text-primary-blue", bg: "bg-primary-blue/10" },
  { icon: Compass, label: "Career Mentor", desc: "Personalized career path recommendations based on your profile", color: "text-primary-purple", bg: "bg-primary-purple/10" },
  { icon: Radar, label: "Market Radar", desc: "Live job market scan showing which skills are most in-demand now", color: "text-warning", bg: "bg-warning/10" },
  { icon: FileText, label: "Resume Parser", desc: "Upload your resume to extract skills and find matched jobs instantly", color: "text-success", bg: "bg-success/10" },
  { icon: Map, label: "GapMap", desc: "Visual skill gap analysis comparing your profile to market demand", color: "text-danger", bg: "bg-danger/10" },
  { icon: Briefcase, label: "Resume Tools", desc: "AI-powered resume rewriter and tailored cover letter generator", color: "text-primary-blue", bg: "bg-primary-blue/10" },
  { icon: MessageSquare, label: "Interview Prep", desc: "Practice with AI mock quizzes and get instant answer feedback", color: "text-primary-purple", bg: "bg-primary-purple/10" },
];

const WELCOME_KEY = "skillsync_welcome_shown";

export function WelcomeModal() {
  const { user, firstName } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    // Show only once per user account
    const key = `${WELCOME_KEY}_${user.uid}`;
    const alreadyShown = localStorage.getItem(key);
    if (!alreadyShown) {
      // Small delay so dashboard renders first
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleClose = () => {
    if (user) {
      localStorage.setItem(`${WELCOME_KEY}_${user.uid}`, "true");
    }
    setIsOpen(false);
  };

  const handleWatchDemos = () => {
    handleClose();
    navigate("/demos");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", damping: 28, stiffness: 380 }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border border-border shadow-2xl shadow-primary-blue/10 flex flex-col">
              
              {/* Header */}
              <div className="relative p-8 pb-6 overflow-hidden shrink-0">
                {/* Glow */}
                <div className="absolute -top-10 -right-10 w-48 h-48 bg-primary-blue/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary-purple/15 rounded-full blur-2xl pointer-events-none" />

                <button
                  onClick={handleClose}
                  className="absolute top-5 right-5 p-2 rounded-full text-text-secondary hover:bg-border/60 hover:text-text-primary transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-primary-blue/15 text-primary-blue">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <span className="font-mono text-xs uppercase tracking-widest text-primary-blue">Welcome aboard</span>
                </div>

                <h1 className="font-display text-3xl font-semibold text-text-primary mb-2 leading-tight">
                  Hey {firstName || "there"}, welcome to{" "}
                  <span className="bg-gradient-to-r from-primary-blue to-primary-purple bg-clip-text text-transparent">
                    SkillSync AI!
                  </span>
                </h1>
                <p className="text-text-secondary leading-relaxed">
                  Your all-in-one AI career assistant. Here's a quick tour of the 7 powerful tools waiting for you — all free during our launch phase.
                </p>
              </div>

              {/* Features list */}
              <div className="px-8 pb-6 grid grid-cols-1 gap-3">
                {features.map(({ icon: Icon, label, desc, color, bg }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 }}
                    className="flex items-start gap-4 p-4 rounded-2xl bg-background border border-border hover:border-primary-blue/30 transition-colors group"
                  >
                    <div className={`p-2.5 rounded-xl ${bg} ${color} shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary group-hover:text-primary-blue transition-colors">
                        {label}
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-success/40 shrink-0 mt-0.5 ml-auto" />
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-8 py-6 border-t border-border bg-background/40 rounded-b-3xl shrink-0 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-xs text-text-secondary text-center sm:text-left">
                    💡 Start with <span className="font-semibold text-text-primary">Skill Assessment</span> to get personalized recommendations
                  </p>
                  <button
                    onClick={handleWatchDemos}
                    className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary-blue transition-colors font-semibold shrink-0"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Watch quick demos first
                  </button>
                </div>
                <button
                  onClick={handleClose}
                  className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary-blue text-white text-sm font-bold hover:bg-blue-600 transition-colors"
                >
                  Let's get started <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}