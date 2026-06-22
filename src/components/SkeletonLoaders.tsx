import { motion } from "motion/react";

export function SkeletonPulseLine({ className = "h-4 bg-white/10 rounded-lg w-full" }: { className?: string }) {
  return (
    <div className={`animate-pulse relative overflow-hidden bg-white/5 rounded-lg ${className}`}>
      <div 
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" 
        style={{
          backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%)",
        }}
      />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      {/* Welcome Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-white/10 rounded-lg shrink-0" />
          <div className="space-y-2">
            <SkeletonPulseLine className="h-8 w-64 bg-white/10 rounded-xl" />
            <SkeletonPulseLine className="h-4 w-48 bg-white/5 rounded-lg ml-1" />
          </div>
        </div>
        <div className="h-10 w-32 bg-white/10 rounded-xl shrink-0" />
      </div>

      {/* Top Stats Grid */}
      <div className="grid gap-8 md:grid-cols-3">
        {/* Card 1 */}
        <div className="p-6 sm:p-8 bg-card/40 border border-border/80 rounded-[1.5rem] sm:rounded-[2rem] space-y-6 relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-white/10 rounded-xl shrink-0" />
            <SkeletonPulseLine className="h-4 w-28 bg-white/10" />
          </div>
          <SkeletonPulseLine className="h-12 w-20 bg-white/10 rounded-xl" />
          <div className="flex gap-2">
            <SkeletonPulseLine className="h-6 w-16 bg-white/5" />
            <SkeletonPulseLine className="h-6 w-16 bg-white/5" />
            <SkeletonPulseLine className="h-6 w-12 bg-white/5" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-6 sm:p-8 bg-card/40 border border-border/80 rounded-[1.5rem] sm:rounded-[2rem] space-y-6 relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-white/10 rounded-xl shrink-0" />
            <SkeletonPulseLine className="h-4 w-32 bg-white/10" />
          </div>
          <div className="space-y-2">
            <SkeletonPulseLine className="h-3 w-full bg-white/5" />
            <SkeletonPulseLine className="h-3 w-5/6 bg-white/5" />
          </div>
          <SkeletonPulseLine className="h-11 w-full bg-white/10 rounded-xl mt-4" />
        </div>

        {/* Card 3 */}
        <div className="p-6 sm:p-8 bg-card/40 border border-border/80 rounded-[1.5rem] sm:rounded-[2rem] space-y-4 relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-white/10 rounded-xl shrink-0" />
            <SkeletonPulseLine className="h-4 w-36 bg-white/10" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <SkeletonPulseLine className="h-3 w-16 bg-white/5" />
              <SkeletonPulseLine className="h-3 w-8 bg-white/5" />
            </div>
            <SkeletonPulseLine className="h-2 w-full bg-white/10 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="h-10 bg-white/5 rounded-xl" />
            <div className="h-10 bg-white/5 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Main Chart Box */}
      <div className="p-8 bg-card/40 border border-border/80 rounded-[2rem] space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <SkeletonPulseLine className="h-5 w-48 bg-white/10" />
            <SkeletonPulseLine className="h-3.5 w-64 bg-white/5" />
          </div>
          <SkeletonPulseLine className="h-8 w-24 bg-white/10 rounded-lg" />
        </div>
        <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
      </div>

      {/* Two Columns Row */}
      <div className="grid gap-8 md:grid-cols-2">
        {/* Interview Prep */}
        <div className="p-6 sm:p-8 bg-card/40 border border-border/80 rounded-[1.5rem] sm:rounded-[2rem] space-y-6">
          <div className="flex justify-between items-center">
            <SkeletonPulseLine className="h-6 w-44 bg-white/10" />
            <SkeletonPulseLine className="h-3.5 w-16 bg-white/5" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="h-11 w-11 bg-white/10 rounded-xl" />
              <div className="space-y-2 flex-1">
                <SkeletonPulseLine className="h-4 w-28 bg-white/10" />
                <SkeletonPulseLine className="h-3.5 w-36 bg-white/5" />
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="h-11 w-11 bg-white/10 rounded-xl" />
              <div className="space-y-2 flex-1">
                <SkeletonPulseLine className="h-4 w-32 bg-white/10" />
                <SkeletonPulseLine className="h-3.5 w-40 bg-white/5" />
              </div>
            </div>
          </div>
          <SkeletonPulseLine className="h-12 w-full bg-white/10 rounded-xl" />
        </div>

        {/* Action Items */}
        <div className="p-6 sm:p-8 bg-card/40 border border-border/80 rounded-[1.5rem] sm:rounded-[2rem] space-y-6">
          <div className="flex justify-between items-center">
            <SkeletonPulseLine className="h-6 w-32 bg-white/10" />
            <SkeletonPulseLine className="h-6 w-16 bg-white/5 rounded-xl" />
          </div>
          <div className="flex gap-3">
            <div className="h-12 bg-white/5 rounded-xl flex-1 border border-white/5" />
            <div className="h-12 w-12 bg-white/10 rounded-xl" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="h-6 w-6 rounded-full bg-white/10" />
                <SkeletonPulseLine className="h-4 w-3/4 bg-white/5" />
                <div className="h-5 w-5 bg-white/5 rounded ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CareerMentorSkeleton() {
  return (
    <div className="space-y-12 w-full">
      {/* Title & Hub Header */}
      <div className="text-center space-y-4 animate-pulse">
        <SkeletonPulseLine className="h-10 sm:h-12 w-80 bg-white/10 mx-auto rounded-xl" />
        <SkeletonPulseLine className="h-4 sm:h-5 w-96 bg-white/5 mx-auto rounded-lg" />
      </div>

      {/* Grid of 3 Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 sm:p-8 pb-10 sm:pb-12 flex flex-col h-full border-2 border-border/60 bg-card/40 rounded-[2rem] sm:rounded-[2.5rem] relative overflow-hidden space-y-6"
          >
            {/* Header / Top Meta */}
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-3 flex-1">
                <SkeletonPulseLine className="h-7 w-36 bg-white/10 rounded-lg" />
                <SkeletonPulseLine className="h-3.5 w-44 bg-white/5 rounded-md" />
              </div>
              {/* Match circle placeholder */}
              <div className="w-14 h-14 rounded-full border-4 border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                <div className="h-2 w-2 rounded-full bg-white/10 animate-ping" />
              </div>
            </div>

            {/* Demand badge */}
            <SkeletonPulseLine className="h-6 w-24 bg-white/10 rounded-full" />

            {/* Divider */}
            <div className="border-t border-white/5 my-1" />

            {/* Key Data list */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-white/10 shrink-0" />
                <SkeletonPulseLine className="h-4 w-40 bg-white/5" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-white/10 shrink-0" />
                <SkeletonPulseLine className="h-4 w-32 bg-white/5" />
              </div>
            </div>

            {/* Gap Analysis Box */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
              <div className="space-y-2">
                <SkeletonPulseLine className="h-3 w-20 bg-white/10" />
                <SkeletonPulseLine className="h-2.5 w-3/4 bg-white/5" />
              </div>
              <div className="space-y-2">
                <SkeletonPulseLine className="h-3 w-20 bg-white/10" />
                <SkeletonPulseLine className="h-2.5 w-2/3 bg-white/5" />
              </div>
            </div>

            {/* Career path progression slider/arrows */}
            <div className="space-y-2 pt-2">
              <SkeletonPulseLine className="h-3 w-28 bg-white/10" />
              <div className="flex items-center gap-2">
                <SkeletonPulseLine className="h-5 w-16 bg-white/5 rounded" />
                <div className="h-3 w-3 bg-white/5 rounded-full" />
                <SkeletonPulseLine className="h-5 w-16 bg-white/5 rounded" />
              </div>
            </div>

            {/* CTA action button */}
            <div className="mt-auto pt-4">
              <SkeletonPulseLine className="h-11 w-full bg-white/10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RouteLoadingSkeleton() {
  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* Sidebar - Desktop Placeholder */}
      <div className="hidden lg:flex h-screen w-64 flex-col border-r border-border bg-card p-4 space-y-6 shrink-0">
        {/* Logo Section */}
        <div className="flex h-12 items-center gap-2 border-b border-border px-2 pb-4">
          <div className="h-8 w-8 animate-pulse bg-primary-blue/20 rounded-lg shrink-0" />
          <SkeletonPulseLine className="h-5 w-28 bg-white/10" />
        </div>

        {/* Nav Items */}
        <div className="flex-1 space-y-4 py-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="h-4 w-4 animate-pulse bg-white/10 rounded-md shrink-0" />
              <SkeletonPulseLine className={`h-4 bg-white/5 ${i % 2 === 0 ? 'w-24' : 'w-32'}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area Placeholder */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Placeholder */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-6 w-6 lg:hidden animate-pulse bg-white/10 rounded-md" />
            <SkeletonPulseLine className="h-6 w-36 sm:w-48 bg-white/15 rounded-md" />
          </div>

          <div className="flex items-center gap-3">
            {/* ThemeToggle / Feedback Buttons Skeletons */}
            <div className="h-9 w-9 bg-white/10 rounded-xl" />
            <div className="h-9 w-20 bg-white/10 rounded-xl hidden sm:block" />
          </div>
        </header>

        {/* Page Content Placeholder - Mimics a standard professional app dashboard page layout */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full">
          <div className="max-w-[1600px] mx-auto p-4 lg:p-8 space-y-8">
            
            {/* Page Header Area */}
            <div className="space-y-3">
              <SkeletonPulseLine className="h-8 w-48 sm:w-64 bg-white/15 rounded-xl" />
              <SkeletonPulseLine className="h-4 w-64 sm:w-96 bg-white/5 rounded-md" />
            </div>

            {/* Quick Actions / Stats Grid */}
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-5 bg-card/30 border border-border/60 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-10 w-10 bg-white/10 rounded-xl" />
                    <SkeletonPulseLine className="h-3 w-12 bg-white/5" />
                  </div>
                  <div className="space-y-2">
                    <SkeletonPulseLine className="h-6 w-20 bg-white/10 rounded-md" />
                    <SkeletonPulseLine className="h-3.5 w-full bg-white/5" />
                  </div>
                </div>
              ))}
            </div>

            {/* Main Central Content Block & Side Card */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 p-6 bg-card/30 border border-border/60 rounded-2xl space-y-6">
                <div className="flex justify-between items-center">
                  <SkeletonPulseLine className="h-5 w-40 bg-white/10" />
                  <div className="h-8 w-16 bg-white/10 rounded-lg" />
                </div>
                <div className="space-y-4">
                  <div className="h-40 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-white/15 animate-ping" />
                  </div>
                  <div className="space-y-2">
                    <SkeletonPulseLine className="h-3.5 w-full bg-white/5" />
                    <SkeletonPulseLine className="h-3.5 w-5/6 bg-white/5" />
                    <SkeletonPulseLine className="h-3.5 w-4/6 bg-white/5" />
                  </div>
                </div>
              </div>

              <div className="p-6 bg-card/30 border border-border/60 rounded-2xl space-y-6">
                <SkeletonPulseLine className="h-5 w-32 bg-white/10" />
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-10 w-10 bg-white/10 rounded-xl shrink-0" />
                      <div className="space-y-2 flex-1">
                        <SkeletonPulseLine className="h-4 w-3/4 bg-white/10" />
                        <SkeletonPulseLine className="h-3.5 w-1/2 bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

