import { DashboardLayout } from "../components/DashboardLayout";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { SkillTag } from "../components/SkillTag";
import { 
  User, Mail, Briefcase, MapPin, Edit2, Shield, 
  CheckCircle2, Activity, Zap, Settings, Download, Trash2, 
  ChevronRight, Calendar, Radar, MessageSquare,
  Printer, X, Plus, Kanban
} from "lucide-react";
import { useUser } from "../context/UserContext";
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { exportProfileData, clearProfileData } from "../services/profileService";
import { exportDashboardPDF } from "../utils/pdfExport";
import { SavedResult, SavedJob } from "../types/profile";
import { sessionCache } from "../utils/sessionCache";

// Refactored Components
import { SavedResults } from "../components/profile/SavedResults";
import { ActivityFeed } from "../components/profile/ActivityFeed";
import { ApplicationBoard } from "../components/profile/ApplicationBoard";

type TabType = 'overview' | 'board' | 'results' | 'activity' | 'settings';

export default function ProfilePage() {
  const { user, fullName, initials, updateProfile, logout } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(user || {
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    location: '',
    experience: '',
    score: 0,
    tier: 'Free' as const
  });
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [selectedResult, setSelectedResult] = useState<SavedResult | null>(null);

  // Update form data when user changes
  React.useEffect(() => {
    if (user) {
      setFormData(user);
    }
  }, [user]);

  const scoreData = useMemo(() => {
    if (!user?.scoreHistory) return [];
    return [...user.scoreHistory].reverse().map(h => ({
      name: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: h.score,
      reason: h.reason
    }));
  }, [user?.scoreHistory]);

  const skillTier = useMemo(() => {
    const s = user?.skillSyncScore?.total || 0;
    if (s >= 90) return { name: 'Master', color: 'text-primary-purple', bg: 'bg-primary-purple/10' };
    if (s >= 70) return { name: 'Expert', color: 'text-primary-blue', bg: 'bg-primary-blue/10' };
    if (s >= 40) return { name: 'Advanced', color: 'text-success', bg: 'bg-success/10' };
    if (s >= 20) return { name: 'Practitioner', color: 'text-warning', bg: 'bg-warning/10' };
    return { name: 'Novice', color: 'text-text-secondary', bg: 'bg-text-secondary/10' };
  }, [user?.skillSyncScore?.total]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(formData);
    setSaveStatus("Profile updated successfully!");
    setIsEditing(false);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleManualAddSkill = () => {
    if (newSkillInput.trim()) {
      const currentSkills = user.skills || [];
      if (!currentSkills.includes(newSkillInput.trim())) {
        updateProfile({ skills: [...currentSkills, newSkillInput.trim()] });
      }
      setNewSkillInput("");
      setIsAddingSkill(false);
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const currentSkills = user.skills || [];
    const updatedSkills = currentSkills.filter(s => s !== skillToRemove);
    updateProfile({ skills: updatedSkills });
  };

  const handleUpdateJobStatus = async (jobId: string, newStatus: SavedJob["status"]) => {
    const currentJobs = (user as any).savedJobs || [];
    const updatedJobs = currentJobs.map((j: SavedJob) => 
      j.id === jobId ? { ...j, status: newStatus } : j
    );
    await updateProfile({ savedJobs: updatedJobs } as any);
    setSaveStatus("Application status updated!");
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleRemoveJob = async (jobId: string) => {
    if (!window.confirm("Remove this job from your board?")) return;
    const currentJobs = (user as any).savedJobs || [];
    const updatedJobs = currentJobs.filter((j: SavedJob) => j.id !== jobId);
    await updateProfile({ savedJobs: updatedJobs } as any);
    setSaveStatus("Job removed.");
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleExport = () => {
    exportProfileData(user);
  };

  const handleClearData = async () => {
    if (window.confirm("Are you sure you want to clear all your saved results? This cannot be undone.")) {
      await clearProfileData(user.uid);
      setSaveStatus("All saved data cleared.");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleClearCache = () => {
    sessionCache.clear();
    setSaveStatus("Session cache successfully cleared.");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'board', label: 'Job Board', icon: Kanban },
    { id: 'results', label: 'Saved Results', icon: Shield },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <DashboardLayout title="Your Talent Profile" showBackButton backPath="/dashboard">
      <style>{`
        @media print {
          body, html, #root, [id="root"], #main-content, main {
            background: #ffffff !important;
            color: #111827 !important;
            height: auto !important;
            overflow: visible !important;
            position: static !important;
            width: 100% !important;
          }
          aside, header, nav, button, .no-print, .chatbot-widget, #chatbot-widget, iframe, [data-tour] {
            display: none !important;
          }
          #main-content, main, .flex-1 {
            overflow: visible !important;
            height: auto !important;
            position: static !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          body { padding: 1.5cm !important; }
          .print-block { display: block !important; }
        }
      `}</style>
      <div className="max-w-6xl mx-auto space-y-6 pb-20 no-print">
        
        {saveStatus && (
          <div className="fixed top-24 right-8 z-50 p-4 rounded-xl bg-card border border-border text-text-primary shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <p className="text-sm font-medium">{saveStatus}</p>
          </div>
        )}

        {/* PROFILE HEADER */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-blue to-primary-purple rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
          <Card className="relative overflow-hidden p-8 border border-border bg-background backdrop-blur-xl">
            <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-30" />
            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
              {/* Score Ring */}
              <div className="relative shrink-0">
                <div className="h-40 w-40 flex items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-text-primary/5"
                      strokeWidth="2.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <motion.path
                      initial={{ strokeDasharray: "0, 100" }}
                      animate={{ strokeDasharray: `${user.skillSyncScore?.total || 0}, 100` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="text-primary-blue"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="text-center z-10">
                    <span className="text-5xl font-black text-text-primary tracking-tighter">
                      {user.skillSyncScore?.total || 0}
                    </span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary mt-1">SkillScore</span>
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-2 h-14 w-14 rounded-2xl bg-card border-2 border-border flex items-center justify-center text-xl font-bold text-text-primary shadow-xl">
                  {initials}
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-display text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight uppercase break-words w-full sm:w-auto">{fullName}</h1>
                    <div className={cn("px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-widest border border-border shrink-0", skillTier.color, skillTier.bg)}>
                      {skillTier.name}
                    </div>
                  </div>
                  <p className="text-text-secondary text-base sm:text-lg font-medium break-words">{user.role || 'Job Seeker'} • {user.location || 'Not specified'}</p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-background border border-border text-text-secondary text-sm">
                    <Briefcase className="h-4 w-4" />
                    {user.experience}
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-background border border-border text-text-secondary text-sm">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary-blue/10 border border-primary-blue/20 text-primary-blue text-sm font-bold">
                    <Zap className="h-4 w-4" />
                    {user.tier} Tier
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex flex-wrap gap-2 self-start no-print">
                <Button 
                  variant="outline" 
                  className="rounded-2xl border-border bg-bg-card text-text-primary hover:bg-card-hover gap-2 font-semibold shadow-lg cursor-pointer"
                  onClick={() => exportDashboardPDF(user)}
                >
                  <Download className="h-4 w-4" /> Export PDF
                </Button>
                <Button 
                  variant="outline" 
                  className="rounded-2xl border-primary-blue bg-primary-blue/10 hover:bg-primary-blue/20 text-text-primary gap-2"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4 text-primary-blue" /> Print Profile
                </Button>
                <Button 
                  variant="outline" 
                  className="rounded-2xl border-border bg-background hover:bg-background text-text-primary gap-2"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit2 className="h-4 w-4" /> Edit
                </Button>
                <Button 
                  variant="ghost" 
                  className="rounded-2xl text-text-secondary hover:text-danger hover:bg-danger/10"
                  onClick={logout}
                >
                  Logout
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* TAB NAVIGATION */}
        <div className="w-full overflow-x-auto pb-1">
          <div className="flex items-center gap-2 p-1 bg-card rounded-[2rem] border border-border w-max min-w-full sm:w-auto sm:min-w-0 sm:max-w-fit sm:mx-auto lg:mx-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 sm:px-6 py-3 rounded-[1.8rem] font-mono text-xs sm:text-sm uppercase tracking-widest transition-all whitespace-nowrap shrink-0",
                  activeTab === tab.id
                    ? "bg-primary-blue text-white shadow-xl"
                    : "text-text-secondary hover:text-text-primary hover:bg-background"
                )}
              >
                <tab.icon className={cn("h-4 w-4 shrink-0", activeTab === tab.id ? "text-white" : "")} />
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* TAB CONTENT */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6 order-1">
                  {isEditing ? (
                    <Card className="p-8 border border-border bg-card">
                      <h3 className="font-display text-xl font-semibold text-text-primary uppercase tracking-tight mb-6">Edit Profile Info</h3>
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="font-mono text-[10px] uppercase tracking-widest text-text-secondary ml-2">First Name</label>
                            <Input 
                              value={formData.firstName} 
                              className="bg-background border-border text-text-primary rounded-2xl h-12"
                              onChange={(e) => setFormData({...formData, firstName: e.target.value})} 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="font-mono text-[10px] uppercase tracking-widest text-text-secondary ml-2">Last Name</label>
                            <Input 
                              value={formData.lastName} 
                              className="bg-background border-border text-text-primary rounded-2xl h-12"
                              onChange={(e) => setFormData({...formData, lastName: e.target.value})} 
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="font-mono text-[10px] uppercase tracking-widest text-text-secondary ml-2">Experience Level</label>
                          <Input 
                            value={formData.experience} 
                            className="bg-background border-border text-text-primary rounded-2xl h-12"
                            onChange={(e) => setFormData({...formData, experience: e.target.value})} 
                          />
                        </div>
                        <div className="flex gap-3">
                          <Button type="submit" className="flex-1 rounded-2xl bg-primary-blue hover:bg-primary-blue/90">Save Changes</Button>
                          <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-2xl">Cancel</Button>
                        </div>
                      </form>
                    </Card>
                  ) : (
                    <Card className="p-8 border border-border bg-card">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="font-display text-xl font-semibold text-text-primary uppercase tracking-tight">Talent Skills</h3>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setIsAddingSkill(true)}
                          className="text-primary-blue hover:bg-primary-blue/10 rounded-xl"
                        >
                          <Plus className="h-4 w-4 mr-2" /> Add Skill
                        </Button>
                      </div>
                      
                      {isAddingSkill && (
                        <div className="mb-6 flex gap-2 animate-in zoom-in-95 duration-200">
                          <Input 
                            autoFocus
                            placeholder="e.g. React, Python, UI Design"
                            value={newSkillInput}
                            onChange={(e) => setNewSkillInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleManualAddSkill()}
                            className="bg-background border-border rounded-xl h-10"
                          />
                          <Button size="sm" onClick={handleManualAddSkill} className="rounded-xl">Add</Button>
                          <Button size="sm" variant="ghost" onClick={() => setIsAddingSkill(false)} className="rounded-xl">Cancel</Button>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3">
                        {user.skills && user.skills.length > 0 ? (
                          user.skills.map((skill: string, index: number) => (
                            <div key={`${skill}-${index}`} className="group relative">
                              <SkillTag 
                                name={skill} 
                                className="px-4 py-2 text-sm bg-background border-border"
                              />
                              <button 
                                onClick={() => handleRemoveSkill(skill)}
                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-danger text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="w-full py-12 text-center rounded-[2rem] border-2 border-dashed border-border">
                            <p className="text-text-secondary/60 italic">No skills listed yet. Use the Radar or Parser to discover your talent DNA.</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </div>

                <div className="space-y-6 order-2 lg:order-2">
                  <Card className="p-8 border border-border bg-card">
                    <h3 className="font-display text-xl font-semibold text-text-primary uppercase tracking-tight mb-6">Learning Path</h3>
                    <div className="space-y-4">
                      {user.learningPath && user.learningPath.length > 0 ? (
                        user.learningPath.map((item: any, i: number) => {
                          const skillName = item.skillName || item.skill || item.name || "Skill";
                          const title = item.title || skillName;
                          const url = item.learnUrl || item.url || item.link;
                          return (
                            <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-background border border-border group hover:border-primary-purple/30 transition-all">
                              <div className="mt-1 h-5 w-5 rounded-full border-2 border-primary-purple flex items-center justify-center shrink-0">
                                <div className="h-2 w-2 rounded-full bg-primary-purple" />
                              </div>
                              <div className="space-y-1 min-w-0 flex-1">
                                <p className="font-display font-bold text-text-primary text-sm uppercase tracking-tight group-hover:text-primary-purple transition-colors truncate">{skillName}</p>
                                {title !== skillName && (
                                  <p className="text-xs text-text-secondary truncate">{title}</p>
                                )}
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-text-secondary">{item.status || 'Planned'}</p>
                                  {url && (
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-purple hover:underline">
                                      Learn →
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-xs text-text-secondary italic mb-4">No active learning path.</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => navigate('/roadmap')}
                            className="rounded-xl border-border text-text-primary text-[10px] uppercase tracking-widest"
                          >
                            Generate Roadmap
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'board' && (
              <ApplicationBoard 
                jobs={(user as any).savedJobs || []} 
                onUpdateStatus={handleUpdateJobStatus}
                onRemoveJob={handleRemoveJob}
              />
            )}

            {activeTab === 'results' && (
              <SavedResults user={user} setSelectedResult={setSelectedResult} />
            )}

            {activeTab === 'activity' && (
              <ActivityFeed user={user} scoreData={scoreData} />
            )}

            {activeTab === 'settings' && (
              <div className="max-w-2xl mx-auto space-y-6">
                <Card className="p-8 border border-border bg-card">
                  <h3 className="font-display text-xl font-semibold text-text-primary uppercase tracking-tight mb-6">Data & Privacy</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 rounded-[2rem] bg-background border border-border">
                      <div className="space-y-1">
                        <p className="font-mono text-sm uppercase tracking-wider text-text-primary">Export JSON Backup</p>
                        <p className="text-xs text-text-secondary">Download a full JSON backup of your assessments, roadmaps and score history.</p>
                      </div>
                      <Button variant="outline" onClick={handleExport} className="rounded-2xl border-border text-text-primary gap-2 shrink-0">
                        <Download className="h-4 w-4" /> Export JSON
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-6 rounded-[2rem] bg-background border border-border">
                      <div className="space-y-1">
                        <p className="font-mono text-sm uppercase tracking-wider text-text-primary">Export PDF Summary</p>
                        <p className="text-xs text-text-secondary">Download a PDF executive summary of your active learning and profile.</p>
                      </div>
                      <Button variant="outline" onClick={() => exportDashboardPDF(user)} className="rounded-2xl border-primary-blue bg-primary-blue/10 text-primary-blue hover:bg-primary-blue/20 gap-2 shrink-0">
                        <Printer className="h-4 w-4" /> Save PDF
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-6 rounded-[2rem] bg-background border border-border">
                      <div className="space-y-1">
                        <p className="font-mono text-sm uppercase tracking-wider text-text-primary">Cloud Sync</p>
                        <p className="text-xs text-text-secondary">Your data is currently synced with SkillSync Enterprise Cloud.</p>
                      </div>
                      <div className="flex items-center gap-2 text-success font-mono text-[10px] uppercase">
                        <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                        Synced
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-6 rounded-[2rem] bg-background border border-border">
                      <div className="space-y-1">
                        <p className="font-mono text-sm uppercase tracking-wider text-text-primary">Clear Local Cache</p>
                        <p className="text-xs text-text-secondary">Wipes stored API responses from your browser session to force fresh analysis fetches.</p>
                      </div>
                      <Button variant="outline" onClick={handleClearCache} className="rounded-2xl border-border text-text-primary gap-2 shrink-0">
                        <Trash2 className="h-4 w-4" /> Clear Cache
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-6 rounded-[2rem] bg-danger/5 border border-danger/20">
                      <div className="space-y-1">
                        <p className="font-mono text-sm uppercase tracking-wider text-danger">Reset Results</p>
                        <p className="text-xs text-danger/60">Delete all saved results and reset your SkillSync score to zero.</p>
                      </div>
                      <Button variant="ghost" onClick={handleClearData} className="rounded-2xl text-danger hover:bg-danger/20 gap-2">
                        <Trash2 className="h-4 w-4" /> Clear All
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* RE-VIEW MODAL */}
        <AnimatePresence>
          {selectedResult && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={() => setSelectedResult(null)}
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden bg-card rounded-[3rem] border border-border shadow-2xl flex flex-col"
              >
                <div className="p-8 border-b border-border flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-primary-blue">
                      {selectedResult.type.replace('-', ' ')}
                    </p>
                    <h3 className="font-display text-2xl font-semibold text-text-primary uppercase tracking-tight">{selectedResult.title}</h3>
                  </div>
                  <button onClick={() => setSelectedResult(null)} className="p-3 bg-background rounded-2xl text-text-secondary hover:text-text-primary">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="p-8 overflow-y-auto custom-scrollbar">
                  <div className="bg-background/50 rounded-3xl p-6 border border-border text-text-secondary text-sm leading-relaxed space-y-3">
                    {selectedResult.data && typeof selectedResult.data === "object"
                      ? Object.entries(selectedResult.data).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-semibold text-text-primary capitalize">{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}: </span>
                            <span>{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}</span>
                          </div>
                        ))
                      : <p>{String(selectedResult.data)}</p>
                    }
                  </div>
                </div>
                <div className="p-8 border-t border-border flex justify-end">
                   <Button onClick={() => setSelectedResult(null)} className="rounded-2xl px-12">Close View</Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}