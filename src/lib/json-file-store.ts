// Tiny JSON-file persistence for the demo (files live in .data/, not committed).
// If the file system is read-only (e.g. serverless hosting), data is kept in
// memory until the server restarts.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export function jsonFileStore<T>(name: string, seed: () => T | Promise<T>) {
  const file = path.join(process.cwd(), ".data", name)
  let memory: T | null = null

  async function write(data: T) {
    try {
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, JSON.stringify(data, null, 2))
    } catch {
      memory = data
    }
  }

  async function read(): Promise<T> {
    if (memory) return memory
    try {
      return JSON.parse(await readFile(file, "utf8")) as T
    } catch {
      const data = await seed()
      await write(data)
      return data
    }
  }

  return { read, write }
}
