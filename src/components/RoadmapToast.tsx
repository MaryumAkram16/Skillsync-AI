import { useEffect } from "react";
import { motion } from "motion/react";
import { cn } from "../utils/cn";

/**
 * Extracted from roadmap.tsx. Named "RoadmapToast" (not "Toast") to avoid
 * colliding with the existing shared components/Toast.tsx (the useToast()
 * hook). NOTE: this page already imports and uses that shared useToast()
 * hook elsewhere (for ai/error/success messages) — this local component is
 * a separate, parallel toast implementation for a specific local `toast`
 * state variable. That's duplicate functionality worth consolidating onto
 * the shared hook at some point, but doing that consolidation safely means
 * tracing every call site that sets the local `toast` state first — a
 * separate, slightly riskier task from tonight's "extract as-is" pass.
 *
 * A non-blocking toast for transient confirmations (copied to clipboard etc.)
 * Replaces native alert() so the UI stays in-frame.
 */
export function RoadmapToast({
  message,
  tone = "success",
  onClose,
}: {
  message: string;
  tone?: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold backdrop-blur-md border",
        tone === "success"
          ? "bg-green-500/95 text-white border-green-400"
          : "bg-red-500/95 text-white border-red-400"
      )}
    >
      {message}
    </motion.div>
  );
}
