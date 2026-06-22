import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useUser } from "../context/UserContext";
import { api } from "../utils/api";
import { useToast } from "../components/Toast";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  ShieldAlert, 
  MessageSquare, 
  Activity, 
  Search, 
  Sparkles, 
  Star, 
  ShieldCheck, 
  ShieldAlert as ShieldIcon, 
  UserX, 
  Plus, 
  Minus, 
  Check, 
  TrendingUp, 
  HelpCircle, 
  Clock, 
  ArrowRight,
  ChevronRight,
  Database
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tier?: "Free" | "Pro";
  role?: string;
  isAdmin?: boolean;
  score?: number;
  metadata?: {
    assessmentCount?: number;
    [key: string]: any;
  };
}

interface UserFeedbackData {
  id: string;
  userId: string;
  feature: string;
  rating: number;
  comment?: string;
  timestamp: any;
}

interface PlatformFeedbackData {
  id: string;
  rating: number;
  comment?: string;
  timestamp: any;
}

interface ActivityLogData {
  id: string;
  userId: string;
  type: string;
  details: string;
  timestamp: any;
}

export default function AdminPage() {
  const { user: currentUser, isAdmin: isCurrentUserAdmin, isAuthReady } = useUser();
  const toastCtx = useToast();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data retrieved from Administrative endpoint
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [platformFeedback, setPlatformFeedback] = useState<PlatformFeedbackData[]>([]);
  const [userFeedback, setUserFeedback] = useState<UserFeedbackData[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogData[]>([]);
  
  // Tab control & searching
  const [activeTab, setActiveTab] = useState<"users" | "feedback" | "activity">("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Load all admin data from endpoint on mount
  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAdminData();
      setUsers(data.users || []);
      setPlatformFeedback(data.platformFeedback || []);
      setUserFeedback(data.userFeedback || []);
      setActivityLog(data.activityLog || []);
    } catch (err: any) {
      console.error("Admin data load failed:", err);
      setError(err?.message || "Failed to retrieve administrative records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthReady && isCurrentUserAdmin) {
      loadAdminData();
    }
  }, [isAuthReady, isCurrentUserAdmin]);

  // Route protection - if authenticated but not admin, show graceful access denied
  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-primary-blue border-t-transparent animate-spin rounded-full"></div>
          <span className="text-sm font-medium text-text-secondary">Verifying administration access...</span>
        </div>
      </div>
    );
  }

  if (!isCurrentUserAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary px-4 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md p-8 rounded-2xl border border-warning/20 bg-bg-card shadow-xl space-y-6"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center text-warning">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-display font-black text-text-heading">Administrative Access Required</h1>
            <p className="text-sm text-text-secondary">
              This panel is restricted to authorized operators and admin accounts. Your account does not possess the permissions necessary to view these records.
            </p>
          </div>
          <Button onClick={() => window.location.href = "/dashboard"} className="w-full">
            Back to Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  // Operation handlers
  const handleToggleTier = async (targetUser: AdminUser) => {
    try {
      setUpdatingUserId(targetUser.id);
      const nextTier = targetUser.tier === "Pro" ? "Free" : "Pro";
      await api.updateUserProfile(targetUser.id, { tier: nextTier });
      
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, tier: nextTier } : u));
      toastCtx.success("Tier Updated", `Successfully upgraded ${targetUser.email} to ${nextTier} tier!`);
    } catch (err: any) {
      toastCtx.error("Update Failed", err?.message || "Could not change tier.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleUpdateAssessmentCount = async (targetUser: AdminUser, newCount: number) => {
    if (newCount < 0) return;
    try {
      setUpdatingUserId(targetUser.id);
      await api.updateUserProfile(targetUser.id, { assessmentCount: newCount });
      
      setUsers(prev => prev.map(u => {
        if (u.id === targetUser.id) {
          const updatedMeta = { ...(u.metadata || {}), assessmentCount: newCount };
          return { ...u, metadata: updatedMeta };
        }
        return u;
      }));
      toastCtx.success("Count Updated", `Set assessment count for ${targetUser.email} to ${newCount}!`);
    } catch (err: any) {
      toastCtx.error("Update Failed", err?.message || "Could not change assessment count.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleToggleAdminStatus = async (targetUser: AdminUser) => {
    if (targetUser.id === currentUser?.uid) {
      toastCtx.error("Operation Denied", "For security, you cannot revoke your own administrator privileges.");
      return;
    }

    try {
      setUpdatingUserId(targetUser.id);
      const nextAdminState = !targetUser.isAdmin;
      await api.updateUserProfile(targetUser.id, { 
        isAdmin: nextAdminState, 
        role: nextAdminState ? "admin" : "user" 
      });
      
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, isAdmin: nextAdminState, role: nextAdminState ? "admin" : "user" } : u));
      toastCtx.success("Permissions Updated", `${targetUser.email} is ${nextAdminState ? 'now an' : 'no longer an'} Administrator.`);
    } catch (err: any) {
      toastCtx.error("Update Failed", err?.message || "Could not toggle admin state.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Filtering users
  const filteredUsers = users.filter(u => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      u.email.toLowerCase().includes(term) ||
      (u.firstName || "").toLowerCase().includes(term) ||
      (u.lastName || "").toLowerCase().includes(term) ||
      u.id.includes(term)
    );
  });

  // Calculate statistics
  const totalUsers = users.length;
  const proUsersCount = users.filter(u => u.tier === "Pro").length;
  const adminUsersCount = users.filter(u => u.isAdmin || u.role === "admin").length;
  const totalFeedback = userFeedback.length + platformFeedback.length;

  return (
    <DashboardLayout title="Administration Console">
      <div className="space-y-6">
        
        {/* Top welcome ribbon */}
        <div id="admin-welcome-ribbon" className="relative p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 text-white overflow-hidden shadow-lg">
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-mono text-[10px] uppercase tracking-wider border border-amber-500/25">
                Active Session
              </span>
              <span className="text-slate-400 font-mono text-[10px]">•</span>
              <span className="text-slate-400 font-mono text-[10px]">Secure Shell Admin Role Verified</span>
            </div>
            <h2 className="text-3xl font-display font-black tracking-tight text-white leading-none">
              Systems Overlord
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Operator logged in as <strong className="text-white font-semibold">{currentUser?.email}</strong>. Manage user licenses, audit customer satisfaction metrics, override limits, and inspect logs.
            </p>
          </div>
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-15 hover:opacity-25 transition-opacity duration-300 pointer-events-none select-none">
            <Database className="h-32 w-32 text-indigo-400" />
          </div>
        </div>

        {/* Global Summary Statistics Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5 flex flex-col justify-between hover:border-slate-300/40 transition-all shadow-sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider font-mono">Platform Accounts</span>
              <Users className="h-4 w-4 text-primary-purple" />
            </div>
            <div className="mt-4 flex flex-col">
              <span className="text-2xl font-black text-text-heading font-display leading-tight">{totalUsers}</span>
              <span className="text-[10px] text-text-secondary mt-1">Total database users registered</span>
            </div>
          </Card>

          <Card className="p-5 flex flex-col justify-between hover:border-slate-300/40 transition-all shadow-sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider font-mono">Premium Licenses</span>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-4 flex flex-col">
              <span className="text-2xl font-black text-text-heading font-display leading-tight">{proUsersCount}</span>
              <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1 mt-1">
                {totalUsers > 0 ? ((proUsersCount / totalUsers) * 100).toFixed(0) : 0}% tier conversion
              </span>
            </div>
          </Card>

          <Card className="p-5 flex flex-col justify-between hover:border-slate-300/40 transition-all shadow-sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider font-mono">System Feedback</span>
              <MessageSquare className="h-4 w-4 text-primary-blue" />
            </div>
            <div className="mt-4 flex flex-col">
              <span className="text-2xl font-black text-text-heading font-display leading-tight">{totalFeedback}</span>
              <span className="text-[10px] text-text-secondary mt-1">Written surveys & UX rating submissions</span>
            </div>
          </Card>

          <Card className="p-5 flex flex-col justify-between hover:border-slate-300/40 transition-all shadow-sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider font-mono">Operators Role</span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-4 flex flex-col">
              <span className="text-2xl font-black text-text-heading font-display leading-tight">{adminUsersCount}</span>
              <span className="text-[10px] text-text-secondary mt-1">Privileged accounts detected</span>
            </div>
          </Card>
        </div>

        {/* Dynamic Navigation Tabs and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between border-b border-border/80 pb-4">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-bg-card border border-border/60 self-start">
            <button
              onClick={() => { setActiveTab("users"); setError(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'users' ? 'bg-primary-blue text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <Users className="h-4 w-4" />
              Licenses & Users
            </button>
            <button
              onClick={() => { setActiveTab("feedback"); setError(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'feedback' ? 'bg-primary-blue text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <MessageSquare className="h-4 w-4" />
              Feedbacks ({totalFeedback})
            </button>
            <button
              onClick={() => { setActiveTab("activity"); setError(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'activity' ? 'bg-primary-blue text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <Activity className="h-4 w-4" />
              Recent Logs
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-secondary/60">
                <Search className="h-4 w-4" />
              </span>
              <Input
                type="text"
                placeholder="Lookup by email, UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs w-full"
              />
            </div>
            
            <Button 
              variant="outline" 
              onClick={loadAdminData} 
              disabled={loading}
              className="px-3"
              id="btn-admin-refresh"
            >
              Sync
            </Button>
          </div>
        </div>

        {/* Main Console Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-16 text-center space-y-4"
            >
              <div className="h-8 w-8 border-4 border-primary-blue border-t-transparent animate-spin rounded-full mx-auto"></div>
              <p className="text-xs text-text-secondary font-mono">Syncing securely with Firestore master database...</p>
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error-panel"
              className="p-6 border border-warning/10 rounded-2xl bg-warning/5 text-center space-y-4"
            >
              <ShieldAlert className="h-10 w-10 text-warning mx-auto animate-bounce" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-text-heading uppercase tracking-wide">Secure Data Retrieval Interrupted</h4>
                <p className="text-xs text-text-secondary max-w-lg mx-auto">{error}</p>
              </div>
              <Button onClick={loadAdminData} className="mx-auto">Retry Synchronization</Button>
            </motion.div>
          ) : activeTab === "users" ? (
            <motion.div
              key="users-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="overflow-x-auto rounded-xl border border-border bg-bg-card">
                <table className="w-full border-collapse text-left text-xs text-text-primary">
                  <thead className="bg-bg-primary/50 text-[10px] font-mono tracking-wider text-text-secondary uppercase border-b border-border">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold">User Details</th>
                      <th className="px-6 py-3.5 font-semibold text-center">Tier & Status</th>
                      <th className="px-6 py-3.5 font-semibold text-center">Skill Assessments Used</th>
                      <th className="px-6 py-3.5 font-semibold text-center">System Permissions</th>
                      <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-text-secondary font-mono">
                          No matching records found in system registries.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const usedAssessments = u.metadata?.assessmentCount ?? 0;
                        const isThisUserMe = u.id === currentUser?.uid;
                        const userClass = updatingUserId === u.id ? "opacity-40 pointer-events-none transition-opacity" : "";
                        
                        return (
                          <tr key={u.id} className={`${userClass} hover:bg-bg-primary/20 transition-all`}>
                            {/* User details */}
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-display font-bold text-text-heading text-sm">
                                  {`${u.firstName || ""} ${u.lastName || ""}`.trim() || "Anonymous Hero"}
                                  {isThisUserMe && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-mono text-[9px] uppercase tracking-widest border border-emerald-500/25">
                                      You
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs text-text-secondary font-mono tracking-tight">{u.email}</span>
                                <span className="text-[10px] text-text-secondary/60 font-mono tracking-tight mt-0.5">UID: {u.id}</span>
                              </div>
                            </td>

                            {/* Tier Badge / Status */}
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center">
                                <button
                                  onClick={() => handleToggleTier(u)}
                                  className={`px-3 py-1 text-[10px] font-mono font-black uppercase tracking-wider rounded-full border cursor-pointer transition-all ${
                                    u.tier === "Pro" 
                                      ? "bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.1)]" 
                                      : "bg-slate-500/10 text-slate-500 border-slate-500/25"
                                  }`}
                                  title="Click to toggle user tier licensing state"
                                >
                                  {u.tier === "Pro" ? "★ Pro Active" : "Free License"}
                                </button>
                              </div>
                            </td>

                            {/* Assessment Tokens used / limit */}
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  onClick={() => handleUpdateAssessmentCount(u, usedAssessments - 1)}
                                  disabled={usedAssessments <= 0}
                                  className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-bg-primary active:scale-95 transition-all text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                
                                <div className="flex flex-col justify-center">
                                  <span className="font-display font-black text-sm text-text-heading">
                                    {usedAssessments} <span className="text-[10px] font-medium text-text-secondary">/ 3</span>
                                  </span>
                                  <span className="text-[9px] text-text-secondary mt-0.5 uppercase tracking-wide">Used</span>
                                </div>

                                <button
                                  onClick={() => handleUpdateAssessmentCount(u, usedAssessments + 1)}
                                  className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-bg-primary active:scale-95 transition-all text-text-secondary hover:text-text-primary cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </td>

                            {/* Admin Role Permission */}
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center">
                                <button
                                  onClick={() => handleToggleAdminStatus(u)}
                                  disabled={isThisUserMe}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-display font-black uppercase tracking-wider border flex items-center gap-1.5 cursor-pointer transition-all ${
                                    u.isAdmin || u.role === 'admin'
                                      ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                                      : "bg-slate-500/10 text-text-secondary border-slate-500/25 hover:text-text-primary hover:border-slate-500/40"
                                  }`}
                                  title={isThisUserMe ? "Forbidden to revoke your own operator rank" : "Toggle operator credentials status"}
                                >
                                  {(u.isAdmin || u.role === 'admin') ? (
                                    <>
                                      <ShieldIcon className="h-3.5 w-3.5 text-rose-500" />
                                      SYS_ADMIN
                                    </>
                                  ) : (
                                    <>
                                      <Users className="h-3.5 w-3.5" />
                                      REG_USER
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Quick Actions */}
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button 
                                  variant="outline"
                                  onClick={() => handleToggleTier(u)}
                                  className="text-[10px] px-2.5 py-1.5 font-semibold h-auto"
                                >
                                  Toggle Tier
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : activeTab === "feedback" ? (
            <motion.div
              key="feedback-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* User Feedback */}
              <div className="space-y-3">
                <h3 className="font-display font-extrabold text-sm text-text-heading uppercase tracking-widest text-primary-blue">
                  Feature satisfaction feedback ({userFeedback.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userFeedback.length === 0 ? (
                    <div className="col-span-full py-8 text-center border border-dashed border-border rounded-xl bg-bg-card text-text-secondary text-xs">
                      No feature reviews yet.
                    </div>
                  ) : (
                    userFeedback.map((f) => {
                      const userObj = users.find(u => u.id === f.userId);
                      const email = userObj?.email || "Anonymous id: " + f.userId.slice(0, 8);
                      const userName = userObj ? `${userObj.firstName || ""} ${userObj.lastName || ""}`.trim() : "Tester Profile";
                      const dateString = f.timestamp?.seconds 
                        ? new Date(f.timestamp.seconds * 1000).toLocaleString() 
                        : "Received recently";
                        
                      return (
                        <div key={f.id} className="p-4 rounded-xl border border-border bg-bg-card space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow">
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h4 className="font-display font-medium text-text-heading text-sm leading-tight">{userName}</h4>
                                <span className="text-[10px] text-text-secondary font-mono leading-none">{email}</span>
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full bg-primary-blue/10 text-primary-blue text-[9px] font-mono uppercase tracking-widest font-black shrink-0">
                                {f.feature}
                              </span>
                            </div>
                            
                            {/* Stars rating */}
                            <div className="flex items-center gap-0.5 text-amber-500">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`h-3.5 w-3.5 ${i < f.rating ? 'fill-amber-500' : 'text-slate-300'}`} 
                                />
                              ))}
                            </div>
                            
                            <p className="text-xs text-text-primary italic leading-relaxed bg-bg-primary/30 p-2.5 rounded-lg border border-border/40">
                              "{f.comment || "No explicit comment written."}"
                            </p>
                          </div>
                          
                          <div className="pt-2 border-t border-border/40 text-[9px] text-text-secondary font-mono flex items-center justify-between">
                            <span>Receipt Date</span>
                            <span>{dateString}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Platform Feedback */}
              <div className="space-y-3 pt-4">
                <h3 className="font-display font-extrabold text-sm text-text-heading uppercase tracking-widest text-primary-purple">
                  Platform Rating surveys ({platformFeedback.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {platformFeedback.length === 0 ? (
                    <div className="col-span-full py-8 text-center border border-dashed border-border rounded-xl bg-bg-card text-text-secondary text-xs">
                      No platform net promoter scores submitted yet.
                    </div>
                  ) : (
                    platformFeedback.map((f) => {
                      const dateString = f.timestamp?.seconds 
                        ? new Date(f.timestamp.seconds * 1000).toLocaleString() 
                        : "Received recently";
                        
                      return (
                        <div key={f.id} className="p-4 rounded-xl border border-border bg-bg-card space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[9px] text-text-secondary">Feedback Id: #{f.id.slice(0, 8)}</span>
                              <div className="flex items-center gap-0.5 text-emerald-500">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star 
                                    key={i} 
                                    className={`h-3.5 w-3.5 ${i < f.rating ? 'fill-emerald-500' : 'text-slate-300'}`} 
                                  />
                                ))}
                              </div>
                            </div>
                            
                            <p className="text-xs text-text-primary italic leading-relaxed bg-bg-primary/30 p-2.5 rounded-lg border border-border/40">
                              "{f.comment || "Operator survey submitted without written notes."}"
                            </p>
                          </div>
                          
                          <div className="pt-2 border-t border-border/40 text-[9px] text-text-secondary font-mono flex items-center justify-between">
                            <span>Receipt Date</span>
                            <span>{dateString}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="activity-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <h3 className="font-display font-extrabold text-sm text-text-heading uppercase tracking-widest text-[#8b5cf6]">
                Secure Real-Time Operations Log (Last 100 System Events)
              </h3>
              
              <div className="rounded-xl border border-border bg-slate-950 p-4 font-mono text-[11px] text-slate-300 space-y-2 overflow-y-auto max-h-[500px] leading-relaxed shadow-inner">
                {activityLog.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    No system log files stored in this snapshot execution block.
                  </div>
                ) : (
                  activityLog.map((log) => {
                    const userObj = users.find(u => u.id === log.userId);
                    const email = userObj ? userObj.email : "id_" + log.userId.slice(0, 6);
                    const formattedDate = log.timestamp?.seconds 
                      ? new Date(log.timestamp.seconds * 1000).toISOString().replace("T", " ").slice(0, 19)
                      : new Date().toISOString().replace("T", " ").slice(0, 19);
                      
                    let typeColor = "text-primary-blue";
                    if (log.type === "login") typeColor = "text-emerald-400";
                    if (log.type === "logout") typeColor = "text-rose-400";
                    if (log.type === "pathway-started") typeColor = "text-pink-400";
                    if (log.type === "resume-generated") typeColor = "text-amber-400";

                    return (
                      <div key={log.id} className="pb-1.5 border-b border-white/5 flex items-start gap-3 select-all hover:bg-white/5 p-1 rounded transition-colors">
                        <span className="text-slate-500 shrink-0 select-none">[{formattedDate}]</span>
                        <span className={`${typeColor} uppercase font-bold shrink-0 w-28`}>{log.type}</span>
                        <div className="flex-1">
                          <span className="text-slate-400 font-bold">{email}:</span>{" "}
                          <span>{log.details}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
