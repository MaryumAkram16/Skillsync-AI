import { diffWords } from "diff";

/**
 * Renders an original-vs-rewritten bullet point as a side-by-side word diff.
 * Extracted from resume-tools.tsx — purely presentational, no shared state
 * with the rest of that page, so it was safe to pull out as-is.
 */
export const BulletDiff = ({ original, rewritten }: { original: string; rewritten: string }) => {
  const diff = diffWords(original, rewritten);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">Original</p>
          <div className="p-3 rounded-lg bg-danger/5 border border-danger/10 text-sm text-text-primary leading-relaxed">
            {diff.map((part, i) => (
              <span
                key={i}
                className={part.removed ? "bg-danger/20 text-danger line-through decoration-danger/50" : part.added ? "hidden" : ""}
              >
                {part.value}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[10px] text-primary-purple uppercase tracking-widest">Optimized</p>
          <div className="p-3 rounded-lg bg-success/5 border border-success/10 text-sm text-text-primary leading-relaxed">
            {diff.map((part, i) => (
              <span
                key={i}
                className={part.added ? "bg-success/20 text-success font-medium" : part.removed ? "hidden" : ""}
              >
                {part.value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
