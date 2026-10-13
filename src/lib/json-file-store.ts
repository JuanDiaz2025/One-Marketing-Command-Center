// Tiny JSON-file persistence for the leads (files live in .data/ next to DealTrack's own data).
// If the file system is read-only (e.g. serverless hosting), data is kept in
// memory until the server restarts.
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { DATA_DIR } from "@/lib/store"

import { shared } from "@/lib/shared-state"

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function jsonFileStore<T>(name: string, seed: () => T | Promise<T>) {
  const file = path.join(DATA_DIR, name)
  let memory: T | null = null

  async function write(data: T) {
    const text = JSON.stringify(data, null, 2)
    try {
      await mkdir(path.dirname(file), { recursive: true })
    } catch (error) {
      // A read-only disk (e.g. serverless hosting): keep the data in memory instead. Anything else
      // is a real failure and must not be hidden.
      const code = (error as NodeJS.ErrnoException).code
      if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
        memory = data
        return
      }
      throw error
    }
    // Write a copy and swap it in, so a read at the same moment (or the app closing mid-save) never
    // leaves a half-written file. On Windows the swap fails while another program (antivirus, a
    // backup or search indexer) has the file open; keep trying for about 5 seconds, then fail
    // loudly rather than lose or overwrite anything.
    const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    try {
      await writeFile(temp, text)
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(temp, file)
          memory = null
          return
        } catch (error) {
          if (attempt >= 20) throw error
          await pause(Math.min(500, 50 * (attempt + 1)))
        }
      }
    } catch (error) {
      await rm(temp, { force: true }).catch(() => {})
      throw new Error(`Couldn't save ${name}: another program has it open. Try again in a moment. (${(error as Error).message})`)
    }
  }

  async function read(): Promise<T> {
    if (memory) return memory
    try {
      return JSON.parse(await readFile(file, "utf8")) as T
    } catch (error) {
      // Only start fresh when there's no file yet; never overwrite one that couldn't be read.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      const data = await seed()
      await write(data)
      return data
    }
  }

  // Read, change and save one at a time, so two changes at the same moment (two website leads
  // arriving together) can't overwrite each other. `change` edits the data in place.
  // One queue per file for the whole app (pages and API routes alike), see shared-state.ts.
  const q = shared(`file-queue:${file}`, () => ({ queue: Promise.resolve() as Promise<unknown> }))
  function update<R>(change: (data: T) => R | Promise<R>): Promise<R> {
    const run = q.queue.then(async () => {
      const data = await read()
      const result = await change(data)
      await write(data)
      return result
    })
    q.queue = run.catch(() => {})
    return run
  }

  return { read, write, update }
}
