// Runs a TypeScript script with the app's "@/..." imports, e.g. node scripts/run-ts.mjs scripts/daily-check.ts
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createJiti } from "jiti"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const [script, ...args] = process.argv.slice(2)
process.argv = [process.argv[0], script, ...args]
const jiti = createJiti(import.meta.url, { alias: { "@": path.join(root, "src") } })
await jiti.import(path.resolve(script))
