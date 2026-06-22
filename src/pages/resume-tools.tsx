import React, { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useUser } from "../context/UserContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { extractTextFromFile } from "../utils/fileExtractor";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../utils/firestoreErrors";
import { 
  UploadCloud, 
  CheckCircle2, 
  Loader2, 
  AlertTriangle, 
  FileText, 
  Mail, 
  Sparkles, 
  X, 
  Plus,
  Lightbulb, 
  Copy,
  ArrowRight,
  Check,
  Download,
  Save,
  History,
  Trash2,
  Search,
  Filter,
  SortAsc,
  Calendar,
  Edit2,
  AlertCircle,
  RefreshCw,
  WifiOff,
  UserX,
  ShieldAlert
} from "lucide-react";

import { api } from "../utils/api";
import { saveResultToProfile } from "../services/profileService";
import { SAMPLE_PROFILES } from "../data/sampleProfiles";
import { ResumeItemResult } from "../types/profile";
import { UsageLimitLocked, UsageLimitStrip } from "../components/UsageLimitBanner";
import { 
  trackFeatureStart, 
  trackFeatureCompletion 
} from "../services/featureService";

import { BulletDiff } from "../components/BulletDiff";
import { downloadResumeAsPDF, downloadCoverLetterAsPDF } from "../utils/resumeToolsPdfExport";

export default function ResumeToolsPage() {
  const { user, isLoggedIn, updateProfile } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [tab, setTab] = useState<"upload" | "manual">(
    searchParams.get("mode") === "manual" ? "manual" : "upload"
  );
  
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Pre-fill from user profile
  useEffect(() => {
    if (user) {
      setFullName(`${user.firstName || ''} ${user.lastName || ''}`.trim());
      setEmail(user.email || "");
      setCurrentRole(user.role || "");
      if (user.skills && Array.isArray(user.skills)) {
        setSkills(user.skills);
      }
    }
  }, [user]);

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

  const clearManualForm = () => {
    setFullName("");
    setEmail("");
    setCurrentRole("");
    setEducation("");
    setExperienceYears("1-3 years");
    setSkills([]);
    setSkillInput("");
    setWorkHistory("");
    setSummary("");
  };

  // ── Try Sample Data — fills BOTH the resume AND a matching job description,
  // since this feature rewrites a resume against a specific job posting (unlike
  // parser.tsx, which only needs the resume + a target role). Profiles live in
  // ../data/sampleProfiles.ts (shared with parser.tsx) so both features offer
  // the same role choices with internally-coherent resume/job pairs.
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
    setJobDescription(profile.jobDescription);
    setJobTitle(profile.jobTitle);
    setCompany(profile.company);
    setError(null);
    setShowSamplePicker(false);
  };
  
  const [jobDescription, setJobDescription] = useState("");
  const [resumeTitle, setResumeTitle] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [tone, setTone] = useState("Professional");
  
  const [selectedMode, setSelectedMode] = useState<"rewrite" | "cover_letter" | "both">("rewrite");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStatus, setParseStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const [results, setResults] = useState<{
    rewrite?: any;
    coverLetter?: any;
  } | null>(null);

  const [savedItems, setSavedItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'savedItems'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSavedItems(items);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/savedItems`);
    });

    return () => unsubscribe();
  }, [user]);

  const [showSaved, setShowSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{[key: string]: boolean}>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "resume" | "cover_letter" | "bullet" | "summary">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title" | "company">("date");

  const [editingBulletIndex, setEditingBulletIndex] = useState<number | null>(null);
  const [editedBulletText, setEditedBulletText] = useState("");

  const handleEditBullet = (index: number, text: string) => {
    setEditingBulletIndex(index);
    setEditedBulletText(text);
  };

  const handleSaveBulletEdit = (index: number) => {
    if (!results?.rewrite?.bullets) return;
    
    const newBullets = [...results.rewrite.bullets];
    newBullets[index] = { ...newBullets[index], rewritten: editedBulletText };
    
    setResults({
      ...results,
      rewrite: {
        ...results.rewrite,
        bullets: newBullets
      }
    });
    setEditingBulletIndex(null);
  };

  const handleCancelBulletEdit = () => {
    setEditingBulletIndex(null);
    setEditedBulletText("");
  };

  const filteredItems = savedItems
    .filter(item => {
      const matchesSearch = 
        item.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.company.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || item.type === filterType;
      
      const itemDate = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
      const matchesStartDate = !startDate || itemDate >= new Date(startDate);
      const matchesEndDate = !endDate || itemDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999));
      
      return matchesSearch && matchesType && matchesStartDate && matchesEndDate;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      }
      if (sortBy === "title") return a.jobTitle.localeCompare(b.jobTitle);
      if (sortBy === "company") return a.company.localeCompare(b.company);
      return 0;
    });

  const handleSave = async (type: 'resume' | 'cover_letter' | 'bullet' | 'summary', data: any, id?: string) => {
    if (!user) return;

    const newItem = {
      type,
      data,
      timestamp: serverTimestamp(),
      resumeTitle: resumeTitle || "",
      jobTitle: jobTitle || "Untitled Position",
      company: company || "Unknown Company",
      userId: user.uid
    };

    const statusKey = id ? `${type}-${id}` : type;

    try {
      await addDoc(collection(db, 'users', user.uid, 'savedItems'), newItem);
      
      // Also save to consolidated profile results
      const profileResult: ResumeItemResult = {
        id: `res-${Date.now()}`,
        type: 'resume-tool',
        subType: type === 'resume' ? 'resume' : type === 'cover_letter' ? 'cover-letter' : 'bullets',
        title: `${type.charAt(0).toUpperCase() + type.slice(1)}: ${jobTitle}`,
        jobTitle: jobTitle || "Untitled Position",
        company: company || "Unknown Company",
        timestamp: new Date().toISOString(),
        data: data
      };
      await saveResultToProfile(user.uid, profileResult);

      setSaveStatus(prev => ({ ...prev, [statusKey]: true }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [statusKey]: false })), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/savedItems`);
    }
  };

  const deleteSavedItem = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'savedItems', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/savedItems/${id}`);
    }
  };

  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedLetter, setCopiedLetter] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [resumeCopied, setResumeCopied] = useState(false);
  const [copiedBullet, setCopiedBullet] = useState(false);

  if (!isLoggedIn || !user) return null;

  // ── Usage limit ───────────────────────────────────────────────────────────
  const usedCount = (user as any)?.savedResumeItems?.length ?? 0;
  const LIMIT = 5;
  const isLocked = usedCount >= LIMIT;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
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

  const handleCopy = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const buildOptimizedResume = (rewrite: any) => {
    const lines: string[] = [];

    if (rewrite.tailoredSummary) {
      lines.push("PROFESSIONAL SUMMARY");
      lines.push("─".repeat(40));
      lines.push(rewrite.tailoredSummary);
      lines.push("");
    }

    if (rewrite.bullets?.length > 0) {
      lines.push("EXPERIENCE HIGHLIGHTS");
      lines.push("─".repeat(40));
      rewrite.bullets.forEach((b: any) => {
        lines.push(`• ${b.rewritten}`);
      });
      lines.push("");
    }

    if (rewrite.skillsToHighlight?.length > 0) {
      lines.push("KEY SKILLS");
      lines.push("─".repeat(40));
      lines.push(rewrite.skillsToHighlight.join(" • "));
      lines.push("");
    }

    if (rewrite.topJobKeywords?.length > 0) {
      lines.push("ATS KEYWORDS");
      lines.push("─".repeat(40));
      lines.push(rewrite.topJobKeywords.join(", "));
    }

    return lines.join("\n");
  };

  const downloadResume = (text: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "optimized-resume.txt";
    a.click();
    URL.revokeObjectURL(url);
  };


  const handleSubmit = async () => {
    let resumeText = "";

    if (tab === "upload") {
      if (!file) {
        setError("Please upload your resume first.");
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

    if (!jobDescription.trim()) {
      setError("Please provide a job description.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults(null);
    
    // Track feature start
    await trackFeatureStart(user.uid, "resume-tools", "Resume Tools");

    const overallStartTime = performance.now();
    try {
      if (tab === "upload" && file) {
        setParseStatus("Reading resume file...");
        setParseProgress(10);
        resumeText = await extractTextFromFile(file, (percent) => {
          setParseProgress(Math.floor(10 + percent * 0.3)); // 10% to 40% is extraction
          if (percent > 80) setParseStatus("Finalizing text extraction...");
          else setParseStatus("Extracting content from pages...");
        });
      }
      
      const extractionEndTime = performance.now();
      console.log(`[ResumeTools] Extraction phase took ${((extractionEndTime - overallStartTime) / 1000).toFixed(2)}s`);
      
      // Truncate to prevent payload too large or AI context window issues
      if (resumeText.length > 10000) {
        resumeText = resumeText.substring(0, 10000);
      }
      
      setParseStatus("Sending to AI for processing...");
      setParseProgress(50);
      
      let data = await api.resumeTools(
        user.uid,
        selectedMode,
        resumeText,
        jobDescription || "Not provided",
        jobTitle || "Not provided",
        company || "Not provided",
        tone,
        user.firstName
      );

      setParseStatus("Analyzing results...");
      setParseProgress(80);
      
      // Aggressive unwrap helper
      const unwrapData = (d: any): any => {
        if (!d) return d;
        let current = d;
        
        // 1. Handle Array/n8n style
        if (Array.isArray(current) && current.length > 0) {
          current = current[0];
        }
        
        // 2. Common wrapper keys
        if (current.json) current = current.json;
        if (current.data && typeof current.data === 'object' && !current.rewrite && !current.coverLetter) current = current.data;
        if (current.output && typeof current.output === 'object') current = current.output;
        if (current.result && typeof current.result === 'object') current = current.result;
        
        // 3. String JSON parsing
        if (typeof current === 'string' && (current.trim().startsWith('{') || current.trim().startsWith('['))) {
          try {
            current = JSON.parse(current);
            return unwrapData(current);
          } catch (e) { /* ignore */ }
        }
        
        // 4. Exhaustive key search if we don't have known keys
        if (typeof current === 'object' && !current.rewrite && !current.coverLetter && !current.fullResume && !current.fullText) {
          const keys = Object.keys(current);
          
          // If only one key, it's likely a wrapper
          if (keys.length === 1) {
            const val = current[keys[0]];
            if (val && typeof val === 'object') return unwrapData(val);
            if (val && typeof val === 'string' && val.length > 50) return val; // Assume it's the result
          }
          
          // Search for any key containing 'resume', 'letter', 'rewrite', 'output'
          for (const key of keys) {
            const kl = key.toLowerCase();
            if (kl.includes('resume') || kl.includes('letter') || kl.includes('rewrite') || kl.includes('output') || kl.includes('result')) {
               const val = current[key];
               if (val && (typeof val === 'string' || typeof val === 'object')) return val;
            }
          }
        }
        
        return current;
      };

      data = unwrapData(data);
      console.log("Deeply unwrapped data:", data);
      
      // Look for results in various locations
      let rewrite = data.rewrite || data.rewrittenText || data.rewrittenResume || data.optimizedResume || data.output_resume;
      let coverLetter = data.coverLetter || data.letter || data.cover_letter || data.generated_letter;
      
      // If the unwrapped data itself is a string, assign it to either rewrite or coverLetter based on mode
      if (typeof data === 'string' && data.length > 50) {
        if (selectedMode === 'rewrite') rewrite = data;
        else if (selectedMode === 'cover_letter') coverLetter = data;
        else rewrite = data;
      }
      
      // If we found strings but the UI expects objects, wrap them
      if (typeof rewrite === 'string') {
        rewrite = { fullResume: rewrite, atsScoreBefore: 0, atsScoreAfter: 0, atsScoreDelta: 0 };
      }
      if (typeof coverLetter === 'string') {
        coverLetter = { fullText: coverLetter, matchScore: 0 };
      }
      
      // Final fallback: if nothing found but we have top level content
      if (!rewrite && !coverLetter && data.content) {
        if (selectedMode === 'rewrite') rewrite = { fullResume: data.content };
        else if (selectedMode === 'cover_letter') coverLetter = { fullText: data.content };
        else rewrite = { fullResume: data.content };
      }

      const hasResults = !!(rewrite || coverLetter);
      
      if (hasResults) {
        setResults({
          rewrite: rewrite || null,
          coverLetter: coverLetter || null
        });

        // Save skills to user profile
        if (isLoggedIn && user) {
          let allNewSkills: string[] = [];

          // Skills from AI response (if rewrite mode)
          if (rewrite && rewrite.skillsToHighlight && Array.isArray(rewrite.skillsToHighlight)) {
            allNewSkills = [...allNewSkills, ...rewrite.skillsToHighlight];
          }

          // Skills from manual entry (if manual tab)
          if (tab === "manual" && skills.length > 0) {
            allNewSkills = [...allNewSkills, ...skills];
          }

          if (allNewSkills.length > 0 && isLoggedIn && user) {
            const currentSkills = user.skills || [];
            const mergedSkills = Array.from(new Set([...currentSkills, ...allNewSkills.map(s => String(s))]));
            
            if (mergedSkills.length > currentSkills.length) {
              updateProfile({ skills: mergedSkills });
            }
          }
        }

        setParseProgress(100);
        setParseStatus("Complete!");

        // Track feature completion
        await trackFeatureCompletion(
          user.uid,
          "resume-tools",
          "Resume Tools",
          () => {}
        );
      } else {
        let errorMsg = data.error || data.message || "Failed to process resume";
        if (typeof errorMsg === 'string' && errorMsg.includes('"resumeText":')) {
          errorMsg = "The AI service failed to process this resume. Please try a different resume or check your inputs.";
        }
        throw new Error(errorMsg);
      }
      
    } catch (err: any) {
      console.error(err);
      let errorMessage = typeof err === 'string' ? err : (err.message || "An error occurred while processing your request.");
      
      if (typeof errorMessage === 'string' && (
        errorMessage.includes('resumeText') || 
        errorMessage.includes('{"') ||
        errorMessage.length > 300
      )) {
        errorMessage = "The AI service failed to process this request. This often happens if the input is too long or the server is busy. Please try again or use a shorter version.";
      }
      setError(errorMessage);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
      }, 500);
    }
  };

  const getErrorInfo = (err: string) => {
    if (err.includes("timed out")) {
      return {
        type: "Timeout Error",
        icon: <WifiOff className="h-5 w-5" />,
        description: "The AI service is taking longer than expected. This usually happens with very long resumes or high server load.",
        tips: [
          "Try with a shorter version of your resume",
          "Check your internet connection",
          "Try again in a few minutes"
        ]
      };
    }
    
    if (err.includes("404") || err.includes("Not Found")) {
      return {
        type: "Service Unavailable",
        icon: <ShieldAlert className="h-5 w-5" />,
        description: "The processing service could not be reached. There might be a configuration issue with the service URL.",
        tips: [
          "Wait a few moments and try again",
          "If you are an admin, check the RESUME_TOOLS_SERVICE_URL secret",
          "Try the manual entry mode"
        ]
      };
    }

    if (err.includes("401") || err.includes("Unauthorized") || err.includes("API key")) {
      return {
        type: "Authentication Error",
        icon: <UserX className="h-5 w-5" />,
        description: "There was a problem authenticating with the AI service.",
        tips: [
          "Check if your API keys are correctly set in the environment",
          "Ensure the service token matches the expected value",
          "Contact support if the issue persists"
        ]
      };
    }

    return {
      type: "Processing Error",
      icon: <AlertCircle className="h-5 w-5" />,
      description: err || "An unexpected error occurred while processing your request.",
      tips: [
        "Try refreshing the page",
        "Ensure you've filled out all required fields",
        "Try a different resume file"
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
        className="overflow-hidden mt-6 mb-10"
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

  return (
    <DashboardLayout title="Resume Tools" showBackButton backPath="/parser">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Usage limit — locked screen */}
        {isLocked && <UsageLimitLocked feature="Resume Tools" limit={LIMIT} />}

        {/* Usage strip — show when 1 remaining */}
        {!isLocked && <UsageLimitStrip feature="Resume Tools" limit={LIMIT} used={usedCount} />}

        {!isLocked && (
          <>
            <div className="relative overflow-hidden rounded-[2rem] p-6 flex justify-between items-center gap-4">
          <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-30" />
          <div className="absolute -top-20 -left-12 w-[320px] h-[240px] bg-primary-violet/10 rounded-full blur-[110px] pointer-events-none" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary-purple mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-purple animate-pulse-violet" />
              AI-tailored optimization
            </span>
            <h1 className="font-display text-2xl font-semibold text-text-primary">Optimize Your Application</h1>
            <p className="text-sm text-text-secondary">Tailor your resume and cover letter to any job description</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowSaved(!showSaved)}
            className="relative z-10 flex items-center gap-2"
          >
            <History className="h-4 w-4" />
            {showSaved ? "Hide History" : "View Saved"}
            {savedItems.length > 0 && (
              <span className="ml-1 bg-primary-purple text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {savedItems.length}
              </span>
            )}
          </Button>
        </div>

        {showSaved && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5 text-primary-purple" />
                Saved History
              </h2>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-secondary" />
                  <Input 
                    placeholder="Search by title or company..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs w-full md:w-64"
                  />
                </div>
                
                <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
                  <Button 
                    variant={filterType === "all" ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => setFilterType("all")}
                    className="h-7 text-[10px] px-2"
                  >
                    All
                  </Button>
                  <Button 
                    variant={filterType === "resume" ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => setFilterType("resume")}
                    className="h-7 text-[10px] px-2"
                  >
                    Resumes
                  </Button>
                  <Button 
                    variant={filterType === "cover_letter" ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => setFilterType("cover_letter")}
                    className="h-7 text-[10px] px-2"
                  >
                    Letters
                  </Button>
                  <Button 
                    variant={filterType === "bullet" ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => setFilterType("bullet")}
                    className="h-7 text-[10px] px-2"
                  >
                    Bullets
                  </Button>
                  <Button 
                    variant={filterType === "summary" ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => setFilterType("summary")}
                    className="h-7 text-[10px] px-2"
                  >
                    Summaries
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <SortAsc className="h-4 w-4 text-text-secondary" />
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-card border border-border rounded-lg h-9 px-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-purple"
                  >
                    <option value="date">Newest First</option>
                    <option value="title">Job Title</option>
                    <option value="company">Company</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-card/50 p-3 rounded-xl border border-border/50">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary-purple" />
                <span className="text-xs font-medium">Filter by Date:</span>
              </div>
              <div className="flex items-center gap-2">
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-[10px] w-32"
                />
                <span className="text-xs text-text-secondary">to</span>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-[10px] w-32"
                />
                {(startDate || endDate) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setStartDate(""); setEndDate(""); }}
                    className="h-7 px-2 text-[10px] text-danger hover:bg-danger/10"
                  >
                    Clear Dates
                  </Button>
                )}
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <p className="text-sm text-text-secondary italic">
                  {savedItems.length === 0 
                    ? "No saved items yet. Generate and save results to see them here."
                    : "No items match your search or filter criteria."}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="p-4 hover:border-primary-purple/30 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {item.type === 'resume' ? (
                          <div className="p-1.5 rounded bg-primary-purple/10">
                            <FileText className="h-4 w-4 text-primary-purple" />
                          </div>
                        ) : item.type === 'cover_letter' ? (
                          <div className="p-1.5 rounded bg-primary-blue/10">
                            <Mail className="h-4 w-4 text-primary-blue" />
                          </div>
                        ) : item.type === 'summary' ? (
                          <div className="p-1.5 rounded bg-amber-500/10">
                            <Sparkles className="h-4 w-4 text-amber-500" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded bg-success/10">
                            <Sparkles className="h-4 w-4 text-success" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-display text-sm font-semibold truncate max-w-[150px]">
                            {item.type === 'bullet' ? 'Saved Bullet' : item.type === 'summary' ? 'Saved Summary' : (item.resumeTitle || item.jobTitle)}
                          </h4>
                          <p className="text-[10px] text-text-secondary truncate max-w-[200px]">
                            {item.type === 'bullet' ? item.data.rewritten : item.type === 'summary' ? item.data : (item.resumeTitle ? `${item.jobTitle} @ ${item.company}` : item.company)}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteSavedItem(item.id)}
                        className="p-1 text-text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                        <Calendar className="h-3 w-3" />
                        {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString() : new Date(item.timestamp).toLocaleDateString()}
                      </div>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => {
                          if (item.type === 'bullet') {
                            handleCopy(item.data.rewritten, setCopiedBullet);
                            return;
                          }
                          if (item.type === 'summary') {
                            handleCopy(item.data, setCopiedSummary);
                            return;
                          }
                          setResults(prev => ({
                            ...prev,
                            [item.type === 'resume' ? 'rewrite' : 'coverLetter']: item.data
                          }));
                          setShowSaved(false);
                          // Scroll to results
                          window.scrollTo({ top: 800, behavior: 'smooth' });
                        }}
                        className="text-[10px] h-7"
                      >
                        {item.type === 'bullet' ? (copiedBullet ? "Copied!" : "Copy Bullet") : item.type === 'summary' ? (copiedSummary ? "Copied!" : "Copy Summary") : "Restore"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            <div className="border-b border-border pb-8"></div>
          </motion.div>
        )}
        
        {/* SHARED INPUTS */}
        <Card className="p-6">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary-purple" />
                Your Resume
              </h2>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed mb-6">
              Upload your current resume or enter your details manually.
            </p>

            {/* Tab Switcher */}
            <div className="flex gap-4 border-b border-border mb-6">
              <button 
                type="button"
                onClick={() => setTab("upload")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "upload" ? "border-primary-blue text-primary-blue" : "border-transparent text-text-secondary hover:text-text-primary"}`}
              >
                Upload Resume
              </button>
              <button 
                type="button"
                onClick={() => setTab("manual")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "manual" ? "border-primary-blue text-primary-blue" : "border-transparent text-text-secondary hover:text-text-primary"}`}
              >
                Enter Manually
              </button>
            </div>

            {/* Try Sample Data — fills both the resume AND a matching job
                description, so users can see the rewrite/cover-letter output
                instantly without needing a real resume + job posting. */}
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

            {/* File Upload / Manual Form Container */}
            <div className="mb-6">
              {tab === "upload" ? (
                /* File Upload */
                <div 
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                    isDragging ? "border-primary-purple bg-primary-purple/10" : "border-border hover:border-text-secondary bg-background"
                  } ${file ? "border-success/50 bg-success/5" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
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

                  <div className="col-span-full">
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
                      className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-blue h-20 resize-y"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Years of Experience</label>
                    <select 
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg p-3 text-sm text-text-primary focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                    >
                      <option value="0-1 years">0-1 years</option>
                      <option value="1-3 years">1-3 years</option>
                      <option value="3-5 years">3-5 years</option>
                      <option value="5-10 years">5-10 years</option>
                      <option value="10+ years">10+ years</option>
                    </select>
                  </div>

                  <div className="col-span-full">
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

                  <div className="col-span-full">
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Work Experience / Job History</label>
                    <textarea 
                      value={workHistory}
                      onChange={(e) => setWorkHistory(e.target.value)}
                      placeholder="e.g. 2 years at Acme Corp as React Developer, built dashboard apps..."
                      className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-blue h-28 resize-y"
                    />
                  </div>

                  <div className="col-span-full">
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Summary / About</label>
                    <textarea 
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Brief professional summary..."
                      className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-blue h-20 resize-y"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearManualForm}
                      className="text-text-secondary hover:text-danger hover:bg-danger/5 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Clear Form
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Job Description */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Job Description</label>
              <textarea 
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job posting here..."
                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-blue min-h-[120px] resize-y"
              />
            </div>

            {/* Resume Title */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Resume Title (Optional)</label>
              <Input 
                value={resumeTitle}
                onChange={(e) => setResumeTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Resume - V1"
              />
            </div>

            {/* Job Title & Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Job Title</label>
                <Input 
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Frontend Developer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Company Name</label>
                <Input 
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                />
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-blue"
              >
                <option value="Professional">Professional</option>
                <option value="Conversational">Conversational</option>
                <option value="Bold">Bold</option>
              </select>
            </div>

            {/* MODE SELECTOR */}
            <div className="pt-4 border-t border-border">
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setSelectedMode("rewrite")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    selectedMode === "rewrite" 
                      ? "bg-primary-purple text-white shadow-lg" 
                      : "bg-card text-text-secondary border border-border hover:border-primary-purple/50"
                  }`}
                >
                  Rewrite Resume
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMode("cover_letter")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    selectedMode === "cover_letter" 
                      ? "bg-primary-purple text-white shadow-lg" 
                      : "bg-card text-text-secondary border border-border hover:border-primary-purple/50"
                  }`}
                >
                  Cover Letter
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMode("both")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all flex items-center ${
                    selectedMode === "both" 
                      ? "bg-primary-purple text-white shadow-lg" 
                      : "bg-card text-text-secondary border border-border hover:border-primary-purple/50"
                  }`}
                >
                  Both
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ml-1.5 ${
                    selectedMode === "both" ? "bg-white/20 text-white" : "bg-primary-purple/10 text-primary-purple"
                  }`}>
                    Most Popular
                  </span>
                </button>
              </div>
              <p className="text-xs text-text-secondary text-center mt-2">
                Select what you want to generate from your resume
              </p>
            </div>

            {renderError()}

            {isProcessing && (
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

            {/* ACTION BUTTON */}
            <Button 
              onClick={handleSubmit} 
              className="w-full mt-4" 
              disabled={isProcessing}
            >
              {selectedMode === "rewrite" && <><FileText className="h-4 w-4 mr-2" /> Rewrite Resume</>}
              {selectedMode === "cover_letter" && <><Mail className="h-4 w-4 mr-2" /> Generate Cover Letter</>}
              {selectedMode === "both" && <><Sparkles className="h-4 w-4 mr-2" /> Rewrite & Generate Letter</>}
            </Button>
          </div>
        </Card>

        {/* RESULTS SECTION */}
        {results && (
          <div className="space-y-8 pb-12">
            
            {/* RESUME REWRITER RESULTS */}
            {results.rewrite && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
                  <FileText className="h-6 w-6 text-primary-purple" />
                  Resume Optimization Result
                </h2>

                {/* ATS Score - only show if scores are present and non-zero */}
                {results.rewrite.atsScoreAfter > 0 && (
                  <Card className="p-6">
                    <h3 className="font-display font-semibold mb-4">ATS Compatibility Score</h3>
                    <div className="flex items-end gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-text-secondary">Before</span>
                          <span className="font-medium">{results.rewrite.atsScoreBefore}/100</span>
                        </div>
                        <div className="w-full bg-border rounded-full h-3 overflow-hidden">
                          <div className="bg-danger/40 h-full rounded-full" style={{ width: `${results.rewrite.atsScoreBefore}%` }} />
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-text-secondary">After</span>
                          <span className="font-medium">{results.rewrite.atsScoreAfter}/100</span>
                        </div>
                        <div className="w-full bg-border rounded-full h-3 overflow-hidden">
                          <div className="bg-success h-full rounded-full" style={{ width: `${results.rewrite.atsScoreAfter}%` }} />
                        </div>
                      </div>
                      <div className="bg-success/20 text-success font-bold px-3 py-1.5 rounded-lg text-sm mb-1">
                        +{results.rewrite.atsScoreDelta} pts
                      </div>
                    </div>
                  </Card>
                )}

                {/* Tailored Summary */}
                {results.rewrite.tailoredSummary && (
                  <Card className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-display font-semibold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary-purple" />
                        Tailored Summary
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => handleCopy(results.rewrite.tailoredSummary, setCopiedSummary)}
                        >
                          {copiedSummary ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          <span className="ml-2">{copiedSummary ? "Copied!" : "Copy"}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSave('summary', results.rewrite.tailoredSummary)}
                          className="flex items-center gap-2"
                        >
                          {saveStatus['summary'] 
                            ? <><Check className="h-3.5 w-3.5 text-success" /> Saved</>
                            : <><Save className="h-3.5 w-3.5" /> Save</>
                          }
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-text-primary bg-background p-4 rounded-md border border-border">
                      {results.rewrite.tailoredSummary}
                    </p>
                  </Card>
                )}

                {/* Skills to Highlight / Remove */}
                <div className="grid md:grid-cols-2 gap-6">
                  {results.rewrite.skillsToHighlight && results.rewrite.skillsToHighlight.length > 0 && (
                    <Card className="p-6 border-success/20">
                      <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        Skills to Highlight
                      </h3>
                      <ul className="space-y-2">
                        {results.rewrite.skillsToHighlight.map((skill: string, i: number) => (
                          <li key={i} className="text-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-success" />
                            {skill}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                  {results.rewrite.skillsToRemove && results.rewrite.skillsToRemove.length > 0 && (
                    <Card className="p-6 border-danger/20">
                      <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                        <X className="h-5 w-5 text-danger" />
                        Skills to Remove
                      </h3>
                      <ul className="space-y-2">
                        {results.rewrite.skillsToRemove.map((skill: string, i: number) => (
                          <li key={i} className="text-sm flex items-center gap-2 text-text-secondary line-through">
                            <div className="w-1.5 h-1.5 rounded-full bg-danger" />
                            {skill}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>

                {/* Red Flags */}
                {results.rewrite.redFlags && results.rewrite.redFlags.length > 0 && (
                  <Card className="p-6 bg-danger/5 border-danger/20">
                    <h3 className="font-display font-semibold text-danger mb-4 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Red Flags Detected
                    </h3>
                    <ul className="space-y-2">
                      {results.rewrite.redFlags.map((flag: string, i: number) => (
                        <li key={i} className="text-sm text-danger flex items-start gap-2">
                          <span className="mt-1">•</span>
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Format Tips */}
                {results.rewrite.formatTips && results.rewrite.formatTips.length > 0 && (
                  <Card className="p-6 bg-primary-blue/5 border-primary-blue/20">
                    <h3 className="font-display font-semibold text-primary-blue mb-4 flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      Formatting Tips
                    </h3>
                    <ul className="space-y-2">
                      {results.rewrite.formatTips.map((tip: string, i: number) => (
                        <li key={i} className="text-sm text-primary-blue flex items-start gap-2">
                          <span className="mt-1">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Bullets */}
                {results.rewrite.bullets && results.rewrite.bullets.length > 0 && (
                  <div>
                    <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary-purple" />
                      Optimized Experience Bullets
                    </h3>
                    <div className="space-y-4">
                      {results.rewrite.bullets.map((bullet: any, i: number) => (
                        <Card key={i} className="p-5 border-border/50 hover:border-primary-purple/30 transition-colors">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary-purple/10 flex items-center justify-center text-[10px] font-bold text-primary-purple">
                                {i + 1}
                              </div>
                              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Bullet Optimization</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger/10 text-danger">{bullet.scoreBefore || 0}</span>
                              <ArrowRight className="h-3 w-3 text-text-secondary" />
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success/10 text-success">{bullet.scoreAfter || 0}</span>
                            </div>
                          </div>
                          
                          {editingBulletIndex === i ? (
                            <div className="space-y-3">
                              <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                                <p className="font-mono text-[10px] text-text-secondary uppercase tracking-widest mb-2">Original</p>
                                <p className="text-sm text-text-secondary italic">{bullet.original}</p>
                              </div>
                              <div className="space-y-2">
                                <p className="font-mono text-[10px] text-primary-purple uppercase tracking-widest">Rewritten (Editing)</p>
                                <textarea 
                                  value={editedBulletText}
                                  onChange={(e) => setEditedBulletText(e.target.value)}
                                  className="w-full p-3 text-sm min-h-[100px] rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary-purple/20 focus:border-primary-purple transition-all resize-none bg-white"
                                  placeholder="Edit your optimized bullet point..."
                                />
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={handleCancelBulletEdit}
                                    className="h-8 text-xs"
                                    type="button"
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    variant="primary" 
                                    size="sm" 
                                    onClick={() => handleSaveBulletEdit(i)}
                                    className="h-8 text-xs bg-primary-purple hover:bg-primary-purple/90 text-white"
                                    type="button"
                                  >
                                    Save Changes
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="group relative">
                              <BulletDiff original={bullet.original} rewritten={bullet.rewritten} />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditBullet(i, bullet.rewritten)}
                                className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white shadow-sm border border-border opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                title="Edit Bullet"
                                type="button"
                              >
                                <Edit2 className="h-3.5 w-3.5 text-primary-purple" />
                              </Button>
                            </div>
                          )}
                          
                          {bullet.keywordsAdded && bullet.keywordsAdded.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5 items-center">
                              <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest mr-1">Added Keywords:</span>
                              {bullet.keywordsAdded.map((kw: string, j: number) => (
                                <span key={j} className="bg-primary-purple/10 text-primary-purple text-[10px] font-medium rounded-full px-2 py-0.5 border border-primary-purple/20">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-4 flex justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleSave('bullet', bullet, i.toString())}
                              className="h-7 text-[10px] flex items-center gap-1.5 text-primary-purple hover:bg-primary-purple/5"
                            >
                              {saveStatus[`bullet-${i}`] ? (
                                <><Check className="h-3 w-3 text-success" /> Saved to Profile</>
                              ) : (
                                <><Save className="h-3 w-3" /> Save Bullet</>
                              )}
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optimized Full Text */}
                {(results.rewrite.fullResume || results.rewrite.tailoredSummary || results.rewrite.bullets?.length > 0) && (() => {
                  const optimizedText = results.rewrite.fullResume || buildOptimizedResume(results.rewrite);
                  if (!optimizedText) return null;
                  return (
                    <Card className="p-6 border-primary-purple/30 bg-primary-purple/5">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-primary-purple" />
                        <h3 className="font-display font-semibold text-primary-purple">Your Optimized Resume</h3>
                      </div>
                      <p className="text-xs text-text-secondary mb-4">
                        Here is your fully rewritten resume ready to copy or download
                      </p>

                      <div className="bg-background border border-border rounded-xl p-5 font-mono text-sm text-text-primary whitespace-pre-wrap max-h-[500px] overflow-y-auto mb-4">
                        {optimizedText}
                      </div>

                      <div className="flex gap-3">
                        <Button
                          variant="secondary"
                          onClick={() => handleCopy(optimizedText, setResumeCopied)}
                          className="flex items-center gap-2"
                        >
                          {resumeCopied
                            ? <><Check className="h-4 w-4" /> Copied!</>
                            : <><Copy className="h-4 w-4" /> Copy Full Resume</>
                          }
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleSave('resume', results.rewrite)}
                          className="flex items-center gap-2"
                        >
                          {saveStatus['resume'] 
                            ? <><Check className="h-4 w-4 text-success" /> Saved!</>
                            : <><Save className="h-4 w-4" /> Save to Profile</>
                          }
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => downloadResume(optimizedText)}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" /> Download as .txt
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => downloadResumeAsPDF(results.rewrite, { fullName, jobTitle, company, fallbackName: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : undefined })}
                          className="flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" /> Download as PDF
                        </Button>
                      </div>
                    </Card>
                  );
                })()}
              </motion.div>
            )}

            {/* DIVIDER FOR BOTH MODE */}
            {results.rewrite && results.coverLetter && (
              <div className="relative my-12">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-4 text-sm font-medium text-text-secondary flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Cover Letter
                  </span>
                </div>
              </div>
            )}

            {/* COVER LETTER RESULTS */}
            {results.coverLetter && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
                    <Mail className="h-6 w-6 text-primary-blue" />
                    Cover Letter
                  </h2>
                  {results.coverLetter.matchScore && (
                    <div className={`flex items-center justify-center w-12 h-12 rounded-full border-4 font-bold text-sm ${
                      results.coverLetter.matchScore > 75 ? 'border-success text-success' :
                      results.coverLetter.matchScore >= 50 ? 'border-warning text-warning' :
                      'border-danger text-danger'
                    }`}>
                      {results.coverLetter.matchScore}
                    </div>
                  )}
                </div>

                {/* Subject Line */}
                {results.coverLetter.subject && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Email Subject</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-sm font-medium">
                        {results.coverLetter.subject}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary" 
                          onClick={() => handleCopy(results.coverLetter.subject, setCopiedSubject)}
                        >
                          {copiedSubject ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleSave('summary', results.coverLetter.subject, 'cl-subject')}
                          className="flex items-center gap-1.5"
                        >
                          {saveStatus['summary-cl-subject'] 
                            ? <><Check className="h-3.5 w-3.5 text-success" /></>
                            : <><Save className="h-3.5 w-3.5" /></>
                          }
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Keywords */}
                {results.coverLetter.keywordsCovered && results.coverLetter.keywordsCovered.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-2">Keywords Used</label>
                    <div className="flex flex-wrap gap-2">
                      {results.coverLetter.keywordsCovered.map((kw: string, i: number) => (
                        <span key={i} className="bg-primary-purple/10 text-primary-purple text-xs rounded-full px-2.5 py-1 font-medium">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Letter */}
                {results.coverLetter.fullText && (
                  <Card className="p-6 relative">
                    <div className="whitespace-pre-wrap text-sm text-text-primary mb-6 font-serif leading-relaxed">
                      {results.coverLetter.fullText}
                    </div>
                    
                    <div className="flex justify-between items-end mt-6 pt-4 border-t border-border">
                      <span className="text-xs text-text-secondary">
                        {results.coverLetter.wordCount} words
                      </span>
                      <div className="flex gap-3 items-end">
                        <Button 
                          variant="secondary" 
                          onClick={() => handleCopy(results.coverLetter.fullText, setCopiedLetter)}
                          className="flex-1"
                        >
                          {copiedLetter ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                          {copiedLetter ? "Copied!" : "Copy Full Letter"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleSave('cover_letter', results.coverLetter)}
                          className="flex-1"
                        >
                          {saveStatus['cover_letter'] 
                            ? <><Check className="h-4 w-4 text-success mr-2" /> Saved!</>
                            : <><Save className="h-4 w-4 mr-2" /> Save to Profile</>
                          }
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => downloadCoverLetterAsPDF(results.coverLetter, { fullName, company, fallbackName: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : undefined })}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" /> Download as PDF
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Section Breakdown */}
                <div className="grid md:grid-cols-3 gap-4">
                  {results.coverLetter.whyThisRole && (
                    <Card className="p-4 bg-card/50">
                      <h4 className="font-mono text-xs text-text-secondary uppercase tracking-wider mb-2">Why This Role</h4>
                      <p className="text-sm">{results.coverLetter.whyThisRole}</p>
                    </Card>
                  )}
                  {results.coverLetter.whyThisCompany && (
                    <Card className="p-4 bg-card/50">
                      <h4 className="font-mono text-xs text-text-secondary uppercase tracking-wider mb-2">Why This Company</h4>
                      <p className="text-sm">{results.coverLetter.whyThisCompany}</p>
                    </Card>
                  )}
                  {results.coverLetter.proofParagraph && (
                    <Card className="p-4 bg-card/50">
                      <h4 className="font-mono text-xs text-text-secondary uppercase tracking-wider mb-2">Proof Paragraph</h4>
                      <p className="text-sm">{results.coverLetter.proofParagraph}</p>
                    </Card>
                  )}
                </div>

              </motion.div>
            )}

          </div>
        )}
      </>
    )}
  </div>
    </DashboardLayout>
  );
}