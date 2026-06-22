import React from "react";
import { cn } from "../utils/cn";

interface SkillTagProps {
  name: string;
  level?: "high" | "medium" | "low";
  className?: string;
  key?: React.Key;
  onClick?: () => void;
  isActive?: boolean;
}

export function SkillTag({ name, level = "medium", className, onClick, isActive }: SkillTagProps) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium border transition-all hover:scale-105",
        onClick ? "cursor-pointer" : "cursor-default",
        {
          "bg-danger/10 text-danger border-danger/20 hover:bg-danger/20": level === "high",
          "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20": level === "medium",
          "bg-success/10 text-success border-success/20 hover:bg-success/20 opacity-90": level === "low",
        },
        isActive && "ring-2 ring-offset-1 ring-current",
        className
      )}
    >
      {name}
    </Tag>
  );
}

// ── Mono demand label ───────────────────────────────────────────────────────
// Matches the landing page's font-mono uppercase tracking-widest treatment
// used for step numbers and tags (see index.tsx / index.css). Drop this above
// a SkillTag group so feature pages share the landing page's data-terminal
// texture instead of plain font-bold section headers.

const DEMAND_COLOR: Record<NonNullable<SkillTagProps["level"]>, string> = {
  high: "text-danger",
  medium: "text-warning",
  low: "text-success",
};

export function DemandLabel({ level = "medium", children }: { level?: SkillTagProps["level"]; children: React.ReactNode }) {
  return (
    <span className={cn("font-mono text-[10px] uppercase tracking-widest", DEMAND_COLOR[level])}>
      {children}
    </span>
  );
}