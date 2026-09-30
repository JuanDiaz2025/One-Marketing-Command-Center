// The chat's tools (Google Ads queries and the leads list) as a small MCP server, for when the
// chat runs on Claude Code (ASSISTANT_PROVIDER=claude-code). Claude Code starts it for each
// question; it speaks MCP over stdin/stdout and reads the same .data folder as the app.
//
// Environment: OMCC_ROOT (the app folder), OMCC_USER (whose Google Ads connection to use) and
// OMCC_CUSTOMER_ID (which account). Other settings come from the environment or .env.local.
import { existsSync, readFileSync, rmSync } from "node:fs"
import { createInterface } from "node:readline"

import { runTool, toolSpecs } from "@/lib/assistant/tools"
import { getConnection } from "@/lib/google/connections"

// scripts/run-ts.mjs has already moved to OMCC_ROOT, so .data and .env.local are found here.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]?.trim() && m[2].trim()) process.env[m[1]] = m[2].trim()
  }
}
// Started fine: clear any earlier start-up error the chat would otherwise show.
rmSync(".data/assistant-tools-error.log", { force: true })

const connection = process.env.OMCC_USER ? await getConnection(process.env.OMCC_USER) : null
const account =
  connection?.accounts.find((a) => a.customerId === process.env.OMCC_CUSTOMER_ID) ??
  connection?.accounts[0] ??
  null

type Message = { id?: number | string; method?: string; params?: Record<string, unknown> }
const send = (message: object) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`)

async function handle(msg: Message) {
  if (msg.id === undefined) return // a notification, e.g. notifications/initialized
  switch (msg.method) {
    case "initialize":
      return send({
        id: msg.id,
        result: {
          protocolVersion: (msg.params?.protocolVersion as string) ?? "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "omcc", version: "1.0.0" },
        },
      })
    case "ping":
      return send({ id: msg.id, result: {} })
    case "tools/list":
      return send({
        id: msg.id,
        result: {
          tools: toolSpecs.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.parameters,
          })),
        },
      })
    case "tools/call": {
      const name = String(msg.params?.name ?? "")
      const result = await runTool(name, msg.params?.arguments ?? {}, { connection, account })
      return send({ id: msg.id, result: { content: [{ type: "text", text: result.content }], isError: Boolean(result.isError) } })
    }
    default:
      return send({ id: msg.id, error: { code: -32601, message: `Unknown method ${msg.method}` } })
  }
}

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return
  let msg: Message
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  handle(msg).catch((error) =>
    send({ id: msg.id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } }),
  )
})
