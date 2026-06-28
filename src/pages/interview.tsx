import { DashboardLayout } from "../components/DashboardLayout";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { api } from "../utils/api";
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { storage } from "../services/storage";
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  History,
  Trophy,
  Brain,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Layout,
  Target,
  User,
  RefreshCw,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import { useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { saveResultToProfile } from "../services/profileService";
import { InterviewResult } from "../types/profile";
import {
  trackFeatureStart,
  trackFeatureCompletion
} from "../services/featureService";
import { UsageLimitLocked, UsageLimitStrip } from "../components/UsageLimitBanner";
import {
  Mode,
  Difficulty,
  Level,
  PracticeMode,
  QuizQuestion,
  OpenQuestion,
  LibraryCategory,
  LibraryResponse,
  HistorySession,
  HistoryResponse,
} from "../utils/interviewTypes";
import {
  QUIZ_QUESTION_COUNT,
  OPEN_QUESTION_COUNT,
  INPUT_LIMITS,
  sanitizeInput,
  normalizeLibraryCategories,
  computeTotalQuestions,
} from "../utils/interviewHelpers";

/* ============================================================================
 * Main page
 * ========================================================================== */

export default function InterviewPage() {
  const { user } = useUser();
  const location = useLocation();
  // ── Usage limit ───────────────────────────────────────────────────────────
  const usedCount = (user as any)?.metadata?.usageCounts?.interviewPrep ?? 0;
  const LIMIT = 3;
  const isLocked = usedCount >= LIMIT;

  const [mode, setMode] = useState<Mode>("selection");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [role, setRole] = useState(user?.role || "");
  const [level, setLevel] = useState<Level>("mid");
  const [skills, setSkills] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [selectedMode, setSelectedMode] = useState<PracticeMode>("quiz");

  // Generated content state
  const [quizData, setQuizData] = useState<QuizQuestion[]>([]);
  const [openQuestions, setOpenQuestions] = useState<OpenQuestion[]>([]);
  const [libraryCategories, setLibraryCategories] = useState<LibraryCategory[]>([]);
  const [libraryMeta, setLibraryMeta] = useState<{
    total_questions: number;
    role: string;
  } | null>(null);
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);

  // Active-quiz state
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveComplete, setSaveComplete] = useState(false);
  const [showResumeBanner, setShowResumeBanner] = useState(false);

  // Resume handler
  const handleResumeSaved = () => {
    const parsed = storage.get("skillsync_last_interview") as any;
    if (parsed) {
      setRole(parsed.metadata?.role || "");
      if (parsed.metadata?.mode === "quiz") {
        setQuizData(parsed.data.quiz);
        setSelectedOptions(parsed.data.selection || {});
        setMode("quiz");
      } else {
        setOpenQuestions(parsed.data.questions);
        setMode("questions");
      }
      setShowResumeBanner(false);
    }
  };

  useEffect(() => {
    const saved = storage.get("skillsync_last_interview") as any;
    const state = location.state as { autoResume?: boolean } | null;
    const shouldAutoResume = state?.autoResume;

    if (saved && mode === "selection") {
      if (shouldAutoResume) {
        setRole(saved.metadata?.role || "");
        if (saved.metadata?.mode === "quiz") {
          setQuizData(saved.data.quiz);
          setSelectedOptions(saved.data.selection || {});
          setMode("quiz");
        } else {
          setOpenQuestions(saved.data.questions);
          setMode("questions");
        }
        setShowResumeBanner(false);
      } else {
        setShowResumeBanner(true);
      }
    }
  }, [mode, location.state]);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<number, boolean>>({});
  const [weakTopics, setWeakTopics] = useState<string[]>([]);

  // Library state
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  // Pre-fill role from user profile only on first hydration where role is empty
  useEffect(() => {
    if (user?.role && !role) setRole(user.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  // ── Deep-linked practice (e.g. from the chatbot: /interview?role=Backend+Developer) ──
  // Pre-fills the role from the URL and auto-starts practice, so the user
  // lands on questions instead of a blank selection screen.
  const autoStartRoleRef = React.useRef<string | null>(null);
  const hasAutoStartedRef = React.useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleParam = params.get("role") || params.get("topic");
    if (roleParam && roleParam.trim()) {
      autoStartRoleRef.current = roleParam.trim();
      setRole(roleParam.trim());
    }
    // Only meant to run once, on the URL the page was loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      autoStartRoleRef.current &&
      role === autoStartRoleRef.current &&
      !hasAutoStartedRef.current &&
      mode === "selection"
    ) {
      hasAutoStartedRef.current = true;
      handleStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, mode]);

  const totalQuestionsPracticed = useMemo(
    () => computeTotalQuestions(historyData),
    [historyData]
  );

  /* --------------------------------------------------------------------------
   * Handlers
   * ------------------------------------------------------------------------ */

  const resetQuiz = () => {
    setAnsweredCount(0);
    setCorrectCount(0);
    setSelectedOptions({});
    setSubmittedQuestions({});
    setWeakTopics([]);
  };

  const handleStart = async () => {
    const cleanRole = sanitizeInput(role, INPUT_LIMITS.role);
    const cleanSkills = sanitizeInput(skills, INPUT_LIMITS.skills);

    if (!cleanRole) {
      setError("Please specify a role to practice for.");
      return;
    }

    setLoading(true);
    setError(null);

    // Track feature start
    if (user?.uid) {
      await trackFeatureStart(user.uid, "interview-prep", "Interview Preparation");
    }

    try {
      if (selectedMode === "quiz" || selectedMode === "questions") {
        const result = await api.generateInterview({
          userId: user?.uid || "anonymous",
          role: cleanRole,
          level,
          skills: cleanSkills,
          mode: selectedMode,
          difficulty,
        });

        if (selectedMode === "quiz") {
          const quiz = Array.isArray(result?.data?.quiz) ? result.data.quiz : [];
          if (!quiz.length) {
            throw new Error("The quiz generator returned no questions. Please try again.");
          }
          setQuizData(quiz);
          setSessionId(typeof result?.session_id === "number" ? result.session_id : null);
          setMode("quiz");
          resetQuiz();
        } else {
          const questions = Array.isArray(result?.data?.questions)
            ? result.data.questions
            : [];
          if (!questions.length) {
            throw new Error("No interview questions were returned. Please try again.");
          }
          setOpenQuestions(questions);
          setSessionId(typeof result?.session_id === "number" ? result.session_id : null);
          setMode("questions");
        }
      } else if (selectedMode === "library") {
        const result: LibraryResponse = await api.getQuestionLibrary({
          topic: cleanRole,
          role: cleanRole,
          difficulty,
        });

        const categories = normalizeLibraryCategories(result?.library?.categories);
        if (!categories.length) {
          throw new Error("The library returned no categories for this role.");
        }
        setLibraryCategories(categories);
        setLibraryMeta({
          total_questions:
            result?.library?.total_questions ??
            categories.reduce((sum, c) => sum + c.questions.length, 0),
          role: cleanRole,
        });
        setActiveCategory(categories[0].category);
        setMode("library");

        // Track completion for library mode
        if (user?.uid) {
          await trackFeatureCompletion(
            user.uid,
            "interview-prep",
            "Interview Preparation",
            () => {}
          );
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start practice session.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!user?.uid) {
      setError("You must be signed in to view practice history.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result: HistoryResponse = await api.getInterviewSessionHistory({
        userId: user.uid,
      });
      setHistoryData(result ?? null);
      setMode("history");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load practice history.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInterview = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      // For quiz: real % correct. For open-question prep: there's no objective
      // score (the user is reading model answers), so we save 0 rather than a
      // fabricated 100% that would inflate the user's history average.
      const score =
        mode === "quiz" && quizData.length > 0
          ? Math.round((correctCount / quizData.length) * 100)
          : 0;

      const result: InterviewResult = {
        id: `int-${Date.now()}`,
        type: "interview-training",
        title: `${mode === "quiz" ? "Quiz" : "Question Prep"}: ${role}`,
        role,
        score,
        mode: mode as "quiz" | "questions",
        timestamp: new Date().toISOString(),
        data:
          mode === "quiz"
            ? { quiz: quizData, selection: selectedOptions }
            : { questions: openQuestions },
      };

      await saveResultToProfile(user.uid, result);

      // Save output to localStorage as requested
      storage.set("skillsync_last_interview", {
        feature: "interview",
        title: `${mode === "quiz" ? "Quiz" : "Question Prep"}: ${role}`,
        data: mode === "quiz" ? { quiz: quizData, selection: selectedOptions } : { questions: openQuestions },
        timestamp: new Date().toISOString(),
        metadata: {
          role,
          mode
        },
        path: "/interview"
      } as any);

      setSaveComplete(true);
      setTimeout(() => setSaveComplete(false), 3000);
    } catch (e) {
      console.error("Failed to save interview session:", e);
      setError("Could not save this session to your profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectOption = (qIdx: number, option: string) => {
    if (submittedQuestions[qIdx]) return;
    setSelectedOptions((prev) => ({ ...prev, [qIdx]: option }));
  };

  const handleSubmitAnswer = (qIdx: number) => {
    const question = quizData[qIdx];
    const selected = selectedOptions[qIdx];
    if (!question || !selected || submittedQuestions[qIdx]) return;

    const isCorrect = selected === question.correct_answer;

    setSubmittedQuestions((prev) => ({ ...prev, [qIdx]: true }));
    setAnsweredCount((prev) => prev + 1);
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
    } else if (question.focus_area && !weakTopics.includes(question.focus_area)) {
      setWeakTopics((prev) => [...prev, question.focus_area]);
    }

    // Background sync to backend for performance tracking. Correctness is
    // already determined locally — this call only persists analytics. We
    // attach a .catch so a failed analytics call never throws an unhandled
    // promise rejection. We never block the UI on this.
    if (sessionId !== null) {
      api
        .evaluateInterviewAnswer({
          userId: user?.uid || "anonymous",
          sessionId,
          question: question.question,
          questionType: "mcq",
          focusArea: question.focus_area,
          difficulty: question.difficulty,
          userAnswer: selected,
          correctAnswer: question.correct_answer,
          role,
        })
        .catch((err) => {
          // Silent — analytics failure must not interrupt the practice flow.
          console.error("Background answer-sync failed:", err);
        });
    }
  };

  const toggleQuestionExpansion = (id: string) => {
    setExpandedQuestions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  /* --------------------------------------------------------------------------
   * Render
   * ------------------------------------------------------------------------ */

  return (
    <DashboardLayout
      title={mode === "selection" ? "Interview Preparation" : "Interview Training"}
      showBackButton
      backPath={mode === "selection" ? "/dashboard" : undefined}
      onBack={mode !== "selection" ? () => setMode("selection") : undefined}
      actions={
        mode === "selection" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHistory}
            className="text-text-secondary hover:text-text-primary hidden sm:flex"
          >
            <History className="h-4 w-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-widest">History</span>
          </Button>
        ) : undefined
      }
    >
      {isLocked && <UsageLimitLocked feature="Interview Prep" limit={LIMIT} />}
      {!isLocked && (
      <div className="max-w-5xl mx-auto space-y-6 pb-20 px-4">
        {usedCount > 0 && mode === "selection" && <UsageLimitStrip used={usedCount} limit={LIMIT} feature="Interview Prep" />}
        {showResumeBanner && mode === "selection" && (
          <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/20 text-warning">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-heading">You have a saved session</p>
                <p className="text-xs text-text-secondary">Pick up where you left off with your last practice session.</p>
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
                className="bg-warning text-near-black font-bold"
              >
                Resume Session
              </Button>
            </div>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger flex items-center gap-3"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium flex-1">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {mode === "selection" && (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-12 gap-8"
            >
              <div className="md:col-span-12">
                <Card className="relative overflow-hidden p-8 space-y-8 bg-gradient-to-br from-card to-background">
                  <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-40" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[480px] h-[260px] bg-primary-violet/10 rounded-full blur-[120px] pointer-events-none" />
                  <div className="relative z-10 text-center space-y-2">
                    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary-purple bg-primary-purple/10 border border-primary-purple/20 rounded-full px-3.5 py-1.5 mb-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary-purple animate-pulse-violet" />
                      AI-driven simulation
                    </span>
                    <h2 className="font-display text-3xl font-semibold text-text-primary">Ready to Level Up?</h2>
                    <p className="text-text-secondary">
                      Prepare for your next big break with AI-driven interview simulation.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">

                      <div>
                        <label className="block font-mono text-xs uppercase tracking-wider text-text-secondary mb-3">
                          1. Target Role
                        </label>
                        <Input
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          maxLength={INPUT_LIMITS.role}
                          placeholder="e.g. AI Engineer, Product Manager..."
                          className="text-lg py-6"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block font-mono text-xs uppercase tracking-wider text-text-secondary mb-3">
                            2. Experience Level
                          </label>
                      <select
                        className="w-full bg-card/80 border border-border rounded-xl p-3.5 text-sm sm:p-3 focus:border-primary-blue transition-all outline-none text-text-primary font-medium cursor-pointer"
                        value={level}
                        onChange={(e) => setLevel(e.target.value as Level)}
                      >
                            <option value="junior">Junior / Beginner</option>
                            <option value="mid">Mid / Intermediate</option>
                            <option value="senior">Senior / Advanced</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-mono text-xs uppercase tracking-wider text-text-secondary mb-3">
                            3. Difficulty
                          </label>
                      <select
                        className="w-full bg-card/80 border border-border rounded-xl p-3.5 text-sm sm:p-3 focus:border-primary-purple transition-all outline-none text-text-primary font-medium cursor-pointer"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                      >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-mono text-xs uppercase tracking-wider text-text-secondary mb-3">
                          4. Skills to focus on
                        </label>
                        <Input
                          value={skills}
                          onChange={(e) => setSkills(e.target.value)}
                          maxLength={INPUT_LIMITS.skills}
                          placeholder="e.g. System Design, Python, React..."
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="block font-mono text-xs uppercase tracking-wider text-text-secondary mb-1">
                        5. Choose Practice Mode
                      </label>
                      <div className="grid gap-3">
                        {(
                          [
                            {
                              id: "quiz" as const,
                              title: "MCQ Quiz",
                              desc: `${QUIZ_QUESTION_COUNT} quick questions with instant feedback`,
                              icon: Brain,
                              color: "text-primary-blue",
                              bg: "bg-primary-blue/10",
                            },
                            {
                              id: "questions" as const,
                              title: "Interview Questions",
                              desc: `${OPEN_QUESTION_COUNT} deep questions with ideal answers`,
                              icon: MessageSquare,
                              color: "text-primary-purple",
                              bg: "bg-primary-purple/10",
                            },
                            {
                              id: "library" as const,
                              title: "Question Library",
                              desc: "Browse a curated bank organized by category",
                              icon: BookOpen,
                              color: "text-success",
                              bg: "bg-success/10",
                            },
                          ]
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedMode(m.id)}
                            className={`flex items-start gap-4 p-4 rounded-2xl border transition-all text-left group ${
                              selectedMode === m.id
                                ? "bg-card border-primary-blue shadow-lg ring-1 ring-primary-blue/20"
                                : "bg-background border-border hover:border-text-secondary/30"
                            }`}
                          >
                            <div
                              className={`p-3 rounded-xl ${m.bg} ${m.color} transition-transform group-hover:scale-110`}
                            >
                              <m.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <p
                                className={`font-bold ${
                                  selectedMode === m.id
                                    ? "text-primary-blue"
                                    : "text-text-primary"
                                }`}
                              >
                                {m.title}
                              </p>
                              <p className="text-xs text-text-secondary mt-1">{m.desc}</p>
                            </div>
                            <div
                              className={`mt-1 transition-opacity ${
                                selectedMode === m.id ? "opacity-100" : "opacity-0"
                              }`}
                            >
                              <div className="h-4 w-4 rounded-full bg-primary-blue flex items-center justify-center">
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>

                    <div className="pt-2 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button
                            className="flex-1 py-5 sm:py-6 text-base sm:text-lg h-auto"
                            onClick={handleStart}
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                                Preparing...
                              </>
                            ) : (
                              <>
                                Launch Training
                                <ArrowRight className="h-5 w-5 ml-2" />
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            className="px-6 py-5 sm:py-6 h-auto"
                            onClick={fetchHistory}
                            title="View Session History"
                            disabled={loading}
                          >
                            <History className="h-5 w-5 mr-2 sm:mr-0" />
                            <span className="sm:hidden font-bold uppercase tracking-widest text-xs">View History</span>
                          </Button>
                        </div>
                        {loading && (
                          <div className="w-full bg-border rounded-full h-1.5 mt-2 overflow-hidden">
                            <motion.div
                              className="bg-primary-blue h-1.5 rounded-full"
                              initial={{ width: "0%" }}
                              animate={{ width: "100%" }}
                              transition={{ duration: 10, ease: "easeInOut" }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </motion.div>
          )}

          {mode === "quiz" && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <Card className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="font-display text-xl font-semibold flex items-center gap-2 text-text-primary">
                      <Target className="h-6 w-6 text-primary-blue" />
                      Interview Quiz — {role}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-primary-blue/10 text-primary-blue text-[10px] font-bold uppercase">
                        {level}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-warning/10 text-warning text-[10px] font-bold uppercase">
                        ⚡ {difficulty}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-success/10 text-success text-[10px] font-bold uppercase">
                        {quizData.length} Questions
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
                        Progress
                      </p>
                      <p className="text-lg font-bold text-text-primary">
                        {answeredCount}/{quizData.length}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setMode("selection")}>
                      Quit
                    </Button>
                  </div>
                </div>
              </Card>

              <div className="space-y-8 pb-32">
                {quizData.map((q, qIdx) => (
                  <Card
                    key={qIdx}
                    className={`overflow-hidden transition-all duration-500 ${
                      submittedQuestions[qIdx]
                        ? "ring-1 ring-border"
                        : "shadow-lg border-primary-blue/30"
                    }`}
                  >
                    <div className="p-6 border-b border-border bg-card/50 flex items-start gap-4">
                      <span className="h-8 w-8 rounded-lg bg-primary-blue text-white flex items-center justify-center font-bold text-sm shrink-0">
                        Q{qIdx + 1}
                      </span>
                      <div className="space-y-2">
                        <p className="font-bold text-lg text-text-primary leading-tight">
                          {q.question}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-background border border-border text-text-secondary uppercase font-bold">
                            {q.difficulty}
                          </span>
                          {q.focus_area && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-primary-blue/5 text-primary-blue uppercase font-bold">
                              📌 {q.focus_area}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 grid md:grid-cols-2 gap-4">
                      {(["A", "B", "C", "D"] as const).map((key) => {
                        const isSelected = selectedOptions[qIdx] === key;
                        const isSubmitted = submittedQuestions[qIdx];
                        const isCorrect = key === q.correct_answer;

                        let cardClass =
                          "relative flex items-center gap-4 p-4 rounded-xl border text-left transition-all ";
                        if (isSubmitted) {
                          if (isCorrect) cardClass += "bg-success/5 border-success text-success ";
                          else if (isSelected)
                            cardClass += "bg-danger/5 border-danger text-danger ";
                          else cardClass += "bg-background border-border opacity-60 ";
                        } else {
                          if (isSelected)
                            cardClass +=
                              "bg-primary-blue/5 border-primary-blue ring-1 ring-primary-blue shadow-md ";
                          else
                            cardClass +=
                              "bg-background border-border hover:border-primary-blue/50 cursor-pointer ";
                        }

                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={isSubmitted}
                            onClick={() => handleSelectOption(qIdx, key)}
                            className={cardClass}
                            aria-label={`Option ${key}`}
                          >
                            <span
                              className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                                isSubmitted && isCorrect
                                  ? "bg-success text-white"
                                  : isSubmitted && isSelected
                                  ? "bg-danger text-white"
                                  : isSelected
                                  ? "bg-primary-blue text-white"
                                  : "bg-card text-text-secondary"
                              }`}
                            >
                              {key}
                            </span>
                            <span className="text-sm font-medium">{q.options[key]}</span>
                            {isSubmitted && isCorrect && (
                              <CheckCircle2 className="h-4 w-4 ml-auto text-success" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <AnimatePresence>
                      {!submittedQuestions[qIdx] ? (
                        <div className="px-6 pb-6">
                          <Button
                            className="w-full"
                            disabled={!selectedOptions[qIdx]}
                            onClick={() => handleSubmitAnswer(qIdx)}
                          >
                            Submit Answer
                          </Button>
                        </div>
                      ) : (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          className="px-6 pb-6 border-t border-border bg-card/30"
                        >
                          <div className="pt-6 space-y-4">
                            <div
                              className={`p-4 rounded-xl border ${
                                selectedOptions[qIdx] === q.correct_answer
                                  ? "bg-success/10 border-success/20"
                                  : "bg-danger/10 border-danger/20"
                              }`}
                            >
                              <p className="font-bold flex items-center gap-2 text-sm mb-2">
                                {selectedOptions[qIdx] === q.correct_answer ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                    Correct Answer!
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="h-4 w-4 text-danger" />
                                    Incorrect
                                  </>
                                )}
                              </p>
                              <p className="text-sm text-text-primary leading-relaxed">
                                {q.explanation}
                              </p>
                            </div>
                            {q.study_tip && (
                              <div className="p-4 bg-background/50 rounded-xl border border-border">
                                <p className="font-mono text-[10px] uppercase text-text-secondary tracking-widest mb-1 flex items-center gap-1">
                                  <Brain className="h-3 w-3" /> Study Tip
                                </p>
                                <p className="text-xs text-text-secondary italic">{q.study_tip}</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                ))}
              </div>

              {quizData.length > 0 && answeredCount === quizData.length && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 z-50">
                  <Card className="p-6 shadow-2xl border-primary-blue bg-card flex flex-col items-center text-center gap-4">
                    <div className="space-y-1">
                      <p className="text-4xl font-black text-primary-blue">
                        {correctCount}/{quizData.length}
                      </p>
                      <p className="text-sm font-bold text-text-secondary">Questions Correct</p>
                    </div>

                    {weakTopics.length > 0 && (
                      <div className="text-left w-full space-y-2">
                        <p className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
                          📌 Topics to practice
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {weakTopics.map((t) => (
                            <span
                              key={t}
                              className="px-3 py-1 rounded-full bg-danger/10 text-danger text-xs font-medium"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                      <Button className="flex-1" onClick={async () => {
                        // Track completion when they finish the quiz and click another
                        if (user?.uid) {
                          await trackFeatureCompletion(
                            user.uid,
                            "interview-prep",
                            "Interview Preparation",
                            () => {}
                          );
                        }
                        setMode("selection");
                      }}>
                        Try Another
                      </Button>
                      <Button
                        variant={saveComplete ? "outline" : "primary"}
                        className={cn("flex-1", saveComplete && "border-success text-success")}
                        onClick={handleSaveInterview}
                        disabled={isSaving || saveComplete}
                      >
                        {isSaving ? "Saving..." : saveComplete ? "Saved!" : "Save to Profile"}
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={fetchHistory}>
                        View History
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </motion.div>
          )}

          {mode === "questions" && (
            <motion.div
              key="questions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-semibold flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary-purple/10 text-primary-purple">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  Role-Based Interview Questions
                </h2>
                <Button variant="outline" size="sm" onClick={() => setMode("selection")}>
                  Reset
                </Button>
              </div>

              <div className="space-y-4">
                {openQuestions.map((q, i) => (
                  <Card key={i} className="p-0 overflow-hidden">
                    <div className="p-6 bg-card/50 border-b border-border flex items-start gap-4">
                      <span className="h-8 w-8 rounded-lg bg-primary-purple text-white flex items-center justify-center font-bold text-xs shrink-0">
                        Q{i + 1}
                      </span>
                      <div className="space-y-2">
                        <p className="font-bold text-lg text-text-primary leading-tight">
                          {q.question}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {q.category && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-primary-purple/10 text-primary-purple font-bold uppercase">
                              {q.category}
                            </span>
                          )}
                          {q.difficulty && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-background border border-border text-text-secondary font-bold uppercase">
                              {q.difficulty}
                            </span>
                          )}
                          {q.focus_area && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-text-secondary/5 text-text-secondary font-bold">
                              📌 {q.focus_area}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-6 grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        {q.ideal_answer && (
                          <div>
                            <p className="font-mono text-[10px] text-success uppercase tracking-widest mb-2">
                              ✅ Ideal Answer
                            </p>
                            <div className="p-4 rounded-xl border-l-4 border-l-success bg-success/5 text-sm text-text-primary leading-relaxed shadow-inner">
                              {q.ideal_answer}
                            </div>
                          </div>
                        )}
                        {q.what_interviewer_looks_for && (
                          <div>
                            <p className="font-mono text-[10px] text-primary-blue uppercase tracking-widest mb-2">
                              🎯 What Interviewers Look For
                            </p>
                            <div className="p-4 rounded-xl bg-primary-blue/5 border border-primary-blue/20 text-sm text-text-secondary leading-relaxed">
                              {q.what_interviewer_looks_for}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {q.follow_up && (
                          <div>
                            <p className="font-mono text-[10px] text-primary-purple uppercase tracking-widest mb-2">
                              🔍 Follow-Up Question
                            </p>
                            <div className="p-4 rounded-xl border border-primary-purple/20 bg-primary-purple/5 text-sm text-primary-purple italic font-medium leading-relaxed">
                              "{q.follow_up}"
                            </div>
                          </div>
                        )}
                        {q.red_flags && (
                          <div>
                            <p className="font-mono text-[10px] text-danger uppercase tracking-widest mb-2">
                              🚩 Red Flags
                            </p>
                            <div className="p-4 rounded-xl border border-danger/20 bg-danger/5 text-sm text-danger leading-relaxed">
                              {q.red_flags}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="text-center py-6 flex flex-col sm:flex-row justify-center gap-4">
                <Button onClick={async () => {
                  // Track completion for questions node
                  if (user?.uid) {
                    await trackFeatureCompletion(
                      user.uid,
                      "interview-prep",
                      "Interview Preparation",
                      () => {}
                    );
                  }
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }} className="w-full sm:w-auto">
                  Back to Top
                </Button>
                <Button
                  variant={saveComplete ? "outline" : "primary"}
                  className={cn("w-full sm:w-auto", saveComplete && "border-success text-success")}
                  onClick={handleSaveInterview}
                  disabled={isSaving || saveComplete}
                >
                  {isSaving ? "Saving..." : saveComplete ? "Saved!" : "Save Training Session"}
                </Button>
              </div>
            </motion.div>
          )}

          {mode === "library" && libraryMeta && libraryCategories.length > 0 && (
            <motion.div
              key="library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <Card className="p-8 bg-gradient-to-br from-primary-blue/10 to-primary-purple/10 border-primary-blue/20">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-text-primary flex items-center gap-3">
                      <BookOpen className="h-7 w-7 text-primary-blue" />
                      {libraryMeta.role} Question Library
                    </h2>
                    <p className="text-sm text-text-secondary mt-1">
                      Curated bank of {libraryMeta.total_questions} questions for this role.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setMode("selection")}>
                    New Search
                  </Button>
                </div>
              </Card>

              <div className="flex flex-wrap gap-2 sticky top-4 z-10 bg-background/80 backdrop-blur-md p-2 rounded-2xl border border-border">
                {libraryCategories.map((cat) => (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() => setActiveCategory(cat.category)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeCategory === cat.category
                        ? "bg-primary-blue text-white shadow-lg"
                        : "bg-card text-text-secondary hover:bg-background"
                    }`}
                  >
                    {cat.category} ({cat.questions.length})
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {libraryCategories
                  .find((c) => c.category === activeCategory)
                  ?.questions.map((q, i) => {
                    const qKey = `${activeCategory}-${i}`;
                    const isOpen = !!expandedQuestions[qKey];
                    return (
                      <Card
                        key={qKey}
                        className={`p-0 overflow-hidden transition-all duration-300 ${
                          isOpen ? "ring-1 ring-primary-blue shadow-lg" : "hover:border-primary-blue/30"
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full p-4 flex items-center justify-between gap-4 select-none text-left"
                          onClick={() => toggleQuestionExpansion(qKey)}
                          aria-expanded={isOpen}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div
                              className={`p-1.5 rounded-lg bg-background ${
                                isOpen ? "text-primary-blue" : "text-text-secondary"
                              }`}
                            >
                              <Layout className="h-4 w-4" />
                            </div>
                            <p
                              className={`text-sm font-bold transition-colors ${
                                isOpen ? "text-primary-blue" : "text-text-primary"
                              }`}
                            >
                              {q.question}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {q.difficulty && (
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                  q.difficulty === "hard"
                                    ? "bg-danger/10 text-danger"
                                    : q.difficulty === "easy"
                                    ? "bg-success/10 text-success"
                                    : "bg-warning/10 text-warning"
                                }`}
                              >
                                {q.difficulty}
                              </span>
                            )}
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 text-primary-blue" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-text-secondary" />
                            )}
                          </div>
                        </button>

                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-border bg-card/50"
                            >
                              <div className="p-6 grid gap-6 md:grid-cols-2">
                                <div className="space-y-4">
                                  {q.ideal_answer && (
                                    <div>
                                      <p className="font-mono text-[10px] text-success uppercase tracking-widest mb-2 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Ideal Answer
                                      </p>
                                      <div className="p-4 rounded-xl border-l-4 border-l-success bg-white border border-border text-xs text-text-primary leading-relaxed">
                                        {q.ideal_answer}
                                      </div>
                                    </div>
                                  )}
                                  {q.what_interviewer_looks_for && (
                                    <div>
                                      <p className="font-mono text-[10px] text-primary-blue uppercase tracking-widest mb-2 flex items-center gap-1">
                                        <Target className="h-3 w-3" /> Looking For
                                      </p>
                                      <div className="p-4 rounded-xl bg-white border border-border text-xs text-text-secondary leading-relaxed">
                                        {q.what_interviewer_looks_for}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-4">
                                  {q.follow_up && (
                                    <div>
                                      <p className="font-mono text-[10px] text-primary-purple uppercase tracking-widest mb-2">
                                        🔍 Follow-Up
                                      </p>
                                      <div className="p-4 rounded-xl border border-primary-purple/10 bg-primary-purple/5 text-xs text-primary-purple italic leading-relaxed">
                                        "{q.follow_up}"
                                      </div>
                                    </div>
                                  )}
                                  {q.red_flags && (
                                    <div>
                                      <p className="font-mono text-[10px] text-danger uppercase tracking-widest mb-2">
                                        🚩 Red Flags
                                      </p>
                                      <div className="p-4 rounded-xl border border-danger/10 bg-danger/5 text-xs text-danger leading-relaxed">
                                        {q.red_flags}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    );
                  })}
              </div>
            </motion.div>
          )}

          {mode === "history" && historyData && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl font-semibold flex items-center gap-3">
                  <History className="h-7 w-7 text-primary-purple" />
                  Practice Performance Analytics
                </h2>
                <Button variant="outline" size="sm" onClick={() => setMode("selection")}>
                  Back to Tools
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Total Sessions",
                    value: historyData.summary?.total_sessions ?? 0,
                    icon: Layout,
                    color: "text-primary-blue",
                  },
                  {
                    label: "Average Score",
                    value: `${historyData.summary?.avg_score ?? 0}%`,
                    icon: Trophy,
                    color: "text-success",
                  },
                  {
                    label: "Unique Roles",
                    value: historyData.summary?.roles_practiced?.length ?? 0,
                    icon: User,
                    color: "text-warning",
                  },
                  {
                    label: "Total Questions",
                    value: totalQuestionsPracticed,
                    icon: MessageSquare,
                    color: "text-primary-purple",
                  },
                ].map((s, i) => (
                  <Card key={i} className="p-6 text-center space-y-2">
                    <p className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
                      {s.label}
                    </p>
                    <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                  </Card>
                ))}
              </div>

              {historyData.summary?.top_weak_topics &&
                historyData.summary.top_weak_topics.length > 0 && (
                  <Card className="p-6">
                    <p className="font-mono text-[10px] text-danger uppercase tracking-widest mb-4">
                      ⚠️ Mastery Focus (Weak Topics)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {historyData.summary.top_weak_topics.map((t) => (
                        <span
                          key={t}
                          className="px-4 py-1.5 rounded-full bg-danger/5 text-danger border border-danger/10 text-xs font-bold text-center"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </Card>
                )}

              <Card className="overflow-hidden border-border bg-card">
                <div className="p-4 bg-background border-b border-border grid grid-cols-12 gap-4 font-mono text-[10px] uppercase text-text-secondary tracking-widest">
                  <div className="col-span-4 pl-2">Session Details</div>
                  <div className="col-span-2 text-center">Type</div>
                  <div className="col-span-2 text-center">Difficulty</div>
                  <div className="col-span-2 text-center">Score</div>
                  <div className="col-span-2 text-right pr-2">Date</div>
                </div>
                <div className="divide-y divide-border">
                  {(historyData.sessions ?? []).map((s, i) => (
                    <div
                      key={i}
                      className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-muted/30 transition-colors"
                    >
                      <div className="col-span-4 pl-2">
                        <p className="font-bold text-sm text-text-primary capitalize">
                          {s.role ?? "—"}
                        </p>
                        <p className="text-[10px] text-text-secondary font-medium uppercase">
                          {s.level ?? ""}
                        </p>
                      </div>
                      <div className="col-span-2 text-center">
                        {s.session_type && (
                          <span className="px-2 py-0.5 rounded-full bg-primary-blue/5 text-primary-blue text-[10px] font-bold uppercase">
                            {s.session_type}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-center">
                        {s.difficulty && (
                          <span
                            className={`text-[10px] font-bold capitalize ${
                              s.difficulty === "hard"
                                ? "text-danger"
                                : s.difficulty === "easy"
                                ? "text-success"
                                : "text-warning"
                            }`}
                          >
                            {s.difficulty}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-center">
                        <div
                          className={`inline-block px-3 py-1 rounded-full font-black text-sm ${
                            (s.score_percent ?? 0) >= 70
                              ? "bg-success/10 text-success"
                              : (s.score_percent ?? 0) >= 40
                              ? "bg-warning/10 text-warning"
                              : "bg-danger/10 text-danger"
                          }`}
                        >
                          {s.score_percent ?? 0}%
                        </div>
                      </div>
                      <div className="col-span-2 text-right pr-2 text-xs text-text-secondary">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                  ))}
                  {(!historyData.sessions || historyData.sessions.length === 0) && (
                    <div className="p-12 text-center text-text-secondary italic text-sm">
                      No sessions recorded yet. Start practicing to see your progress here!
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}
    </DashboardLayout>
  );
}