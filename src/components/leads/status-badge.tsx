import { cn } from "@/lib/utils"

export default function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        active ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground")}
        aria-hidden="true"
      />
      {active ? "Live" : "Paused"}
    </span>
  )
}
