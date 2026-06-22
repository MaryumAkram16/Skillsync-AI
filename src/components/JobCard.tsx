import React from "react";
import { Card } from "./Card";
import { Button } from "./Button";
import { Briefcase, MapPin, Building, ExternalLink, Percent, Calendar, Bookmark, BookmarkCheck } from "lucide-react";

interface JobCardProps {
  jobTitle: string;
  company: string;
  location: string;
  matchScore: number;
  applyLink: string;
  atsScore?: number;
  keywordMatchScore?: number;
  experienceMatchScore?: number;
  skillMatchScore?: number;
  finalScore?: number;
  posted?: string;
  isSaved?: boolean;
  onSave?: () => void;
  isApplied?: boolean;
  onApply?: () => void;
  onOpenDetails?: () => void;
  isRemote?: boolean;
  employmentType?: string;
  showMatchScore?: boolean;
}

function ScoreBar({ label, score, colorClass }: { label: string; score?: number; colorClass: string }) {
  if (score === undefined) return null;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="font-medium text-text-primary">{score}%</span>
      </div>
      <div className="w-full bg-background rounded-full h-1.5 border border-border">
        <div className={`h-1.5 rounded-full ${colorClass}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function JobCard({
  jobTitle, company, location, matchScore, applyLink,
  atsScore, keywordMatchScore, experienceMatchScore, skillMatchScore, finalScore,
  posted, isSaved = false, onSave, isApplied = false, onApply, onOpenDetails,
  isRemote, employmentType, showMatchScore = true,
}: JobCardProps) {
  const displayScore = finalScore !== undefined ? Math.round(finalScore) : matchScore;

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    onApply?.(); // marks the job "applied" in the user's profile
    window.open(applyLink, "_blank", "noopener,noreferrer");
  };

  return (
    <Card
      className={`p-5 border border-border hover:border-primary-blue/50 transition-colors bg-card flex flex-col h-full ${onOpenDetails ? "cursor-pointer" : ""}`}
      onClick={onOpenDetails}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-display font-semibold text-lg text-text-primary line-clamp-2">{jobTitle}</h3>
        {showMatchScore && (
          <div className="flex items-center gap-1 bg-success/10 text-success px-2 py-1 rounded-md text-xs font-mono font-semibold tracking-wide shrink-0">
            <Percent className="h-3 w-3" />
            {displayScore}% Match
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Building className="h-4 w-4 shrink-0" />
          <span className="truncate">{company}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">{location}</span>
        </div>
        {(isRemote || employmentType) && (
          <div className="flex items-center gap-2 flex-wrap">
            {isRemote && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary-blue/10 text-primary-blue border border-primary-blue/20">
                Remote
              </span>
            )}
            {employmentType && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-card text-text-secondary border border-border">
                {employmentType}
              </span>
            )}
          </div>
        )}
        {posted && (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>Posted {posted}</span>
          </div>
        )}
      </div>

      <div className="flex-1">
        {(atsScore !== undefined || keywordMatchScore !== undefined || experienceMatchScore !== undefined || skillMatchScore !== undefined) && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 pb-5 border-t border-border mt-2">
            <ScoreBar label="ATS Score" score={atsScore} colorClass="bg-primary-purple" />
            <ScoreBar label="Keyword Match" score={keywordMatchScore} colorClass="bg-primary-blue" />
            <ScoreBar label="Experience" score={experienceMatchScore} colorClass="bg-warning" />
            <ScoreBar label="Skill Match" score={skillMatchScore} colorClass="bg-success" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-auto w-full">
        {/* Save Job Button */}
        <Button
          variant="outline"
          className={`shrink-0 transition-all ${
            isSaved
              ? "border-success/50 text-success bg-success/5 hover:bg-success/10"
              : "hover:border-primary-blue/50"
          }`}
          title={isSaved ? "Job saved" : "Save job"}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSave?.(); }}
          disabled={isSaved}
        >
          {isSaved
            ? <BookmarkCheck className="h-4 w-4" />
            : <Bookmark className="h-4 w-4" />
          }
        </Button>

        <Button
          className={`flex-1 ${isApplied ? "opacity-70" : ""}`}
          onClick={handleApply}
        >
          {isApplied ? "Applied ✓" : "Apply Now"} <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </Card>
  );
}