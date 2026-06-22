import { DashboardLayout } from "../components/DashboardLayout";
import { Card } from "../components/Card";
import { Map, Target, ArrowRight, Flame, Activity, Leaf, BookOpen, AlertTriangle, Check, X, Download, Loader2, Sparkles } from "lucide-react";
import { Button } from "../components/Button";
import { motion } from "motion/react";
import { useUser } from "../context/UserContext";
import React, { useEffect, useState, useRef } from "react";
import { LearningCard } from "../components/LearningCard";
import { useNavigate } from "react-router-dom";
import { gapDataService } from "../services/gapDataService";
import { api } from "../utils/api";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
import { useToast } from "../components/Toast";
import { 
  trackFeatureStart, 
  trackFeatureCompletion 
} from "../services/featureService";

const CircularProgress = ({ score }: { score: number }) => {
  const color = score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-danger";
  const strokeColor = score >= 80 ? "stroke-success" : score >= 50 ? "stroke-warning" : "stroke-danger";
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          className="stroke-border"
          strokeWidth="8"
          fill="transparent"
          r={radius}
          cx="50"
          cy="50"
        />
        <circle
          className={`${strokeColor} transition-all duration-1000 ease-out`}
          strokeWidth="8"
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx="50"
          cy="50"
          style={{ strokeDasharray: circumference, strokeDashoffset }}
        />
      </svg>
      <div className={`absolute text-2xl font-bold ${color}`}>
        {score}
      </div>
    </div>
  );
};

export default function GapMapPage() {
  const { isLoggedIn, user, updateProfile, fullName } = useUser();
  const navigate = useNavigate();
  const { success } = useToast();
  const [data, setData] = useState<any>(null);
  const [sortBy, setSortBy] = useState<"skill" | "title">("skill");
  const [completedResources, setCompletedResources] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // ── Explain This Gap state — for the "Explain this gap" click-to-expand on
  // each missing/critical skill tag. Server also caches by content hash
  // across users (see /api/explain-skill-gap), so most clicks are free.
  const [gapExplanations, setGapExplanations] = useState<Record<string, { whyItMatters: string; ifYouSkipIt: string }>>({});
  const [explainingGap, setExplainingGap] = useState<string | null>(null);
  const [activeGapSkill, setActiveGapSkill] = useState<string | null>(null);

  const handleExplainGap = async (skill: string, priority: "high" | "medium" | "low") => {
    if (activeGapSkill === skill) {
      setActiveGapSkill(null); // toggle closed
      return;
    }
    setActiveGapSkill(skill);
    if (gapExplanations[skill]) return; // already loaded this session
    setExplainingGap(skill);
    try {
      const result = await api.explainSkillGap({ skill, priority, targetRole: (user as any)?.role || undefined });
      setGapExplanations((prev) => ({ ...prev, [skill]: result.explanation }));
    } catch {
      setGapExplanations((prev) => ({
        ...prev,
        [skill]: { whyItMatters: "Couldn't load explanation right now — try again in a moment.", ifYouSkipIt: "" },
      }));
    } finally {
      setExplainingGap(null);
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      // Capture the element as a PNG
      const dataUrl = await toPng(reportRef.current, { 
        cacheBust: true, 
        backgroundColor: '#f9fafb',
        style: {
          padding: '20px'
        }
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // If content is longer than one page, we might need multiple pages, 
      // but for a summary report, one page often suffices if scaled.
      // For simplicity, we scale to fit width.
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`SkillSync_GapMap_${fullName?.replace(/\s+/g, '_') || 'User'}.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isLoggedIn) return null;

  useEffect(() => {
    if (!isLoggedIn || !user) {
      setData(null);
      return;
    }
    
    const fetchData = async () => {
      const firestoreData = await gapDataService.getGapData(user.uid);
      if (firestoreData) {
        setData(firestoreData);
        if (firestoreData.completedResources) {
          setCompletedResources(new Set(firestoreData.completedResources));
        }
      } else {
        // Fallback to legacy localStorage if no Firestore data exists yet
        const storedData = localStorage.getItem("skillsync_data");
        if (storedData) {
          try {
            let parsed = JSON.parse(storedData);
            if (Array.isArray(parsed)) {
              let merged = {};
              parsed.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                  const toMerge = item.data ? item.data : item;
                  merged = { ...merged, ...toMerge };
                }
              });
              parsed = merged;
            }
            if (parsed && parsed.data) {
              parsed = parsed.data;
            }
            setData(parsed);
          } catch (e) {
            console.error("Failed to parse stored data", e);
          }
        }
      }
    };

    fetchData();

    // Track feature start
    if (user?.uid) {
      trackFeatureStart(user.uid, "gapmap", "Skill Gap Map");
    }
  }, [isLoggedIn, user]);

  const triggerCompletion = async () => {
    if (user?.uid) {
      await trackFeatureCompletion(
        user.uid,
        "gapmap",
        "Skill Gap Map",
        () => {}
      );
    }
  };

  // Update profile with learning path when data is loaded
  useEffect(() => {
    if (data && user) {
      const technicalSkills = data.skillGaps?.technicalSkills || { high: [], medium: [], low: [] };
      let learningResources = [...(data.learningResources || [])];
      
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

      const missingSkills = extractArray(data, ["missing skills", "missingSkills", "missing_skills"]);
      
      if (missingSkills.length > 0) {
        const extractedResources = missingSkills
          .filter((skill: any) => typeof skill === 'object' && (skill['video url'] || skill.videoUrl || skill.url || skill.link || skill.video_url))
          .map((skill: any) => ({
            skillName: skill.skill || skill.name || skill.title || "Missing Skill",
            learnUrl: skill['video url'] || skill.videoUrl || skill.url || skill.link || skill.video_url,
            title: skill.title || skill.description || skill.skill || skill.name
          }));
          
        if (extractedResources.length > 0) {
          const existingUrls = new Set(learningResources.map((r: any) => r.learnUrl));
          extractedResources.forEach((r: any) => {
            if (!existingUrls.has(r.learnUrl)) {
              learningResources.push(r);
              existingUrls.add(r.learnUrl);
            }
          });
        }
      }

      if (learningResources.length > 0) {
        // Only update if it's different from what's currently in the profile
        const currentPathUrls = new Set((user.learningPath || []).map(r => r.learnUrl));
        const hasNewResources = learningResources.some(r => !currentPathUrls.has(r.learnUrl));
        
        if (hasNewResources) {
          const cleanResources = learningResources.map(r => ({
            skillName: r.skillName || r.skill || r.name || "Skill",
            learnUrl: r.learnUrl || r.url || r.link || "",
            title: r.title || r.skillName || "Learning Resource"
          })).filter(r => r.learnUrl);
          
          updateProfile({ learningPath: cleanResources });
        }
      }
    }
  }, [data, user, updateProfile]);

  if (!data) {
    return (
      <DashboardLayout title="SkillSync GapMap" showBackButton backPath="/parser">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="p-4 bg-warning/10 text-warning rounded-full mb-4">
            <AlertTriangle className="h-12 w-12" />
          </div>
          <div className="flex flex-col items-center justify-center py-24 text-center max-w-lg mx-auto">
            <div className="p-6 bg-primary-purple/10 rounded-[2rem] mb-8">
              <Map className="h-16 w-16 text-primary-purple mx-auto" />
            </div>
            <h2 className="font-display text-3xl font-semibold text-text-heading uppercase tracking-tight mb-3">
              No Gap Analysis Yet
            </h2>
            <p className="text-text-body font-medium mb-8 leading-relaxed">
              Upload your resume and search for a target role to see exactly which skills you're missing and what to learn next.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button
                onClick={() => navigate('/parser')}
                className="flex-1 bg-accent hover:bg-accent/90 text-text-heading font-black uppercase tracking-widest rounded-2xl h-12 justify-center gap-2"
              >
                <ArrowRight className="h-4 w-4" /> Upload Resume
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/parser?mode=manual')}
                className="flex-1 border-border text-text-body font-black uppercase tracking-widest rounded-2xl h-12 justify-center"
              >
                Enter Manually
              </Button>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-body/30 mt-6">
              Tip: Complete the Skill Assessment first for better gap analysis
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const technicalSkills = data.skillGaps?.technicalSkills || { high: [], medium: [], low: [] };
  let learningResources = [...(data.learningResources || [])];
  
  const extractArray = (obj: any, possibleKeys: string[]) => {
    if (!obj) return [];
    
    // Check direct keys first
    for (const key of possibleKeys) {
      if (obj[key]) {
        const val = obj[key];
        if (Array.isArray(val)) return val;
        if (typeof val === 'object') return Object.values(val);
        if (typeof val === 'string') return val.split(',').map(s => s.trim());
      }
    }
    
    // Check case-insensitive and without spaces/underscores
    const normalizedKeys = possibleKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
    for (const key of Object.keys(obj)) {
      const normalizedObjKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKeys.includes(normalizedObjKey)) {
        const val = obj[key];
        if (Array.isArray(val)) return val;
        if (typeof val === 'object') return Object.values(val);
        if (typeof val === 'string') return val.split(',').map(s => s.trim());
      }
    }
    
    return [];
  };

  const extractObject = (obj: any, possibleKeys: string[]) => {
    if (!obj) return null;
    
    for (const key of possibleKeys) {
      if (obj[key]) return obj[key];
    }
    
    const normalizedKeys = possibleKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
    for (const key of Object.keys(obj)) {
      const normalizedObjKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKeys.includes(normalizedObjKey)) {
        return obj[key];
      }
    }
    
    return null;
  };

  const missingSkills = extractArray(data, ["missing skills", "missingSkills", "missing_skills"]);
  const aggregatedSkillsObj = extractObject(data, ["aggregated skills", "aggregatedSkills", "aggregated_skills"]);
  
  // Fallback to array if it's not the new object format
  const aggregatedSkills = Array.isArray(aggregatedSkillsObj) ? aggregatedSkillsObj : extractArray(data, ["aggregated skills", "aggregatedSkills", "aggregated_skills"]);
  
  const hasAggregatedSkillsObj = aggregatedSkillsObj && !Array.isArray(aggregatedSkillsObj) && aggregatedSkillsObj.jobSkills;
  
  // Extract learning resources from missingSkills if they have video urls
  if (missingSkills.length > 0) {
    const extractedResources = missingSkills
      .filter((skill: any) => typeof skill === 'object' && (skill['video url'] || skill.videoUrl || skill.url || skill.link || skill.video_url))
      .map((skill: any) => ({
        skillName: skill.skill || skill.name || skill.title || "Missing Skill",
        learnUrl: skill['video url'] || skill.videoUrl || skill.url || skill.link || skill.video_url,
        title: skill.title || skill.description || skill.skill || skill.name
      }));
      
    if (extractedResources.length > 0) {
      // Merge with existing resources, avoiding duplicates by URL
      const existingUrls = new Set(learningResources.map((r: any) => r.learnUrl));
      extractedResources.forEach((r: any) => {
        if (!existingUrls.has(r.learnUrl)) {
          learningResources.push(r);
          existingUrls.add(r.learnUrl);
        }
      });
    }
  }

  const hasNewFormat = missingSkills.length > 0 || aggregatedSkills.length > 0;

  const toggleResourceComplete = async (url: string) => {
    if (!user) return;
    
    const newCompleted = new Set(completedResources);
    if (newCompleted.has(url)) {
      newCompleted.delete(url);
    } else {
      newCompleted.add(url);
    }
    
    setCompletedResources(newCompleted);
    
    // Persist to Firestore
    try {
      await gapDataService.saveGapData(user.uid, {
        ...data,
        completedResources: Array.from(newCompleted)
      });
    } catch (error) {
      console.error("Failed to save completion status", error);
    }
  };

  const sortedLearningResources = [...learningResources].sort((a, b) => {
    if (sortBy === "skill") {
      const skillA = (a.skillName || a.skill || a.name || "").toLowerCase();
      const skillB = (b.skillName || b.skill || b.name || "").toLowerCase();
      return skillA.localeCompare(skillB);
    } else {
      const titleA = (a.title || a.skillName || a.skill || a.name || "").toLowerCase();
      const titleB = (b.title || b.skillName || b.skill || b.name || "").toLowerCase();
      return titleA.localeCompare(titleB);
    }
  });

  const currentProgress = learningResources.length > 0 
    ? Math.round((completedResources.size / learningResources.length) * 100) 
    : 0;

  const handleExportPDF = () => {
    // Before printing, briefly show user a "Print Preview" toast
    success(
      "Print Preview Mode",
      "Tip: In the print dialog, select 'Save as PDF' to export digitally"
    );

    const container = document.querySelector('.gapmap-container');
    if (container) {
      container.setAttribute('data-date', new Date().toLocaleDateString());
      container.setAttribute('data-progress', currentProgress.toString());
    }

    // Briefly delay window.print() to allow the toast to appear
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <DashboardLayout title="SkillSync GapMap" showBackButton backPath="/parser">
      <style>{`
        @media print {
          /* Reset background to white */
          * {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }

          /* Hide buttons and non-essential UI */
          button,
          aside,
          nav,
          header,
          footer,
          .chat-button,
          .scan-again-btn,
          .start-learning-btn,
          .nav-bar,
          .feedback-button,
          .toast-container,
          .export-btn {
            display: none !important;
          }

          /* Fix layout to full page width */
          .gapmap-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
          }

          /* Skill tags should be visible */
          .skill-tag {
            border: 1px solid #333 !important;
            background: #f5f5f5 !important;
            color: #000 !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            display: inline-block !important;
            margin: 4px !important;
          }

          /* Grid to single column for cards */
          .skills-grid {
            display: block !important;
            columns: 2 !important;
          }

          /* Gap score prominent */
          .gap-score {
            font-size: 48px !important;
            color: #000 !important;
            font-weight: bold !important;
          }

          /* HIGH/MEDIUM DEMAND labels */
          .high-demand-label {
            color: #c00 !important;
            font-weight: bold !important;
          }
          .medium-demand-label {
            color: #e60 !important;
            font-weight: bold !important;
          }

          /* Learning path cards */
          .learning-path-card {
            border: 1px solid #ccc !important;
            border-radius: 8px !important;
            padding: 12px !important;
            margin-bottom: 8px !important;
            background: white !important;
            break-inside: avoid !important;
          }

          /* Progress bar as text instead */
          .progress-bar-container::after {
            content: "Progress: " attr(data-progress) "%";
            display: block !important;
            font-weight: bold !important;
          }
          .progress-bar {
            display: none !important;
          }

          /* Page settings */
          @page {
            size: A4 portrait;
            margin: 20mm;
          }

          /* Add header with app name */
          .gapmap-container::before {
            content: "SkillSync AI — Skill Gap Analysis Report";
            display: block !important;
            font-size: 20px !important;
            font-weight: bold !important;
            margin-bottom: 16px !important;
            border-bottom: 2px solid #000 !important;
            padding-bottom: 8px !important;
          }

          /* Add generated date at bottom */
          .gapmap-container::after {
            content: "Generated on: " attr(data-date);
            display: block !important;
            font-size: 12px !important;
            color: #666 !important;
            margin-top: 24px !important;
            border-top: 1px solid #ccc !important;
            padding-top: 8px !important;
          }
        }
      `}</style>
      <div className="max-w-5xl mx-auto space-y-8 gapmap-container" ref={reportRef}>
        
        <Card className="relative overflow-hidden p-6 bg-gradient-to-r from-card to-success/5 border-success/20">
          <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-30" />
          <div className="absolute -top-20 -right-12 w-[320px] h-[240px] bg-primary-violet/10 rounded-full blur-[110px] pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/20 rounded-xl text-success">
                <Map className="h-8 w-8" />
              </div>
              <div>
                <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary-purple mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-purple animate-pulse-violet" />
                  Live analysis
                </span>
                <h2 className="font-display text-xl font-semibold">Your Skill Gap Analysis</h2>
                <p className="text-text-secondary flex items-center gap-2">
                  Based on your recent resume scan
                </p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
              {learningResources.length > 0 && (
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary mb-1">Learning Progress</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 bg-border rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary-purple transition-all duration-500" 
                        style={{ width: `${(completedResources.size / learningResources.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-primary-purple">
                      {Math.round((completedResources.size / learningResources.length) * 100)}%
                    </span>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={handleExportPDF}
                  className="export-btn flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest bg-accent hover:bg-accent/90 text-near-black h-10 px-4 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow"
                >
                  📄 Export as PDF
                </button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    downloadPDF();
                    triggerCompletion();
                  }} 
                  disabled={isDownloading}
                  className="flex items-center gap-2 border-primary-purple/30 text-primary-purple hover:bg-primary-purple/5"
                >
                  <Download className={`h-4 w-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                  {isDownloading ? 'Generating...' : 'Download PDF'}
                </Button>
                <Button variant="outline" onClick={() => navigate('/parser')}>Scan Another Resume</Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Skill Gaps Section */}
        {hasAggregatedSkillsObj ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex flex-col items-center justify-center shrink-0">
                  <h3 className="font-display font-semibold text-text-primary mb-4">Gap Score</h3>
                  <CircularProgress score={aggregatedSkillsObj.gapScore || 0} />
                </div>
                
                <div className="flex-1 space-y-6">
                  <div>
                    <h3 className="font-display font-semibold text-text-primary mb-3">Job Skills</h3>
                    <div className="space-y-3">
                      {['high', 'medium', 'low'].map((level) => {
                        const skills = aggregatedSkillsObj.jobSkills[level] || [];
                        if (skills.length === 0) return null;
                        
                        const levelColor = level === 'high' ? 'text-danger' : level === 'medium' ? 'text-warning' : 'text-success';
                        
                        return (
                          <div key={level} className="flex flex-col sm:flex-row sm:items-start gap-2">
                            <span className={`font-mono text-xs uppercase w-28 shrink-0 mt-1.5 ${levelColor} ${level === 'high' ? 'high-demand-label' : level === 'medium' ? 'medium-demand-label' : ''}`}>{level} Demand</span>
                            <div className="flex flex-wrap gap-2">
                              {skills.map((skill: string, i: number) => {
                                const hasSkill = (aggregatedSkillsObj.candidateSkills || []).some((s: string) => s.toLowerCase() === skill.toLowerCase());
                                return (
                                  <span key={i} className={`skill-tag px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 border ${hasSkill ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
                                    {skill}
                                    {hasSkill ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-display font-semibold text-text-primary mb-3">My Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {(aggregatedSkillsObj.candidateSkills || []).map((skill: string, i: number) => {
                        const isJobSkill = ['high', 'medium', 'low'].some(level => 
                          (aggregatedSkillsObj.jobSkills[level] || []).some((s: string) => s.toLowerCase() === skill.toLowerCase())
                        );
                        
                        return (
                          <span key={i} className={`skill-tag px-3 py-1.5 rounded-full text-xs font-medium border ${isJobSkill ? 'bg-primary-blue/10 text-primary-blue border-primary-blue/30' : 'bg-card text-text-secondary border-border'}`}>
                            {skill}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : hasNewFormat ? (
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="p-6 h-full border-danger/30 bg-gradient-to-br from-card to-danger/5">
                <h3 className="font-display font-semibold text-danger mb-4 flex items-center gap-2">
                  <Flame className="h-5 w-5" />
                  Missing Skills
                </h3>
                <p className="text-sm text-text-secondary mb-4">Skills required for the role that are missing from your resume.</p>
                <div className="flex flex-wrap gap-2">
                  {missingSkills.length > 0 ? (
                    missingSkills.map((skill: any, i: number) => {
                      const skillName = typeof skill === 'object' ? (skill.skill || skill.name || JSON.stringify(skill)) : skill;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleExplainGap(skillName, "high")}
                          className={`skill-tag px-3 py-1.5 rounded-md bg-danger/10 text-danger border border-danger/20 font-bold text-sm hover:bg-danger/20 transition-colors cursor-pointer ${activeGapSkill === skillName ? "ring-2 ring-offset-1 ring-danger" : ""}`}
                        >
                          {skillName}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-sm text-text-secondary italic">No missing skills found.</span>
                  )}
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="p-6 h-full border-success/30 bg-gradient-to-br from-card to-success/5">
                <h3 className="font-display font-semibold text-success mb-4 flex items-center gap-2">
                  <Leaf className="h-5 w-5" />
                  Aggregated Skills
                </h3>
                <p className="text-sm text-text-secondary mb-4">Skills we identified from your resume.</p>
                <div className="flex flex-wrap gap-2">
                  {aggregatedSkills.length > 0 ? (
                    aggregatedSkills.map((skill: any, i: number) => {
                      const skillName = typeof skill === 'object' ? (skill.skill || skill.name || JSON.stringify(skill)) : skill;
                      return (
                        <span key={i} className="skill-tag px-3 py-1.5 rounded-md bg-success/10 text-success border border-success/20 text-sm font-medium">
                          {skillName}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-sm text-text-secondary italic">No aggregated skills found.</span>
                  )}
                </div>
              </Card>
            </motion.div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="p-6 h-full border-danger/30 bg-gradient-to-br from-card to-danger/5">
                <h3 className="font-display font-semibold text-danger mb-4 flex items-center gap-2">
                  <Flame className="h-5 w-5" />
                  High Priority Gaps
                </h3>
                <p className="text-sm text-text-secondary mb-4">Critical skills missing for this role.</p>
                <div className="flex flex-wrap gap-2">
                  {technicalSkills.high?.length > 0 ? (
                    technicalSkills.high.map((skill: any, i: number) => {
                      const skillName = typeof skill === 'object' ? (skill.skill || skill.name || JSON.stringify(skill)) : skill;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleExplainGap(skillName, "high")}
                          className={`skill-tag px-3 py-1.5 rounded-md bg-danger/10 text-danger border border-danger/20 font-bold text-sm hover:bg-danger/20 transition-colors cursor-pointer ${activeGapSkill === skillName ? "ring-2 ring-offset-1 ring-danger" : ""}`}
                        >
                          {skillName}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-sm text-text-secondary italic">No high priority gaps found.</span>
                  )}
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="p-6 h-full border-warning/30 bg-gradient-to-br from-card to-warning/5">
                <h3 className="font-display font-semibold text-warning mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Medium Priority Gaps
                </h3>
                <p className="text-sm text-text-secondary mb-4">Valuable additions to your profile.</p>
                <div className="flex flex-wrap gap-2">
                  {technicalSkills.medium?.length > 0 ? (
                    technicalSkills.medium.map((skill: any, i: number) => {
                      const skillName = typeof skill === 'object' ? (skill.skill || skill.name || JSON.stringify(skill)) : skill;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleExplainGap(skillName, "medium")}
                          className={`skill-tag px-3 py-1.5 rounded-md bg-warning/10 text-warning border border-warning/20 font-medium text-sm hover:bg-warning/20 transition-colors cursor-pointer ${activeGapSkill === skillName ? "ring-2 ring-offset-1 ring-warning" : ""}`}
                        >
                          {skillName}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-sm text-text-secondary italic">No medium priority gaps found.</span>
                  )}
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="p-6 h-full border-success/30 bg-gradient-to-br from-card to-success/5">
                <h3 className="font-display font-semibold text-success mb-4 flex items-center gap-2">
                  <Leaf className="h-5 w-5" />
                  Low Priority Gaps
                </h3>
                <p className="text-sm text-text-secondary mb-4">Niche or emerging skills.</p>
                <div className="flex flex-wrap gap-2">
                  {technicalSkills.low?.length > 0 ? (
                    technicalSkills.low.map((skill: any, i: number) => {
                      const skillName = typeof skill === 'object' ? (skill.skill || skill.name || JSON.stringify(skill)) : skill;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleExplainGap(skillName, "low")}
                          className={`skill-tag px-3 py-1.5 rounded-md bg-success/10 text-success border border-success/20 text-sm hover:bg-success/20 transition-colors cursor-pointer ${activeGapSkill === skillName ? "ring-2 ring-offset-1 ring-success" : ""}`}
                        >
                          {skillName}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-sm text-text-secondary italic">No low priority gaps found.</span>
                  )}
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Explain This Gap — shared panel, shows whichever skill tag was clicked */}
        {activeGapSkill && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="overflow-hidden"
          >
            <Card className="p-5 border-primary-blue/30 bg-primary-blue/5 flex gap-4 items-start">
              <div className="h-9 w-9 rounded-xl bg-primary-blue/10 border border-primary-blue/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-widest text-primary-blue mb-2">
                  Why "{activeGapSkill}" matters
                </p>
                {explainingGap === activeGapSkill ? (
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span className="text-sm animate-pulse">Analyzing this gap...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {gapExplanations[activeGapSkill]?.whyItMatters && (
                      <p className="text-sm text-text-primary leading-relaxed">
                        {gapExplanations[activeGapSkill].whyItMatters}
                      </p>
                    )}
                    {gapExplanations[activeGapSkill]?.ifYouSkipIt && (
                      <p className="text-sm text-text-primary leading-relaxed">
                        <strong className="text-primary-blue">If you skip it: </strong>
                        {gapExplanations[activeGapSkill].ifYouSkipIt}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setActiveGapSkill(null)}
                className="text-text-secondary hover:text-text-primary transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </Card>
          </motion.div>
        )}

        {/* Learning Resources Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <h3 className="font-display text-xl font-semibold flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-primary-purple" />
                  Learning Path
                </h3>
                <p className="text-sm text-text-secondary">Track your progress as you master the required skills.</p>
              </div>
              
              {learningResources.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-text-secondary whitespace-nowrap">Sort by:</label>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "skill" | "title")}
                    className="h-9 rounded-md border border-border bg-background px-3 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  >
                    <option value="skill">Skill Name</option>
                    <option value="title">Title</option>
                  </select>
                </div>
              )}
            </div>
            
            {sortedLearningResources.length > 0 ? (
              <div className="space-y-6">
                {/* Progress Bar */}
                <div className="bg-background border border-border rounded-xl p-4 progress-bar-container" data-progress={Math.round((completedResources.size / sortedLearningResources.length) * 100)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-secondary">Overall Progress</span>
                    <span className="text-sm font-bold text-primary-purple">
                      {Math.round((completedResources.size / sortedLearningResources.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-border rounded-full overflow-hidden progress-bar">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(completedResources.size / sortedLearningResources.length) * 100}%` }}
                      className="h-full bg-primary-purple"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 skills-grid">
                  {sortedLearningResources.map((resource: any, index: number) => {
                    const url = resource.learnUrl || resource.url || resource.link || resource['video url'] || resource.videoUrl || resource.video_url;
                    return (
                      <LearningCard 
                        key={index}
                        skillName={resource.skillName || resource.skill || resource.name}
                        learnUrl={url}
                        title={resource.title}
                        isCompleted={completedResources.has(url)}
                        onToggleComplete={() => toggleResourceComplete(url)}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-border rounded-xl">
                <BookOpen className="h-12 w-12 text-text-secondary opacity-20 mx-auto mb-3" />
                <h4 className="font-display text-lg font-semibold mb-1">No resources found</h4>
                <p className="text-text-secondary text-sm">We couldn't find specific learning resources for your skill gaps.</p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Action Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex justify-center pb-8">
          <Button size="lg" onClick={() => navigate('/parser')} className="flex items-center gap-2">
            Scan Resume Again
            <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>

      </div>
    </DashboardLayout>
  );
}