import { MapPin, Play, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ChannelFormat } from "@/lib/setup"

function Drawing({ format, image }: { format: ChannelFormat; image?: string }) {
  if (format === "vertical") {
    return (
      <div className="relative h-24 w-[3.375rem] shrink-0 overflow-hidden rounded-lg bg-slate-800 shadow-sm ring-1 ring-black/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image && <img src={image} alt="" className="size-full object-cover" />}
        <div className="absolute inset-x-1 top-1 flex gap-0.5">
          <span className="h-0.5 flex-1 rounded-full bg-white" />
          <span className="h-0.5 flex-1 rounded-full bg-white/50" />
        </div>
        <Play className="absolute top-1/2 left-1/2 size-4 -translate-1/2 fill-white text-white drop-shadow" />
      </div>
    )
  }
  if (format === "feed") {
    return (
      <div className="flex h-24 w-[4.5rem] shrink-0 flex-col gap-1 overflow-hidden rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-black/10">
        <div className="flex items-center gap-0.5">
          <span className="size-2 rounded-full bg-slate-300" />
          <span className="h-1 w-7 rounded-full bg-slate-300" />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-sm bg-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image && <img src={image} alt="" className="size-full object-cover" />}
        </div>
        <span className="h-1 w-10 rounded-full bg-slate-300" />
      </div>
    )
  }
  if (format === "search") {
    return (
      <div className="flex h-24 w-[4.5rem] shrink-0 flex-col gap-1.5 rounded-lg bg-white p-2 shadow-sm ring-1 ring-black/10">
        <div className="flex items-center gap-0.5 rounded-full px-1 py-0.5 ring-1 ring-slate-300">
          <Search className="size-2 text-slate-400" />
          <span className="h-0.5 flex-1 rounded-full bg-slate-300" />
        </div>
        <span className="text-[7px] leading-none font-bold text-slate-500">Sponsored</span>
        <span className="h-1.5 w-12 rounded-full bg-blue-500" />
        <span className="h-1 w-14 rounded-full bg-slate-300" />
        <span className="h-1 w-10 rounded-full bg-slate-300" />
        <span className="h-1 w-12 rounded-full bg-slate-300" />
      </div>
    )
  }
  return (
    <div className="relative h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-emerald-50 shadow-sm ring-1 ring-black/10">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#d1fae5_1px,transparent_1px),linear-gradient(to_bottom,#d1fae5_1px,transparent_1px)] bg-[length:10px_10px]" />
      <span className="absolute top-12 -left-2 h-2 w-24 -rotate-12 bg-white" />
      <MapPin className="absolute top-1/2 left-1/2 size-7 -translate-1/2 fill-rose-500 text-white drop-shadow" />
    </div>
  )
}

// A tiny drawing of how an ad looks in a placement, using the owner's own ads where it can.
// "sm" shrinks it for table rows.
export default function FormatPreview({
  format,
  image,
  size = "md",
  className,
}: {
  format: ChannelFormat
  image?: string
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <div className={cn("shrink-0", className)} style={size === "sm" ? { zoom: 0.6 } : undefined}>
      <Drawing format={format} image={image} />
    </div>
  )
}
