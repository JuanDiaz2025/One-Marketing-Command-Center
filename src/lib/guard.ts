import { unstable_rethrow } from "next/navigation"

// Runs a button's server action so a failure (most often a data file another program has open for
// a moment) comes back as a short message on the button, instead of crashing the whole page.
// Redirects and other Next.js signals pass through.
export async function guard<T>(run: () => Promise<T>, onError: (message: string) => T): Promise<T> {
  try {
    return await run()
  } catch (error) {
    unstable_rethrow(error)
    console.error("Action failed:", error)
    const message = error instanceof Error ? error.message : String(error)
    return onError(/another program has it open/.test(message) ? "Couldn't save just now (a file was busy). Try again in a moment." : "Something went wrong. Try again in a moment.")
  }
}
