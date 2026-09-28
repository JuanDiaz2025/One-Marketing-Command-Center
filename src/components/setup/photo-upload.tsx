"use client"

import { useRef, useState } from "react"
import { Camera, ImagePlus, Smartphone, Store, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { MAX_PHOTOS, MAX_PHOTO_BYTES, type UploadedPhoto } from "@/lib/setup"

type PhotoUploadProps = {
  photos: UploadedPhoto[]
  onChange: (photos: UploadedPhoto[]) => void
  invalid?: boolean
}

const tips = [
  { icon: Smartphone, text: "Vertical photos fit best" },
  { icon: Camera, text: "Close-ups of what you sell" },
  { icon: Store, text: "Your space and your team" },
]

export default function PhotoUpload({ photos, onChange, invalid }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const room = MAX_PHOTOS - photos.length

  function addFiles(files: FileList) {
    const all = Array.from(files)
    const images = all.filter((file) => file.type.startsWith("image/"))
    const small = images.filter((file) => file.size <= MAX_PHOTO_BYTES)
    const added = small.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      url: URL.createObjectURL(file),
    }))

    const skipped = []
    if (images.length < all.length) skipped.push("Only photos can be added.")
    if (small.length < images.length) skipped.push("Photos must be under 20 MB.")
    if (small.length > room) skipped.push(`You can add up to ${MAX_PHOTOS} photos.`)
    setNotice(skipped.length ? skipped.join(" ") : null)

    if (added.length) onChange([...photos, ...added])
  }

  function remove(photo: UploadedPhoto) {
    URL.revokeObjectURL(photo.url)
    onChange(photos.filter((p) => p.id !== photo.id))
    setNotice(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        disabled={room === 0}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        className={cn(
          "group flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed bg-card px-6 text-center transition-all",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          "enabled:cursor-pointer enabled:hover:border-primary/60 enabled:hover:bg-secondary/40 disabled:opacity-60",
          photos.length ? "py-8" : "py-14",
          dragging ? "border-primary bg-secondary/60" : "border-border",
          invalid && "border-destructive",
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 via-pink-500 to-violet-600 text-white shadow-lg shadow-pink-500/25 transition-transform group-enabled:group-hover:scale-105">
          <ImagePlus className="size-6" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-lg font-semibold">
            {room === 0 ? (
              "You've added the most photos you can"
            ) : (
              <>
                Drag photos here or <span className="text-primary">browse</span>
              </>
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            JPG, PNG, or WebP · up to {MAX_PHOTOS} photos
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files)
          // Allow picking the same file again after removing it.
          e.target.value = ""
        }}
      />

      {notice && <p className="text-sm text-amber-700">{notice}</p>}

      {photos.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {photos.length} of {MAX_PHOTOS} photos
          </p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {photos.map((photo) => (
              <li
                key={photo.id}
                className="group relative aspect-[4/5] overflow-hidden rounded-3xl bg-muted shadow-sm ring-1 ring-black/5"
              >
                {/* Object URLs from the file picker, which next/image can't optimize. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.name} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(photo)}
                  aria-label={`Remove ${photo.name}`}
                  className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="flex flex-wrap justify-center gap-2">
          {tips.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-2 text-sm text-muted-foreground ring-1 ring-border"
            >
              <Icon className="size-4 text-primary" />
              {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
