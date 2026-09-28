import { cn } from "@/lib/utils"
import { setupSteps } from "@/lib/setup"

export default function SetupProgress({ current }: { current: number }) {
  return (
    <ol
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${setupSteps.length}, minmax(0, 1fr))` }}
      aria-label="Setup progress"
    >
      {setupSteps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? "step" : undefined}
          className="flex flex-col gap-2"
        >
          <span
            className={cn(
              "h-1.5 rounded-full",
              index <= current ? "bg-gradient-to-r from-primary to-fuchsia-500" : "bg-border",
            )}
          />
          <span
            className={cn(
              "hidden text-xs sm:block",
              index === current ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {step}
          </span>
        </li>
      ))}
    </ol>
  )
}
