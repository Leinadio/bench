import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  label: string;
  size?: "sm" | "md";
}

function scoreColor(score: number): string {
  if (score <= 2) return "bg-red-500";
  if (score === 3) return "bg-yellow-500";
  return "bg-green-500";
}

function scoreTextColor(score: number): string {
  if (score <= 2) return "text-red-700";
  if (score === 3) return "text-yellow-700";
  return "text-green-700";
}

export function ScoreBadge({ score, label, size = "md" }: ScoreBadgeProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1", size === "sm" && "scale-90")}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center text-white font-bold",
          scoreColor(score),
          size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs"
        )}
      >
        {score}/5
      </div>
      <span className={cn("text-xs font-medium", scoreTextColor(score))}>{label}</span>
    </div>
  );
}
