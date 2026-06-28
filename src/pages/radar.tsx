import { DashboardLayout } from "../components/DashboardLayout";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { SkillTag } from "../components/SkillTag";
import { Search, Radar as RadarIcon, Flame, Activity, Leaf, Code, Users, AlertTriangle, ExternalLink, RefreshCw, Briefcase, Sparkles, ArrowRight, History, X, Loader2 } from "lucide-react";
import { JobCard } from "../components/JobCard";
import { useUser } from "../context/UserContext";
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { storage } from "../services/storage";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../utils/api";
import { saveResultToProfile } from "../services/profileService";
import { RadarAnalysisResult } from "../types/profile";
import { 
  trackFeatureStart, 
  trackFeatureCompletion 
} from "../services/featureService";
import { UsageLimitLocked, UsageLimitStrip } from "../components/UsageLimitBanner";

export default function RadarPage() {
  const { user, isLoggedIn, updateProfile } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [jobs, setJobs] = useState<any[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // ── Usage limit ───────────────────────────────────────────────────────────
  const usedCount = (user as any)?.metadata?.usageCounts?.radar ?? 0;
  const LIMIT = 5;
  const isLocked = usedCount >= LIMIT;
  const [role, setRole] = useState("Frontend Developer");
  
  if (!isLoggedIn || !user) return null;
  const [country, setCountry] = useState("Worldwide");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);
  const [salary, setSalary] = useState<any>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [hasLoadedRadar, setHasLoadedRadar] = useState(false);

  // ── Explain Trend state — for the "Explain this trend" click-to-expand on
  // each skill tag. Cached client-side per skill so re-clicking the same tag
  // within this session doesn't re-call the API (server also caches by
  // content hash across users/sessions — see /api/explain-trend).
  const [trendExplanations, setTrendExplanations] = useState<Record<string, { whyTrending: string; whatsDrivingDemand: string }>>({});
  const [explainingTrend, setExplainingTrend] = useState<string | null>(null);
  const [activeTrendSkill, setActiveTrendSkill] = useState<string | null>(null);

  const handleExplainTrend = async (skill: string, tier: "high" | "medium" | "low") => {
    if (activeTrendSkill === skill) {
      setActiveTrendSkill(null); // toggle closed
      return;
    }
    setActiveTrendSkill(skill);
    if (trendExplanations[skill]) return; // already loaded this session
    setExplainingTrend(skill);
    try {
      const result = await api.explainTrend({ skill, tier, role, country });
      setTrendExplanations((prev) => ({ ...prev, [skill]: result.explanation }));
    } catch {
      setTrendExplanations((prev) => ({
        ...prev,
        [skill]: { whyTrending: "Couldn't load explanation right now — try again in a moment.", whatsDrivingDemand: "" },
      }));
    } finally {
      setExplainingTrend(null);
    }
  };
  
  const [structuredData, setStructuredData] = useState({
    technical: {
      high: [],
      medium: [],
      low: []
    },
    soft: {
      high: [],
      medium: [],
      low: []
    }
  });

  // Sync saved job IDs on user.savedJobs changes
  useEffect(() => {
    if (!user) return;
    const existing: any[] = (user as any).savedJobs || [];
    setSavedJobIds(new Set(existing.map((j: any) => j.id)));
  }, [user?.uid, (user as any)?.savedJobs]);

  const handleSaveJob = async (job: any) => {
    if (!user) return;
    const jobId = `job-${job.jobTitle}-${job.company}`.replace(/\s+/g, "-").toLowerCase();
    if (savedJobIds.has(jobId)) return;

    const savedJob = {
      id: jobId,
      jobTitle: job.jobTitle || "",
      company: job.company || "",
      location: job.location || "",
      applyLink: job.applyLink || "",
      matchScore: job.matchScore || 90,
      isRemote: job.isRemote || false,
      employmentType: job.employmentType || "",
      savedAt: new Date().toISOString(),
      status: "saved",
    };

    const existing: any[] = (user as any).savedJobs || [];
    const updated = [savedJob, ...existing].slice(0, 50); // keep last 50 saved jobs

    try {
      await updateProfile?.({ savedJobs: updated } as any);
      setSavedJobIds(prev => new Set([...prev, jobId]));
      setSaveToast(`"${job.jobTitle}" saved!`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.error("[Radar] Failed to save job:", err);
    }
  };

  // Resume handler
  const handleResumeSaved = () => {
    const parsed = storage.get("skillsync_last_radar") as any;
    if (parsed) {
      setRole(parsed.data.role);
      setCountry(parsed.data.country);
      setStructuredData(parsed.data.structuredData);
      setSalary(parsed.data.salary);
      setJobs(parsed.data.jobs || []);
      setHasLoadedRadar(true);
      setShowResumeBanner(false);
    }
  };

  useEffect(() => {
    const saved = storage.get("skillsync_last_radar");
    const state = location.state as { autoResume?: boolean } | null;
    const shouldAutoResume = state?.autoResume;

    if (saved && !hasLoadedRadar) {
      if (shouldAutoResume) {
        const parsed = saved as any;
        setRole(parsed.data.role);
        setCountry(parsed.data.country);
        setStructuredData(parsed.data.structuredData);
        setSalary(parsed.data.salary);
        setJobs(parsed.data.jobs || []);
        setHasLoadedRadar(true);
        setShowResumeBanner(false);
      } else {
        setShowResumeBanner(true);
      }
    }
  }, [hasLoadedRadar, location.state]);

  // ── Deep-linked search (e.g. from the chatbot: /radar?role=Frontend+Developer) ──
  // Pre-fills the role/country from the URL and runs the search automatically,
  // so the user lands on results instead of a blank form they have to fill in.
  const autoSearchRoleRef = React.useRef<string | null>(null);
  const hasAutoSearchedRef = React.useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleParam = params.get("role");
    const countryParam = params.get("country");
    if (roleParam && roleParam.trim()) {
      autoSearchRoleRef.current = roleParam.trim();
      setRole(roleParam.trim());
      if (countryParam && countryParam.trim()) setCountry(countryParam.trim());
    }
    // Only meant to run once, on the URL the page was loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      autoSearchRoleRef.current &&
      role === autoSearchRoleRef.current &&
      !hasAutoSearchedRef.current &&
      !hasLoadedRadar
    ) {
      hasAutoSearchedRef.current = true;
      handleSearch({ preventDefault: () => {} } as React.FormEvent);
    }
  }, [role, hasLoadedRadar]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim()) return;
    
    setIsSearching(true);
    setHasLoadedRadar(true);
    setError(null);
    setWebhookMessage(null);
    setSalary(null);
    
    // Track feature start
    await trackFeatureStart(user.uid, "radar", "Market Radar");

    try {
      const response = await api.getTrendingSkills(user.uid, role, country);

      // ── Normalize radar response ──────────────────────────────────────────
      // The response can arrive in several shapes depending on whether it came
      // from Gemini, OpenAI, n8n, or a cached result. This single function
      // handles all of them and always returns a flat data object.
      const normalizeRadarResponse = (raw: any): {
        parsedData: Record<string, any>;
        message: string | null;
      } => {
        if (!raw) return { parsedData: {}, message: null };

        // Step 1 — safely parse a JSON string if needed
        const tryParse = (val: any): any => {
          if (typeof val !== "string") return val;
          try { return JSON.parse(val); } catch { return val; }
        };

        // Step 2 — flatten: n8n often wraps in [{json: {...}}] or [{...}]
        let flat: any = raw;
        if (Array.isArray(flat)) {
          // Merge all array items into one object (handles multi-item n8n arrays)
          flat = flat.reduce((acc: any, item: any) => {
            const src = tryParse(item?.json ?? item);
            return typeof src === "object" && src !== null
              ? { ...acc, ...src }
              : acc;
          }, {});
        }

        // Step 3 — unwrap .json string wrapper if present
        if (flat?.json) flat = tryParse(flat.json);

        // Step 4 — unwrap .data wrapper if present
        if (flat?.data && typeof flat.data === "object") flat = flat.data;

        // Step 5 — ensure we have a plain object
        flat = tryParse(flat);
        if (typeof flat !== "object" || flat === null) flat = {};

        // Step 6 — extract status message
        const message: string | null =
          flat.rawText ?? flat.message ?? null;

        return { parsedData: flat, message };
      };

      const { parsedData, message: webhookMsg } = normalizeRadarResponse(response);
      console.log("[Radar] Normalized response:", parsedData);

      if (webhookMsg) setWebhookMessage(webhookMsg);

      // Helper: find an array value by trying multiple possible key names
      const getArray = (obj: any, keys: string[]): any[] => {
        if (!obj || typeof obj !== "object") return [];
        for (const key of keys) {
          if (Array.isArray(obj[key]) && obj[key].length > 0) return obj[key];
        }
        return [];
      };

      if (parsedData && Object.keys(parsedData).length > 0) {
        const tech = parsedData.technicalSkills ?? parsedData.technical ?? {};
        const soft = parsedData.softSkills     ?? parsedData.soft      ?? {};

        // Robust salary extraction — try all known key variants
        const extractedSalary =
          parsedData.salary      ??
          parsedData.salaryIntel ??
          parsedData.salary_intel ??
          parsedData.salaryInsights ?? null;

        setSalary(
          extractedSalary && typeof extractedSalary === "object"
            ? extractedSalary
            : null
        );

        const techHigh   = getArray(tech, ["high",   "highDemand",   "core"]);
        const techMedium = getArray(tech, ["medium", "mediumDemand", "rising"]);
        const techLow    = getArray(tech, ["low",    "lowDemand",    "niche"]);

        const softHigh   = getArray(soft, ["high",   "highDemand",   "core"]);
        const softMedium = getArray(soft, ["medium", "mediumDemand", "rising"]);
        const softLow    = getArray(soft, ["low",    "lowDemand",    "niche"]);

        const gotJobs = parsedData.jobs || [];
        setJobs(gotJobs);

        if (techHigh.length || techMedium.length || techLow.length || softHigh.length || softMedium.length || softLow.length) {
          const newStructuredData = {
            technical: { high: techHigh, medium: techMedium, low: techLow },
            soft: { high: softHigh, medium: softMedium, low: softLow }
          };
          setStructuredData(newStructuredData);

          // Results are now on screen — stop the "Scanning the Market..."
          // overlay right here. The remaining steps below (saving to profile,
          // localStorage, completion tracking) are background bookkeeping
          // that involve their own network calls; the user doesn't need to
          // stare at a loading spinner while those finish in the background.
          setIsSearching(false);

          // Save to profile
          const profileResult: RadarAnalysisResult = {
            id: `rad-${Date.now()}`,
            type: 'radar',
            title: `Trend Analysis: ${role}`,
            role: role,
            skills: techHigh,
            timestamp: new Date().toISOString(),
            data: {
              role,
              country,
              structuredData: newStructuredData,
              salary: extractedSalary,
              jobs: gotJobs
            }
          };
          await saveResultToProfile(user.uid, profileResult);

          // Save output to localStorage as requested
          storage.set("skillsync_last_radar", {
            feature: "radar",
            title: `Trend Analysis: ${role}`,
            data: {
              role,
              country,
              structuredData: newStructuredData,
              salary: extractedSalary,
              jobs: gotJobs
            },
            timestamp: new Date().toISOString(),
            path: "/radar"
          } as any);

          // Track feature completion
          await trackFeatureCompletion(
            user.uid,
            "radar",
            "Market Radar",
            () => {}
          );

        } else if (Array.isArray(parsedData)) {
          // Fallback for flat array of strings
          const strings = parsedData.filter(item => typeof item === 'string');
          if (strings.length > 0) {
            const high = strings.slice(0, Math.ceil(strings.length / 3));
            const medium = strings.slice(Math.ceil(strings.length / 3), Math.ceil(strings.length * 2 / 3));
            const low = strings.slice(Math.ceil(strings.length * 2 / 3));
            setStructuredData({ 
              technical: { high, medium, low },
              soft: { high: [], medium: [], low: [] }
            });
          } else {
            // Clear structured data if we couldn't parse it
            setStructuredData({
              technical: { high: [], medium: [], low: [] },
              soft: { high: [], medium: [], low: [] }
            });
          }
        } else {
          // Clear structured data if we couldn't parse it
          setStructuredData({
            technical: { high: [], medium: [], low: [] },
            soft: { high: [], medium: [], low: [] }
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.error || err.message || "Failed to fetch skills from the webhook.";
      setError(errorMessage);
    } finally {
      setIsSearching(false);
    }
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
    <DashboardLayout 
      title="SkillSync Radar" 
      showBackButton 
      backPath="/dashboard"
      actions={
        user?.savedRadarAnalyses && user.savedRadarAnalyses.length > 0 ? (
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
      <div className="max-w-4xl mx-auto">
        {showResumeBanner && !isSearching && (
          <div className="bg-success/10 border border-success/20 rounded-2xl p-4 mb-6 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/20 text-success">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-heading">You have a saved analysis</p>
                <p className="text-xs text-text-secondary">Pick up where you left off with your last radar insights.</p>
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
                className="bg-success text-near-black font-bold"
              >
                Resume Analysis
              </Button>
            </div>
          </div>
        )}
        {/* Usage limit — locked screen */}
        {isLocked && <UsageLimitLocked feature="Market Radar" limit={LIMIT} />}

        {!isLocked && (
          <>
            {/* Usage strip — show when 1 remaining */}
            <UsageLimitStrip feature="Market Radar" limit={LIMIT} used={usedCount} />

            <Card className="relative overflow-hidden p-6 mb-8 bg-gradient-to-r from-card to-primary-blue/5 border-primary-blue/20">
          <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-40" />
          <div className="absolute -top-20 -right-12 w-[320px] h-[260px] bg-primary-violet/10 rounded-full blur-[110px] pointer-events-none" />
          <div className="relative flex items-start gap-4">
            <div className="p-3 bg-primary-blue/20 rounded-xl text-primary-blue">
              <RadarIcon className="h-8 w-8" />
            </div>
            <div>
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary-purple">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-purple animate-pulse-violet" />
                Live scan
              </span>
              <h2 className="font-display text-xl font-semibold mb-2 mt-1">Market Demand Radar</h2>
              <p className="text-text-secondary mb-4">
                Enter a job role to analyze millions of live job postings and discover the most requested skills right now.
              </p>
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-text-secondary" />
                  <Input 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="pl-10 h-11"
                    placeholder="e.g. Frontend Developer, Data Scientist..."
                  />
                </div>
                <div className="relative w-full sm:w-48">
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-blue disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                  >
                    <option value="Worldwide">Worldwide</option>
                    {countriesList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-secondary">
                    <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
                <Button type="submit" disabled={isSearching} className="w-full sm:w-auto h-11 px-8">
                  {isSearching ? "Scanning..." : "Scan Market"}
                </Button>
              </form>
            </div>
          </div>
        </Card>

        {/* Loading State Section */}
        {isSearching && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Card className="p-8 text-center flex flex-col items-center justify-center space-y-4 border-primary-blue/30 bg-primary-blue/5">
              <div className="relative">
                <div className="absolute inset-0 bg-primary-blue/20 blur-2xl rounded-full animate-pulse" />
                <Activity className="h-12 w-12 text-primary-blue animate-bounce relative" />
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold text-text-primary">Scanning the Market...</h3>
                <p className="text-text-secondary mt-1">Analyzing live job postings for {role || "your role"}...</p>
              </div>
              <div className="w-full max-w-xs bg-border rounded-full h-1.5 mt-4 overflow-hidden">
                <motion.div 
                  className="bg-primary-blue h-1.5 rounded-full" 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                />
              </div>
            </Card>
          </motion.div>
        )}

        {/* Error State Section */}
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Card className="p-6 border-danger/30 bg-danger/5">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-danger/10 rounded-full text-danger shrink-0 mt-1">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-semibold text-danger mb-2">
                    {error.toLowerCase().includes("no jobs found") ? "No Matching Results" : "Market Analysis Failed"}
                  </h3>
                  <p className="text-text-primary mb-4 font-medium">
                    {error.toLowerCase().includes("no jobs found")
                      ? "We couldn't find live job postings for this role. Try a broader title, a different country, or check back later."
                      : error}
                  </p>
                  
                  <div className="bg-background rounded-md p-4 border border-border">
                    <h4 className="font-semibold text-sm mb-2 text-text-primary">Troubleshooting Steps:</h4>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-text-secondary">
                      <li>
                        <strong>Service Status:</strong> Verify that the analysis service at <code className="bg-card px-1 py-0.5 rounded text-xs">skillsync-radar-xpywgod6ua-uc.a.run.app</code> is active and accessible.
                      </li>
                      <li>
                        <strong>Authentication:</strong> Ensure the <code className="bg-card px-1 py-0.5 rounded text-xs">API_KEY</code> environment variable is correctly configured in your project secrets.
                      </li>
                      <li>
                        <strong>Network Issues:</strong> Check your internet connection and ensure no firewall rules are blocking the request to the analysis service.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Webhook Message Section */}
        {webhookMessage && (
          <Card className="p-6 mb-8 bg-primary-blue/5 border-primary-blue/20">
            <div className="flex items-start gap-3">
              <Activity className="h-5 w-5 text-primary-blue mt-0.5" />
              <div>
                <h3 className="font-bold text-text-primary mb-1">Service Response</h3>
                <p className="text-text-secondary text-sm whitespace-pre-wrap">{webhookMessage}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Structured Skills Section */}
        <div className="mt-8 space-y-10">
          {/* Empty state — no scan run yet */}
          {!isSearching && !error && structuredData.technical.high.length === 0 && structuredData.technical.medium.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-16 text-center rounded-[2.5rem] border border-dashed border-border bg-bg-card">
                <div className="p-5 bg-primary-blue/10 rounded-full w-fit mx-auto mb-6">
                  <RadarIcon className="h-10 w-10 text-primary-blue" />
                </div>
                <h3 className="font-display text-2xl font-semibold text-text-heading uppercase tracking-tight mb-3">
                  No Market Scan Yet
                </h3>
                <p className="text-text-body font-medium mb-8 max-w-sm mx-auto">
                  Enter a job role above and click "Scan Market" to see which skills are in highest demand right now from live job listings.
                </p>
                <div className="flex flex-wrap gap-2 justify-center text-[10px] font-black uppercase tracking-widest text-text-body/40">
                  <span className="px-3 py-1.5 rounded-full bg-bg-primary border border-white/5">Frontend Developer</span>
                  <span className="px-3 py-1.5 rounded-full bg-bg-primary border border-white/5">Data Scientist</span>
                  <span className="px-3 py-1.5 rounded-full bg-bg-primary border border-white/5">DevOps Engineer</span>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Technical Skills */}
          {(structuredData.technical.high.length > 0 || structuredData.technical.medium.length > 0) && (
            <>
          <section>
            <h2 className="font-display text-2xl font-semibold mb-6 flex items-center gap-2 border-b border-border pb-2">
              <Code className="h-6 w-6 text-primary-blue" />
              Technical Skills
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {/* High Demand */}
              <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <Card className="p-6 h-full border-danger/30 bg-gradient-to-br from-card to-danger/5 shadow-sm hover:shadow-md transition-all">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-danger mb-4 flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5" />
                    High Demand
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {structuredData.technical.high.map((skill, i) => (
                      <SkillTag
                        key={i}
                        name={skill}
                        level="high"
                        isActive={activeTrendSkill === skill}
                        onClick={() => handleExplainTrend(skill, "high")}
                      />
                    ))}
                  </div>
                </Card>
              </motion.div>

              {/* Medium Demand */}
              <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <Card className="p-6 h-full border-warning/30 bg-gradient-to-br from-card to-warning/5 shadow-sm hover:shadow-md transition-all">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-warning mb-4 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5" />
                    Medium Demand
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {structuredData.technical.medium.map((skill, i) => (
                      <SkillTag
                        key={i}
                        name={skill}
                        level="medium"
                        isActive={activeTrendSkill === skill}
                        onClick={() => handleExplainTrend(skill, "medium")}
                      />
                    ))}
                  </div>
                </Card>
              </motion.div>

              {/* Low Demand */}
              <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <Card className="p-6 h-full border-success/30 bg-gradient-to-br from-card to-success/5 shadow-sm hover:shadow-md transition-all">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-success mb-4 flex items-center gap-2">
                    <Leaf className="h-3.5 w-3.5" />
                    Low Demand
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {structuredData.technical.low.map((skill, i) => (
                      <SkillTag
                        key={i}
                        name={skill}
                        level="low"
                        isActive={activeTrendSkill === skill}
                        onClick={() => handleExplainTrend(skill, "low")}
                      />
                    ))}
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* Explain This Trend — shared panel, shows whichever skill tag was clicked */}
            {activeTrendSkill && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 overflow-hidden"
              >
                <Card className="p-5 border-primary-blue/30 bg-primary-blue/5 flex gap-4 items-start">
                  <div className="h-9 w-9 rounded-xl bg-primary-blue/10 border border-primary-blue/20 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-primary-blue mb-2">
                      Why "{activeTrendSkill}" is trending
                    </p>
                    {explainingTrend === activeTrendSkill ? (
                      <div className="flex items-center gap-2 text-text-secondary">
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        <span className="text-sm animate-pulse">Analyzing this trend...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {trendExplanations[activeTrendSkill]?.whyTrending && (
                          <p className="text-sm text-text-primary leading-relaxed">
                            {trendExplanations[activeTrendSkill].whyTrending}
                          </p>
                        )}
                        {trendExplanations[activeTrendSkill]?.whatsDrivingDemand && (
                          <p className="text-sm text-text-primary leading-relaxed">
                            <strong className="text-primary-blue">What's driving it: </strong>
                            {trendExplanations[activeTrendSkill].whatsDrivingDemand}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTrendSkill(null)}
                    className="text-text-secondary hover:text-text-primary transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Card>
              </motion.div>
            )}
          </section>

          {/* Soft Skills */}
          <section>
            <h2 className="font-display text-2xl font-semibold mb-6 flex items-center gap-2 border-b border-border pb-2">
              <Users className="h-6 w-6 text-primary-purple" />
              Soft Skills
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {/* High Demand */}
              <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <Card className="p-6 h-full border-danger/30 bg-gradient-to-br from-card to-danger/5 shadow-sm hover:shadow-md transition-all">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-danger mb-4 flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5" />
                    High Demand
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {structuredData.soft.high.map((skill, i) => (
                      <SkillTag key={i} name={skill} level="high" />
                    ))}
                  </div>
                </Card>
              </motion.div>

              {/* Medium Demand */}
              <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <Card className="p-6 h-full border-warning/30 bg-gradient-to-br from-card to-warning/5 shadow-sm hover:shadow-md transition-all">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-warning mb-4 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5" />
                    Medium Demand
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {structuredData.soft.medium.map((skill, i) => (
                      <SkillTag key={i} name={skill} level="medium" />
                    ))}
                  </div>
                </Card>
              </motion.div>

              {/* Low Demand */}
              <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <Card className="p-6 h-full border-success/30 bg-gradient-to-br from-card to-success/5 shadow-sm hover:shadow-md transition-all">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-success mb-4 flex items-center gap-2">
                    <Leaf className="h-3.5 w-3.5" />
                    Low Demand
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {structuredData.soft.low.map((skill, i) => (
                      <SkillTag key={i} name={skill} level="low" />
                    ))}
                  </div>
                </Card>
              </motion.div>
            </div>
          </section>
            </>
          )} {/* end conditional skills render */}

          {/* Salary Section */}
          {salary && (() => {
            const min = salary.min ?? salary.annualMin ?? salary.min_salary ?? salary.minSalary ?? salary.minimum;
            const max = salary.max ?? salary.annualMax ?? salary.max_salary ?? salary.maxSalary ?? salary.maximum;
            const avg = salary.midpoint ?? salary.avg ?? salary.average ?? salary.median ?? salary.mean;
            const curr = salary.currency ?? salary.currencyCode ?? 'USD';
            const confidence = salary.confidence;
            const note = salary.note;
            
            const formatCurrency = (val: any) => {
              if (val == null) return 'N/A';
              const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]+/g, "")) : Number(val);
              return isNaN(num) ? 'N/A' : num.toLocaleString();
            };

            const source = salary.source ?? "ai_estimate";
            return (
              <section>
                <h2 className="font-display text-2xl font-semibold mb-6 flex items-center gap-2 border-b border-border pb-2">
                  💰 Salary Intel
                </h2>

                <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                  <Card className="p-6 bg-gradient-to-br from-card to-primary-blue/5 border-primary-blue/20">
                    
                    <div className="text-center mb-4">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <p className="text-sm text-text-secondary">Estimated Salary Range</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${source === "listing_data" ? "bg-success/10 text-success border border-success/20" : "bg-warning/10 text-warning border border-warning/20"}`}>
                          {source === "listing_data" ? "📊 Live Data" : "🤖 AI Estimate"}
                        </span>
                      </div>
                      <p className="text-2xl font-bold">
                        {curr} {formatCurrency(min)} – {formatCurrency(max)}
                      </p>
                    </div>

                    <div className="flex justify-between text-sm text-text-secondary">
                      <span>Min: {formatCurrency(min)}</span>
                      <span>Avg: {formatCurrency(avg)}</span>
                      <span>Max: {formatCurrency(max)}</span>
                    </div>

                    {(confidence || note) && (
                      <div className="mt-4 pt-4 border-t border-border/50 text-sm text-text-secondary flex flex-col gap-1">
                        {confidence && (
                          <p className="flex items-center gap-1">
                            <span className="font-medium text-text-primary">Confidence:</span> 
                            <span className="capitalize">{confidence}</span>
                          </p>
                        )}
                        {note && (
                          <p className="flex items-start gap-1">
                            <span className="font-medium text-text-primary">Note:</span> 
                            <span>{note}</span>
                          </p>
                        )}
                      </div>
                    )}

                  </Card>
                </motion.div>
              </section>
            );
          })()}

          {/* Job Listings Section */}
          {jobs && jobs.length > 0 && (
            <section className="animate-fade-in space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-2">
                <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
                  <Briefcase className="h-6 w-6 text-primary-blue animate-pulse" />
                  Live Job Openings
                </h2>
                
                <Button 
                  onClick={() => navigate(`/parser?role=${encodeURIComponent(role)}`)}
                  className="bg-primary-purple hover:bg-primary-purple/90 text-white rounded-xl gap-2 shadow-lg shadow-primary-purple/20 group"
                >
                  <Sparkles className="h-4 w-4" />
                  Optimize Resume for this Role
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {jobs.map((job, index) => {
                  const jobId = `job-${job.jobTitle}-${job.company}`.replace(/\s+/g, "-").toLowerCase();
                  return (
                    <div key={jobId || index} className="h-full">
                      <JobCard
                        jobTitle={job.jobTitle}
                        company={job.company}
                        location={job.location}
                        matchScore={job.matchScore || 90}
                        applyLink={job.applyLink}
                        isRemote={job.isRemote}
                        employmentType={job.employmentType}
                        isSaved={savedJobIds.has(jobId)}
                        onSave={() => handleSaveJob(job)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
          </>
        )}
      </div>

      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-5 right-5 z-55 bg-black text-white px-4 py-2.5 rounded-xl shadow-2xl border border-white/10 flex items-center gap-2 animate-bounce">
          <span className="text-success font-bold text-sm">✓</span>
          <span className="text-xs font-semibold">{saveToast}</span>
        </div>
      )}

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
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg text-text-heading">Saved Analyses</h3>
                  <p className="text-xs text-text-secondary">Your previously generated radar insights</p>
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
              {user?.savedRadarAnalyses && user.savedRadarAnalyses.length > 0 ? (
                user.savedRadarAnalyses.map((r) => (
                  <div 
                    key={r.id} 
                    className="border border-border/50 bg-bg-card rounded-2xl p-5 hover:border-success hover:shadow-lg transition-all text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <h4 className="font-bold text-text-heading text-lg mb-1">{r.title || "Radar Analysis"}</h4>
                      <div className="flex items-center gap-3 text-xs font-mono text-text-secondary">
                        <span className="text-success font-bold px-2 py-0.5 bg-success/10 rounded-md">Role: {r.role}</span>
                        <span>{new Date(r.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-success text-near-black border-none whitespace-nowrap px-6 shrink-0 hover:bg-success/90"
                      onClick={() => {
                        setStructuredData(r.data.structuredData);
                        setJobs(r.data.jobs);
                        setSalary(r.data.salary);
                        // The saved data usually doesn't have the original 'country' query stored,
                        // but setting the state and then triggering logic gives us the result.
                        setIsSearching(false);
                        setHasLoadedRadar(true);
                        setShowSavedModal(false);
                      }}
                    >
                      Load Analysis
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 px-4">
                  <RadarIcon className="h-12 w-12 text-text-secondary/20 mx-auto mb-4" />
                  <p className="text-text-heading font-medium">No saved analyses yet</p>
                  <p className="text-text-secondary text-sm mt-2">Generate a market radar and save it to see it here.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}