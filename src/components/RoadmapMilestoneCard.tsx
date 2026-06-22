import React from "react";
import { Target } from "lucide-react";
import { MilestoneProject } from "../utils/roadmapTypes";

/**
 * Extracted from roadmap.tsx — pure presentational component, props only.
 */
export const MilestoneCard = React.memo(function MilestoneCard({
  project,
}: {
  project: MilestoneProject;
}) {
  return (
    <div className="p-4 sm:p-6 md:p-8 rounded-xl md:rounded-[4rem] bg-bg-card border border-border shadow-2xl text-text-primary space-y-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
        <Target className="h-16 w-16 sm:h-24 sm:w-24 text-text-primary" />
      </div>
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase text-accent tracking-[0.4em] block">
            Phase Milestone
          </span>
          {project.estimated_hours > 0 && (
            <div className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-accent/10 border border-accent/20 font-mono text-[9px] uppercase tracking-widest text-text-primary">
              {project.estimated_hours} Hours Scope
            </div>
          )}
        </div>
        {project.name && (
          <h5 className="font-display text-2xl sm:text-3xl font-semibold italic tracking-tight leading-tight uppercase line-clamp-2 text-text-heading">
            {project.name}
          </h5>
        )}
      </div>
      {project.description && (
        <p className="text-sm text-text-body font-medium leading-relaxed relative z-10 bg-bg-primary/50 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-border/50 shadow-inner">
          {project.description}
        </p>
      )}
      {project.deliverables.length > 0 && (
        <div className="space-y-4 relative z-10">
          <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest block ml-2">
            Verified Deliverables
          </span>
          <div className="grid gap-3">
            {project.deliverables.map((d, di) => (
              <div
                key={di}
                className="px-5 py-3.5 sm:px-6 sm:py-4 rounded-2xl bg-bg-primary border border-border flex items-center gap-4 group/item hover:border-accent transition-all"
              >
                <div className="w-2 h-2 rounded-full bg-accent group-hover/item:scale-125 transition-all shadow-[0_0_10px_rgba(26,92,92,0.5)]" />
                <span className="text-xs font-bold text-text-primary transition-colors">
                  {d}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
