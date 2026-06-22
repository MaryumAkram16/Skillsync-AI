import React from 'react'
import { Lock, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

interface UsageLimitBannerProps {
  feature: string        // e.g. "Career Mentor"
  limit: number          // e.g. 2
  used: number           // how many they've used
  showLocked?: boolean   // show the full locked screen vs just a warning strip
}

// ── Small strip warning (shown when getting close) ────────────────────────────
export function UsageLimitStrip({ feature, limit, used }: UsageLimitBannerProps) {
  const remaining = limit - used
  if (remaining > 1) return null // only show when 1 left

  return (
    <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-warning/30 bg-warning/5">
      <Sparkles className="w-4 h-4 text-warning flex-shrink-0" />
      <p className="text-xs font-medium text-warning">
        {remaining === 0
          ? `You've used all ${limit} free ${feature} uses.`
          : `You have ${remaining} free ${feature} use${remaining === 1 ? '' : 's'} remaining.`}
      </p>
    </div>
  )
}

// ── Full locked screen ────────────────────────────────────────────────────────
export function UsageLimitLocked({ feature, limit }: { feature: string; limit: number }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      {/* Lock icon */}
      <div className="w-20 h-20 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center mb-6">
        <Lock className="w-9 h-9 text-warning" />
      </div>

      {/* Heading */}
      <h2 className="font-display text-2xl font-semibold text-text-heading uppercase tracking-tight mb-2">
        Free Limit Reached
      </h2>
      <p className="text-sm text-text-secondary max-w-sm mb-1">
        You've used your <span className="text-warning font-semibold">{limit} free {feature}</span> {limit === 1 ? 'report' : 'uses'}.
      </p>
      <p className="text-xs text-text-secondary/60 max-w-sm mb-8">
        This limit helps us keep SkillSync running for everyone during the testing phase. Thank you for understanding!
      </p>

      {/* Usage pills */}
      <div className="flex items-center gap-2 mb-8">
        {Array.from({ length: limit }).map((_, i) => (
          <div
            key={i}
            className="w-8 h-2 rounded-full bg-warning"
          />
        ))}
        <span className="text-xs text-warning font-black ml-1">{limit}/{limit} used</span>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/dashboard"
          className="px-6 py-3 rounded-xl border border-border text-text-secondary
            hover:bg-border/30 transition-colors text-sm font-bold uppercase tracking-widest"
        >
          Back to Dashboard
        </Link>
        <Link
          to="/skill-assessment"
          className="px-6 py-3 rounded-xl bg-primary-blue text-white
            hover:opacity-90 transition-opacity text-sm font-bold uppercase tracking-widest"
        >
          Try Other Features
        </Link>
      </div>

      {/* Fine print */}
      <p className="text-xs text-text-secondary/40 mt-8 max-w-xs">
        Limits reset at the end of the testing phase. Your saved results are still accessible in your profile.
      </p>
    </div>
  )
}