import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { api } from "../utils/api";
import { useUser } from "../context/UserContext";
import { cn } from "../utils/cn";
import {
  Compass,
  Loader2,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Target,
  BarChart,
  Lightbulb,
  AlertCircle,
  RefreshCw,
  Calendar,
  TrendingUp,
  Trophy,
  Code,
  Sparkles,
  X,
  History,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { saveResultToProfile } from "../services/profileService";
import { RoadmapResult } from "../types/profile";
import { exportRoadmapPDF } from "../utils/pdfExport";
import { 
  trackFeatureStart, 
  trackFeatureCompletion 
} from "../services/featureService";
import { useToast } from "../components/Toast";
import { UsageLimitLocked, UsageLimitStrip } from "../components/UsageLimitBanner";
import { MilestoneCard } from "../components/RoadmapMilestoneCard";
import { ErrorCard } from "../components/RoadmapErrorCard";
import { RoadmapToast } from "../components/RoadmapToast";
import { ResourcesSection } from "../components/RoadmapResourcesSection";
import { Roadmap, ResourcesData, RoadmapPhase } from "../utils/roadmapTypes";
import { INPUT_LIMITS, sanitize, normalizeRoadmap } from "../utils/roadmapHelpers";

const nodeVariants: any = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.5,
      ease: "easeOut"
    }
  })
};

const lineVariants: any = {
  hidden: { scaleY: 0, originY: 0 },
  visible: (i: number) => ({
    scaleY: 1,
    transition: {
      delay: i * 0.15 + 0.1,
      duration: 0.4,
      ease: "easeOut"
    }
  })
};

const phaseVariants: any = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const milestoneMessages = {
  first: {
    title: "🎉 First Step Complete!",
    message: "Great start! Keep the momentum going."
  },
  phase: {
    title: "🏆 Phase Complete!",
    message: "Amazing work! You're ready for the next phase."
  },
  halfway: {
    title: "⚡ Halfway There!",
    message: "You're making serious progress. Don't stop now!"
  },
  complete: {
    title: "🚀 Roadmap Complete!",
    message: "You've mastered this path! Ready for your next challenge?"
  }
};

/* ============================================================================
 * Main page
 * ========================================================================== */

export default function RoadmapPage() {
  const { user } = useUser();
  const { ai, error: toastError, success } = useToast();
  const location = useLocation();

  // ── Usage limit ───────────────────────────────────────────────────────────
  const usedCount = (user as any)?.savedRoadmaps?.length ?? 0;
  const LIMIT = 2;
  const isLocked = usedCount >= LIMIT;

  // Form state
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("beginner");
  const [timeCommitment, setTimeCommitment] = useState("");
  const [industry, setIndustry] = useState("");
  const [preference, setPreference] = useState("mixed");
  const [currentSkills, setCurrentSkills] = useState("");
  const [targetRole, setTargetRole] = useState("");

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResourcesLoading, setIsResourcesLoading] = useState(false);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [resourcesData, setResourcesData] = useState<ResourcesData | null>(null);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"journey" | "deepdive">("journey");
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [completedTopics, setCompletedTopics] = useState<Record<string, boolean>>({});

  // Memoize prefersReduced
  const prefersReduced = useMemo(() => 
    typeof window !== 'undefined' ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false
  , []);

  // Transient UI feedback
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(
    null
  );
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);

  // ── Explain phase state ───────────────────────────────────────────────────
  // phaseExplanations: keyed by phase index, holds 3 separate structured
  // fields (not one string with embedded markdown) — this avoids literal
  // "**asterisks**" showing up in the UI; labels render as real JSX <strong>
  // elements instead of markdown the page never parsed.
  // explainLoading: which phase index is currently loading (null = none)
  // explainOpen: which phase index's drawer is open (null = none)
  const [phaseExplanations, setPhaseExplanations] = useState<Record<number, { whatYoullLearn: string; whatYoullBuild: string; topTip: string }>>({});
  const [explainLoading, setExplainLoading] = useState<number | null>(null);
  const [explainOpen, setExplainOpen] = useState<number | null>(null);

  // Handle pre-fill from navigation state (e.g. arriving from another page)
  useEffect(() => {
    const state = location.state as {
      roadmap?: Roadmap;
      goal?: string;
      role?: string;
      level?: string;
      skills?: string | string[];
      industry?: string;
    } | null;
    if (!state) return;
    if (state.roadmap) setRoadmap(state.roadmap);
    if (state.goal) setGoal(state.goal);
    else if (state.role) {
      setGoal(`Become a ${state.role}`);
      setTargetRole(state.role);
    }
    if (state.level) setLevel(state.level.toLowerCase());
    if (state.skills) {
      setCurrentSkills(
        Array.isArray(state.skills) ? state.skills.join(", ") : state.skills
      );
    }
    if (state.industry) setIndustry(state.industry);
  }, [location.state]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("skillsync_last_roadmap");
    const progress = localStorage.getItem("skillsync_roadmap_progress");
    
    if (progress) {
      try {
        setCompletedTopics(JSON.parse(progress));
      } catch (e) {
        console.error("Failed to parse roadmap progress", e);
      }
    }

    const state = location.state as { autoResume?: boolean } | null;
    const shouldAutoResume = state?.autoResume;

    if (saved && !roadmap) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.data) {
          if (shouldAutoResume) {
            setRoadmap(parsed.data);
            setGoal(parsed.title || "");
            setShowResumeBanner(false);
          } else {
            setShowResumeBanner(true);
          }
        }
      } catch (e) {
        console.error("Failed to parse saved roadmap", e);
      }
    }
  }, [roadmap, location.state]);

  const handleResumeSaved = () => {
    const saved = localStorage.getItem("skillsync_last_roadmap");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRoadmap(parsed.data);
        setGoal(parsed.title || "");
        setShowResumeBanner(false);
        setToast({ message: "Loaded saved roadmap", tone: "success" });
      } catch (e) {
        console.error("Failed to resume saved roadmap", e);
        setShowResumeBanner(false);
      }
    }
  };

  // ── Deep-linked generation (e.g. from the chatbot: /roadmap?goal=Data+Analysis) ──
  // Pre-fills the goal/role from the URL and runs generation automatically,
  // so the user lands on a roadmap instead of a blank form.
  const autoGenerateGoalRef = React.useRef<string | null>(null);
  const hasAutoGeneratedRef = React.useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const goalParam = params.get("goal");
    const roleParam = params.get("role");
    if (goalParam && goalParam.trim()) {
      autoGenerateGoalRef.current = goalParam.trim();
      setGoal(goalParam.trim());
      if (roleParam && roleParam.trim()) setTargetRole(roleParam.trim());
    } else if (roleParam && roleParam.trim()) {
      const inferredGoal = `Become a ${roleParam.trim()}`;
      autoGenerateGoalRef.current = inferredGoal;
      setGoal(inferredGoal);
      setTargetRole(roleParam.trim());
    }
    // Only meant to run once, on the URL the page was loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      autoGenerateGoalRef.current &&
      goal === autoGenerateGoalRef.current &&
      !hasAutoGeneratedRef.current &&
      !roadmap
    ) {
      hasAutoGeneratedRef.current = true;
      handleGenerate();
    }
  }, [goal, roadmap]);

  const handleGenerateNew = () => {
    localStorage.removeItem("skillsync_last_roadmap");
    setRoadmap(null);
    setShowResumeBanner(false);
  };

  /* --------------------------------------------------------------------------
   * Handlers
   * ------------------------------------------------------------------------ */

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      setError("You must be signed in to generate a roadmap.");
      return;
    }

    const cleanGoal = sanitize(goal, INPUT_LIMITS.goal);
    if (!cleanGoal) {
      setError("Please specify a learning goal.");
      return;
    }

    setIsGenerating(true);
    setRoadmap(null);
    setResourcesData(null);
    setResourcesError(null);
    setError(null);
    setStatusMessage("Building your roadmap — this typically takes about 15 seconds...");
    
    // Track feature start
    await trackFeatureStart(user.uid, "roadmap", "Career Roadmap");

    try {
      const response = await api.generateRoadmap({
        userId: user.uid,
        goal: cleanGoal,
        level,
        timeCommitment: sanitize(timeCommitment, INPUT_LIMITS.timeCommitment),
        preference,
        currentSkills: sanitize(currentSkills, INPUT_LIMITS.skills),
        targetRole: sanitize(targetRole, INPUT_LIMITS.targetRole),
        industry: sanitize(industry, INPUT_LIMITS.industry),
      });

      // The API may return either { roadmap: {...} } or the roadmap object directly.
      const rawRoadmap = response?.roadmap ?? response;
      const normalized = normalizeRoadmap(rawRoadmap, cleanGoal);

      if (!normalized) {
        throw new Error("Could not parse the generated roadmap. Please try again.");
      }

      // Surface the DB id if it came back at a different level than the payload.
      const apiId =
        response?.roadmap_id ?? response?.id ?? normalized.roadmap_id ?? "";
      if (apiId && !normalized.roadmap_id) {
        normalized.roadmap_id = apiId;
      }

      if (!normalized.phases.length) {
        throw new Error(
          "The roadmap generator returned no phases. Please try again with a clearer goal."
        );
      }

      setRoadmap(normalized);
      setStatusMessage(null);

      // Save output to localStorage as requested
      localStorage.setItem("skillsync_last_roadmap", JSON.stringify({
        feature: "roadmap",
        title: cleanGoal,
        data: normalized,
        timestamp: new Date().toISOString(),
        path: "/roadmap"
      }));

      // Track feature completion
      await trackFeatureCompletion(
        user.uid,
        "roadmap",
        "Career Roadmap",
        () => {}
      );

      ai("Roadmap Ready!", "Your personalised career roadmap has been generated"); // <-- ADDED
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to generate roadmap. Please try again.";
      console.error("Roadmap generation failed:", err);
      toastError("Generation Failed", message); // <-- ADDED
      setError(message);
      setStatusMessage(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestResources = async () => {
    if (!roadmap?.roadmap_id) {
      setResourcesError("This roadmap has no ID yet — try regenerating it.");
      return;
    }

    setIsResourcesLoading(true);
    setResourcesData(null);
    setResourcesError(null);

    try {
      const response = await api.suggestResources({
        roadmap_id: Number(roadmap.roadmap_id),
      });
      // Accept the canonical shape from the backend, allowing one level of wrapping.
      const result: ResourcesData =
        response?.data ?? response?.resources ?? response ?? {};
      setResourcesData(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load resources. Please try again.";
      console.error("Resource fetch failed:", err);
      setResourcesError(message);
    } finally {
      setIsResourcesLoading(false);
    }
  };

  const copySummary = async () => {
    if (!roadmap) return;
    const lines = [
      roadmap.title,
      "",
      roadmap.total_duration && `Duration: ${roadmap.total_duration}`,
      roadmap.salary_range && `Salary: ${roadmap.salary_range}`,
      roadmap.job_titles.length > 0 && `Roles: ${roadmap.job_titles.join(", ")}`,
      "",
      roadmap.summary,
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setToast({ message: "Summary copied to clipboard", tone: "success" });
    } catch {
      setToast({ message: "Failed to copy summary", tone: "error" });
    }
  };

  const scrollToNextIncomplete = () => {
    if (!roadmap) return;
    for (let pi = 0; pi < roadmap.phases.length; pi++) {
      for (let ti = 0; ti < roadmap.phases[pi].topics.length; ti++) {
        const key = `${pi}-${ti}`;
        if (!completedTopics[key]) {
          const el = document.getElementById(`topic-${key}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
        }
      }
    }
  };

  const handleNodeComplete = (pi: number, ti: number) => {
    if (!roadmap) return;
    
    const key = `${pi}-${ti}`;
    const nextCompleted = {
      ...completedTopics,
      [key]: !completedTopics[key]
    };
    
    setCompletedTopics(nextCompleted);
    localStorage.setItem('skillsync_roadmap_progress', JSON.stringify(nextCompleted));

    // Only show milestones when marking as COMPLETE
    if (!completedTopics[key]) {
      const allTopics: string[] = [];
      roadmap.phases.forEach((p, pIdx) => {
        p.topics.forEach((t, tIdx) => {
          allTopics.push(`${pIdx}-${tIdx}`);
        });
      });

      const completedCount = Object.values(nextCompleted).filter(Boolean).length;
      const totalNodes = allTopics.length;
      const isLastInPhase = ti === roadmap.phases[pi].topics.length - 1;

      let milestone: { title: string; message: string } | null = null;

      if (completedCount === 1) {
        milestone = milestoneMessages.first;
      } else if (completedCount === totalNodes) {
        milestone = milestoneMessages.complete;
      } else if (completedCount === Math.floor(totalNodes / 2)) {
        milestone = milestoneMessages.halfway;
      } else if (isLastInPhase) {
        milestone = milestoneMessages.phase;
      }

      if (milestone) {
        success(milestone.title, milestone.message, "Next Step →", scrollToNextIncomplete);
      }
    }
  };

  // ── Explain Phase handler ─────────────────────────────────────────────────
  // Calls the backend /api/explain-phase endpoint (Gemini-only, light limiter).
  // Results are cached in phaseExplanations so re-opening the drawer is instant.
  const handleExplainPhase = async (phase: RoadmapPhase, idx: number) => {
    // If already open, toggle closed
    if (explainOpen === idx) {
      setExplainOpen(null);
      return;
    }
    // If already cached, just open
    if (phaseExplanations[idx]) {
      setExplainOpen(idx);
      return;
    }
    setExplainLoading(idx);
    setExplainOpen(idx);
    try {
      const result = await api.explainPhase({
        phaseName: phase.name,
        topics: phase.topics.map((t) => t.name),
        tools: phase.tools,
        milestoneProject: phase.milestone_project?.name || "",
        checkpoint: phase.checkpoint || "",
        phaseNumber: idx + 1,
        totalPhases: roadmap?.phases.length || 1,
      });
      setPhaseExplanations((prev) => ({
        ...prev,
        [idx]: result.explanation || { whatYoullLearn: "", whatYoullBuild: "", topTip: "" },
      }));
    } catch (e: any) {
      setPhaseExplanations((prev) => ({
        ...prev,
        [idx]: {
          whatYoullLearn: "Couldn't load explanation right now — try again in a moment.",
          whatYoullBuild: "",
          topTip: "",
        },
      }));
    } finally {
      setExplainLoading(null);
    }
  };

  const handleSaveRoadmap = async () => {
    if (!roadmap || !user) return;
    try {
      const roadmapResult: RoadmapResult = {
        id: String(roadmap.roadmap_id || `road-${Date.now()}`),
        type: "roadmap",
        title: roadmap.title,
        goal,
        phases: roadmap.phases,
        timestamp: new Date().toISOString(),
        data: roadmap,
      };
      await saveResultToProfile(user.uid, roadmapResult);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setToast({ message: "Roadmap saved to your profile", tone: "success" });
    } catch (e) {
      console.error("Failed to save roadmap:", e);
      setToast({ message: "Could not save roadmap", tone: "error" });
    }
  };

  const handleExportPDF = () => {
    if (!roadmap) return;
    exportRoadmapPDF(roadmap, user);
  };

  const exportPlainText = async () => {
    if (!roadmap) return;
    const parts: string[] = [`ROADMAP: ${roadmap.title}`];
    if (roadmap.total_duration || roadmap.weekly_hours || roadmap.salary_range) {
      const meta = [
        roadmap.total_duration && `Duration: ${roadmap.total_duration}`,
        roadmap.weekly_hours && `Hours: ${roadmap.weekly_hours}/week`,
        roadmap.salary_range && `Salary: ${roadmap.salary_range}`,
      ]
        .filter(Boolean)
        .join(" | ");
      parts.push(meta, "");
    }
    roadmap.phases.forEach((phase, i) => {
      parts.push(`PHASE ${i + 1}: ${phase.name}`);
      if (phase.focus_area) parts.push(`Focus: ${phase.focus_area}`);
      if (phase.duration) parts.push(`Duration: ${phase.duration}`);
      if (phase.topics.length > 0)
        parts.push(`Topics: ${phase.topics.map((t) => t.name).join(", ")}`);
      if (phase.milestone_project?.name)
        parts.push(`Milestone: ${phase.milestone_project.name}`);
      parts.push("");
    });
    try {
      await navigator.clipboard.writeText(parts.join("\n"));
      setToast({ message: "Plain text roadmap copied to clipboard", tone: "success" });
    } catch {
      setToast({ message: "Failed to copy roadmap text", tone: "error" });
    }
  };

  /* --------------------------------------------------------------------------
   * Render
   * ------------------------------------------------------------------------ */

  return (
    <DashboardLayout
      title={roadmap ? "Your Career Roadmap" : "Roadmap Generator"}
      showBackButton={!!roadmap}
      onBack={() => setRoadmap(null)}
      actions={
        roadmap ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportPDF}
            className="border border-accent text-accent hover:bg-accent/10 h-9 px-4 rounded-xl flex items-center bg-transparent"
          >
            <Download className="h-4 w-4 mr-2 text-accent" />
            <span className="text-xs font-bold uppercase tracking-widest">Download PDF</span>
          </Button>
        ) : (!roadmap && user && user.savedRoadmaps && user.savedRoadmaps.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSavedModal(true)}
            className="text-text-secondary hover:text-text-primary hidden sm:flex"
          >
            <History className="h-4 w-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-widest">History</span>
          </Button>
        ) : undefined)
      }
    >
      <div
        className={cn("max-w-5xl mx-auto space-y-8", roadmap ? "pb-4" : "pb-20")}
      >
        {/* Resume Banner */}
        {showResumeBanner && !roadmap && (
          <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20 text-accent">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-heading">You have a saved roadmap</p>
                <p className="text-xs text-text-secondary">Pick up where you left off with your last generation.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowResumeBanner(false)}
                className="text-text-secondary hover:text-text-heading"
              >
                Dismiss
              </Button>
              <Button 
                size="sm" 
                onClick={handleResumeSaved}
                className="bg-accent text-near-black font-bold"
              >
                Resume Last Roadmap
              </Button>
            </div>
          </div>
        )}

        {/* Usage limit — locked screen */}
        {isLocked && !roadmap && <UsageLimitLocked feature="Roadmap" limit={LIMIT} />}

        {!isLocked && (
          <>
            {/* Usage strip — show when 1 remaining */}
            {!roadmap && (
              <UsageLimitStrip feature="Roadmap" limit={LIMIT} used={usedCount} />
            )}

            {!roadmap && (
              <section className="space-y-4">
                <div className="relative overflow-hidden rounded-[2rem] p-6 flex items-center gap-3">
                  <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-30" />
                  <div className="absolute -top-16 -right-10 w-[300px] h-[220px] bg-primary-violet/10 rounded-full blur-[100px] pointer-events-none" />
                  <div className="relative z-10 p-2 rounded-lg bg-accent/10 text-accent">
                    <Compass className="h-6 w-6" />
                  </div>
                  <div className="relative z-10">
                    <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary-purple mb-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary-purple animate-pulse-violet" />
                      AI-powered curator
                    </span>
                    <h2 className="font-display text-2xl font-semibold text-text-heading tracking-tight">
                      Roadmap Generator
                    </h2>
                    <p className="text-text-body">
                      Transform your career aspirations into a clear, actionable success path with
                      our AI-powered learning curator.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {!roadmap && (
              <Card className="p-6">
                <form onSubmit={handleGenerate} className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-text-heading">
                  <Target className="h-4 w-4 text-accent" />
                  What career/role do you want? (Your Goal)
                </label>
                <Input
                  placeholder="e.g. AI Engineer, Data Scientist, Full Stack Developer"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  maxLength={INPUT_LIMITS.goal}
                  required
                  className="h-11 sm:h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-text-heading">
                  <BarChart className="h-4 w-4 text-accent" />
                  Current Level
                </label>
                <select
                  className="w-full h-11 sm:h-12 px-3 rounded-xl border border-border bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-text-primary font-medium"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option value="beginner" className="bg-bg-primary">
                    Beginner
                  </option>
                  <option value="intermediate" className="bg-bg-primary">
                    Intermediate
                  </option>
                  <option value="advanced" className="bg-bg-primary">
                    Advanced
                  </option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-text-heading">
                  <Clock className="h-4 w-4 text-accent" />
                  Weekly Hours
                </label>
                <Input
                  placeholder="e.g. 10 hours per week"
                  value={timeCommitment}
                  onChange={(e) => setTimeCommitment(e.target.value)}
                  maxLength={INPUT_LIMITS.timeCommitment}
                  required
                  className="h-11 sm:h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-text-heading">
                  <Lightbulb className="h-4 w-4 text-accent" />
                  Existing Skills
                </label>
                <Input
                  placeholder="e.g. Python, Excel, basic SQL (optional)"
                  value={currentSkills}
                  onChange={(e) => setCurrentSkills(e.target.value)}
                  maxLength={INPUT_LIMITS.skills}
                  className="h-11 sm:h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-text-heading">
                  <Compass className="h-4 w-4 text-accent" />
                  Target Industry
                </label>
                <Input
                  placeholder="e.g. healthcare, finance, general tech"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  maxLength={INPUT_LIMITS.industry}
                  className="h-11 sm:h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-text-heading">
                  <BookOpen className="h-4 w-4 text-accent" />
                  Learning Style
                </label>
                <select
                  className="w-full h-11 sm:h-12 px-3 rounded-xl border border-border bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-text-primary font-medium"
                  value={preference}
                  onChange={(e) => setPreference(e.target.value)}
                >
                  <option value="mixed" className="bg-bg-primary">
                    Mixed (Videos, Reading, Projects)
                  </option>
                  <option value="videos" className="bg-bg-primary">
                    Videos
                  </option>
                  <option value="reading" className="bg-bg-primary">
                    Reading
                  </option>
                  <option value="hands-on" className="bg-bg-primary">
                    Hands-on Projects
                  </option>
                </select>
              </div>

              <div className="md:col-span-2 pt-2">
                {statusMessage && (
                  <div className="mb-4 p-4 bg-accent/5 border border-accent/20 text-text-primary rounded-2xl text-sm font-medium flex flex-col justify-center gap-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-accent" />
                      <span className="font-bold tracking-tight">{statusMessage}</span>
                    </div>
                    {isGenerating && (
                      <div className="w-full bg-border/30 rounded-full h-2 overflow-hidden">
                        <motion.div
                          className="bg-accent h-2 rounded-full shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 15, ease: "easeInOut" }}
                        />
                      </div>
                    )}
                  </div>
                )}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full sm:w-auto px-10 bg-accent hover:bg-accent/90 text-near-black font-black uppercase tracking-widest text-xs rounded-2xl border-none shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Building Path...
                    </div>
                  ) : (
                    "Generate My Career Path"
                  )}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {error && (
          <ErrorCard
            error={error}
            onRetry={() => handleGenerate()}
            onDismiss={() => setError(null)}
          />
        )}
      </>
    )}

    <AnimatePresence>
          {roadmap && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 mt-8"
            >
              <div className="flex justify-between items-center bg-bg-card p-2 rounded-2xl border border-border shadow-lg">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setViewMode("journey")}
                          className={cn(
                            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                            viewMode === "journey"
                              ? "bg-accent text-near-black shadow-lg shadow-accent/20"
                              : "text-text-primary hover:bg-white/5"
                          )}
                        >
                          <Compass className="h-4 w-4" />
                          Journey Map (Visual)
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode("deepdive")}
                          className={cn(
                            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                            viewMode === "deepdive"
                              ? "bg-accent text-near-black shadow-lg shadow-accent/20"
                              : "text-text-primary hover:bg-white/5"
                          )}
                        >
                          <BookOpen className="h-4 w-4" />
                          Deep Dive (Detailed)
                        </button>
                      </div>
              </div>

              {/* ROADMAP DISPLAY */}
              <div className="space-y-8">
                {viewMode === "deepdive" && (
                  <div className="p-8 rounded-[2.5rem] bg-bg-card border border-border shadow-2xl shadow-accent/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-30" />
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full -mr-64 -mt-64 blur-[100px]" />
                    <div className="relative z-10 space-y-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-text-primary font-mono text-xs uppercase tracking-[0.2em]">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary-purple animate-pulse-violet" />
                          Expert Path
                        </span>
                        {roadmap.roadmap_id && (
                          <span className="px-3 py-1.5 rounded-full bg-white/5 text-text-secondary font-mono text-[10px] uppercase tracking-widest">
                            ID: {roadmap.roadmap_id}
                          </span>
                        )}
                      </div>

                      <h3 className="font-display text-5xl font-semibold text-text-heading tracking-tight leading-[1.1]">
                        🗺️ {roadmap.title}
                      </h3>

                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
                        {roadmap.total_duration && (
                          <div className="p-4 rounded-2xl bg-bg-primary border border-border space-y-1">
                            <span className="font-mono text-[10px] uppercase text-text-secondary tracking-widest">
                              📅 Duration
                            </span>
                            <p className="text-xl font-black text-text-primary">
                              {roadmap.total_duration}
                            </p>
                          </div>
                        )}
                        {roadmap.weekly_hours > 0 && (
                          <div className="p-4 rounded-2xl bg-bg-primary border border-border space-y-1">
                            <span className="font-mono text-[10px] uppercase text-text-secondary tracking-widest">
                              ⏱ Time
                            </span>
                            <p className="text-xl font-black text-text-primary">
                              {roadmap.weekly_hours} hrs/week
                            </p>
                          </div>
                        )}
                        {roadmap.salary_range && (
                          <div className="p-4 rounded-2xl bg-bg-primary border border-border space-y-1 min-w-0">
                            <span className="font-mono text-[10px] uppercase text-text-secondary tracking-widest">
                              💰 Salary
                            </span>
                            <p className="text-base sm:text-lg md:text-xl font-black text-green-500 break-words leading-tight">
                              {roadmap.salary_range}
                            </p>
                          </div>
                        )}
                        {roadmap.job_titles.length > 0 && (
                          <div className="p-4 rounded-2xl bg-bg-primary border border-border space-y-1">
                            <span className="font-mono text-[10px] uppercase text-text-secondary tracking-widest">
                              👔 Roles
                            </span>
                            <p className="text-sm font-bold text-text-primary line-clamp-2">
                              {roadmap.job_titles.join(", ")}
                            </p>
                          </div>
                        )}
                      </div>

                      {roadmap.summary && (
                        <div className="p-6 rounded-3xl bg-accent/[0.03] border border-accent/10 relative">
                          <div className="absolute top-0 left-6 -translate-y-1/2 px-3 py-1 rounded-full bg-accent text-near-black font-mono text-[10px] uppercase tracking-widest">
                            CareerAI Summary
                          </div>
                          <p className="text-text-primary text-lg font-medium leading-relaxed italic">
                            "{roadmap.summary}"
                          </p>
                        </div>
                      )}

                      {roadmap.prerequisites && roadmap.prerequisites.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-mono text-text-secondary uppercase tracking-widest text-[10px]">
                            Prerequisites:
                          </span>
                          {roadmap.prerequisites.map((p, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-bg-surface border border-border text-text-primary text-xs font-bold"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {viewMode === "journey" ? (
                  <div className="bg-bg-card text-text-primary p-4 sm:p-6 md:p-16 rounded-xl md:rounded-[4rem] border-[2px] sm:border-[4px] border-border shadow-2xl relative overflow-hidden font-sans">
                    {/* Header Info */}
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 mb-10 sm:mb-24 relative z-10">
                      <div className="grid sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start order-2 md:order-1">
                        {roadmap.prerequisites && roadmap.prerequisites.length > 0 && (
                          <div className="bg-bg-primary border-[2px] sm:border-[3px] border-border rounded-xl md:rounded-[2rem] p-5 sm:p-6 shadow-lg h-fit">
                            <h5 className="font-mono text-[10px] uppercase text-text-primary text-center border-b border-border/20 pb-3 mb-5 tracking-[0.2em]">
                              Pre-requisites
                            </h5>
                            <div className="flex flex-wrap gap-2 justify-center">
                              {roadmap.prerequisites.map((p, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1.5 bg-accent/10 text-[9px] sm:text-[10px] font-black text-text-primary rounded-lg border border-accent/20 uppercase"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="bg-bg-primary border-[2px] sm:border-[3px] border-border rounded-xl md:rounded-[2rem] p-5 sm:p-6 shadow-lg text-center space-y-4 h-fit">
                          <p className="font-mono text-[10px] uppercase tracking-tight leading-relaxed italic text-text-secondary">
                            Tailored path generated by AI for your goals.
                          </p>
                          <div
                            onClick={handleSaveRoadmap}
                            className="py-3 bg-accent text-near-black text-[11px] font-black rounded-xl border border-near-black shadow-lg uppercase cursor-pointer hover:translate-y-[-2px] transition-all active:scale-95"
                          >
                            Master This Path
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center pt-4 sm:pt-12 space-y-6 sm:space-y-12 order-1 md:order-2">
                        <div className="hidden md:block w-1.5 h-20 border-l-[6px] border-dotted border-accent" />
                        <h2 className="font-display text-3xl sm:text-5xl md:text-7xl font-semibold uppercase tracking-tight text-center leading-[0.9] max-w-[500px] text-text-heading">
                          {roadmap.title}
                        </h2>
                        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-[4px] sm:border-[6px] border-accent border-dotted animate-pulse" />
                      </div>
                    </div>

                    {/* STICKY PROGRESS BAR */}
                    {(() => {
                      const totalTopics = roadmap.phases.reduce((sum, p) => sum + p.topics.length, 0);
                      const completedCount = Object.values(completedTopics).filter(Boolean).length;
                      const progressPct = totalTopics > 0 
                        ? Math.round((completedCount / totalTopics) * 100) 
                        : 0;
                      return (
                        <div className="sticky top-0 z-40 bg-bg-primary/95 backdrop-blur border-b border-border px-4 py-2 flex items-center gap-3 mb-6 sm:mb-12 rounded-xl">
                          <span className="text-xs font-black text-text-secondary whitespace-nowrap">
                            {completedCount}/{totalTopics} complete
                          </span>
                          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-accent rounded-full transition-all duration-500"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-xs font-black text-accent">{progressPct}%</span>
                        </div>
                      );
                    })()}

                    {/* FLOWCHART */}
                    <div className="relative pb-10 overflow-x-hidden px-1 sm:px-0">
                      <motion.div 
                        initial={prefersReduced ? {} : "hidden"}
                        animate="visible"
                        variants={lineVariants}
                        className="absolute left-6 sm:left-8 md:left-1/2 top-0 bottom-0 w-[3px] sm:w-[4px] md:w-[8px] bg-accent -translate-x-1/2 border-x border-black/5 md:border-x-2 md:border-near-black/10 min-h-[500px]" 
                      />
                      <div className="relative z-20 space-y-12 sm:space-y-24 md:space-y-48 pb-10">
                        {roadmap.phases.map((phase, idx) => (
                          <div key={idx} className="w-full">
                            {/* Single column mobile layout */}
                            <div className="flex flex-col gap-3 pl-10 sm:pl-12 md:hidden mb-12 relative w-full">
                              {/* Phase header */}
                              <motion.div
                                initial={prefersReduced ? {} : "hidden"}
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={phaseVariants}
                                className="bg-bg-primary border-[2px] border-border px-4 py-3 rounded-xl shadow-md w-full text-center relative z-30"
                              >
                                <div className="space-y-1">
                                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] block text-accent">
                                    Phase {idx + 1}
                                  </span>
                                  <span className="font-display text-xl md:text-3xl font-semibold uppercase tracking-tight leading-none text-text-heading">
                                    {phase.name}
                                  </span>
                                </div>
                                <div className="absolute top-1/2 -translate-y-1/2 left-[-45px] sm:left-[-52px] w-3.5 h-3.5 bg-accent border-[2px] border-near-black rounded-full z-40" />
                              </motion.div>

                              {/* Topics directly below, full width */}
                              {phase.topics.length > 0 && (
                                <motion.div
                                  id={`phase-mob-${idx}`}
                                  initial={prefersReduced ? {} : "hidden"}
                                  whileInView="visible"
                                  viewport={{ once: true }}
                                  variants={nodeVariants}
                                  custom={idx}
                                  className="w-full min-w-0 max-w-full bg-bg-primary border-[3px] border-border rounded-xl shadow-xl overflow-hidden"
                                >
                                  <div className="bg-bg-card border-b border-border py-3 px-6">
                                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-primary text-center block">
                                      {phase.focus_area || phase.name}
                                    </span>
                                  </div>
                                  <div className="p-4 sm:p-6 md:p-8 grid grid-cols-1 gap-2.5">
                                    {phase.topics.map((topic, ti) => {
                                      const key = `${idx}-${ti}`;
                                      const isDone = completedTopics[key];
                                      return (
                                        <div
                                          key={ti}
                                          id={`topic-mob-${key}`}
                                          onClick={() => handleNodeComplete(idx, ti)}
                                          className={cn(
                                            "border px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex flex-col items-stretch gap-1.5 justify-between group",
                                            isDone 
                                              ? "bg-accent text-near-black border-accent" 
                                              : "bg-accent/5 border-accent/20 text-text-primary hover:bg-accent/10"
                                          )}
                                        >
                                          <div className="flex items-center justify-between w-full">
                                            <span>{topic.name}</span>
                                            {isDone ? (
                                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                                            ) : (
                                              <div className="h-4 w-4 rounded-full border-2 border-accent/30 group-hover:border-accent transition-colors shrink-0" />
                                            )}
                                          </div>
                                          {topic.subtopics && topic.subtopics.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {topic.subtopics.slice(0,3).map((sub, si) => (
                                                <span key={si} className="text-[10px] px-2 py-0.5 rounded-full bg-border/50 text-text-secondary font-medium">
                                                  {sub}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </div>

                            {/* Keep existing alternating layout for md+ */}
                            <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] items-center gap-6 md:gap-12 w-full max-w-[1300px] mx-auto relative px-2 sm:px-4">
                              <div className="flex justify-end items-center h-full">
                                {idx % 2 !== 0 && phase.topics.length > 0 && (
                                  <div className="flex items-center gap-10 flex-row-reverse">
                                    <motion.div
                                      id={`phase-${idx}`}
                                      initial={prefersReduced ? {} : "hidden"}
                                      whileInView="visible"
                                      viewport={{ once: true }}
                                      variants={nodeVariants}
                                      custom={idx}
                                      className="w-full md:w-fit min-w-0 md:min-w-[240px] max-w-full md:max-w-[420px] bg-bg-primary border-[3px] border-border rounded-xl md:rounded-[2rem] shadow-xl overflow-hidden"
                                    >
                                      <div className="bg-bg-card border-b border-border py-4 px-8">
                                        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-primary text-center block">
                                          {phase.focus_area || phase.name}
                                        </span>
                                      </div>
                                      <div className="p-4 sm:p-6 md:p-8 grid grid-cols-1 gap-3">
                                        {phase.topics.map((topic, ti) => {
                                          const key = `${idx}-${ti}`;
                                          const isDone = completedTopics[key];
                                          return (
                                            <div
                                              key={ti}
                                              id={`topic-${key}`}
                                              onClick={() => handleNodeComplete(idx, ti)}
                                              className={cn(
                                                "border px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-stretch gap-1.5 justify-between group",
                                                isDone 
                                                  ? "bg-accent text-near-black border-accent" 
                                                  : "bg-accent/5 border-accent/20 text-text-primary hover:bg-accent/10"
                                              )}
                                            >
                                              <div className="flex items-center justify-between w-full">
                                                <span>{topic.name}</span>
                                                {isDone ? (
                                                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                                                ) : (
                                                  <div className="h-4 w-4 rounded-full border-2 border-accent/30 group-hover:border-accent transition-colors shrink-0" />
                                                )}
                                              </div>
                                              {topic.subtopics && topic.subtopics.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {topic.subtopics.slice(0,3).map((sub, si) => (
                                                    <span key={si} className="text-[10px] px-2 py-0.5 rounded-full bg-border/50 text-text-secondary font-medium">
                                                      {sub}
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </motion.div>
                                    <div className="w-28 border-t-[4px] border-dotted border-accent shrink-0" />
                                  </div>
                                )}
                              </div>

                              <div className="relative flex justify-start md:justify-center py-4 md:py-20 pl-10 sm:pl-12 md:pl-0">
                                <motion.div
                                  initial={prefersReduced ? {} : "hidden"}
                                  whileInView="visible"
                                  viewport={{ once: true }}
                                  variants={phaseVariants}
                                  className="bg-bg-primary border-[2px] md:border-[3px] border-border px-5 sm:px-10 py-3 sm:py-6 rounded-2xl shadow-xl w-full md:w-fit min-w-[180px] sm:min-w-[240px] max-w-[400px] text-center transform md:hover:rotate-1 transition-transform z-30 relative"
                                >
                                  <div className="space-y-1">
                                    <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.3em] block text-accent">
                                      Phase {idx + 1}
                                    </span>
                                    <span className="font-display text-xl md:text-3xl font-semibold uppercase tracking-tight leading-none text-text-heading">
                                      {phase.name}
                                    </span>
                                  </div>
                                  <div
                                    className={cn(
                                      "absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 bg-accent border-[2px] md:border-[3px] border-near-black rounded-full z-40 transition-all",
                                      "left-[-45px] sm:left-[-52px] md:left-auto", // mobile positioning
                                      idx % 2 === 0
                                        ? "md:-right-[2.5px] md:translate-x-1/2 md:translate-y-1/2 lg:right-[-12px] lg:translate-x-0 lg:translate-y-[-50%]"
                                        : "md:-left-[2.5px] md:-translate-x-1/2 md:translate-y-1/2 lg:left-[-12px] lg:translate-x-0 lg:translate-y-[-50%]"
                                    )}
                                  />
                                </motion.div>
                              </div>

                              <div className="flex justify-start items-center h-full pl-10 sm:pl-12 md:pl-0">
                                {idx % 2 === 0 && phase.topics.length > 0 && (
                                  <div className="flex items-center gap-6 md:gap-10 w-full">
                                    <div className="hidden md:block w-28 border-t-[4px] border-dotted border-accent shrink-0" />
                                    <motion.div
                                      id={`phase-${idx}`}
                                      initial={prefersReduced ? {} : "hidden"}
                                      whileInView="visible"
                                      viewport={{ once: true }}
                                      variants={nodeVariants}
                                      custom={idx}
                                      className="w-full md:w-fit min-w-0 md:min-w-[240px] max-w-full md:max-w-[420px] bg-bg-primary border-[3px] border-border rounded-xl md:rounded-[2rem] shadow-xl overflow-hidden"
                                    >
                                      <div className="bg-bg-card border-b border-border py-4 px-8">
                                        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-primary text-center block">
                                          {phase.focus_area || phase.name}
                                        </span>
                                      </div>
                                      <div className="p-4 sm:p-6 md:p-8 grid grid-cols-1 gap-2.5 sm:gap-3">
                                        {phase.topics.map((topic, ti) => {
                                          const key = `${idx}-${ti}`;
                                          const isDone = completedTopics[key];
                                          return (
                                            <div
                                              key={ti}
                                              id={`topic-${key}`}
                                              onClick={() => handleNodeComplete(idx, ti)}
                                              className={cn(
                                                "border px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-stretch gap-1.5 justify-between group",
                                                isDone 
                                                  ? "bg-accent text-near-black border-accent" 
                                                  : "bg-accent/5 border-accent/20 text-text-primary hover:bg-accent/10"
                                              )}
                                            >
                                              <div className="flex items-center justify-between w-full">
                                                <span>{topic.name}</span>
                                                {isDone ? (
                                                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                                                ) : (
                                                  <div className="h-4 w-4 rounded-full border-2 border-accent/30 group-hover:border-accent transition-colors shrink-0" />
                                                )}
                                              </div>
                                              {topic.subtopics && topic.subtopics.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {topic.subtopics.slice(0,3).map((sub, si) => (
                                                    <span key={si} className="text-[10px] px-2 py-0.5 rounded-full bg-border/50 text-text-secondary font-medium">
                                                      {sub}
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </motion.div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-8 pt-10 pb-4 relative z-10">
                      <div className="font-mono text-[12px] uppercase tracking-[0.5em] bg-accent text-near-black px-8 py-3 rounded-full">
                        AI Roadmap Complete
                      </div>
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-bg-primary border-[4px] border-accent flex items-center justify-center text-accent shadow-xl">
                        <CheckCircle2 className="h-10 w-10" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-12 sm:space-y-16">
                    {/* DEEP DIVE VIEW */}
                    {roadmap.phases.map((phase, idx) => (
                      <motion.div
                        key={idx}
                        id={`phase-detail-${idx}`}
                        initial={prefersReduced ? {} : "hidden"}
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={phaseVariants}
                        className="bg-bg-card border border-border rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl transition-all hover:border-accent/20"
                      >
                        <div className="p-8 sm:p-12 md:p-16 border-b border-border/10 bg-accent relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full -mr-64 -mt-64 blur-[100px] opacity-70 transition-colors" />
                          <div className="relative z-10 space-y-6 sm:space-y-10">
                            <div className="flex flex-wrap items-center justify-between gap-8">
                              <div className="space-y-4 sm:space-y-6">
                                <div className="flex items-center gap-4 sm:gap-8">
                                  <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-[1.5rem] sm:rounded-[2rem] bg-bg-primary border border-black/10 shadow-2xl flex items-center justify-center text-3xl sm:text-5xl font-black text-near-black group-hover:scale-105 transition-transform">
                                    0{idx + 1}
                                  </div>
                                  <div className="space-y-1.5 text-near-black">
                                    <span className="font-mono text-[10px] uppercase tracking-[0.5em] opacity-60">
                                      Mastery Module {idx + 1}
                                    </span>
                                    <h3 className="font-display text-2xl sm:text-4xl md:text-5xl font-semibold tracking-tight uppercase italic text-text-heading">
                                      "{phase.name}"
                                    </h3>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  {phase.duration && (
                                    <div className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-2xl bg-bg-primary/70 text-near-black border border-black/10 font-mono text-[10px] uppercase tracking-widest font-bold">
                                      <Clock className="h-3.5 w-3.5" /> {phase.duration}
                                    </div>
                                  )}
                                  {phase.weekly_hours > 0 && (
                                    <div className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-2xl bg-bg-primary/70 text-near-black border border-black/10 font-mono text-[10px] uppercase tracking-widest font-bold">
                                      <Calendar className="h-3.5 w-3.5" /> {phase.weekly_hours}h Intensity
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* ── Explain this phase button ─────────────────── */}
                              <button
                                onClick={() => handleExplainPhase(phase, idx)}
                                className={cn(
                                  "flex items-center gap-2 px-5 py-2.5 rounded-2xl font-mono text-[10px] uppercase tracking-widest transition-all border shadow-lg shrink-0",
                                  explainOpen === idx
                                    ? "bg-near-black text-accent border-near-black"
                                    : "bg-bg-primary/80 text-near-black border-black/10 hover:bg-bg-primary hover:shadow-xl"
                                )}
                              >
                                {explainLoading === idx ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5" />
                                )}
                                {explainOpen === idx && explainLoading !== idx ? "Hide" : "Explain"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* ── Explain drawer (slides in below the phase banner) ── */}
                        <AnimatePresence>
                          {explainOpen === idx && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: "easeOut" }}
                              className="overflow-hidden border-b border-border/20"
                            >
                              <div className="px-8 sm:px-12 md:px-16 py-8 bg-bg-primary/60 flex gap-4 sm:gap-6 items-start">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-mono text-[10px] uppercase tracking-widest text-accent mb-3">
                                    AI Phase Summary
                                  </p>
                                  {explainLoading === idx ? (
                                    <div className="flex items-center gap-3 text-text-secondary">
                                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                      <span className="text-sm animate-pulse">Analyzing this phase...</span>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {phaseExplanations[idx]?.whatYoullLearn && (
                                        <p className="text-sm sm:text-base text-text-primary leading-relaxed font-medium">
                                          <strong className="text-accent">What you'll learn: </strong>
                                          {phaseExplanations[idx].whatYoullLearn}
                                        </p>
                                      )}
                                      {phaseExplanations[idx]?.whatYoullBuild && (
                                        <p className="text-sm sm:text-base text-text-primary leading-relaxed font-medium">
                                          <strong className="text-accent">What you'll build: </strong>
                                          {phaseExplanations[idx].whatYoullBuild}
                                        </p>
                                      )}
                                      {phaseExplanations[idx]?.topTip && (
                                        <p className="text-sm sm:text-base text-text-primary leading-relaxed font-medium">
                                          <strong className="text-accent">Top tip: </strong>
                                          {phaseExplanations[idx].topTip}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => setExplainOpen(null)}
                                  className="text-text-secondary hover:text-text-primary transition-colors shrink-0 mt-0.5"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="p-6 sm:p-10 lg:p-20 grid lg:grid-cols-[1fr_450px] gap-10 sm:gap-20 items-start">
                          <div className="space-y-12 sm:space-y-20">
                            {phase.topics.length > 0 && (
                              <section className="space-y-10 sm:space-y-16">
                                <div className="flex items-center gap-4 sm:gap-8 pb-6 sm:pb-8 border-b border-border">
                                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-[1.2rem] sm:rounded-[2rem] bg-accent/10 border border-accent/20 text-accent flex items-center justify-center shadow-inner">
                                    <BookOpen className="h-8 w-8 sm:h-10 sm:w-10" />
                                  </div>
                                  <div className="space-y-1">
                                    <h4 className="font-display text-xl sm:text-3xl font-semibold text-text-heading tracking-tight">
                                      Technical Breakdown
                                    </h4>
                                    <p className="font-mono text-text-secondary text-[10px] uppercase tracking-widest">
                                      Learning Objectives
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-10 sm:space-y-16">
                                  {phase.topics.map((topic, ti) => {
                                    const key = `${idx}-${ti}`;
                                    const isDone = completedTopics[key];
                                    return (
                                      <div
                                        key={ti}
                                        id={`topic-detail-${key}`}
                                        className={cn(
                                          "relative group/topic pl-8 sm:pl-16 border-l-2 transition-all duration-500",
                                          isDone ? "border-accent" : "border-border/80 hover:border-accent"
                                        )}
                                      >
                                        <div 
                                          className={cn(
                                            "absolute left-[-11px] top-0 w-5 h-5 rounded-full border-4 border-bg-card transition-all cursor-pointer z-10",
                                            isDone ? "bg-accent scale-110" : "bg-border group-hover/topic:bg-accent"
                                          )}
                                          onClick={() => handleNodeComplete(idx, ti)}
                                        />
                                        <div className="space-y-6 sm:space-y-8">
                                          <div className="flex flex-wrap justify-between items-end gap-6 sm:gap-10">
                                            <div className="space-y-2">
                                              <div className="flex items-center gap-4">
                                                <h5 className={cn(
                                                  "text-xl sm:text-3xl font-black transition-all",
                                                  isDone ? "text-accent line-through opacity-60" : "text-text-heading"
                                                )}>
                                                  {topic.name}
                                                </h5>
                                                {isDone && (
                                                  <CheckCircle2 className="h-6 w-6 text-accent animate-in zoom-in duration-300" />
                                                )}
                                              </div>
                                              {topic.estimated_hours > 0 && (
                                                <div className="flex items-center gap-3">
                                                  <span className="px-3 py-1 bg-accent/15 text-accent font-mono text-[9px] uppercase tracking-widest rounded-lg border border-accent/30 font-bold">
                                                    {topic.estimated_hours} Hours Focus
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                            {/* Decorative phase number — absolutely positioned so it
                                                never creates blank space when the left column is short */}
                                            <span className="hidden sm:block text-8xl font-black text-accent/5 select-none leading-none -mb-3 italic pointer-events-none" aria-hidden="true">
                                              0{ti + 1}
                                            </span>
                                          </div>
                                          {topic.subtopics.length > 0 && (
                                            <div className={cn(
                                              "grid grid-cols-1 min-[500px]:grid-cols-2 gap-3 sm:gap-4 transition-opacity",
                                              isDone ? "opacity-50" : "opacity-100"
                                            )}>
                                              {topic.subtopics.map((sub, si) => (
                                                <div
                                                  key={si}
                                                  className="flex items-center gap-2.5 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-bg-primary/50 border border-border hover:border-accent/30 transition-all shadow-sm min-w-0"
                                                >
                                                  <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                                                  <span className="text-xs sm:text-sm font-bold text-text-primary leading-snug break-words min-w-0">
                                                    {sub}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>
                            )}

                            {phase.tools.length > 0 && (
                              <section className="space-y-8 sm:space-y-12">
                                <div className="flex items-center gap-4 sm:gap-6 pb-6 border-b border-border/50">
                                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center shadow-inner">
                                    <Code className="h-6 w-6 sm:h-8 sm:w-8" />
                                  </div>
                                  <div className="space-y-1">
                                    <h4 className="font-display text-xl sm:text-2xl font-semibold text-text-heading tracking-tight">
                                      The Modern Toolkit
                                    </h4>
                                    <p className="font-mono text-text-secondary text-[10px] uppercase tracking-widest">
                                      Required Technologies
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-3 sm:gap-5">
                                  {phase.tools.map((tool) => (
                                    <div
                                      key={tool}
                                      className="px-4 py-2.5 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl bg-bg-primary border border-border shadow-lg hover:shadow-xl hover:translate-y-[-4px] transition-all flex items-center gap-3 sm:gap-4 group min-w-0"
                                    >
                                      <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-accent group-hover:scale-125 transition-transform shrink-0" />
                                      <span className="font-mono text-xs sm:text-sm text-text-primary tracking-widest uppercase break-words min-w-0">
                                        {tool}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </section>
                            )}
                            
                            {(phase.skills_gained.length > 0 || phase.common_mistakes.length > 0) && (
                              <div className="grid md:grid-cols-2 gap-8 sm:gap-16 pt-8 sm:pt-16 border-t border-border">
                                {phase.skills_gained.length > 0 && (
                                  <div className="space-y-6 sm:space-y-8">
                                    <div className="flex items-center gap-3 sm:gap-4 text-green-500">
                                      <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
                                      <h5 className="font-display text-md sm:text-lg font-semibold uppercase tracking-widest">
                                        Skills Gained
                                      </h5>
                                    </div>
                                    <ul className="space-y-2 sm:space-y-3">
                                      {phase.skills_gained.map((skill, si) => (
                                        <li key={si} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-text-primary">
                                          <div className="mt-1.5 h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                          {skill}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {phase.common_mistakes.length > 0 && (
                                  <div className="space-y-6 sm:space-y-8">
                                    <div className="flex items-center gap-3 sm:gap-4 text-amber-500">
                                      <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                                      <h5 className="font-display text-md sm:text-lg font-semibold uppercase tracking-widest">
                                        Common Mistakes
                                      </h5>
                                    </div>
                                    <ul className="space-y-2 sm:space-y-3">
                                      {phase.common_mistakes.map((mistake, mi) => (
                                        <li key={mi} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-text-primary">
                                          <div className="mt-1.5 h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                          {mistake}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="space-y-8 lg:sticky lg:top-24 lg:self-start">
                            {phase.milestone_project?.name && (
                              <MilestoneCard project={phase.milestone_project} />
                            )}
                            {phase.checkpoint && (
                              <div className="p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] bg-accent/5 border border-accent/20">
                                <p className="font-mono text-[10px] uppercase tracking-widest text-accent mb-3">
                                  ✓ Phase Checkpoint
                                </p>
                                <p className="text-xs sm:text-sm font-medium text-text-primary leading-relaxed">
                                  {phase.checkpoint}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    
                    {(roadmap.career_outcomes.length > 0 ||
                      roadmap.next_steps_after_roadmap.length > 0) && (
                      <div className="p-6 sm:p-12 rounded-[2rem] sm:rounded-[3rem] bg-bg-card border border-border shadow-2xl space-y-10 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary-purple/5 pointer-events-none" />

                        {roadmap.career_outcomes.length > 0 && (
                          <div className="relative z-10 p-6 sm:p-8 rounded-3xl bg-bg-primary border border-border space-y-6">
                            <h5 className="font-display text-md sm:text-lg font-semibold uppercase tracking-widest flex items-center gap-3 text-text-heading">
                              <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
                              🏆 CAREER OUTCOMES
                            </h5>
                            <ul className="space-y-3">
                              {roadmap.career_outcomes.map((outcome, i) => (
                                <li key={i} className="flex items-start gap-3 text-text-primary">
                                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 shrink-0" />
                                  <span className="text-xs sm:text-sm font-medium leading-relaxed">{outcome}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {roadmap.next_steps_after_roadmap.length > 0 && (
                          <div className="relative z-10 p-6 sm:p-8 rounded-3xl bg-bg-primary border border-border text-text-primary space-y-6">
                            <h5 className="font-display text-md sm:text-lg font-semibold uppercase tracking-widest flex items-center gap-3 text-text-heading">
                              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
                              📈 NEXT STEPS AFTER COMPLETING
                            </h5>
                            <div className="space-y-4">
                              {roadmap.next_steps_after_roadmap.map((step, i) => (
                                <div key={i} className="flex items-start gap-3 sm:gap-4 font-bold group">
                                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-accent/10 text-text-primary flex items-center justify-center shrink-0 text-[10px] sm:text-xs font-black group-hover:bg-accent transition-all">
                                    {i + 1}
                                  </div>
                                  <p className="text-xs sm:text-sm leading-relaxed text-text-primary">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {roadmap.roadmap_id && (
                          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center font-mono text-[10px] uppercase tracking-[0.3em] text-text-secondary pt-6 border-t border-border gap-4">
                            <span>Roadmap Built by AI Mentor</span>
                            <span className="px-3 py-1 rounded-full bg-bg-primary text-text-primary border border-border">
                              ID: {roadmap.roadmap_id}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-10 pb-24">
                <button
                  type="button"
                  onClick={handleSuggestResources}
                  disabled={isResourcesLoading}
                  className={cn(
                    "h-28 border border-border shadow-xl hover:shadow-2xl hover:translate-y-[-4px] transition-all rounded-[2rem] flex flex-col gap-2 items-center justify-center cursor-pointer group bg-bg-card text-text-primary w-full disabled:opacity-50 disabled:pointer-events-none"
                  )}
                >
                  {isResourcesLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                  ) : (
                    <>
                      <span className="text-3xl group-hover:scale-110 transition-transform">📚</span>
                      <span className="font-mono text-sm uppercase tracking-[0.2em] text-text-primary">
                        Get Resources
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSaveRoadmap}
                  className={cn(
                    "h-28 border border-border shadow-xl hover:shadow-2xl hover:translate-y-[-4px] transition-all rounded-[2rem] flex flex-col gap-2 items-center justify-center cursor-pointer group",
                    saved ? "bg-accent/10 border-accent/50" : "bg-bg-card text-text-primary"
                  )}
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform">
                    {saved ? "💾" : "📌"}
                  </span>
                  <span className="font-mono text-sm uppercase tracking-[0.2em] text-text-primary">
                    {saved ? "Saved!" : "Save Roadmap"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="h-28 border border-border shadow-xl hover:shadow-2xl hover:translate-y-[-4px] transition-all rounded-[2rem] flex flex-col gap-2 items-center justify-center cursor-pointer group bg-bg-card text-text-primary"
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform">
                    📄
                  </span>
                  <span className="font-mono text-sm uppercase tracking-[0.2em] text-text-primary">
                    Download PDF
                  </span>
                </button>

                <button
                  type="button"
                  onClick={copySummary}
                  className={cn(
                    "h-28 border border-border shadow-xl hover:shadow-2xl hover:translate-y-[-4px] transition-all rounded-[2rem] flex flex-col gap-2 items-center justify-center cursor-pointer group",
                    copied ? "bg-green-500/10 border-green-500/50" : "bg-bg-card text-text-primary"
                  )}
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform">
                    {copied ? "✅" : "📋"}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-black uppercase tracking-[0.2em]",
                      copied ? "text-green-500" : "text-text-primary"
                    )}
                  >
                    {copied ? "Copied!" : "Copy Summary"}
                  </span>
                </button>
              </div>

              {/* Floating Action Button */}
              {roadmap && (
                <div className="fixed bottom-4 right-4 z-50">
                  <button
                    onClick={() => {
                      // Small vibration if supported
                      if (window.navigator?.vibrate) window.navigator.vibrate(20);
                      handleSaveRoadmap();
                    }}
                    className={cn(
                      "group flex items-center gap-3 px-6 py-4 rounded-full shadow-[0_10px_30px_rgba(var(--accent-rgb),0.3)] transition-all active:scale-95 border-none",
                      saved 
                        ? "bg-green-500 text-white" 
                        : "bg-accent text-near-black hover:bg-accent/90"
                    )}
                  >
                    {saved ? <CheckCircle2 className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                    <span className="font-mono text-xs uppercase tracking-widest">
                      {saved ? "Saved to Profile" : "Save Milestone"}
                    </span>
                  </button>
                </div>
              )}

              <div className="flex justify-center pt-2">
                <Button variant="ghost" size="sm" onClick={exportPlainText}>
                  <ChevronRight className="h-3 w-3 mr-1" />
                  Export as plain text
                </Button>
              </div>

              {/* RESOURCES SECTION */}
              {isResourcesLoading && (
                <div className="flex flex-col items-center justify-center p-12 gap-4">
                  <Loader2 className="h-8 w-8 text-primary-blue animate-spin" />
                  <p className="text-text-secondary font-medium animate-pulse">
                    Hunting for the best courses and videos for you...
                  </p>
                </div>
              )}

              {resourcesError && (
                <div
                  role="alert"
                  className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger flex items-center gap-3"
                >
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium flex-1">{resourcesError}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResourcesError(null);
                      handleSuggestResources();
                    }}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {resourcesData && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-10 pt-10 border-t border-border"
                >
                  <div className="flex items-center gap-6">
                    <div className="p-4 rounded-2xl bg-primary-blue/10 text-primary-blue shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                      <BookOpen className="h-10 w-10" />
                    </div>
                    <div>
                      <h3 className="font-display text-4xl md:text-5xl font-semibold text-text-heading tracking-tight uppercase">
                        Verified Resources
                      </h3>
                      <p className="text-text-secondary font-bold italic tracking-tight">
                        Expert-selected modular intel to accelerate execution.
                      </p>
                    </div>
                  </div>

                  <ResourcesSection data={resourcesData} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <RoadmapToast
              message={toast.message}
              tone={toast.tone}
              onClose={() => setToast(null)}
            />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSavedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
              onClick={() => setShowSavedModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl max-h-[85vh] bg-bg-primary rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-border bg-bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg text-text-heading">Saved Roadmaps</h3>
                    <p className="text-xs text-text-secondary">Your previously generated career maps</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSavedModal(false)}
                  className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-primary rounded-xl transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto p-6 space-y-4 flex-1">
                {user?.savedRoadmaps && user.savedRoadmaps.length > 0 ? (
                  user.savedRoadmaps.map((r) => (
                    <div 
                      key={r.id} 
                      className="border border-border/50 bg-bg-card rounded-2xl p-5 hover:border-accent hover:shadow-lg transition-all text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <h4 className="font-bold text-text-heading text-lg mb-1">{r.data.title || r.id}</h4>
                        <p className="text-xs text-text-secondary">
                          Saved on {new Date(r.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-accent text-near-black border-none whitespace-nowrap px-6 shrink-0"
                        onClick={() => {
                          setRoadmap(r.data);
                          setShowSavedModal(false);
                        }}
                      >
                        Load Roadmap
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 px-4">
                    <Compass className="h-12 w-12 text-text-secondary/20 mx-auto mb-4" />
                    <p className="text-text-heading font-medium">No saved roadmaps yet</p>
                    <p className="text-text-secondary text-sm mt-2">Generate and save a roadmap to see it here.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}