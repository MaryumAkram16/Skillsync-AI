import React, { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { TrendingUp, CheckCircle2, Circle } from 'lucide-react'
import { Card } from './Card'

interface ProgressTrackerProps {
  score: number           // 0–100 SkillSync score
  hasAssessment: boolean
  hasCareerReport: boolean
  hasRoadmap: boolean
  skillCount: number
}

// Radial SVG progress ring
function RadialRing({ percent, size = 120, stroke = 10 }: { percent: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  // Color based on progress
  const color =
    percent >= 75 ? '#10b981' :   // emerald
    percent >= 40 ? '#f59e0b' :   // gold
    '#ef4444'                      // red

  return (
    <svg width={size} height={size} className="-rotate-90">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#374151"
        strokeWidth={stroke}
      />
      {/* Progress arc */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
      />
    </svg>
  )
}

const MILESTONES = [
  { label: 'Skill Assessment', done: (p: ProgressTrackerProps) => p.hasAssessment },
  { label: 'Career Report',    done: (p: ProgressTrackerProps) => p.hasCareerReport },
  { label: 'Roadmap Built',    done: (p: ProgressTrackerProps) => p.hasRoadmap },
  { label: '5+ Skills Added',  done: (p: ProgressTrackerProps) => p.skillCount >= 5 },
]

export function ProgressTracker(props: ProgressTrackerProps) {
  const { score } = props

  // Clamp score to 0–100
  const pct = Math.min(100, Math.max(0, score))

  const completedMilestones = MILESTONES.filter((m) => m.done(props)).length
  const milestonePercent = Math.round((completedMilestones / MILESTONES.length) * 100)

  const label =
    pct >= 75 ? 'Advanced' :
    pct >= 40 ? 'Intermediate' :
    pct > 0   ? 'Beginner' :
                'Not Started'

  const labelColor =
    pct >= 75 ? 'text-[#10b981]' :
    pct >= 40 ? 'text-[#f59e0b]' :
    pct > 0   ? 'text-[#ef4444]' :
                'text-[#9ca3af]'

  return (
    <Card className="p-6 bg-bg-card border-border shadow-2xl rounded-[2rem] relative overflow-hidden h-full group hover:bg-bg-primary transition-all duration-300">
      {/* Landing-page signature: scanline texture */}
      <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-30" />

      {/* Background icon */}
      <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
        <TrendingUp className="h-48 w-48 text-primary-blue" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-3 bg-primary-blue/10 rounded-2xl text-primary-blue border border-primary-blue/20">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-primary-purple mb-0.5">
            <span className="h-1 w-1 rounded-full bg-primary-purple animate-pulse-violet" />
            Live tracking
          </span>
          <h3 className="font-display font-semibold text-text-heading uppercase tracking-widest text-xs">
            Career Progress
          </h3>
        </div>
      </div>

      {/* Radial ring + score */}
      <div className="flex items-center gap-6 mb-6 relative z-10">
        <div className="relative flex-shrink-0">
          <RadialRing percent={pct} size={110} stroke={9} />
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-text-heading leading-none">{pct}</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-text-secondary">score</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className={`font-mono text-sm uppercase tracking-widest mb-1 ${labelColor}`}>{label}</p>
          <p className="text-xs text-text-secondary mb-3 leading-snug">
            {pct === 0
              ? 'Take the skill assessment to get started'
              : pct >= 75
              ? 'Excellent progress! Keep it up.'
              : 'Keep completing milestones to level up'}
          </p>

          {/* Milestone bar */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                Milestones
              </span>
              <span className="text-[10px] font-black text-primary-blue">
                {completedMilestones}/{MILESTONES.length}
              </span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary-blue"
                style={{ filter: 'drop-shadow(0 0 4px #10b98188)' }}
                initial={{ width: 0 }}
                animate={{ width: `${milestonePercent}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Milestone checklist */}
      <div className="space-y-2 relative z-10">
        {MILESTONES.map((m) => {
          const done = m.done(props)
          return (
            <div key={m.label} className="flex items-center gap-2">
              {done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-[#374151] flex-shrink-0" />
              )}
              <span className={`text-[11px] font-medium ${done ? 'text-text-primary' : 'text-text-secondary'}`}>
                {m.label}
              </span>
              {done && (
                <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.5 rounded-full">
                  Done
                </span>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}