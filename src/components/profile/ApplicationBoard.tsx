import React from "react";
import { motion } from "motion/react";
import { Card } from "../Card";
import { Briefcase, ExternalLink, MapPin, Clock, Trash2, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { SavedJob } from "../../types/profile";

interface ApplicationBoardProps {
  jobs: SavedJob[];
  onUpdateStatus: (jobId: string, newStatus: SavedJob["status"]) => void;
  onRemoveJob: (jobId: string) => void;
}

export const ApplicationBoard: React.FC<ApplicationBoardProps> = ({ jobs, onUpdateStatus, onRemoveJob }) => {
  const columns: { id: SavedJob["status"]; title: string; color: string; bg: string }[] = [
    { id: "saved", title: "Saved", color: "text-text-secondary", bg: "bg-background" },
    { id: "applied", title: "Applied", color: "text-primary-blue", bg: "bg-primary-blue/10" },
    { id: "interviewing", title: "Interviewing", color: "text-warning", bg: "bg-warning/10" },
    { id: "offer", title: "Offer", color: "text-success", bg: "bg-success/10" },
    { id: "rejected", title: "Rejected", color: "text-danger", bg: "bg-danger/10" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between px-2">
        <div className="space-y-1">
          <h3 className="font-display text-2xl font-semibold text-text-primary uppercase tracking-tight">Application Board</h3>
          <p className="text-sm text-text-secondary">Track your job search progress across different stages</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-card border border-border">
          <Briefcase className="h-4 w-4 text-primary-blue" />
          <span className="font-mono text-sm font-bold text-text-primary">{jobs.length} Jobs</span>
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar min-h-[600px]">
        {columns.map((column) => {
          const columnJobs = jobs.filter((j) => (j.status || "saved") === column.id);
          
          return (
            <div key={column.id} className="flex-shrink-0 w-80 flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", column.id === "saved" ? "bg-text-secondary" : column.id === "applied" ? "bg-primary-blue" : column.id === "interviewing" ? "bg-warning" : column.id === "offer" ? "bg-success" : "bg-danger")} />
                  <h4 className="font-mono text-xs uppercase tracking-widest font-bold text-text-primary">{column.title}</h4>
                </div>
                <span className="font-mono text-[10px] text-text-secondary bg-card px-2 py-0.5 rounded-lg border border-border">{columnJobs.length}</span>
              </div>

              <div className={cn("flex-1 rounded-[2rem] border border-border p-4 space-y-4 bg-card/30 backdrop-blur-sm", columnJobs.length === 0 && "border-dashed")}>
                {columnJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    layoutId={job.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group"
                  >
                    <Card className="p-4 border border-border bg-card hover:border-primary-blue/30 transition-all shadow-sm">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <h5 className="font-display font-bold text-text-primary text-sm uppercase tracking-tight line-clamp-1 group-hover:text-primary-blue transition-colors">{job.jobTitle}</h5>
                          <button 
                            onClick={() => onRemoveJob(job.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-danger transition-all"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        
                        <p className="text-xs text-text-secondary font-medium">{job.company}</p>

                        <div className="flex flex-wrap gap-2">
                          <div className="flex items-center gap-1 text-[10px] text-text-secondary/70">
                            <MapPin className="h-3 w-3" />
                            {job.location || "Remote"}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-text-secondary/70">
                            <Clock className="h-3 w-3" />
                            {new Date(job.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border flex items-center justify-between">
                          <select 
                            value={job.status || "saved"}
                            onChange={(e) => onUpdateStatus(job.id, e.target.value as any)}
                            className="bg-background border border-border rounded-lg text-[10px] font-mono uppercase tracking-wider px-2 py-1 outline-none focus:border-primary-blue transition-colors"
                          >
                            {columns.map(col => (
                              <option key={col.id} value={col.id}>{col.title}</option>
                            ))}
                          </select>
                          
                          {job.applyLink && (
                            <a 
                              href={job.applyLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1.5 bg-primary-blue/10 rounded-lg text-primary-blue hover:bg-primary-blue hover:text-white transition-all"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
                
                {columnJobs.length === 0 && (
                  <div className="h-24 flex items-center justify-center text-center">
                    <p className="text-[10px] text-text-secondary/40 font-mono uppercase tracking-widest italic">Empty</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
