import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Sparkles, X } from "lucide-react";

interface FeatureHoverDemoProps {
  children: React.ReactNode;
  featureName: string;
  demoVideoUrl?: string;
  description: string;
  /**
   * How much to zoom into the recorded video, e.g. 1.4 = 40% larger/cropped in.
   * Useful when the source recording was captured at a high desktop resolution
   * (e.g. a large gaming laptop screen) and the actual UI being demoed only
   * takes up a small portion of the frame — zooming in crops out the dead
   * space around it so the demo reads clearly inside the small popup/modal.
   * Defaults to 1 (no zoom). Combine with videoPosition to re-center the crop.
   */
  videoZoom?: number;
  /** CSS object-position for the video, e.g. "center top" or "30% 50%". Only
   * matters when videoZoom > 1, to control which part of the frame stays
   * visible after cropping. Defaults to "center center". */
  videoPosition?: string;
}

// Detects touch-primary devices (phones/tablets) vs hover-capable devices
// (laptops/desktops with a mouse). The (hover: none) media query alone isn't
// reliable on every mobile browser / dev-tools emulator, so this combines it
// with maxTouchPoints and a viewport-width fallback — if ANY signal says
// "touch", we treat it as touch. Getting this wrong on a real phone means a
// tap falls through to the desktop hover branch, where it acts like a click
// and navigates immediately instead of showing the demo first.
function useIsTouchDevice() {
  const detect = () => {
    if (typeof window === "undefined") return false;
    const hoverNone = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    const hasTouchPoints = navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0;
    const hasTouchEvent = "ontouchstart" in window;
    const narrowViewport = window.innerWidth <= 820; // covers phones + most tablets in portrait
    return hoverNone || hasTouchPoints || hasTouchEvent || narrowViewport;
  };

  const [isTouch, setIsTouch] = useState(detect);

  useEffect(() => {
    setIsTouch(detect());
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const handler = () => setIsTouch(detect());
    mq.addEventListener("change", handler);
    window.addEventListener("resize", handler);
    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("resize", handler);
    };
  }, []);
  return isTouch;
}

export function FeatureHoverDemo({ children, featureName, demoVideoUrl, description, videoZoom = 1, videoPosition = "center center" }: FeatureHoverDemoProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTouch = useIsTouchDevice();

  const DemoContent = () => {
    const [videoError, setVideoError] = useState(false);

    return (
      <>
        <div className="bg-slate-900 relative flex items-center justify-center overflow-hidden" style={{ aspectRatio: '16/9', minHeight: '320px' }}>
          {demoVideoUrl && !videoError ? (
            <video
              src={demoVideoUrl}
              autoPlay
              loop
              muted
              playsInline
              onError={() => setVideoError(true)}
              className="w-full h-full object-cover"
              style={{
                objectPosition: videoPosition,
                transform: videoZoom !== 1 ? `scale(${videoZoom})` : undefined,
                transformOrigin: videoPosition,
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary-blue/10 to-primary-purple/10 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <div className="relative h-12 w-12 border border-primary-blue/30 rounded-full flex items-center justify-center">
                <div className="absolute inset-0 border-t-2 border-primary-blue rounded-full animate-spin" />
                <div className="h-2.5 w-2.5 bg-primary-blue rounded-full animate-pulse" />
              </div>
              <p className="text-[10px] text-text-secondary font-medium select-none">
                Demo visualization rendering...
              </p>
            </div>
          )}
        </div>
        <div className="p-4 bg-card/80 backdrop-blur-sm">
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {description}
          </p>
        </div>
      </>
    );
  };

  // ── Mobile/touch: tap-to-open modal, no hover behavior at all ───────────
  if (isTouch) {
    return (
      <div className="relative">
        {children}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMobileModalOpen(true);
          }}
          className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-blue/10 text-primary-blue border border-primary-blue/30 text-xs font-bold uppercase tracking-widest active:scale-[0.98] transition-transform"
        >
          <Play className="h-3 w-3 fill-primary-blue" />
          Watch Demo
        </button>

        <AnimatePresence>
          {mobileModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setMobileModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm overflow-hidden rounded-2xl border border-primary-blue/30 bg-card shadow-2xl"
              >
                <div className="flex items-center justify-between gap-2 bg-primary-blue/10 px-3 py-2.5 border-b border-primary-blue/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-primary-blue" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary-blue">
                      Quick Demo: {featureName}
                    </span>
                  </div>
                  <button onClick={() => setMobileModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <DemoContent />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Desktop: hover-to-show popup ─────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: "-50%", y: 10 }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: "-50%", y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-50 pointer-events-none w-[min(600px,90vw)] overflow-hidden rounded-2xl border border-primary-blue/30 bg-card shadow-2xl shadow-primary-blue/20"
            style={{
              left: "50%",
              bottom: "110%",
            }}
          >
            <div className="flex items-center gap-2 bg-primary-blue/10 px-3 py-2 border-b border-primary-blue/20">
              <Sparkles className="h-3 w-3 text-primary-blue" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary-blue">
                Quick Demo: {featureName}
              </span>
            </div>
            <DemoContent />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}