import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  label: string;
  size?: "sm" | "md";
}

function scoreStyle(score: number) {
  if (score <= 2)
    return {
      bg: "bg-red-50",
      text: "text-red-700",
      ring: "ring-red-200",
      label: "text-red-600",
    };
  if (score === 3)
    return {
      bg: "bg-amber-50",
      text: "text-amber-700",
      ring: "ring-amber-200",
      label: "text-amber-600",
    };
  return {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    label: "text-emerald-600",
  };
}

export function ScoreBadge({ score, label, size = "md" }: ScoreBadgeProps) {
  const style = scoreStyle(score);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5",
        size === "sm" && "scale-90"
      )}
    >
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold ring-1",
          style.ring,
          style.bg,
          style.text,
          size === "md" ? "w-11 h-11 text-base" : "w-9 h-9 text-sm"
        )}
      >
        {score}
      </div>
      {label && (
        <span
          className={cn(
            "text-xs font-medium",
            style.label
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
