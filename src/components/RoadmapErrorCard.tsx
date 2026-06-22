import { motion } from "motion/react";
import { RefreshCw, Lightbulb } from "lucide-react";
import { Button } from "../components/Button";
import { getErrorInfo } from "../utils/roadmapHelpers";

/**
 * Extracted from roadmap.tsx — depends only on its props and the
 * extracted getErrorInfo() helper, no shared state with the page.
 */
export function ErrorCard({
  error,
  onRetry,
  onDismiss,
}: {
  error: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const info = getErrorInfo(error);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="overflow-hidden"
    >
      <div className="p-0 border border-danger/20 rounded-2xl bg-danger/[0.02] shadow-sm">
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-danger/10">
          <div className="p-6 md:w-1/2">
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <div className="p-2 rounded-lg bg-red-500/10">{info.icon}</div>
              <h3 className="font-display font-semibold text-lg">{info.type}</h3>
            </div>
            <p className="text-sm text-text-primary mb-4 leading-relaxed">
              {info.description}
            </p>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white border-none"
                onClick={onRetry}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Retry Generation
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-text-secondary hover:text-text-primary"
                onClick={onDismiss}
              >
                Dismiss
              </Button>
            </div>
          </div>
          <div className="p-6 md:w-1/2 bg-red-500/[0.01]">
            <h4 className="font-mono text-xs uppercase tracking-widest text-text-secondary mb-4 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Troubleshooting Tips
            </h4>
            <ul className="space-y-3">
              {info.tips.map((tip, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-text-primary"
                >
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500/40 flex-shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}