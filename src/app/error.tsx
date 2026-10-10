"use client"

import { Button } from "@/components/ui/button"

// When a page fails to load (most often a data file another program had open for a moment), a
// short message with "Try again" instead of a blank screen.
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">Something went wrong loading this page</h1>
      <p className="text-sm text-muted-foreground">Nothing was lost. Try again in a moment; if it keeps happening, close the app and start it again with start.bat.</p>
      <div className="flex gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="outline" onClick={() => location.reload()}>
          Reload the page
        </Button>
      </div>
    </main>
  )
}
