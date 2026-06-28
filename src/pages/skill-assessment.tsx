import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { Card } from "../components/Card";
import { AssessmentUsageIndicator } from "../components/AssessmentUsageIndicator";
import { Button } from "../components/Button";
import { api } from "../utils/api";
import { useUser } from "../context/UserContext";
import { motion, AnimatePresence } from "motion/react";
import { storage } from "../services/storage";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Brain,
  Loader2,
  Trophy,
  BarChart3,
  Target,
  AlertCircle,
  Lightbulb,
  Compass,
  CheckCircle,
  GraduationCap,
  BookOpen,
  Globe,
  Plus,
  X,
  Sparkles,
  Star,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  History,
  Download,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { saveResultToProfile } from "../services/profileService";
import { AssessmentResult } from "../types/profile";
import { 
  trackFeatureStart, 
  trackFeatureCompletion 
} from "../services/featureService";
import { useToast } from "../components/Toast";
import {
  LEVEL_COLORS,
  LEVEL_ORDER,
  defaultLevelFromEducation,
  INTEREST_CATEGORIES,
  COUNTRIES,
  CATEGORY_CONFIG,
} from "../utils/skillAssessmentConstants";
import { downloadFile, buildAssessmentCSV, buildAssessmentJSON } from "../utils/skillAssessmentExport";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScreenState = "welcome" | "loading-quiz" | "quiz" | "analyzing" | "submitting" | "results";

interface InterestItem {
  name: string;
  level: "Beginner" | "Intermediate" | "Expert";
}

interface Question {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer?: string;
  category?: string;
  difficulty?: string;
  skillsInvolved?: string[];
  explanation?: string;
}

interface Results {
  score: number;
  skillLevel: string;
  message: string;
  feedback?: string;
  strengths?: string[];
  weaknesses?: string[];
  identifiedSkills?: string[];
  recommendedSkills?: string[];
  breakdown: Record<string, any>[];
  categoryScores?: Record<string, number>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SkillAssessmentPage() {
  const { user, updateProfile } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { ai, success, error: toastError } = useToast(); // <-- ADDED

  const [screen, setScreen]               = useState<ScreenState>("welcome");
  const [quiz, setQuiz]                   = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx]       = useState(0);
  const [answers, setAnswers]             = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [results, setResults]             = useState<Results | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [dbStatus, setDbStatus]           = useState<{ ok: boolean; error?: string } | null>(null);

  // ── Tier 3 adaptive assessment state ────────────────────────────────────
  // `stage` tracks which 5-question round is active. `stage1Answers` holds
  // the completed Stage 1 answers so they survive into the final submit call
  // (Stage 1 grading itself happens server-side from the Firestore session,
  // but we also keep a local copy purely for the "adaptive" badge/UI).
  const [stage, setStage]                 = useState<1 | 2>(1);
  const [stage1Answers, setStage1Answers] = useState<string[]>([]);
  const [isAdaptive, setIsAdaptive]       = useState(true); // false if backend had to fall back to non-adaptive Stage 2
  const [stage1ScorePreview, setStage1ScorePreview] = useState<number | null>(null);

  // Form state
  const [interests, setInterests]         = useState<InterestItem[]>([]);
  const [country, setCountry]             = useState("");
  const [education, setEducation]         = useState("");
  const [customEducation, setCustomEducation] = useState("");
  const effectiveEducation = education === "Other" ? (customEducation || "Other") : education;
  const [subject, setSubject]             = useState("");
  const [customSkillInput, setCustomSkillInput] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Technical Skills");
  const [formStep, setFormStep] = useState<1 | 2>(1); // Fix 1: 2-step form
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);

  // Resume handler
  const handleResumeSaved = () => {
    const parsed = storage.get("skillsync_last_skill-assessment") as any;
    if (parsed) {
      setResults(parsed.data);
      setScreen("results");
      setShowResumeBanner(false);
    }
  };

  // Pre-fill from profile
  useEffect(() => {
    // Check DB connection on mount
    api.verifyDatabase().then(setDbStatus);

    // Check for saved assessment
    const saved = storage.get("skillsync_last_skill-assessment") as any;
    const state = location.state as { autoResume?: boolean } | null;
    const shouldAutoResume = state?.autoResume;

    if (saved && screen === "welcome") {
      if (shouldAutoResume) {
        setResults(saved.data);
        setScreen("results");
        setShowResumeBanner(false);
      } else {
        setShowResumeBanner(true);
      }
    }

    if (user) {
      setCountry(user.location !== "Not specified" ? user.location : "");
      setEducation(user.experience || "");
      if (user.skills?.length) {
        const smartLevel = defaultLevelFromEducation(user.experience || "");
        setInterests(
          user.skills.slice(0, 6).map((s) => ({ name: s, level: smartLevel }))
        );
      }
    }
  }, [user, location.state]);

  // ── Interest helpers ────────────────────────────────────────────────────────

  const toggleInterest = (name: string) => {
    setInterests((prev) => {
      const existing = prev.find((i) => i.name === name);
      if (existing) return prev.filter((i) => i.name !== name);
      return [...prev, { name, level: "Beginner" }];
    });
  };

  const setLevel = (name: string, level: "Beginner" | "Intermediate" | "Expert") => {
    setInterests((prev) =>
      prev.map((i) => (i.name === name ? { ...i, level } : i))
    );
  };

  const addCustomSkill = () => {
    const trimmed = customSkillInput.trim();
    if (!trimmed) return;
    if (!interests.find((i) => i.name.toLowerCase() === trimmed.toLowerCase())) {
      setInterests((prev) => [...prev, { name: trimmed, level: "Beginner" }]);
    }
    setCustomSkillInput("");
  };

  const removeInterest = (name: string) => {
    setInterests((prev) => prev.filter((i) => i.name !== name));
  };

  const exportToJSON = () => {
    if (!results) return;
    downloadFile(buildAssessmentJSON(results), `skill_assessment_${Date.now()}.json`, "application/json");
    success("Export Successful", "Your assessment results were exported as JSON.");
  };

  const exportToCSV = () => {
    if (!results) return;
    downloadFile(buildAssessmentCSV(results), `skill_assessment_${Date.now()}.csv`, "text/csv;charset=utf-8;");
    success("Export Successful", "Your assessment results were exported as CSV.");
  };

  // ── Assessment flow ─────────────────────────────────────────────────────────

  const startAssessment = async () => {
    setFormStep(1); // reset for retake
    if (!user) return;
    
    // Check assessment limit
    const used = user?.metadata?.assessmentCount ?? 0;
    if (used >= 3) {
      toastError("Assessment Limit Reached", "You have completed your 3 free assessment sessions. Upgrade to continue!");
      setError("Assessment limit reached. You can only perform up to 3 assessments.");
      return;
    }

    if (!country || !education || !subject) {
      setError("Please fill in all background details to continue.");
      return;
    }
    if (interests.length < 3) {
      toastError("Minimum Skills Required", `Please select at least 3 skills. You have selected ${interests.length} skill${interests.length !== 1 ? 's' : ''}.`);
      return;
    }
    setScreen("loading-quiz");
    setError(null);
    // Reset Tier 3 adaptive state for a fresh run (handles retakes cleanly)
    setStage(1);
    setStage1Answers([]);
    setIsAdaptive(true);
    setStage1ScorePreview(null);

    // Track feature start
    await trackFeatureStart(user.uid, "skill-assessment", "Skill Assessment");

    try {
      const data = await api.generateAssessmentStage1(
        user.uid,
        interests as any,
        `${effectiveEducation} in ${subject}`,
        country
      );
      setQuiz(data.quiz || []);
      setAnswers(new Array((data.quiz || []).length).fill(""));
      setCurrentIdx(0);
      setSelectedOption(null);
      setScreen("quiz");
      ai("Quiz Ready!", "Stage 1 of 2 — baseline questions"); // <-- ADDED
    } catch (err: any) {
      setError(err.message || "Failed to load assessment. Please try again.");
      setScreen("welcome");
    }
  };

  const handleNext = () => {
    if (!selectedOption) return;
    const newAnswers = [...answers];
    newAnswers[currentIdx] = selectedOption;
    setAnswers(newAnswers);
    if (currentIdx < quiz.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedOption(newAnswers[currentIdx + 1] || null);
      setShowExplanation(false);
    }
  };

  const handleBack = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      setSelectedOption(answers[currentIdx - 1] || null);
      setShowExplanation(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedOption) return;
    const finalAnswers = [...answers];
    finalAnswers[currentIdx] = selectedOption;

    if (stage === 1) {
      // ── End of Stage 1: analyze + generate Stage 2 ───────────────────────
      setStage1Answers(finalAnswers);
      setScreen("analyzing");
      try {
        const data = await api.analyzeStage1AndGenerateStage2(user.uid, finalAnswers);
        setStage1ScorePreview(typeof data.stage1Score === "number" ? data.stage1Score : null);
        setIsAdaptive(data.adaptive !== false);
        setQuiz(data.quiz || []);
        setAnswers(new Array((data.quiz || []).length).fill(""));
        setCurrentIdx(0);
        setSelectedOption(null);
        setStage(2);
        setScreen("quiz");
        if (data.adaptive === false) {
          // Backend had to fall back to a non-adaptive Stage 2 — let the
          // user know without treating it as an error, since they still get
          // a complete assessment.
          toastError(
            "Stage 2 ready",
            "We couldn't generate adaptive questions this time, so Stage 2 uses standard difficulty instead."
          );
        } else {
          ai("Stage 2 Ready!", "Questions adapted to your Stage 1 performance");
        }
      } catch (err: any) {
        toastError("Couldn't continue assessment", err.message || "Please try again");
        setError(err.message || "Failed to generate Stage 2. Please try again.");
        // Stay on the last Stage 1 question rather than bouncing all the way
        // back to the welcome screen — Stage 1 answers are already saved
        // server-side, so a retry of this same action should succeed.
        setScreen("quiz");
      }
      return;
    }

    // ── End of Stage 2: submit everything and grade ───────────────────────
    setScreen("submitting");
    try {
      const data = await api.submitAdaptiveAssessment(user.uid, quiz, finalAnswers);
      const raw = Array.isArray(data) ? data[0] : data;
      const extracted = raw.summary || raw.data?.summary || raw.data || raw;

      const normalised: Results = {
        score:    Number(extracted.percentage ?? extracted.score ?? 0),
        skillLevel: extracted.skillLevel || extracted.skill_level || "Beginner",
        message:  extracted.message || `You scored ${extracted.score ?? 0}/10.`,
        feedback: extracted.feedback || "",
        strengths: extracted.strengths || [],
        weaknesses: extracted.weaknesses || [],
        identifiedSkills:  extracted.identifiedSkills || extracted.identified_skills || [],
        recommendedSkills: extracted.recommendedSkills || extracted.recommended_skills || [],
        breakdown:     Array.isArray(extracted.breakdown) ? extracted.breakdown : [],
        categoryScores: extracted.categoryScores || extracted.category_scores || {},
      };

      setResults(normalised);

      // ─── Save result to profile ──────────────────────────────────────────
      const profileResult: AssessmentResult = {
        id: `asmt-${Date.now()}`,
        type: 'skill-assessment',
        title: `${subject || 'General'} Assessment`,
        score: normalised.score,
        skillLevel: normalised.skillLevel,
        categoryScores: normalised.categoryScores || {},
        timestamp: new Date().toISOString(),
        data: {
          ...normalised,
          interests: interests.map(i => i.name),
          education: effectiveEducation,
          subject,
          country
        }
      };

      await saveResultToProfile(user.uid, profileResult);

      // Save output to localStorage as requested
      storage.set("skillsync_last_skill-assessment", {
        feature: "skill-assessment",
        title: `${subject || 'General'} Assessment`,
        data: normalised,
        timestamp: new Date().toISOString(),
        path: "/skill-assessment"
      } as any);

      // Save skills to profile
      const allNewSkills = [
        ...(normalised.identifiedSkills || []),
        ...interests.map((i) => i.name),
      ];
      const merged = Array.from(new Set([...(user.skills || []), ...allNewSkills]));
      await updateProfile({ skills: merged });

      // Track feature completion
      await trackFeatureCompletion(
        user.uid,
        "skill-assessment",
        "Skill Assessment",
        () => {}
      );

      success("Assessment Complete!", `You scored ${normalised.score} — ${normalised.skillLevel}`); // <-- ADDED
      setScreen("results");
    } catch (err: any) {
      toastError("Assessment Failed", err.message || "Please try again"); // <-- ADDED
      setError(err.message || "Failed to submit assessment.");
      setScreen("quiz");
    }
  };

  // Progress spans both stages: Stage 1 = 0-50%, Stage 2 = 50-100%
  const progress = quiz.length > 0
    ? (stage === 1
        ? ((currentIdx + 1) / quiz.length) * 50
        : 50 + ((currentIdx + 1) / quiz.length) * 50)
    : 0;
  const currentQuestion = quiz[currentIdx];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout 
      title="Skill Assessment"
      actions={
        screen === "welcome" && user?.savedAssessments && user.savedAssessments.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSavedModal(true)}
            className="text-text-secondary hover:text-text-primary hidden sm:flex"
          >
            <History className="h-4 w-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-widest">History</span>
          </Button>
        ) : undefined
      }
    >
      <div className="max-w-4xl mx-auto py-8 px-4">
        {showResumeBanner && screen === "welcome" && (
          <div className="bg-primary-blue/10 border border-primary-blue/20 rounded-2xl p-4 mb-6 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-blue/20 text-primary-blue">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-heading">You have a saved assessment</p>
                <p className="text-xs text-text-secondary">Pick up where you left off with your last results.</p>
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
                className="bg-primary-blue text-white font-bold"
              >
                Resume Last Results
              </Button>
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">

          {/* ── WELCOME SCREEN ─────────────────────────────────────────────── */}
          {screen === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="text-center space-y-4">
                {dbStatus && !dbStatus.ok && (
                  <div className="p-4 mb-6 bg-warning/10 border border-warning/20 rounded-xl flex items-start gap-4 text-left">
                    <div className="p-2 bg-warning/20 rounded-full text-warning">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-warning">Database Setup Incomplete</p>
                      <p className="text-sm text-text-secondary">{dbStatus.error}</p>
                      <p className="text-xs text-text-secondary mt-2">
                        While the quiz will still work and provide AI feedback, your results will <b>not be saved</b> to your profile history until the Supabase tables are created.
                      </p>
                    </div>
                  </div>
                )}

              <div className="relative overflow-hidden rounded-[2rem] py-8 text-center space-y-4">
                <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-40" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[480px] h-[260px] bg-primary-violet/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="relative z-10 space-y-4">
                  <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary-purple bg-primary-purple/10 border border-primary-purple/20 rounded-full px-3.5 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-purple animate-pulse-violet" />
                    Personalized quiz
                  </span>
                  <div className="inline-flex p-4 rounded-full bg-primary-blue/10 text-primary-blue">
                    <Brain className="h-12 w-12" />
                  </div>
                  <h1 className="font-display text-4xl font-semibold bg-gradient-to-r from-primary-blue to-primary-purple bg-clip-text text-transparent">
                    Discover Your Skills
                  </h1>
                  <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                    Take a personalized quiz tailored to your education, interests, and proficiency levels. We'll identify the skills you have and guide you on what to learn next.
                  </p>
                </div>
              </div>
              </div>

              {/* Assessment Usage Indicator */}
              <div className="max-w-2xl mx-auto">
                <AssessmentUsageIndicator />
              </div>

              {/* ── Step indicator ── */}
              <div className="flex items-center justify-center gap-3 mb-2">
                {[1, 2].map((step) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                      formStep === step
                        ? "bg-primary-blue border-primary-blue text-white"
                        : formStep > step
                        ? "bg-success border-success text-white"
                        : "border-border text-text-secondary bg-background"
                    }`}>
                      {formStep > step ? <CheckCircle className="h-4 w-4" /> : step}
                    </div>
                    <span className={`text-sm font-medium ${formStep === step ? "text-text-primary" : "text-text-secondary"}`}>
                      {step === 1 ? "Your Background" : "Your Skills"}
                    </span>
                    {step < 2 && <div className="w-8 h-px bg-border ml-1" />}
                  </div>
                ))}
              </div>

              <Card className="p-4 sm:p-8 space-y-6 sm:space-y-8">

                {/* ── STEP 1: Background ── */}
                {formStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="font-display text-lg font-semibold text-text-primary mb-1">Tell us about your background</h2>
                      <p className="text-sm text-text-secondary">This helps us tailor quiz difficulty and topics to you.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" /> Education Level
                        </label>
                        <select
                          className="w-full bg-background border border-border rounded-lg p-3 text-text-primary focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                          value={education}
                          onChange={(e) => setEducation(e.target.value)}
                        >
                          <option value="">Select Level</option>
                          <option value="High School">High School / Matric</option>
                          <option value="Associate">Associate / Intermediate</option>
                          <option value="Bachelor's">Bachelor's Degree</option>
                          <option value="Master's">Master's Degree</option>
                          <option value="PhD">PhD</option>
                          <option value="Other">Other</option>
                        </select>
                        {education === "Other" && (
                          <input
                            type="text"
                            className="mt-2 w-full bg-background border border-border rounded-lg p-3 text-text-primary focus:ring-2 focus:ring-primary-blue outline-none transition-all text-sm"
                            placeholder="Describe your education (e.g. vocational diploma, license)"
                            value={customEducation}
                            onChange={(e) => setCustomEducation(e.target.value)}
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                          <Globe className="h-4 w-4" /> Country
                        </label>
                        <select
                          className="w-full bg-background border border-border rounded-lg p-3 text-text-primary focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                        >
                          <option value="">Select Country</option>
                          {COUNTRIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                          <BookOpen className="h-4 w-4" /> Field of Study / Subject
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Computer Science, Business Administration, Biology"
                          className="w-full bg-background border border-border rounded-lg p-3 text-text-primary focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3 text-danger text-sm">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <Button
                      className="w-full py-5 text-base font-bold"
                      onClick={() => {
                        if (!country || !education || !subject) {
                          setError("Please fill in all three fields to continue.");
                          return;
                        }
                        setError(null);
                        setFormStep(2);
                      }}
                    >
                      Continue to Skills <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </motion.div>
                )}

                {/* ── STEP 2: Skills ── */}
                {formStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h2 className="font-display text-lg font-semibold text-text-primary mb-1">Select your skills &amp; proficiency</h2>
                          <p className="text-sm text-text-secondary">Pick at least 3 skills and set your level — this shapes your quiz questions.</p>
                        </div>
                        <div className={`text-sm font-bold px-3 py-1.5 rounded-full border ${
                          interests.length >= 3
                            ? "bg-success/10 text-success border-success/20"
                            : interests.length > 0
                            ? "bg-warning/10 text-warning border-warning/20"
                            : "bg-border text-text-secondary border-border"
                        }`}>
                          {interests.length}/3
                        </div>
                      </div>
                      <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full transition-all ${
                            interests.length >= 3 ? "bg-success" : "bg-warning"
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((interests.length / 3) * 100, 100)}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>

                    {/* Selected skills — Fix 2: dropdown proficiency */}
                    {interests.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-text-secondary">Your selected skills</p>
                        <div className="flex flex-wrap gap-2">
                          {interests.map((item) => (
                            <div
                              key={item.name}
                              className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 text-sm"
                            >
                              <span className="font-medium">{item.name}</span>
                              {/* Fix 2: full dropdown instead of B/I/E tiny buttons */}
                              <select
                                value={item.level}
                                onChange={(e) => setLevel(item.name, e.target.value as "Beginner" | "Intermediate" | "Expert")}
                                className={`text-xs font-semibold rounded-lg px-2 py-1 border outline-none cursor-pointer transition-all ${LEVEL_COLORS[item.level]}`}
                              >
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Expert">Expert</option>
                              </select>
                              <button
                                onClick={() => removeInterest(item.name)}
                                className="text-text-secondary hover:text-danger transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interest categories */}
                    <div className="space-y-3">
                      {INTEREST_CATEGORIES.map((cat) => {
                        const isOpen = expandedCategory === cat.title;
                        return (
                          <div key={cat.title} className="border border-border rounded-xl overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedCategory(isOpen ? null : cat.title)}
                              className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-border/30 transition-colors text-left"
                            >
                              <span className="flex items-center gap-2 font-mono text-sm text-text-secondary uppercase tracking-wider">
                                {cat.icon} {cat.title}
                                <span className="text-xs font-normal text-text-secondary/60 normal-case">
                                  ({interests.filter((i) => cat.skills.includes(i.name)).length} selected)
                                </span>
                              </span>
                              {isOpen ? <ChevronUp className="h-4 w-4 text-text-secondary" /> : <ChevronDown className="h-4 w-4 text-text-secondary" />}
                            </button>
                            <AnimatePresence>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-4 flex flex-wrap gap-2">
                                    {cat.skills.map((skill) => {
                                      const selected = interests.find((i) => i.name === skill);
                                      return (
                                        <button
                                          key={skill}
                                          onClick={() => toggleInterest(skill)}
                                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                            selected
                                              ? "bg-primary-blue border-primary-blue text-white shadow-sm"
                                              : "bg-background border-border text-text-secondary hover:border-primary-blue/50"
                                          }`}
                                        >
                                          {selected && <CheckCircle className="inline h-3 w-3 mr-1" />}
                                          {skill}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom skill input */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-text-secondary flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Add a Custom Skill
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. TensorFlow, Figma, SAP..."
                          value={customSkillInput}
                          onChange={(e) => setCustomSkillInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addCustomSkill()}
                          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-primary-blue outline-none"
                        />
                        <Button size="sm" onClick={addCustomSkill} variant="outline">Add</Button>
                      </div>
                    </div>

                    {error && (
                      <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3 text-danger text-sm">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    {interests.length < 3 && (
                      <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-3 text-warning text-sm">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Select at least 3 skills</p>
                          <p className="text-xs text-warning/80 mt-1">You've selected {interests.length} skill{interests.length !== 1 ? 's' : ''}. Choose {3 - interests.length} more to generate a meaningful assessment.</p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button variant="outline" className="px-6 py-4 h-12" onClick={() => { setFormStep(1); setError(null); }}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        className="flex-1 py-4 h-12 text-base font-bold"
                        onClick={startAssessment}
                        disabled={interests.length < 3}
                      >
                        Start Assessment <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </div>

                    <p className="text-xs text-text-secondary text-center">
                      10 personalized questions · ~8 minutes · Skills identified automatically
                    </p>
                  </motion.div>
                )}

              </Card>
            </motion.div>
          )}

          {/* ── LOADING QUIZ ────────────────────────────────────────────────── */}
          {screen === "loading-quiz" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary-blue/20 blur-3xl rounded-full animate-pulse" />
                <Loader2 className="h-16 w-16 text-primary-blue animate-spin relative" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-semibold">Crafting Your Quiz...</h2>
                <p className="text-text-secondary">
                  Tailoring questions to your {subject} background in {country}
                </p>
              </div>
              <div className="w-full max-w-xs bg-border rounded-full h-1.5 mt-4 overflow-hidden">
                <motion.div 
                  className="bg-primary-blue h-1.5 rounded-full" 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4, ease: "linear", repeat: Infinity }}
                />
              </div>
            </motion.div>
          )}

          {/* ── ANALYZING SCREEN (between Stage 1 and Stage 2) ─────────────────── */}
          {screen === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary-purple/20 blur-3xl rounded-full animate-pulse" />
                <Loader2 className="h-16 w-16 text-primary-purple animate-spin relative" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-semibold">Analyzing Your Answers...</h2>
                <p className="text-text-secondary">
                  Calibrating Stage 2 questions based on your Stage 1 performance
                </p>
              </div>
              <div className="w-full max-w-xs bg-border rounded-full h-1.5 mt-4 overflow-hidden">
                <motion.div
                  className="bg-primary-purple h-1.5 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4, ease: "linear", repeat: Infinity }}
                />
              </div>
            </motion.div>
          )}

          {/* ── QUIZ SCREEN ──────────────────────────────────────────────────── */}
          {screen === "quiz" && quiz.length > 0 && currentQuestion && (
            <motion.div
              key={`quiz-${currentIdx}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary font-medium flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      stage === 1
                        ? "bg-primary-blue/10 text-primary-blue border-primary-blue/20"
                        : "bg-primary-purple/10 text-primary-purple border-primary-purple/20"
                    }`}>
                      Stage {stage} of 2{stage === 2 && !isAdaptive ? " · Standard" : stage === 2 ? " · Adapted" : ""}
                    </span>
                    Question {currentIdx + 1} of {quiz.length}
                  </span>
                  <span className="text-primary-blue font-bold">{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary-blue"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {currentQuestion.category && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      CATEGORY_CONFIG[currentQuestion.category]
                        ? `${CATEGORY_CONFIG[currentQuestion.category].bg} ${CATEGORY_CONFIG[currentQuestion.category].color} border-current/20`
                        : "bg-card text-text-secondary border-border"
                    }`}>
                      {CATEGORY_CONFIG[currentQuestion.category]?.label ?? currentQuestion.category}
                    </span>
                  )}
                  {currentQuestion.difficulty && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-border text-text-secondary uppercase">
                      {currentQuestion.difficulty}
                    </span>
                  )}
                  {currentQuestion.skillsInvolved?.slice(0, 2).map((s) => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-primary-purple/10 text-primary-purple border border-primary-purple/20">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Question card */}
              <Card className="p-8">
                <p className="text-xl font-semibold mb-6 leading-relaxed text-text-primary">
                  {currentQuestion.question}
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {(["A", "B", "C", "D"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSelectedOption(key)}
                      className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 group ${
                        selectedOption === key
                          ? "border-primary-blue bg-primary-blue/5 ring-2 ring-primary-blue/20"
                          : "border-border hover:border-primary-blue/40 hover:bg-primary-blue/5"
                      }`}
                    >
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold shrink-0 transition-all ${
                          selectedOption === key
                            ? "bg-primary-blue text-white"
                            : "bg-border text-text-secondary group-hover:bg-primary-blue/20"
                        }`}
                      >
                        {key}
                      </div>
                      <span className="text-sm leading-relaxed">{currentQuestion.options[key]}</span>
                    </button>
                  ))}
                </div>

                {/* Explanation (visible after selection) */}
                {currentQuestion.explanation && answers[currentIdx] && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowExplanation(!showExplanation)}
                      className="text-xs text-primary-blue hover:underline flex items-center gap-1"
                    >
                      {showExplanation ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showExplanation ? "Hide" : "Show"} Hint
                    </button>
                    <AnimatePresence>
                      {showExplanation && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <p className="mt-2 text-sm text-text-secondary bg-primary-blue/5 border border-primary-blue/20 rounded-lg p-3">
                            💡 {currentQuestion.explanation}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </Card>

              {/* Navigation */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <Button variant="outline" onClick={handleBack} disabled={currentIdx === 0} className="w-full sm:w-auto px-8">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>

                {currentIdx === quiz.length - 1 ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedOption}
                    className="w-full sm:w-auto bg-success hover:bg-success/90 border-none px-8"
                  >
                    {stage === 1 ? (
                      <>Continue to Stage 2 <ArrowRight className="ml-2 h-5 w-5" /></>
                    ) : (
                      <>Finish & See Results <CheckCircle className="ml-2 h-5 w-5" /></>
                    )}
                  </Button>
                ) : (
                  <Button onClick={handleNext} disabled={!selectedOption} className="w-full sm:w-auto px-8">
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>

              {error && (
                <p className="text-sm text-danger text-center">{error}</p>
              )}
            </motion.div>
          )}

          {/* ── SUBMITTING ───────────────────────────────────────────────────── */}
          {screen === "submitting" && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-32 space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-success/20 blur-3xl rounded-full animate-pulse" />
                <Loader2 className="h-16 w-16 text-success animate-spin relative" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-semibold">Analysing Your Results...</h2>
                <p className="text-text-secondary">Identifying your skills and preparing feedback</p>
              </div>
              <div className="w-full max-w-xs bg-border rounded-full h-1.5 mt-4 overflow-hidden">
                <motion.div 
                  className="bg-success h-1.5 rounded-full" 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4, ease: "linear", repeat: Infinity }}
                />
              </div>
            </motion.div>
          )}

          {/* ── RESULTS ──────────────────────────────────────────────────────── */}
          {screen === "results" && results && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              {/* Score hero */}
              <Card className="p-8 text-center bg-gradient-to-br from-primary-blue/5 to-primary-purple/5 border-primary-blue/20">
                <div className="inline-flex p-4 rounded-full bg-success/10 text-success mb-4">
                  <Trophy className="h-10 w-10" />
                </div>
                <h1 className="font-display text-3xl font-semibold mb-2">Assessment Complete!</h1>
                <p className="text-text-secondary mb-6 max-w-xl mx-auto">{results.message}</p>
                <div className="flex flex-wrap justify-center gap-6">
                  <div>
                    <div className="text-5xl font-black text-primary-blue">{Math.round(results.score / 10)} <span className="text-3xl text-text-secondary font-bold">/ 10</span></div>
                    <div className="text-sm text-text-secondary mt-1">{results.score}% Overall Score</div>
                  </div>
                  <div className="w-px bg-border" />
                  <div>
                    <div className="text-2xl font-black text-text-primary">{results.skillLevel}</div>
                    <div className="text-sm text-text-secondary mt-1">Skill Level</div>
                  </div>
                </div>
              </Card>

              {/* Identified skills — the key feature */}
              {(results.identifiedSkills?.length ?? 0) > 0 && (
                <Card className="p-6 border-success/30 bg-success/5">
                  <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-4 text-success">
                    <Sparkles className="h-5 w-5" /> Skills You've Demonstrated
                  </h3>
                  <p className="text-sm text-text-secondary mb-4">
                    Based on your assessment performance, you've shown proficiency in:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {results.identifiedSkills!.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1.5 rounded-full bg-success/15 text-success border border-success/30 text-sm font-medium flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </Card>
              )}

              {/* Recommended skills to learn */}
              {(results.recommendedSkills?.length ?? 0) > 0 && (
                <Card className="p-6 border-primary-blue/20 bg-primary-blue/5">
                  <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-4 text-primary-blue">
                    <Star className="h-5 w-5" /> Skills to Learn Next
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {results.recommendedSkills!.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1.5 rounded-full bg-primary-blue/10 text-primary-blue border border-primary-blue/20 text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </Card>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(results.strengths?.length ?? 0) > 0 && (
                  <Card className="p-6">
                    <h3 className="font-display font-semibold mb-3 text-success flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Strengths
                    </h3>
                    <ul className="space-y-2">
                      {results.strengths!.map((s, i) => (
                        <li key={i} className="text-sm text-text-secondary flex gap-2">
                          <span className="text-success font-bold mt-0.5">•</span> {s}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                {(results.weaknesses?.length ?? 0) > 0 && (
                  <Card className="p-6">
                    <h3 className="font-display font-semibold mb-3 text-warning flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> Growth Areas
                    </h3>
                    <ul className="space-y-2">
                      {results.weaknesses!.map((w, i) => (
                        <li key={i} className="text-sm text-text-secondary flex gap-2">
                          <span className="text-warning font-bold mt-0.5">•</span> {w}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>

              {/* Category breakdown */}
              {results.categoryScores && Object.keys(results.categoryScores).length > 0 && (
                <Card className="p-6">
                  <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-6">
                    <BarChart3 className="h-5 w-5 text-primary-blue" /> Category Performance
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    {/* Radar Chart */}
                    <div className="h-[300px] w-full border border-border/50 rounded-xl bg-card/30">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                        <RadarChart 
                          cx="50%" 
                          cy="50%" 
                          outerRadius="70%" 
                          data={Object.entries(results.categoryScores).map(([key, value]) => ({
                            subject: CATEGORY_CONFIG[key]?.label ?? key,
                            A: value,
                            fullMark: 100,
                          }))}
                        >
                          <PolarGrid stroke="currentColor" className="text-border" />
                          <PolarAngleAxis 
                            dataKey="subject" 
                            tick={{ fill: 'currentColor', fontSize: 12, fillOpacity: 0.7 }} 
                            className="text-text-primary"
                          />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} stroke="transparent" />
                          <Radar
                            name="Score"
                            dataKey="A"
                            stroke="#3b82f6"
                            fill="#3b82f6"
                            fillOpacity={0.4}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Bars */}
                    <div className="grid grid-cols-1 gap-4">
                      {Object.entries(results.categoryScores).map(([key, value]) => {
                        const cfg = CATEGORY_CONFIG[key] ?? {
                          color: "text-primary-blue",
                          bg: "bg-primary-blue/10",
                          icon: <Target className="h-5 w-5" />,
                          label: key,
                        };
                        return (
                          <div key={key} className="p-4 rounded-xl border border-border hover:border-primary-blue/30 transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <div className={`p-2 rounded-lg ${cfg.bg} ${cfg.color}`}>{cfg.icon}</div>
                              <span className={`text-xl font-bold ${cfg.color}`}>{value}%</span>
                            </div>
                            <p className="font-medium text-sm mb-2">{cfg.label}</p>
                            <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full ${cfg.bg.replace("/10", "")}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${value}%` }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              )}

              {/* Feedback */}
              {results.feedback && (
                <Card className="p-6 bg-card/50">
                  <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-warning" /> Mentor Feedback
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{results.feedback}</p>
                </Card>
              )}

              {/* Local Copy & Export Options */}
              <Card className="p-6 border-dashed border-border bg-card/50">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-left space-y-1">
                    <h3 className="font-display font-semibold text-text-primary flex items-center gap-2">
                      <Download className="h-5 w-5 text-primary-blue animate-pulse" /> Local Copy & Export Options
                    </h3>
                    <p className="text-xs text-text-secondary">
                      Keep a portable copy of your skill assessment cache or store/share your results locally in JSON or CSV format.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={exportToJSON}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 border-border hover:border-primary-blue/50 hover:bg-primary-blue/10 transition-colors"
                    >
                      Export to JSON
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={exportToCSV}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 border-border hover:border-success/50 hover:bg-success/10 transition-colors"
                    >
                      Export to CSV
                    </Button>
                  </div>
                </div>
              </Card>

              {/* CTAs */}
              <div className="flex flex-col items-center gap-4 pb-8">
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-10 bg-accent hover:bg-accent-hover text-text-heading font-black uppercase tracking-widest shadow-2xl shadow-accent/30 animate-pulse hover:animate-none gap-3 h-14"
                  onClick={() =>
                    navigate("/career-mentor", {
                      state: {
                        prefill: {
                          education: effectiveEducation,
                          subject,
                          skills: interests.map((i) => i.name),
                          country,
                        },
                      },
                    })
                  }
                >
                  <Compass className="h-5 w-5" />
                  Get My Career Recommendations
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto px-6" onClick={() => setScreen("welcome")}>
                    Retake Assessment
                  </Button>
                  <Button variant="ghost" size="lg" className="w-full sm:w-auto px-6" onClick={() => navigate("/dashboard")}>
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            </motion.div>
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
                  <div className="w-10 h-10 rounded-xl bg-primary-blue/10 flex items-center justify-center text-primary-blue">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg text-text-heading">Saved Assessments</h3>
                    <p className="text-xs text-text-secondary">Your previously completed skill assessments</p>
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
                {user?.savedAssessments && user.savedAssessments.length > 0 ? (
                  user.savedAssessments.map((r) => (
                    <div 
                      key={r.id} 
                      className="border border-border/50 bg-bg-card rounded-2xl p-5 hover:border-primary-blue hover:shadow-lg transition-all text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <h4 className="font-bold text-text-heading text-lg mb-1">{r.title || "Skill Assessment"}</h4>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="text-primary-blue font-bold px-2 py-0.5 bg-primary-blue/10 rounded-md">Score: {r.score}</span>
                          <span className="text-text-secondary">{new Date(r.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-primary-blue text-white border-none whitespace-nowrap px-6 shrink-0 hover:bg-primary-blue/90"
                        onClick={() => {
                          setResults(r.data);
                          setScreen("results");
                          setShowSavedModal(false);
                        }}
                      >
                        Load Results
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 px-4">
                    <Brain className="h-12 w-12 text-text-secondary/20 mx-auto mb-4" />
                    <p className="text-text-heading font-medium">No saved assessments yet</p>
                    <p className="text-text-secondary text-sm mt-2">Take an assessment and save your results to see them here.</p>
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