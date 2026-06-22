import React, { useState } from "react";
import { motion } from "motion/react";
import { Card } from "../Card";
import { Shield, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { SavedResult } from "../../types/profile";
import { useNavigate } from "react-router-dom";

interface SavedResultsProps {
  user: any;
  setSelectedResult: (result: SavedResult) => void;
}

export const SavedResults: React.FC<SavedResultsProps> = ({ user, setSelectedResult }) => {
  const navigate = useNavigate();
  
  const resultSections = [
    { title: 'Assessments', data: user.savedAssessments || [], color: 'text-primary-blue', bg: 'bg-primary-blue/10' },
    { title: 'Career Reports', data: user.savedCareerReports || [], color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
    { title: 'Roadmaps', data: user.savedRoadmaps || [], color: 'text-success', bg: 'bg-success/10' },
    { title: 'Market Analysis', data: user.savedRadarAnalyses || [], color: 'text-warning', bg: 'bg-warning/10' },
    { title: 'Resume Assets', data: user.savedResumeItems || [], color: 'text-primary-violet', bg: 'bg-primary-violet/10' },
    { title: 'Gap Maps', data: user.savedGapAnalyses || [], color: 'text-danger', bg: 'bg-danger/10' },
    { title: 'Interviews', data: user.savedInterviewSessions || [], color: 'text-primary-blue', bg: 'bg-primary-blue/10' },
  ];

  return (
    <div className="space-y-12">
      {resultSections.map((section) => (
        <div key={section.title} className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className={cn("p-2 rounded-xl", section.bg)}>
              <Shield className={cn("h-5 w-5", section.color)} />
            </div>
            <h3 className="font-display text-xl font-semibold text-text-primary uppercase tracking-tight">{section.title}</h3>
            <div className="h-px flex-1 bg-border ml-4 opacity-50" />
            <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">{section.data.length} Results</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.data.length > 0 ? (
              section.data.map((item: any, i: number) => (
                <motion.div
                  key={item.id ? `${item.id}-${i}` : `saved-result-${i}`}
                  whileHover={{ y: -4 }}
                  className="group"
                  onClick={() => {
                    if (item.type === 'roadmap') {
                      navigate('/roadmap', { state: { roadmap: item.data, goal: (item as any).goal, level: (item as any).level } });
                    } else {
                      setSelectedResult(item as SavedResult);
                    }
                  }}
                >
                  <Card className="p-6 border border-border bg-card hover:bg-card transition-all cursor-pointer h-full border border-white/0 group-hover:border-border">
                    <div className="flex justify-between items-start mb-4">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-text-secondary/60">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </div>
                      <div className={cn("px-2 py-0.5 rounded-full font-mono text-[8px] uppercase tracking-widest", section.bg || 'bg-background', section.color)}>
                        {item.type.replace('-', ' ')}
                      </div>
                    </div>
                    <h4 className="font-display font-semibold text-text-primary text-lg uppercase tracking-tight line-clamp-2 mb-2 group-hover:text-primary-blue transition-colors">
                      {item.title}
                    </h4>
                    {item.type === 'skill-assessment' && (
                      <div className="mt-4 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">Score</span>
                        <span className="text-xl font-black text-primary-blue">{(item as any).score}%</span>
                      </div>
                    )}
                    {item.type === 'interview-training' && (
                      <div className="mt-4 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">Performance</span>
                        <span className="text-xl font-black text-primary-purple">{(item as any).score}%</span>
                      </div>
                    )}
                    {item.type === 'resume-tool' && (
                      <div className="mt-4 space-y-1">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">{(item as any).jobTitle}</p>
                        <p className="text-[10px] text-text-secondary/70 truncate">{(item as any).company}</p>
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full p-12 text-center rounded-[3rem] border-2 border-dashed border-border bg-background">
                <p className="text-text-secondary/60 font-medium italic">No saved results in this category yet.</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
