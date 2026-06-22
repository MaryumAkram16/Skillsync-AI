import React, { useState } from "react";
import { Card } from "./Card";
import { Button } from "./Button";
import { ArrowRight, CheckCircle2, Circle, AlertTriangle } from "lucide-react";

interface LearningCardProps {
  skillName: string;
  learnUrl: string;
  title?: string;
  isCompleted?: boolean;
  onToggleComplete?: () => void;
}

function isValidUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function LearningCard({ skillName, learnUrl, title, isCompleted, onToggleComplete }: LearningCardProps) {
  const [urlBroken, setUrlBroken] = useState(false);
  const valid = isValidUrl(learnUrl) && !urlBroken;

  const handleOpen = () => {
    if (!valid) return;
    // Open in new tab — if it 404s the user sees it in the tab
    // We mark as broken if the URL has no valid structure
    window.open(learnUrl, "_blank", "noopener,noreferrer");
  };

  // Build a Google search fallback for broken/missing URLs
  const searchFallback = `https://www.google.com/search?q=${encodeURIComponent(skillName + " tutorial")}`;

  return (
    <Card className={`p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 border ${isCompleted ? 'bg-success/5 border-success/30 shadow-sm' : 'bg-background border-border hover:border-primary-purple/50'} learning-path-card`}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete?.();
          }}
          className={`p-2 rounded-full transition-all shrink-0 ${isCompleted ? 'bg-success text-white' : 'bg-primary-purple/10 text-primary-purple hover:bg-primary-purple/20'}`}
          title={isCompleted ? "Mark as incomplete" : "Mark as completed"}
        >
          {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <h4 className={`font-display font-semibold truncate transition-all ${isCompleted ? 'text-success opacity-80' : 'text-text-primary'}`}>
            {skillName}
          </h4>
          <p className="text-sm text-text-secondary truncate">{title || "Recommended learning resource"}</p>
          {!valid && (
            <p className="text-[11px] text-warning flex items-center gap-1 mt-0.5">
              <AlertTriangle className="h-3 w-3" />
              Resource link unavailable — showing search instead
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant={isCompleted ? "outline" : "secondary"}
          size="sm"
          className={`shrink-0 ${isCompleted ? 'border-success/50 text-success hover:bg-success/5' : ''} ${!valid ? 'opacity-80' : ''}`}
          onClick={() => window.open(valid ? learnUrl : searchFallback, "_blank", "noopener,noreferrer")}
        >
          {isCompleted ? "Review" : "Start Learning"} <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </Card>
  );
}