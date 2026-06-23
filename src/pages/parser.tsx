import { DashboardLayout } from "../components/DashboardLayout";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { JobCard } from "../components/JobCard";
import { UploadCloud, FileText, CheckCircle2, Briefcase, AlertTriangle, ArrowRight, Loader2, ChevronLeft, ChevronRight, X, Plus, AlertCircle, RefreshCw, WifiOff, UserX, ShieldAlert, Lightbulb, Sparkles } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useUser } from "../context/UserContext";
import { api } from "../utils/api";
import { extractTextFromFile } from "../utils/fileExtractor";
import { useNavigate, useSearchParams } from "react-router-dom";
import { gapDataService } from "../services/gapDataService";
import { saveResultToProfile } from "../services/profileService";
import { SAMPLE_PROFILES } from "../data/sampleProfiles";
import ResumeConsentModal, { hasResumeConsent } from "../components/ResumeConsentModal";
import { GapAnalysisResult } from "../types/profile";
import { 
  trackFeatureStart, 
  trackFeatureCompletion 
} from "../services/featureService";

export default function ParserPage() {
  const { user, isLoggedIn, updateProfile } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  if (!isLoggedIn || !user) return null;
  const [tab, setTab] = useState<"upload" | "manual">(
    searchParams.get("mode") === "manual" ? "manual" : "upload"
  );
  
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<React.FormEvent | null>(null);

  // Manual Form States
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [education, setEducation] = useState("");
  const [experienceYears, setExperienceYears] = useState("1-3 years");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [workHistory, setWorkHistory] = useState("");
  const [summary, setSummary] = useState("");

  const [role, setRole] = useState(searchParams.get("role") || "Frontend Developer");
  const [country, setCountry] = useState("Worldwide");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [locationType, setLocationType] = useState("Remote");
  
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStatus, setParseStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [extractedDetails, setExtractedDetails] = useState<{ jobTitle: string; yearsOfExperience: string; skills: string[] } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [jobsPerPage] = useState(6);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedJobIds, setSavedJobIds] = React.useState<Set<string>>(new Set());
  const [appliedJobIds, setAppliedJobIds] = React.useState<Set<string>>(new Set());
  const [selectedJobDetail, setSelectedJobDetail] = React.useState<any | null>(null);
  const [saveToast, setSaveToast] = React.useState<string | null>(null);

  // Load already-saved/applied jobs from user profile on mount
  React.useEffect(() => {
    if (!user) return;
    const existing: any[] = (user as any).savedJobs || [];
    setSavedJobIds(new Set(existing.map((j: any) => j.id)));
    setAppliedJobIds(new Set(existing.filter((j: any) => j.status === "applied").map((j: any) => j.id)));
  }, [user?.uid]);

  const makeJobId = (job: any) => `job-${job.jobTitle}-${job.company}`.replace(/\s+/g, "-").toLowerCase();

  const handleSaveJob = async (job: any) => {
    if (!user) return;
    const jobId = makeJobId(job);
    if (savedJobIds.has(jobId)) return;

    const savedJob = {
      id: jobId,
      jobTitle: job.jobTitle || "",
      company: job.company || "",
      location: job.location || "",
      applyLink: job.applyLink || "",
      matchScore: job.matchScore || 0,
      isRemote: job.isRemote || false,
      employmentType: job.employmentType || "",
      savedAt: new Date().toISOString(),
      status: "saved",
    };

    const existing: any[] = (user as any).savedJobs || [];
    const updated = [savedJob, ...existing].slice(0, 50); // keep last 50 saved jobs

    try {
      await updateProfile({ savedJobs: updated } as any);
      setSavedJobIds(prev => new Set([...prev, jobId]));
      setSaveToast(`"${job.jobTitle}" saved!`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.error("[Parser] Failed to save job:", err);
    }
  };

  // Marks a job as "applied" — adds it to savedJobs if not already there,
  // or flips its status if it was just "saved". This is what powers the
  // Application Board (saved → applied → interviewing → offer/rejected).
  const handleApplyJob = async (job: any) => {
    if (!user) return;
    const jobId = makeJobId(job);
    if (appliedJobIds.has(jobId)) return; // already tracked as applied

    const existing: any[] = (user as any).savedJobs || [];
    const alreadyThere = existing.find((j: any) => j.id === jobId);

    let updated: any[];
    if (alreadyThere) {
      updated = existing.map((j: any) => j.id === jobId ? { ...j, status: "applied" } : j);
    } else {
      const newEntry = {
        id: jobId,
        jobTitle: job.jobTitle || "",
        company: job.company || "",
        location: job.location || "",
        applyLink: job.applyLink || "",
        matchScore: job.matchScore || 0,
        isRemote: job.isRemote || false,
        employmentType: job.employmentType || "",
        savedAt: new Date().toISOString(),
        status: "applied",
      };
      updated = [newEntry, ...existing].slice(0, 50);
    }

    try {
      await updateProfile({ savedJobs: updated } as any);
      setSavedJobIds(prev => new Set([...prev, jobId]));
      setAppliedJobIds(prev => new Set([...prev, jobId]));
      setSaveToast(`Marked "${job.jobTitle}" as applied — track it on your Application Board.`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.error("[Parser] Failed to mark job as applied:", err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const newSkill = skillInput.trim().replace(/,$/, '');
    if (newSkill && !skills.includes(newSkill)) {
      setSkills([...skills, newSkill]);
      setSkillInput("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  // ── Sample Data — lets first-time users explore without a real resume ─────
  // Profiles live in ../data/sampleProfiles.ts (shared with resume-tools.tsx)
  // so both features offer the same role choices with coherent data.
  const [showSamplePicker, setShowSamplePicker] = useState(false);

  const handleTrySampleData = (profileId: string) => {
    const profile = SAMPLE_PROFILES.find((p) => p.id === profileId) || SAMPLE_PROFILES[0];
    setTab("manual");
    setFile(null);
    setFullName(profile.fullName);
    setEmail(profile.email);
    setCurrentRole(profile.currentRole);
    setEducation(profile.education);
    setExperienceYears(profile.experienceYears);
    setSkills(profile.skills);
    setWorkHistory(profile.workHistory);
    setSummary(profile.summary);
    setRole(profile.targetRole);
    setError(null);
    setRoleError(null);
    setShowSamplePicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasResumeConsent()) {
      setPendingSubmit(e);
      setShowConsent(true);
      return;
    }

    let resumeText = "";
    
    if (tab === "upload") {
      if (!file) {
        setError("Please upload a resume first.");
        return;
      }
    } else {
      if (!fullName.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (skills.length === 0) {
        setError("Please add at least one skill.");
        return;
      }
      
      resumeText = `Name: ${fullName}
Email: ${email}
Current Role: ${currentRole}
Education: ${education}
Experience: ${experienceYears}
Skills: ${skills.join(", ")}
Work History: ${workHistory}
Summary: ${summary}`;
    }

    if (!role.trim()) {
      setError("Please enter a target role.");
      return;
    }
    
    const roleRegex = /^[a-zA-Z0-9\s]+$/;
    if (!roleRegex.test(role.trim())) {
      setError("Target role can only contain alphanumeric characters and spaces.");
      return;
    }

    if (user?.uid) {
      await trackFeatureStart(user.uid, "parser", "Smart Parser");
    }

    setIsParsing(true);
    setParseProgress(5);
    setParseStatus(tab === "upload" ? "Reading file..." : "Processing manual entry...");
    setError(null);
    setHasParsed(false);
    setJobs([]);
    // Clear previous extracted details on new submission
    setExtractedDetails(null);
    setCurrentPage(1);

    const overallStartTime = performance.now();
    try {
      // 1. Extract text if upload mode
      if (tab === "upload" && file) {
        // Detect image files upfront so we can show OCR-specific message
        const isImageFile = file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name);
        if (isImageFile) {
          setParseStatus("Reading image with OCR — this may take 20–30 seconds...");
        }
        resumeText = await extractTextFromFile(file, (percent) => {
          setParseProgress(Math.floor(percent * 0.4)); // First 40% is extraction
          if (isImageFile) {
            if (percent > 90) setParseStatus("OCR almost done...");
            else if (percent > 50) setParseStatus("OCR in progress — scanning text from image...");
            else setParseStatus("Reading image with OCR — this may take 20–30 seconds...");
          } else {
            if (percent > 90) setParseStatus("Extraction nearly complete...");
            else if (percent > 50) setParseStatus("Heavy lifting: Analyzing pages...");
            else setParseStatus("Extracting text from resume...");
          }
        });
      }
      
      const extractionEndTime = performance.now();
      console.log(`[Parser] Extraction phase took ${((extractionEndTime - overallStartTime) / 1000).toFixed(2)}s`);
      
      // Truncate to prevent payload too large or n8n timeout issues
      if (resumeText.length > 10000) {
        resumeText = resumeText.substring(0, 10000);
      }

      // If upload mode, we extract current job details concurrently
      if (tab === "upload") {
        api.extractResumeDetails(resumeText)
          .then(details => {
            console.log("[Parser] Extracted details:", details);
            setExtractedDetails(details);
          })
          .catch(err => {
            console.warn("[Parser] Failed to extract simple resume details, continuing...", err);
          });
      } else {
        // Manual mode, we already have the details
        setExtractedDetails({
          jobTitle: currentRole || "Not specified",
          yearsOfExperience: experienceYears || "Not specified",
          skills: skills
        });
      }
      
      setParseProgress(45);
      setParseStatus("Analyzing skills and matching jobs...");
      
      // 2. Call API
      const response = await api.parseResume(user.uid, resumeText, role, country, employmentType, locationType);
      
      setParseProgress(80);
      setParseStatus("Processing results...");
      
      const unwrap = (d: any): any => {
        if (!d) return d;
        
        const tryParse = (val: any) => {
          if (typeof val === 'string') {
            try {
              return JSON.parse(val);
            } catch (e) {
              return val;
            }
          }
          return val;
        };

        if (Array.isArray(d)) {
          const processed = d.map(item => tryParse(item.json || item));
          if (processed.length === 1) return processed[0];
          return processed;
        }
        
        if (d.json) return tryParse(d.json);
        return tryParse(d);
      };

      const data = unwrap(response);
      
      // 3. Store response
      let finalResponse = data.data ? data.data : data;
      
      // Handle array by merging all objects (consistent with gapmap.tsx)
      if (Array.isArray(finalResponse)) {
        let merged = {};
        finalResponse.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            const toMerge = item.data ? item.data : item;
            merged = { ...merged, ...toMerge };
          }
        });
        finalResponse = merged;
      }

      localStorage.removeItem("skillsync_data");
      await gapDataService.saveGapData(user.uid, finalResponse);

      // Save Gap Analysis to profile
      const gapResult: GapAnalysisResult = {
        id: `gap-${Date.now()}`,
        type: 'gap-map',
        title: `Gap Analysis: ${role}`,
        targetRole: role,
        gaps: finalResponse.skillsGaps || [],
        timestamp: new Date().toISOString(),
        data: finalResponse
      };
      await saveResultToProfile(user.uid, gapResult);

      // 3.5 Update user profile with extracted skills
      if (isLoggedIn && user) {
        const extractArray = (obj: any, possibleKeys: string[]) => {
          if (!obj) return [];
          for (const key of possibleKeys) {
            if (obj[key]) {
              const val = obj[key];
              if (Array.isArray(val)) return val;
              if (typeof val === 'object') return Object.values(val);
              if (typeof val === 'string') return val.split(',').map(s => s.trim());
            }
          }
          return [];
        };

        let allNewSkills: string[] = [];

        // Skills from API response
        const extractedSkills = extractArray(finalResponse, [
          "aggregated skills", "aggregatedSkills", "aggregated_skills",
          "candidate skills", "candidateSkills", "candidate_skills",
          "skills", "verifiedSkills", "verified_skills"
        ]);

        if (extractedSkills.length > 0) {
          const cleanSkills = extractedSkills
            .map(s => typeof s === 'object' ? (s.skill || s.name || s.title) : s)
            .filter(s => typeof s === 'string' && s.trim().length > 0);
          allNewSkills = [...allNewSkills, ...cleanSkills];
        }

        // Skills from manual entry
        if (tab === "manual" && skills.length > 0) {
          allNewSkills = [...allNewSkills, ...skills];
        }

        // Merge with existing skills
        if (allNewSkills.length > 0 && isLoggedIn && user) {
          const currentSkills = user.skills || [];
          const mergedSkills = Array.from(new Set([...currentSkills, ...allNewSkills.map(s => String(s))]));
          
          if (mergedSkills.length > currentSkills.length) {
            updateProfile({ skills: mergedSkills });
          }
        }
      }
      
      // 4. Render Jobs
      if (finalResponse && finalResponse.topJobs) {
        setJobs(finalResponse.topJobs);
      } else if (finalResponse && finalResponse.jobs) {
        setJobs(finalResponse.jobs);
      }
      
      setParseProgress(100);
      setParseStatus("Complete!");
      
      // Small delay to let the user see 100% before hiding
      setTimeout(async () => {
        setHasParsed(true);
        setIsParsing(false);
        
        // Track feature completion
        await trackFeatureCompletion(
          user.uid,
          "parser",
          "Resume Parser",
          () => {}
        );
      }, 500);
      
    } catch (err: any) {
      console.error("[Parser] Error:", err);
      setError(err?.message || "Failed to parse resume. Please try again.");
    } finally {
      setIsParsing(false);
    }
  };

  const getErrorInfo = (err: string) => {
    const errorLower = err.toLowerCase();
    
    if (errorLower.includes("file") || errorLower.includes("format") || errorLower.includes("type")) {
      return {
        type: "Invalid File Format",
        icon: <FileText className="h-5 w-5" />,
        description: "We couldn't read your resume file. Ensure it's not password protected or corrupted.",
        tips: [
          "Use PDF, DOCX, or plain TXT formats",
          "Ensure the file size is under 5MB",
          "Try saving your document as a new PDF",
          "If it's an image, make sure text is clear and readable"
        ]
      };
    }

    if (errorLower.includes("network") || errorLower.includes("fetch") || errorLower.includes("failed to fetch")) {
      return {
        type: "Connection Error",
        icon: <WifiOff className="h-5 w-5" />,
        description: "Our systems are having trouble communicating. This usually fixes itself quickly.",
        tips: [
          "Check your internet connection",
          "Disable restrictive browser extensions",
          "Try the 'Enter Manually' tab if upload fails",
          "Check if you're behind a strict corporate firewall"
        ]
      };
    }
    
    if (errorLower.includes("unauthorized") || errorLower.includes("session")) {
      return {
        type: "Session Timeout",
        icon: <UserX className="h-5 w-5" />,
        description: "Your session has expired. You'll need to log in again to continue parsing.",
        tips: [
          "Refresh the browser page",
          "Log out and log back in",
          "Ensure cookies are enabled in your browser"
        ]
      };
    }

    if (errorLower.includes("limit") || errorLower.includes("quota") || errorLower.includes("too many requests")) {
      return {
        type: "Usage Limit Reached",
        icon: <ShieldAlert className="h-5 w-5" />,
        description: "Our AI engine is currently throttled or you've hit a daily parsing limit.",
        tips: [
          "Wait 2-3 minutes and try again",
          "Use shorter text or a smaller file",
          "Upgrade for higher parsing priority"
        ]
      };
    }

    return {
      type: "Processing Error",
      icon: <AlertCircle className="h-5 w-5" />,
      description: err || "An unexpected error occurred while analyzing your resume.",
      tips: [
        "Try refreshing the page",
        "Switch to manual entry if upload fails",
        "Ensure you've filled out all required fields"
      ]
    };
  };

  const renderError = () => {
    if (!error) return null;
    const info = getErrorInfo(error);
    
    return (
      <motion.div 
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className="overflow-hidden mt-6"
      >
        <div className="p-0 border border-danger/20 rounded-2xl bg-danger/[0.02] shadow-sm">
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-danger/10">
            <div className="p-6 md:w-1/2">
              <div className="flex items-center gap-3 text-danger mb-3">
                <div className="p-2 rounded-lg bg-danger/10">
                  {info.icon}
                </div>
                <h3 className="font-display font-semibold text-lg">{info.type}</h3>
              </div>
              <p className="text-sm text-text-primary mb-4 leading-relaxed">
                {info.description}
              </p>
              <div className="flex items-center gap-3">
                <Button 
                  size="sm" 
                  className="bg-danger hover:bg-danger/90 text-white border-none"
                  onClick={handleSubmit}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  Retry Process
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-text-secondary hover:text-text-primary"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
            <div className="p-6 md:w-1/2 bg-danger/[0.01]">
              <h4 className="font-mono text-xs uppercase tracking-widest text-text-secondary mb-4 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Troubleshooting Tips
              </h4>
              <ul className="space-y-3">
                {info.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-danger/40 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const countriesList = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Austria", "Bangladesh", "Belgium", 
    "Brazil", "Canada", "Chile", "China", "Colombia", "Czech Republic", "Denmark", "Egypt", 
    "Finland", "France", "Germany", "Greece", "Hong Kong", "Hungary", "India", "Indonesia", 
    "Ireland", "Israel", "Italy", "Japan", "Kenya", "Malaysia", "Mexico", "Netherlands", 
    "New Zealand", "Nigeria", "Norway", "Pakistan", "Peru", "Philippines", "Poland", "Portugal", 
    "Qatar", "Romania", "Russia", "Saudi Arabia", "Singapore", "South Africa", "South Korea", 
    "Spain", "Sweden", "Switzerland", "Taiwan", "Thailand", "Turkey", "UAE", "UK", "USA", "Vietnam"
  ].sort();

  return (
    <DashboardLayout title="SkillSync Parser" showBackButton backPath="/dashboard">
      <div className="max-w-5xl mx-auto grid gap-8 md:grid-cols-12">
        
        {/* Left Column: Form & Upload */}
        <div className="md:col-span-5 space-y-6">
          <Card className="relative overflow-hidden p-4 sm:p-6">
            <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-30" />
            <div className="absolute -top-16 -left-10 w-[260px] h-[200px] bg-primary-violet/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10">
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary-purple mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-purple animate-pulse-violet" />
              Live job matching
            </span>
            <h2 className="font-display text-xl font-semibold mb-2">Find Matched Jobs</h2>
            <p className="text-text-secondary mb-4 text-xs sm:text-sm">
              Upload your resume and tell us what you're looking for. We'll extract your skills and find the best job matches.
            </p>

            {/* Try Sample Data — lets first-time users explore instantly, with a choice of role */}
            {!hasParsed && !isParsing && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setShowSamplePicker((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-primary-purple/30 bg-primary-purple/5 text-primary-purple text-[10px] sm:text-sm font-bold hover:bg-primary-purple/10 transition-colors cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  Try with Sample Data
                </button>
                {showSamplePicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-2 flex flex-wrap gap-2 overflow-hidden"
                  >
                    {SAMPLE_PROFILES.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => handleTrySampleData(profile.id)}
                        className="px-3 py-1.5 rounded-full border border-border bg-card text-[10px] sm:text-xs font-bold text-text-secondary hover:border-primary-purple/40 hover:text-primary-purple transition-colors cursor-pointer"
                      >
                        {profile.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
            )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tabs */}
              <div className="flex gap-2 sm:gap-4 border-b border-border mb-4">
                <button 
                  type="button"
                  onClick={() => setTab("upload")}
                  className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-[11px] sm:text-sm font-medium border-b-2 transition-colors ${tab === "upload" ? "border-primary-blue text-primary-blue" : "border-transparent text-text-secondary hover:text-text-primary"}`}
                >
                  Upload Resume
                </button>
                <button 
                  type="button"
                  onClick={() => setTab("manual")}
                  className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-[11px] sm:text-sm font-medium border-b-2 transition-colors ${tab === "manual" ? "border-primary-blue text-primary-blue" : "border-transparent text-text-secondary hover:text-text-primary"}`}
                >
                  Enter Manually
                </button>
              </div>

              {tab === "upload" ? (
                /* File Upload Dropzone */
                <div 
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                    isDragging ? "border-primary-purple bg-primary-purple/10" : "border-border hover:border-text-secondary bg-background"
                  } ${file ? "border-success/50 bg-success/5" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept=".pdf,.docx,.txt,image/*"
                  />
                  
                  {isDragging ? (
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-primary-purple/20 rounded-full flex items-center justify-center mb-3 shadow-sm">
                        <Loader2 className="h-6 w-6 text-primary-purple animate-spin" />
                      </div>
                      <h3 className="text-sm font-medium mb-1 text-primary-purple">Drop file here</h3>
                      <p className="text-xs text-primary-purple/70">Release to upload</p>
                    </div>
                  ) : file ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle2 className="h-8 w-8 text-success mb-2" />
                      <p className="font-medium text-sm truncate max-w-full px-4">{file.name}</p>
                      <p className="text-xs text-text-secondary mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center mb-3 shadow-sm">
                        <UploadCloud className="h-6 w-6 text-primary-purple" />
                      </div>
                      <h3 className="text-sm font-medium mb-1">Drag & drop your resume</h3>
                      <p className="text-xs text-text-secondary">PDF, DOCX, TXT, JPG, PNG</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Manual Form Fields */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1 block">Full Name</label>
                      <Input 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. John Smith"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1 block">Email</label>
                      <Input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. john@email.com"
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Current Job Title / Role</label>
                    <Input 
                      value={currentRole}
                      onChange={(e) => setCurrentRole(e.target.value)}
                      placeholder="e.g. Frontend Developer"
                      className="h-10"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Education</label>
                    <textarea 
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                      placeholder="e.g. B.S. in Computer Science, University of Technology, 2020"
                      className="flex min-h-[80px] h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary-blue transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Years of Experience</label>
                    <select 
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-blue"
                    >
                      <option value="0-1 years">0-1 years</option>
                      <option value="1-3 years">1-3 years</option>
                      <option value="3-5 years">3-5 years</option>
                      <option value="5-10 years">5-10 years</option>
                      <option value="10+ years">10+ years</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Skills</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {skills.map((skill, index) => (
                        <span 
                          key={index} 
                          className="bg-primary-blue/10 text-primary-blue border border-primary-blue/20 rounded-full px-2.5 py-0.5 text-xs flex items-center gap-1"
                        >
                          {skill}
                          <button 
                            type="button" 
                            onClick={() => removeSkill(skill)}
                            className="hover:text-primary-blue/70"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="relative">
                      <Input 
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={handleAddSkill}
                        placeholder="Type a skill and press Enter..."
                        className="h-10 pr-10"
                      />
                      <button 
                        type="button"
                        onClick={handleAddSkill}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary-blue"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Work Experience / Job History</label>
                    <textarea 
                      value={workHistory}
                      onChange={(e) => setWorkHistory(e.target.value)}
                      placeholder="e.g. 2 years at Acme Corp as React Developer, built dashboard apps..."
                      className="flex min-h-[112px] h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary-blue transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Summary / About</label>
                    <textarea 
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Brief professional summary..."
                      className="flex min-h-[80px] h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary-blue transition-all resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Form Fields */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Target Role</label>
                  <Input 
                    value={role}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRole(val);
                      if (val.trim() && !/^[a-zA-Z0-9\s]+$/.test(val)) {
                        setRoleError("Target role can only contain alphanumeric characters and spaces.");
                      } else {
                        setRoleError(null);
                      }
                    }}
                    placeholder="e.g. Frontend Developer"
                    required
                    className={roleError ? "border-danger focus:ring-danger" : ""}
                  />
                  {roleError && (
                    <p className="text-xs text-danger mt-1">{roleError}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-text-secondary mb-1">Country</label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-blue"
                      >
                        <option value="Worldwide">Worldwide</option>
                        {countriesList.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Type</label>
                      <select
                        value={employmentType}
                        onChange={(e) => setEmploymentType(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-blue"
                      >
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Freelance">Freelance</option>
                        <option value="Contract">Contract</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Location</label>
                      <select
                        value={locationType}
                        onChange={(e) => setLocationType(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-blue"
                      >
                        <option value="Remote">Remote</option>
                        <option value="Onsite">Onsite</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-md flex items-start gap-2 text-danger text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {isParsing && (
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-xs font-medium text-text-secondary">
                    <span>{parseStatus}</span>
                    <span>{parseProgress}%</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                    <motion.div 
                      className="bg-primary-purple h-2 rounded-full" 
                      initial={{ width: 0 }}
                      animate={{ width: `${parseProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full mt-4" disabled={isParsing}>
                {isParsing ? "Processing..." : "Find Jobs"}
              </Button>
            </form>

            {renderError()}
          </Card>
          
          {hasParsed && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Card className="p-6 border-primary-purple/30 bg-primary-purple/5">
                <h3 className="font-display font-semibold text-primary-purple mb-2">Want to improve your matches?</h3>
                <p className="text-sm text-text-secondary mb-4">
                  We've analyzed your skills against market requirements. See what you're missing.
                </p>
                <Button 
                  variant="secondary" 
                  className="w-full"
                  onClick={() => navigate('/gapmap')}
                >
                  View Skill Gap Analysis <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Card>

              <Card className="p-6 border-primary-blue/30 bg-primary-blue/5">
                <h3 className="font-display font-semibold text-primary-blue mb-2">Optimize Your Resume</h3>
                <p className="text-sm text-text-secondary mb-4">
                  Rewrite your resume bullets and generate a cover letter tailored to any job.
                </p>
                <Button 
                  variant="secondary" 
                  className="w-full"
                  onClick={() => navigate('/resume-tools')}
                >
                  Open Resume Tools <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="md:col-span-7 flex flex-col gap-6">
          {extractedDetails && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-6 border-primary-blue/20 bg-background relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary-blue"></div>
                <h3 className="font-display text-lg font-semibold text-primary-blue mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Extracted Resume Information
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
                  <div className="bg-primary-blue/5 p-3 rounded-lg border border-primary-blue/10">
                    <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest block mb-1">Current Role / Title</span>
                    <p className="font-semibold text-sm">{extractedDetails.jobTitle || "Not specified"}</p>
                  </div>
                  <div className="bg-primary-blue/5 p-3 rounded-lg border border-primary-blue/10">
                    <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest block mb-1">Years of Experience</span>
                    <p className="font-semibold text-sm">{extractedDetails.yearsOfExperience || "Not specified"}</p>
                  </div>
                </div>
                
                <div>
                  <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest block mb-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    Top Skills Identified ({extractedDetails.skills.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {extractedDetails.skills.length > 0 ? extractedDetails.skills.map((skill, index) => (
                      <span 
                        key={index} 
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-border bg-card text-text-secondary hover:border-primary-blue/40 hover:text-primary-blue transition-colors cursor-default"
                      >
                        {skill}
                      </span>
                    )) : (
                      <span className="text-sm text-text-secondary">No skills identified.</span>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Save Job Toast */}
          {saveToast && (
            <div className="fixed bottom-6 right-6 z-50 bg-success text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2">
              <span className="text-sm font-medium">✓ {saveToast}</span>
            </div>
          )}

          {hasParsed ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="font-display text-xl font-semibold flex items-center gap-2">
                  <Briefcase className="h-6 w-6 text-primary-blue" />
                  Top Matched Jobs
                </h3>
                <span className="text-sm text-text-secondary bg-card px-3 py-1 rounded-full border border-border">
                  {jobs.length} found
                </span>
              </div>
              
              {jobs.length > 0 ? (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {jobs.slice((currentPage - 1) * jobsPerPage, currentPage * jobsPerPage).map((job, index) => (
                      <motion.div 
                        key={index}
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: index * 0.1 }}
                      >
                        <JobCard 
                          jobTitle={job.jobTitle}
                          company={job.company}
                          location={job.location}
                          matchScore={job.matchScore}
                          applyLink={job.applyLink}
                          atsScore={job.atsScore}
                          keywordMatchScore={job.keywordMatchScore}
                          experienceMatchScore={job.experienceMatchScore}
                          skillMatchScore={job.skillMatchScore}
                          finalScore={job.finalScore}
                          isRemote={job.isRemote}
                          employmentType={job.employmentType}
                          isSaved={savedJobIds.has(`job-${job.jobTitle}-${job.company}`.replace(/\s+/g, "-").toLowerCase())}
                          onSave={() => handleSaveJob(job)}
                          isApplied={appliedJobIds.has(`job-${job.jobTitle}-${job.company}`.replace(/\s+/g, "-").toLowerCase())}
                          onApply={() => handleApplyJob(job)}
                          onOpenDetails={() => setSelectedJobDetail(job)}
                        />
                      </motion.div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {jobs.length > jobsPerPage && (
                    <div className="flex items-center justify-center gap-2 pt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-2"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.ceil(jobs.length / jobsPerPage) }).map((_, i) => (
                          <Button
                            key={i}
                            variant={currentPage === i + 1 ? "primary" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentPage(i + 1)}
                            className="w-8 h-8 p-0"
                          >
                            {i + 1}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(jobs.length / jobsPerPage)))}
                        disabled={currentPage === Math.ceil(jobs.length / jobsPerPage)}
                        className="px-2"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <Card className="p-8 text-center border-dashed">
                  <Briefcase className="h-12 w-12 text-text-secondary opacity-20 mx-auto mb-3" />
                  <h4 className="text-lg font-medium mb-1">No jobs found</h4>
                  <p className="text-text-secondary text-sm">We couldn't find any jobs matching your profile for this role.</p>
                </Card>
              )}
            </motion.div>
          ) : (
            <div className="h-full min-h-[400px] flex items-center justify-center p-12 border-2 border-dashed border-border rounded-xl text-text-secondary text-center">
              <div>
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Upload your resume and search to see your top job matches here.</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Job Detail Modal — opens on-site instead of immediately leaving for the external apply page */}
      <AnimatePresence>
        {selectedJobDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setSelectedJobDetail(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedJobDetail(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-background text-text-secondary"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="p-6">
                <div className="flex items-center gap-2 bg-success/10 text-success px-2 py-1 rounded-md text-xs font-mono font-semibold tracking-wide inline-flex mb-3">
                  {Math.round(selectedJobDetail.finalScore ?? selectedJobDetail.matchScore)}% Match
                </div>
                <h3 className="font-display text-xl font-semibold text-text-primary mb-1">{selectedJobDetail.jobTitle}</h3>
                <p className="text-sm text-text-secondary mb-4">{selectedJobDetail.company} · {selectedJobDetail.location}{selectedJobDetail.isRemote ? " · Remote" : ""}</p>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 border-t border-border">
                  {selectedJobDetail.atsScore !== undefined && (
                    <div>
                      <p className="text-xs text-text-secondary mb-1">ATS Score</p>
                      <p className="font-semibold text-text-primary">{selectedJobDetail.atsScore}%</p>
                    </div>
                  )}
                  {selectedJobDetail.skillMatchScore !== undefined && (
                    <div>
                      <p className="text-xs text-text-secondary mb-1">Skill Match</p>
                      <p className="font-semibold text-text-primary">{selectedJobDetail.skillMatchScore}%</p>
                    </div>
                  )}
                  {selectedJobDetail.employmentType && (
                    <div>
                      <p className="text-xs text-text-secondary mb-1">Employment Type</p>
                      <p className="font-semibold text-text-primary">{selectedJobDetail.employmentType}</p>
                    </div>
                  )}
                </div>

                {selectedJobDetail.candidateSkills?.length > 0 && (
                  <div className="py-3 border-t border-border">
                    <p className="text-xs text-text-secondary mb-2">Your matching skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJobDetail.candidateSkills.slice(0, 10).map((s: string, i: number) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedJobDetail.missingSkills?.length > 0 && (
                  <div className="py-3 border-t border-border">
                    <p className="text-xs text-text-secondary mb-2">Skills you're missing for this role</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJobDetail.missingSkills.map((s: string, i: number) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    className="shrink-0"
                    disabled={savedJobIds.has(makeJobId(selectedJobDetail))}
                    onClick={() => handleSaveJob(selectedJobDetail)}
                  >
                    {savedJobIds.has(makeJobId(selectedJobDetail)) ? "Saved" : "Save"}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      handleApplyJob(selectedJobDetail);
                      window.open(selectedJobDetail.applyLink, "_blank", "noopener,noreferrer");
                    }}
                  >
                    {appliedJobIds.has(makeJobId(selectedJobDetail)) ? "Applied ✓ — Open Listing Again" : "Apply Now"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ResumeConsentModal
        isOpen={showConsent}
        onAccept={() => {
          setShowConsent(false);
          if (pendingSubmit) handleSubmit(pendingSubmit);
        }}
        onDecline={() => {
          setShowConsent(false);
          setPendingSubmit(null);
        }}
      />
    </DashboardLayout>
  );
}