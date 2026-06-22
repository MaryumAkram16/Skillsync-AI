import { cn } from "../utils/cn";

interface HeatmapCellProps {
  value: number; // 0 to 100
  label: string;
  className?: string;
}

export function HeatmapCell({ value, label, className }: HeatmapCellProps) {
  // Determine color based on value
  let bgColor = "bg-card";
  let textColor = "text-text-secondary";
  
  if (value >= 80) {
    bgColor = "bg-success/20 border-success/30";
    textColor = "text-success";
  } else if (value >= 50) {
    bgColor = "bg-warning/20 border-warning/30";
    textColor = "text-warning";
  } else if (value > 0) {
    bgColor = "bg-danger/20 border-danger/30";
    textColor = "text-danger";
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-4 rounded-lg border transition-colors hover:bg-opacity-80",
        bgColor,
        className
      )}
    >
      <span className={cn("text-lg font-bold", textColor)}>{value}%</span>
      <span className="text-xs text-center mt-1 text-text-secondary">{label}</span>
    </div>
  );
}
