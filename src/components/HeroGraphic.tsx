import { CalendarCheck, Megaphone, Search, TrendingUp } from "lucide-react";

const bars = [38, 52, 44, 63, 58, 76, 88];

export default function HeroGraphic() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      {/* Glow */}
      <div className="absolute -inset-8 rounded-full bg-gradient-to-tr from-sky-400/30 via-violet-400/25 to-fuchsia-400/20 blur-3xl" />

      {/* Dashboard card */}
      <div className="relative rounded-2xl border bg-card p-6 pt-10 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Leads this week</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">248</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="size-3.5" />
            +38%
          </span>
        </div>

        <svg viewBox="0 0 280 110" preserveAspectRatio="none" className="mt-6 h-28 w-full overflow-visible">
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(139 92 246)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(139 92 246)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 90 C30 84 45 70 70 72 S115 50 140 54 S185 30 210 34 S255 12 280 8 L280 110 L0 110 Z"
            fill="url(#area)"
          />
          <path
            d="M0 90 C30 84 45 70 70 72 S115 50 140 54 S185 30 210 34 S255 12 280 8"
            fill="none"
            stroke="rgb(139 92 246)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
        </svg>

        <div className="mt-6 flex h-16 items-end gap-2">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md bg-gradient-to-t from-sky-500/70 to-violet-500/70"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="flex-1 text-center">{d}</span>
          ))}
        </div>
      </div>

      {/* Floating channel chips */}
      <div className="absolute -top-5 -left-2 flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-medium shadow-lg sm:-left-8">
        <span className="flex size-6 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600">
          <Megaphone className="size-3.5" />
        </span>
        Social ads · Live
        <span className="size-2 rounded-full bg-emerald-500" />
      </div>
      <div className="absolute -right-2 top-1/2 flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-medium shadow-lg sm:-right-8">
        <span className="flex size-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
          <Search className="size-3.5" />
        </span>
        Search ads · Live
        <span className="size-2 rounded-full bg-emerald-500" />
      </div>
      <div className="absolute -bottom-6 left-6 flex items-center gap-3 rounded-xl border bg-card px-3 py-2 shadow-lg">
        <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600">
          <CalendarCheck className="size-4" />
        </span>
        <div className="text-xs">
          <p className="font-medium">New booking</p>
          <p className="text-muted-foreground">from your latest ad · just now</p>
        </div>
      </div>
    </div>
  );
}
