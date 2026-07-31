import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { api } from "../utils/api";
import { useUser } from "../context/UserContext";
import { motion, AnimatePresence } from "motion/react";
import { storage } from "../services/storage";
import {
  Compass,
  Loader2,
  Trophy,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Map,
  BookOpen,
  Zap,
  Clock,
  Milestone,
  Target,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Brain,
  GraduationCap,
  Globe,
  Coins,
  History,
  Briefcase,
  DollarSign,
  Star,
  Flame,
  Award,
  Users,
  TrendingDown,
  Download,
  X,
  Sparkles,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { saveResultToProfile } from "../services/profileService";
import { CareerMentorSkeleton } from "../components/SkeletonLoaders";
import { CareerReportResult } from "../types/profile";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  trackFeatureStart,
  trackFeatureCompletion,
} from "../services/featureService";
import { UsageLimitLocked, UsageLimitStrip } from "../components/UsageLimitBanner";

type ScreenState = "form" | "loading" | "report";

interface MentorForm {
  educationLevel: string;
  experienceLevel: string;
  fieldOfStudy: string;
  skills: string;
  country: string;
}

interface EnhancedCareerRecommendation {
  rank: number;
  title: string;
  tagline: string;
  whyFit: string;
  matchScore: number;
  salaryRange: string;
  salarySource?: "live_listings" | "listing_data" | "ai_estimate";
  level: string;
  skills: string[];
  marketDemand: string;
  roleProgression: string[];
  timeToFirstJobMonths: number;
  currentSkillOverlap: string[];
  assessmentAlignment: string;
  skillGapAnalysis: {
    strengths: string[];
    criticalGaps: string[];
  };
}

export default function CareerMentorEnhancedPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Usage limit ───────────────────────────────────────────────────────────
  const usedCount = (user as any)?.metadata?.usageCounts?.careerMentor ?? 0;
  const LIMIT = 3;
  const isLocked = usedCount >= LIMIT;
  const [screen, setScreen] = useState<ScreenState>("form");
  const [formData, setFormData] = useState<MentorForm>({
    educationLevel: "",
    experienceLevel: "",
    fieldOfStudy: "",
    skills: "",
    country: "",
  });
  const [recommendations, setRecommendations] = useState<
    EnhancedCareerRecommendation[]
  >([]);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPrefilled, setIsPrefilled] = useState(false);
  const [customEducation, setCustomEducation] = useState("");
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState<number | null>(null);

  // ── Use Cases state (per role card) ────────────────────────────────────
  const [useCasesMap, setUseCasesMap] = useState<Record<number, any[]>>({});
  const [useCasesLoading, setUseCasesLoading] = useState<Record<number, boolean>>({});
  const [useCasesOpen, setUseCasesOpen] = useState<Record<number, boolean>>({});

  // ── Feedback Modal state ────────────────────────────────────────────────
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);

  // Resume handler
  const handleResumeSaved = () => {
    const parsed = storage.get("skillsync_last_career-mentor") as any;
    if (parsed) {
      setRecommendations(parsed.data);
      setFormData(prev => ({ ...prev, fieldOfStudy: parsed.metadata?.fieldOfStudy || "" }));
      setScreen("report");
      setShowResumeBanner(false);
    }
  };

  useEffect(() => {
    // If there is prefill data from navigation state, do not override
    if (location.state && (location.state as any).prefill) {
      return;
    }

    // Attempt to load from localStorage first
    const parsed = storage.get("skillsync_last_career-mentor") as any;
    if (parsed?.data?.length > 0) {
      setRecommendations(parsed.data);
      if (parsed.metadata?.fieldOfStudy) {
        setFormData(prev => ({ ...prev, fieldOfStudy: parsed.metadata.fieldOfStudy }));
      }
      setScreen("report");
      return;
    }

    // As a fallback, check user profile savedCareerReports
    if (user && (user as any).savedCareerReports && (user as any).savedCareerReports.length > 0) {
      const latestReport = (user as any).savedCareerReports[0];
      if (latestReport && latestReport.recommendations && latestReport.recommendations.length > 0) {
        setRecommendations(latestReport.recommendations);
        if (latestReport.topField) {
          setFormData(prev => ({ ...prev, fieldOfStudy: latestReport.topField }));
        }
        setScreen("report");
      }
    }
  }, [user, location.state]);

  useEffect(() => {
    const saved = storage.get("skillsync_last_career-mentor");
    if (saved && screen === "form") {
      setShowResumeBanner(true);
    }
  }, [screen]);

  const loadingSteps = [
    "Analyzing your profile...",
    "Reviewing assessment results...",
    "Finding best career matches...",
  ];

  useEffect(() => {
    const state = location.state as any;
    if (state && state.prefill) {
      setFormData((prev) => ({
        ...prev,
        educationLevel: state.prefill.education || prev.educationLevel,
        fieldOfStudy: state.prefill.subject || prev.fieldOfStudy,
        skills: state.prefill.skills
          ? state.prefill.skills.join(", ")
          : state.prefill.interests
            ? state.prefill.interests.join(", ")
            : prev.skills,
        country: state.prefill.country || prev.country,
      }));
      setIsPrefilled(true);
      return;
    }

    const history = (storage.get("skillSyncAssessments") || []) as any[];
    if (history && history.length > 0) {
      const latest = history[0];
      setAssessmentData(latest);
      setFormData((prev) => ({
        ...prev,
        educationLevel: latest.educationLevel || prev.educationLevel,
        country: latest.country || prev.country,
        skills: latest.interests
          ? latest.interests.join(", ")
          : latest.identifiedSkills
            ? latest.identifiedSkills.join(", ")
            : prev.skills,
        fieldOfStudy: latest.subject || prev.fieldOfStudy,
      }));
      setIsPrefilled(true);
    } else if (user) {
      setFormData((prev) => ({
        ...prev,
        educationLevel: user.experience || "",
        skills: user.skills ? user.skills.join(", ") : "",
        country: user.location !== "Not specified" ? user.location : "",
      }));
    }
  }, [user, location.state]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setScreen("loading");
    setLoadingStep(0);
    setError(null);

    // Track feature start
    await trackFeatureStart(user.uid, "career-mentor", "Career Mentor");

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < 2 ? prev + 1 : prev));
    }, 2000);

    try {
      const effectiveEducation = formData.educationLevel === "Other" ? (customEducation || "Other") : formData.educationLevel;
      const response = await api.getCareerMentorReport(user.uid, {
        ...formData,
        educationLevel: effectiveEducation,
        assessmentData: assessmentData,
      });

      let data = response;
      if (Array.isArray(response)) {
        data = response[0]?.json || response[0] || {};
      } else if (response.json) {
        data = response.json;
      }

      // The computed `recommendations[]` array is built from calculateMatchScore()
      // (a deterministic recompute that floors at 30 and often has thin/empty
      // fields), but it's reliably the full 3 — it comes straight from the
      // validated STEP 3 recommendations. `mentorReport.allRecommendations[]`
      // is the AI's own richer output (real matchScore, full sentences, real
      // salaryRange) but the second AI call that builds it sometimes runs out
      // of token budget after writing the FIRST recommendation in full detail
      // and never gets to #2/#3 — so it can have only 1 entry.
      //
      // Fix: always iterate over computedRecs (guaranteed 3 cards) and look
      // up a matching rich entry per card by title. If no rich match exists
      // for that slot, the card just falls back to the computed fields
      // instead of disappearing entirely.
      const computedRecs = data.recommendations || data.roles || [];
      const richRecs = data.mentorReport?.allRecommendations || [];

      const baseList = computedRecs.length > 0 ? computedRecs : richRecs;

      const recs = baseList.slice(0, 3).map((computed: any, idx: number) => {
        const rec = richRecs.find(
          (r: any) => r.fieldName === computed.title || r.fieldName === computed.fieldName
        ) || richRecs[idx] || {};

        return {
          rank: rec.rank ?? computed.rank ?? idx + 1,
          title: rec.fieldName || computed.title || computed.fieldName || "",
          tagline: rec.tagline || computed.tagline || "",
          whyFit: rec.whyItFits || rec.whyFit || computed.whyFit || computed.whyItFits || "",
          matchScore: rec.matchScore ?? computed.matchScore ?? 0,
          salaryRange: rec.salaryRange || computed.salaryRange || "Competitive",
          salarySource: computed.salarySource || "ai_estimate",
          level: rec.difficultyLevel || computed.level || "Intermediate",
          skills: [
            ...(rec.skillsToLearn?.technical || []),
            ...(rec.skillsToLearn?.soft || []),
          ].length > 0
            ? [
                ...(rec.skillsToLearn?.technical || []),
                ...(rec.skillsToLearn?.soft || []),
              ].slice(0, 6)
            : computed.skills || [],
          marketDemand: rec.marketDemand || computed.marketDemand || "Stable",
          roleProgression: rec.roleProgression?.length >= 3
            ? rec.roleProgression
            : computed.roleProgression || [],
          timeToFirstJobMonths: rec.timeToFirstJobMonths ?? computed.timeToFirstJobMonths ?? 3,
          currentSkillOverlap: rec.currentSkillOverlap?.length > 0
            ? rec.currentSkillOverlap
            : computed.currentSkillOverlap || [],
          assessmentAlignment: rec.assessmentAlignment || computed.assessmentAlignment || "",
          skillGapAnalysis: {
            strengths: rec.skillGapAnalysis?.strengths || computed.skillGapAnalysis?.strengths || [],
            criticalGaps: rec.skillGapAnalysis?.criticalGaps || computed.skillGapAnalysis?.criticalGaps || [],
          },
        };
      });

      const finalRecs = recs.slice(0, 3);
      setRecommendations(finalRecs);

      // Track feature completion
      await trackFeatureCompletion(
        user.uid,
        "career-mentor",
        "Career Mentor",
        () => {}
      );

      const profileResult: CareerReportResult = {
        id: `crr-${Date.now()}`,
        type: "career-mentor",
        title: `Career Recommendations for ${formData.fieldOfStudy}`,
        topField: formData.fieldOfStudy,
        recommendations: finalRecs,
        timestamp: new Date().toISOString(),
        data: {
          ...formData,
          recommendations: finalRecs,
        },
      };

      await saveResultToProfile(user.uid, profileResult);

      // Save output to localStorage as requested
      storage.set("skillsync_last_career-mentor", {
        feature: "career-mentor",
        title: `Career Recommendations for ${formData.fieldOfStudy}`,
        data: finalRecs,
        timestamp: new Date().toISOString(),
        metadata: {
          fieldOfStudy: formData.fieldOfStudy
        },
        path: "/career-mentor"
      } as any);

      setScreen("report");
    } catch (err: any) {
      setError(err.message || "Failed to generate recommendations.");
      setScreen("form");
    } finally {
      clearInterval(stepInterval);
    }
  };

  const handleGenerateRoadmap = (role: EnhancedCareerRecommendation) => {
    navigate("/roadmap", {
      state: {
        role: role.title,
        level: role.level || "Intermediate",
        skills: role.skills || [],
        industry: formData.fieldOfStudy,
      },
    });
  };

  const handleViewUseCases = async (role: EnhancedCareerRecommendation, idx: number) => {
    // Toggle off if already open
    if (useCasesOpen[idx]) {
      setUseCasesOpen((prev) => ({ ...prev, [idx]: false }));
      return;
    }
    // Already fetched — just open
    if (useCasesMap[idx]) {
      setUseCasesOpen((prev) => ({ ...prev, [idx]: true }));
      return;
    }
    // Fetch from edge function
    setUseCasesLoading((prev) => ({ ...prev, [idx]: true }));
    try {
      const response = await api.findUseCases({
        userId: user?.uid || "anonymous",
        goal: role.title,
        level: role.level || "beginner",
        userBackground: formData.fieldOfStudy || undefined,
      });
      const result = response?.stories || response?.data || response?.use_cases || response;
      const stories = Array.isArray(result) ? result : [];
      setUseCasesMap((prev) => ({ ...prev, [idx]: stories }));
      setUseCasesOpen((prev) => ({ ...prev, [idx]: true }));
    } catch (err: any) {
      console.error("Use cases fetch failed:", err);
      setUseCasesMap((prev) => ({ ...prev, [idx]: [] }));
      setUseCasesOpen((prev) => ({ ...prev, [idx]: true }));
    } finally {
      setUseCasesLoading((prev) => ({ ...prev, [idx]: false }));
    }
  };

  const handleExportPDF = (role: EnhancedCareerRecommendation) => {
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
    const accentColor: [number, number, number] = [59, 130, 246]; // Blue 500

    // Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("SkillSync — Role Summary", 15, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 150, 25);

    // Role Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(role.title, 15, 55);

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "italic");
    doc.text(role.tagline, 15, 62);

    // Overview Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Overview", 15, 75);
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.line(15, 77, 40, 77);

    autoTable(doc, {
      startY: 82,
      head: [["Attribute", "Details"]],
      body: [
        ["Match Score", `${role.matchScore}%`],
        ["Market Demand", role.marketDemand],
        ["Salary Range", role.salaryRange],
        ["Experience Level", role.level],
        ["Time to First Job", `${role.timeToFirstJobMonths} Months`],
      ],
      theme: "striped",
      headStyles: { fillColor: primaryColor },
      styles: { fontSize: 10 },
    });

    // Skill Analysis
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Skill Gap Analysis", 15, finalY);
    doc.line(15, finalY + 2, 55, finalY + 2);

    autoTable(doc, {
      startY: finalY + 7,
      head: [["Strengths", "Critical Gaps"]],
      body: role.skillGapAnalysis.strengths.map((s, i) => [
        s,
        role.skillGapAnalysis.criticalGaps[i] || ""
      ]),
      theme: "grid",
      headStyles: { fillColor: accentColor },
      styles: { fontSize: 10 },
    });

    // Progression
    const progY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Career Progression", 15, progY);
    doc.line(15, progY + 2, 60, progY + 2);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(role.roleProgression.join(" → "), 15, progY + 10);

    // Alignment
    if (role.assessmentAlignment) {
      const alignY = progY + 25;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Personal Alignment", 15, alignY);
      doc.line(15, alignY + 2, 60, alignY + 2);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const splitText = doc.splitTextToSize(role.assessmentAlignment, 180);
      doc.text(splitText, 15, alignY + 10);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("© 2026 SkillSync AI. All Rights Reserved.", 15, 285);

    doc.save(`SkillSync_${role.title.replace(/\s+/g, "_")}.pdf`);
  };

  // ── Render Market Demand Badge ──────────────────────────────────────────
  const renderMarketBadge = (demand: string) => {
    const baseClasses = "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1";
    if (demand === "High Growth") {
      return (
        <div className={`${baseClasses} bg-success/20 text-success`}>
          <Flame className="h-3 w-3" /> High Growth
        </div>
      );
    } else if (demand === "Emerging") {
      return (
        <div className={`${baseClasses} bg-warning/20 text-warning`}>
          <Zap className="h-3 w-3" /> Emerging
        </div>
      );
    }
    return (
      <div className={`${baseClasses} bg-white/10 text-text-body`}>
        <TrendingDown className="h-3 w-3" /> Stable
      </div>
    );
  };

  // ── Render Match Score Visualization ────────────────────────────────────
  const renderMatchScore = (score: number) => {
    const radius = 24; // reduced from 28
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="relative w-14 h-14 flex items-center justify-center shrink-0 ml-4 sm:ml-6">
        <svg className="absolute -rotate-90" width="56" height="56" viewBox="0 0 56 56">
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-white/10"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-success transition-all duration-500"
            strokeLinecap="round"
          />
        </svg>
        <div className="text-center z-10">
          <div className="text-xs font-black text-success leading-none">{score}%</div>
          <div className="text-[7px] uppercase font-mono tracking-widest text-text-body">Match</div>
        </div>
      </div>
    );
  };

  // ── Render Skill Gap Analysis ──────────────────────────────────────────
  const renderSkillGaps = (role: EnhancedCareerRecommendation) => {
    return (
      <div className="space-y-3 text-sm">
        <div>
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-success mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Your Strengths
          </h4>
          <div className="space-y-1">
            {role.skillGapAnalysis.strengths.slice(0, 4).map((strength, idx) => (
              <div key={idx} className="text-text-body text-xs font-medium">
                • {strength}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-warning mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Critical Gaps
          </h4>
          <div className="space-y-1">
            {role.skillGapAnalysis.criticalGaps.slice(0, 4).map((gap, idx) => (
              <div key={idx} className="text-text-body text-xs font-medium">
                • {gap}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Render Match Breakdown — a visual, honest answer to "why this score?" ──
  // Built from data we already have (no invented sub-scores): how many of the
  // skills you'd need for this role you already have, vs. the critical gaps.
  const renderMatchBreakdown = (role: EnhancedCareerRecommendation) => {
    const haveCount = role.currentSkillOverlap?.length || 0;
    const gapCount = role.skillGapAnalysis?.criticalGaps?.length || 0;
    const totalConsidered = haveCount + gapCount;
    const coveragePct = totalConsidered > 0 ? Math.round((haveCount / totalConsidered) * 100) : null;

    return (
      <div className="p-4 rounded-2xl bg-accent/5 border border-accent/15 space-y-3">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-accent flex items-center gap-2">
          <Target className="h-4 w-4" /> Why You're a {role.matchScore}% Match
        </h4>
        {coveragePct !== null && (
          <div>
            <div className="flex justify-between text-[10px] text-text-body/60 mb-1.5">
              <span>Skill coverage for this role</span>
              <span className="font-bold text-text-heading">{haveCount}/{totalConsidered} skills</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-success transition-all duration-700"
                style={{ width: `${coveragePct}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">
            {haveCount} skills already match
          </span>
          {gapCount > 0 && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-warning/10 text-warning border border-warning/20">
              {gapCount} gaps to close
            </span>
          )}
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-primary-blue/10 text-primary-blue border border-primary-blue/20">
            {role.marketDemand} demand
          </span>
        </div>
      </div>
    );
  };

  // ── Render Role Progression ────────────────────────────────────────────
  const renderRoleProgression = (progression: string[]) => {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs overflow-hidden">
        {progression.slice(0, 3).map((role, idx) => (
          <React.Fragment key={idx}>
            <div className="px-2 py-1 bg-primary-blue/10 text-primary-blue rounded max-w-[90px] truncate" title={role}>
              {role}
            </div>
            {idx < 2 && <ArrowRight className="h-3 w-3 text-text-secondary shrink-0" />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout 
      title="Career Mentor"
      actions={
        screen === "form" && user?.savedCareerReports && user.savedCareerReports.length > 0 ? (
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
      <div className="max-w-6xl mx-auto py-8 px-4 h-full">
        {showResumeBanner && screen === "form" && (
          <div className="bg-primary-purple/10 border border-primary-purple/20 rounded-2xl p-4 mb-6 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-purple/20 text-primary-purple">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-heading">You have saved recommendations</p>
                <p className="text-xs text-text-secondary">Pick up where you left off with your last career analysis.</p>
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
                className="bg-primary-purple text-white font-bold"
              >
                Resume Analysis
              </Button>
            </div>
          </div>
        )}
        {/* Usage limit — locked screen - only shown on form view when limit is exceeded */}
        {isLocked && screen === "form" && <UsageLimitLocked feature="Career Mentor" limit={LIMIT} />}

        {(!isLocked || screen !== "form") && (
          <AnimatePresence mode="wait">
                {/* Usage strip — show when 1 remaining */}
                {screen === "form" && (
                  <UsageLimitStrip feature="Career Mentor" limit={LIMIT} used={usedCount} showLocked={false} />
                )}
                {screen === "form" && (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8"
                  >
                    <div className="relative overflow-hidden rounded-[2rem] py-8 text-center space-y-3">
                      <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-40" />
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[480px] h-[260px] bg-primary-violet/10 rounded-full blur-[120px] pointer-events-none" />
                      <div className="relative z-10">
                        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary-purple bg-primary-purple/10 border border-primary-purple/20 rounded-full px-3.5 py-1.5 mb-4">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary-purple animate-pulse-violet" />
                          Matching live market data
                        </span>
                        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-text-heading tracking-tight uppercase">Career Mentor</h1>
                        <p className="text-text-body text-base sm:text-lg max-w-2xl mx-auto font-medium px-4 mt-3">
                          Discover your ideal career path based on your skills, education, and market demand
                        </p>
                      </div>
                    </div>

                    <Card className="p-6 sm:p-10 max-w-2xl mx-auto border border-border bg-bg-card shadow-2xl relative overflow-hidden">
                      
                      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <Compass className="h-24 w-24 text-accent" />
                      </div>

                {/* Fix 4: Assessment loaded badge */}
                {isPrefilled && (
                  <div className="flex items-center gap-3 mb-8 p-4 rounded-2xl bg-success/10 border border-success/20">
                    <div className="h-8 w-8 rounded-xl bg-success/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-success">Assessment Results Loaded</p>
                      <p className="text-xs text-text-body mt-0.5">Your skills, education and country have been pre-filled from your latest assessment.</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-8 relative z-10">

                  {/* Row 1: Education + Experience */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-text-body ml-2 flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-accent" /> Education Level
                      </label>
                      <select
                        className="appearance-none w-full bg-bg-primary border border-border rounded-2xl p-4 text-text-heading focus:ring-2 focus:ring-accent outline-none transition-all cursor-pointer font-bold bg-no-repeat bg-[right_1rem_center]"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '1.5em' }}
                        value={formData.educationLevel}
                        onChange={(e) => setFormData({ ...formData, educationLevel: e.target.value })}
                        required
                      >
                        <option value="">Select education...</option>
                        <option value="High School">High School / Matric</option>
                        <option value="Diploma">Diploma</option>
                        <option value="Associate">Associate / Intermediate</option>
                        <option value="Bachelor">Bachelor's Degree</option>
                        <option value="Master">Master's Degree</option>
                        <option value="PhD">PhD</option>
                        <option value="Bootcamp">Bootcamp / Online Course</option>
                        <option value="Self-taught">Self-taught</option>
                        <option value="Other">Other</option>
                      </select>
                      {formData.educationLevel === "Other" && (
                        <input
                          type="text"
                          className="mt-2 w-full bg-bg-primary border border-border rounded-2xl p-4 text-text-heading focus:ring-2 focus:ring-accent outline-none transition-all font-bold"
                          placeholder="e.g. DAE, O-Levels, A-Levels…"
                          value={customEducation}
                          onChange={(e) => setCustomEducation(e.target.value)}
                          required
                        />
                      )}
                    </div>

                    {/* Fix 5: Experience level */}
                    <div className="space-y-2">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-text-body ml-2 flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-accent" /> Experience Level
                      </label>
                      <select
                        className="appearance-none w-full bg-bg-primary border border-border rounded-2xl p-4 text-text-heading focus:ring-2 focus:ring-accent outline-none transition-all cursor-pointer font-bold bg-no-repeat bg-[right_1rem_center]"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '1.5em' }}
                        value={formData.experienceLevel}
                        onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
                        required
                      >
                        <option value="">Select experience...</option>
                        <option value="Fresh Graduate">Fresh Graduate / No experience</option>
                        <option value="1-2 years">1–2 years</option>
                        <option value="3-5 years">3–5 years</option>
                        <option value="5+ years">5+ years</option>
                        <option value="Career Switcher">Career Switcher</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Field of Study */}
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-text-body ml-2 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-accent" /> Field of Study
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g., Computer Science, Business, Engineering"
                      className="bg-bg-primary border-border text-text-heading rounded-2xl h-14 px-6"
                      value={formData.fieldOfStudy}
                      onChange={(e) => setFormData({ ...formData, fieldOfStudy: e.target.value })}
                      required
                    />
                  </div>

                  {/* Row 3: Country */}
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-text-body ml-2 flex items-center gap-2">
                      <Globe className="h-4 w-4 text-accent" /> Country / Market
                    </label>
                    <select
                      className="appearance-none w-full bg-bg-primary border border-border rounded-2xl p-4 text-text-heading focus:ring-2 focus:ring-accent outline-none transition-all cursor-pointer font-bold bg-no-repeat bg-[right_1rem_center]"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '1.5em' }}
                      value={
                        ["Pakistan", "United States", "United Kingdom", "Canada", "Australia",
                         "India", "UAE", "Saudi Arabia", "Germany", "Singapore",
                         "France", "Japan", "Brazil", "Turkey", "Malaysia", ""].includes(formData.country)
                          ? formData.country
                          : "Other"
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, country: val === "Other" ? "Custom Country" : val });
                      }}
                      required
                    >
                      <option value="">Select country...</option>
                      <option value="Pakistan">Pakistan</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="UAE">UAE</option>
                      <option value="Saudi Arabia">Saudi Arabia</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="India">India</option>
                      <option value="Germany">Germany</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Malaysia">Malaysia</option>
                      <option value="Turkey">Turkey</option>
                      <option value="France">France</option>
                      <option value="Japan">Japan</option>
                      <option value="Brazil">Brazil</option>
                      <option value="Other">Other</option>
                    </select>
                    {!["Pakistan", "United States", "United Kingdom", "Canada", "Australia",
                       "India", "UAE", "Saudi Arabia", "Germany", "Singapore",
                       "France", "Japan", "Brazil", "Turkey", "Malaysia", ""].includes(formData.country) && (
                      <div className="pt-2 animate-in fade-in slide-in-from-top-1">
                        <Input
                          type="text"
                          placeholder="Enter your country"
                          className="bg-bg-primary border-border text-text-heading rounded-2xl h-14"
                          value={formData.country === "Custom Country" ? "" : formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* Row 4: Skills */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-2">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-text-body flex items-center gap-2">
                        <Target className="h-4 w-4 text-accent" /> Your Skills
                      </label>
                      {/* Fix 3: Format hint */}
                      <span className="text-[10px] text-text-body/50 font-medium">separate with commas · max 10 skills</span>
                    </div>
                    <textarea
                      className="w-full bg-bg-primary border border-border rounded-2xl p-6 text-text-heading focus:ring-2 focus:ring-accent outline-none transition-all min-h-[100px] resize-none font-medium"
                      placeholder="e.g. React, Python, SQL, Project Management, Figma..."
                      value={formData.skills}
                      onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full py-8 text-xl font-black uppercase tracking-[0.2em] bg-accent hover:bg-accent/90 text-text-heading rounded-2xl shadow-xl shadow-accent/20">
                    Find My Career Path <ArrowRight className="ml-2 h-6 w-6" />
                  </Button>
                </form>
              </Card>
            </motion.div>
          )}

          {screen === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-12"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full animate-pulse" />
                  <Loader2 className="h-16 w-16 text-accent animate-spin relative" />
                </div>
                <div className="text-center space-y-3">
                  <h2 className="font-display text-2xl sm:text-3xl font-semibold text-text-heading uppercase tracking-tight">
                    {loadingSteps[loadingStep]}
                  </h2>
                  <div className="flex gap-2 justify-center">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`h-2 w-12 rounded-full transition-all duration-500 ${
                          i <= loadingStep ? "bg-accent" : "bg-white/5"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* High-fidelity skeleton loader matching the career path results */}
              <CareerMentorSkeleton />
            </motion.div>
          )}

          {screen === "report" && (
            <motion.div
              key="report"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="font-display text-4xl font-semibold text-text-heading uppercase tracking-tight">
                  Career Recommendations
                </h2>
                <p className="text-text-body text-lg font-medium">
                  Advanced analysis based on your skills, assessment, and market trends
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {recommendations.map((role, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="cursor-pointer"
                    onClick={() =>
                      setSelectedRoleIndex(
                        selectedRoleIndex === idx ? null : idx
                      )
                    }
                  >
                    <Card
                      className={`p-6 sm:p-8 pb-10 sm:pb-12 flex flex-col h-full border-2 transition-all rounded-[2rem] sm:rounded-[2.5rem] relative overflow-hidden ${
                        selectedRoleIndex === idx
                          ? "border-success bg-success/5 shadow-[0_0_50px_rgba(34,197,94,0.1)]"
                          : "border-border bg-bg-card hover:border-success/30"
                      }`}
                    >
                      {/* Header with Match Score */}
                      <div className="flex justify-between items-start mb-8">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                             <h3 className="font-display text-2xl font-semibold text-text-heading uppercase tracking-tight leading-none">{role.title}</h3>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleExportPDF(role);
                               }}
                               className="p-2 rounded-full hover:bg-white/10 text-text-body/40 hover:text-accent transition-colors"
                               title="Download PDF Summary"
                             >
                               <Download className="h-4 w-4" />
                             </button>
                          </div>
                          <p className="text-xs text-text-body/60 font-medium italic mt-2">
                            {role.tagline}
                          </p>
                        </div>
                        {renderMatchScore(role.matchScore)}
                      </div>

                      {/* Market Demand Badge */}
                      <div className="mb-6">
                        {renderMarketBadge(role.marketDemand)}
                      </div>

                      {/* Key Info */}
                      <div className="space-y-4 mb-8 text-sm">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-accent" />
                          </div>
                          <span className="text-text-body font-medium">
                            {role.timeToFirstJobMonths} months to first job
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-accent" />
                          </div>
                          <div>
                            <span className="text-text-heading font-black tracking-tight">{role.salaryRange}</span>
                            {/* Fix 4: salary source label */}
                            <span className={`ml-2 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                              role.salarySource === "live_listings" || role.salarySource === "listing_data"
                                ? "bg-success/15 text-success"
                                : "bg-warning/15 text-warning"
                            }`}>
                              {role.salarySource === "live_listings" || role.salarySource === "listing_data"
                                ? "live data"
                                : "estimated"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center">
                            <Award className="h-4 w-4 text-accent" />
                          </div>
                          <span className="font-mono text-text-body uppercase tracking-widest text-[10px]">{role.level} Level</span>
                        </div>
                      </div>

                      {/* Role Progression */}
                      <div className="mb-6 pb-6 border-b border-white/5">
                        <p className="font-mono text-[10px] text-text-body/40 uppercase tracking-[0.2em] mb-4">
                          Career Progression
                        </p>
                        {renderRoleProgression(role.roleProgression)}
                      </div>

                      {/* Expandable Details */}
                      <AnimatePresence>
                        {selectedRoleIndex === idx && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-6 pb-6 border-b border-white/5 space-y-6"
                          >
                            {/* Why this score — visual skill-coverage breakdown */}
                            {renderMatchBreakdown(role)}

                            {/* Skill Gaps */}
                            {renderSkillGaps(role)}

                            {/* Current Skill Overlap */}
                            {role.currentSkillOverlap.length > 0 && (
                              <div>
                                <h4 className="font-mono text-[10px] uppercase tracking-widest text-accent mb-3 flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4" /> Skills You Have
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {role.currentSkillOverlap.map((skill, i) => (
                                    <span
                                      key={i}
                                      className="px-3 py-1 bg-accent/10 text-accent rounded-full text-[10px] font-mono uppercase tracking-widest border border-accent/20"
                                      title={skill}
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Why This Fits — both the skill-based reasoning (whyFit) and the
                                assessment-based reasoning (assessmentAlignment), since they answer
                                two different questions: "what you can already do" vs "how your
                                assessment results back this up." Both are real AI-generated text
                                that was previously captured but never shown. */}
                            {(role.whyFit || role.assessmentAlignment) && (
                              <div className="space-y-4">
                                {role.whyFit && (
                                  <div>
                                    <h4 className="font-mono text-[10px] uppercase tracking-widest text-accent mb-2 flex items-center gap-2">
                                      <Sparkles className="h-4 w-4" /> Why This Fits Your Skills
                                    </h4>
                                    <p className="text-xs text-text-body leading-relaxed">
                                      {role.whyFit}
                                    </p>
                                  </div>
                                )}
                                {role.assessmentAlignment && (
                                  <div>
                                    <h4 className="font-mono text-[10px] uppercase tracking-widest text-accent mb-2 flex items-center gap-2">
                                      <Brain className="h-4 w-4" /> What Your Assessment Shows
                                    </h4>
                                    <p className="text-xs text-text-body leading-relaxed">
                                      {role.assessmentAlignment}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Use Cases Stories Panel */}
                      <AnimatePresence>
                        {useCasesOpen[idx] && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-8"
                          >
                            {useCasesMap[idx]?.length === 0 ? (
                              <div className="p-8 rounded-[2rem] border border-dashed border-border bg-bg-primary/30 text-center">
                                <Users className="h-8 w-8 text-text-body/20 mx-auto mb-3" />
                                <p className="text-xs font-mono uppercase tracking-widest text-text-body/40">
                                  No stories found for this role yet.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary-purple flex items-center gap-2 px-1">
                                  <Users className="h-3 w-3" /> Real people who made this transition
                                </p>
                                {(useCasesMap[idx] || []).map((story, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="p-5 rounded-[1.5rem] bg-bg-primary/50 border border-border space-y-3"
                                  >
                                    <p className="font-black text-text-heading text-sm leading-snug">
                                      {story.headline}
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-body font-medium">
                                      {story.previous_role && (
                                        <span>
                                          <span className="text-text-body/40">From </span>
                                          {story.previous_role}
                                        </span>
                                      )}
                                      {story.current_role && (
                                        <span>
                                          <span className="text-text-body/40">→ </span>
                                          <span className="text-success font-black">{story.current_role}</span>
                                        </span>
                                      )}
                                    </div>
                                    {story.salary_change && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono uppercase tracking-widest text-text-body/40">Salary</span>
                                        <span className="text-success font-black text-xs">{story.salary_change}</span>
                                      </div>
                                    )}
                                    {story.duration_months && (
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-3 w-3 text-accent" />
                                        <span className="text-xs text-text-body font-medium">{story.duration_months} months to transition</span>
                                      </div>
                                    )}
                                    {story.key_advice && story.key_advice.toLowerCase() !== "not specified" && (
                                      <p className="text-xs italic text-text-body/60 border-l-2 border-primary-purple/30 pl-3">
                                        "{story.key_advice}"
                                      </p>
                                    )}
                                    {story.source_url && (
                                      <a
                                        href={story.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-primary-purple hover:underline"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        Read on {story.source_platform || "source"}
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* CTA Buttons — responsive layout */}
                      <div className="flex flex-col xs:flex-row sm:grid sm:grid-cols-2 gap-3 mt-6 sm:mt-8">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateRoadmap(role);
                          }}
                          className="w-full py-4 sm:py-5 gap-2 group bg-accent hover:bg-accent/90 text-text-heading font-black uppercase tracking-wider rounded-xl sm:rounded-[1.5rem] text-[10px] sm:text-xs"
                        >
                          Roadmap
                          <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
                        </Button>

                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewUseCases(role, idx);
                          }}
                          className={`w-full py-4 sm:py-5 gap-2 font-black uppercase tracking-wider rounded-xl sm:rounded-[1.5rem] transition-all border-2 text-[10px] sm:text-xs ${
                            useCasesOpen[idx]
                              ? "bg-primary-purple/20 border-primary-purple text-primary-purple hover:bg-primary-purple/30"
                              : "bg-transparent border-border text-text-body hover:border-primary-purple hover:text-primary-purple hover:bg-primary-purple/10"
                          }`}
                        >
                          {useCasesLoading[idx] ? (
                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                          {useCasesOpen[idx] ? "Hide" : "Stories"}
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Start Over Button */}
              <div className="flex justify-center pt-8">
                <Button
                  variant="outline"
                  onClick={() => setScreen("form")}
                  className="gap-2 rounded-2xl border-border bg-bg-card hover:bg-bg-primary text-text-body"
                >
                  <RefreshCw className="h-4 w-4" /> Start Over
                </Button>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        )}
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
                  <div className="w-10 h-10 rounded-xl bg-primary-purple/10 flex items-center justify-center text-primary-purple">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg text-text-heading">Saved Reports</h3>
                    <p className="text-xs text-text-secondary">Your previously generated career recommendations</p>
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
                {user?.savedCareerReports && user.savedCareerReports.length > 0 ? (
                  user.savedCareerReports.map((r) => (
                    <div 
                      key={r.id} 
                      className="border border-border/50 bg-bg-card rounded-2xl p-5 hover:border-primary-purple hover:shadow-lg transition-all text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <h4 className="font-bold text-text-heading text-lg mb-1">{r.title || "Career Report"}</h4>
                        <div className="flex items-center gap-3 text-xs font-mono text-text-secondary">
                          <span className="text-primary-purple font-bold px-2 py-0.5 bg-primary-purple/10 rounded-md">Top: {r.topField}</span>
                          <span>{new Date(r.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-primary-purple text-white border-none whitespace-nowrap px-6 shrink-0 hover:bg-primary-purple/90"
                        onClick={() => {
                          setRecommendations(r.data);
                          // It may not be perfect if we don't have metadata, but it's fine
                          setScreen("report");
                          setShowSavedModal(false);
                        }}
                      >
                        Load Report
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 px-4">
                    <Briefcase className="h-12 w-12 text-text-secondary/20 mx-auto mb-4" />
                    <p className="text-text-heading font-medium">No saved reports yet</p>
                    <p className="text-text-secondary text-sm mt-2">Generate a career path and save it to see it here.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
    </DashboardLayout>
  );
}