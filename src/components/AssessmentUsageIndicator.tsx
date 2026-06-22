import React from "react";
import { useUser } from "../context/UserContext";
import { Sparkles, HelpCircle, Lock, CheckCircle2 } from "lucide-react";
import { cn } from "../utils/cn";

interface AssessmentUsageIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

/**
 * Reusable AssessmentUsageIndicator Component
 * Fetches the user's current assessment count from the profile metadata is stored in Firestore
 * and presents a highly polished, interactive progress indicator showing remaining sessions out of 3.
 */
export function AssessmentUsageIndicator({
  className,
  showDetails = true,
}: AssessmentUsageIndicatorProps) {
  const { user } = useUser();

  // Retrieve current usage from user metadata (default to 0)
  const limit = 3;
  const used = user?.metadata?.assessmentCount ?? 0;
  const remaining = Math.max(0, limit - used);

  return (
    <div
      id="assessment-usage-indicator"
      className={cn(
        "p-5 rounded-2xl border border-border bg-bg-card shadow-sm transition-all hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary-blue/10 text-primary-blue">
              {remaining > 0 ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4 text-warning" />
              )}
            </span>
            <h4 className="font-display font-semibold text-sm text-text-primary uppercase tracking-wide">
              Skill Assessment Limit
            </h4>
          </div>
          {showDetails && (
            <p className="text-xs text-text-secondary leading-relaxed max-w-sm mt-1">
              Your account includes up to {limit} free multi-stage skill assessments to discover skill gaps and build accurate roadmap trajectories.
            </p>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <div className="font-mono text-xs font-semibold text-text-secondary tracking-widest uppercase">
            Remaining
          </div>
          <div className="font-display text-2xl font-black text-text-heading">
            {remaining} <span className="text-sm font-medium text-text-secondary">/ {limit}</span>
          </div>
        </div>
      </div>

      {/* Progress visual representation - 3 Pill segments */}
      <div className="mt-4 flex items-center gap-2">
        {Array.from({ length: limit }).map((_, idx) => {
          const isUsed = idx < used;
          return (
            <div
              key={idx}
              className={cn(
                "h-2.5 flex-1 rounded-full transition-all duration-300",
                isUsed
                  ? "bg-warning/30 border border-warning/40 shadow-inner"
                  : "bg-primary-blue border border-primary-blue/50 shadow-[0_0_8px_rgba(37,99,235,0.2)]"
              )}
              title={isUsed ? `Session ${idx + 1} used` : `Session ${idx + 1} remaining`}
            />
          );
        })}
      </div>

      {/* Footer warning or informative note */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-text-secondary">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className={cn("h-3.5 w-3.5", remaining > 0 ? "text-emerald-500" : "text-warning")} />
          <span>
            {remaining === 0 ? (
              <span className="text-warning font-semibold">All assessments used. Upgrade for more.</span>
            ) : (
              <span>Active assessment tokens: <strong className="text-text-primary">{remaining} remaining</strong></span>
            )}
          </span>
        </div>
        <div className="group relative cursor-pointer">
          <HelpCircle className="h-3.5 w-3.5 text-text-secondary/50 hover:text-text-primary transition-colors" />
          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 rounded-lg bg-bg-primary border border-border shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-[10px] leading-normal text-text-secondary pointer-events-none z-50">
            Complimentary limit designed to protect LLM resources during public sandbox testing phases.
          </div>
        </div>
      </div>
    </div>
  );
}
