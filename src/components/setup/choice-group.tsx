import { cn } from "@/lib/utils"

type ChoiceGroupProps<T extends string | number> = {
  name: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  className?: string
}

// A segmented control built on native radio buttons.
export default function ChoiceGroup<T extends string | number>({
  name,
  options,
  value,
  onChange,
  className,
}: ChoiceGroupProps<T>) {
  return (
    <div className={cn("inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1", className)}>
      {options.map((option) => (
        <label
          key={String(option.value)}
          className={cn(
            "cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-all",
            "hover:text-foreground has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm",
            "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
          )}
        >
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
