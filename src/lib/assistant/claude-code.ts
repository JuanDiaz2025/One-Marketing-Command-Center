// The chat on Claude Code, the Claude app installed on this computer, signed in with the
// company's Claude account: no API key, and usage counts against that Claude plan.
// Chosen with ASSISTANT_PROVIDER=claude-code. Each question runs `claude -p` with its built-in
// tools turned off and the chat's own tools (Google Ads queries, leads) served over MCP by
// scripts/assistant-mcp.ts.
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import path from "node:path"

import { AssistantError, INSTRUCTIONS, type AskInput } from "@/lib/assistant/shared"

const TIMEOUT_MS = 4 * 60_000
const TOOLS = ["mcp__omcc__google_ads_query", "mcp__omcc__list_leads"]

const NOT_INSTALLED = "The chat needs Claude on this computer. Click Sign in with Claude below: it sets it up and signs you in with your Claude account."
const NOT_SIGNED_IN = "Claude isn't signed in on this computer yet. Click Sign in with Claude below and sign in with your Claude account."
export const SETUP = "claude_setup"

// Where Claude Code is: CLAUDE_CODE_PATH, the usual install folders (a freshly installed copy may
// not be on the app's PATH yet), or plain "claude".
export function claudeCommand() {
  const configured = process.env.CLAUDE_CODE_PATH?.trim()
  if (configured) return configured
  const home = homedir()
  const candidates =
    process.platform === "win32"
      ? [
          path.join(home, ".local", "bin", "claude.exe"),
          process.env.APPDATA && path.join(process.env.APPDATA, "npm", "claude.cmd"),
        ]
      : [path.join(home, ".local", "bin", "claude"), path.join(home, ".claude", "local", "claude"), "/usr/local/bin/claude", "/opt/homebrew/bin/claude"]
  return candidates.find((c): c is string => Boolean(c) && existsSync(c!)) ?? "claude"
}

// Claude Code signs in with the Claude account, never an API key the app happens to have.
function claudeEnv() {
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY
  delete env.ANTHROPIC_AUTH_TOKEN
  return env
}

// On Windows, `claude` is usually a .cmd file, which only runs through the shell; quote anything
// with spaces for it.
const quote = (arg: string) => (arg === "" ? '""' : /[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg)

function run(args: string[], stdin: string, cwd: string, env: NodeJS.ProcessEnv) {
  const command = claudeCommand()
  // A .exe runs directly; "claude" or a .cmd needs the Windows shell.
  const windows = process.platform === "win32" && !/\.exe$/i.test(command)
  return new Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>((resolve, reject) => {
    const child = spawn(windows ? quote(command) : command, windows ? args.map(quote) : args, {
      cwd,
      env,
      shell: windows,
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      // Through the Windows shell, child is cmd.exe: end Claude Code under it too, not only the shell.
      if (windows && child.pid) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }).on("error", () => child.kill())
      else child.kill()
    }, TIMEOUT_MS)
    child.stdout.on("data", (d) => (stdout += d))
    child.stderr.on("data", (d) => (stderr += d))
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
    child.stdin.end(stdin)
  })
}

export async function askClaudeCode({ turns, situation, tools, userId }: AskInput): Promise<string> {
  // An empty folder to run in, so Claude Code sees no project files, plus its settings files.
  const dir = await mkdtemp(path.join(tmpdir(), "omcc-chat-"))
  try {
    const root = process.cwd()
    const mcp = path.join(dir, "mcp.json")
    await writeFile(
      mcp,
      JSON.stringify({
        mcpServers: {
          omcc: {
            command: process.execPath,
            args: [path.join(root, "scripts", "run-ts.mjs"), path.join(root, "scripts", "assistant-mcp.ts")],
            env: {
              OMCC_ROOT: root,
              OMCC_USER: userId ?? "",
              OMCC_CUSTOMER_ID: tools.account?.customerId ?? "",
            },
          },
        },
      }),
    )
    const system = path.join(dir, "system.txt")
    await writeFile(
      system,
      `${INSTRUCTIONS}\n\n${situation}\n\nUse the google_ads_query and list_leads tools for real numbers. Answer in Markdown.`,
    )

    // Earlier turns go in as text; the last one is the question.
    const earlier = turns.slice(0, -1)
    const prompt = [
      earlier.length
        ? `Conversation so far:\n${earlier.map((t) => `${t.role === "user" ? "Them" : "You"}: ${t.content}`).join("\n\n")}\n\n`
        : "",
      `Question: ${turns.at(-1)?.content ?? ""}`,
    ].join("")

    const env = claudeEnv()

    const args = [
      "-p",
      "--output-format",
      "json",
      "--tools",
      "",
      "--mcp-config",
      mcp,
      "--strict-mcp-config",
      "--allowedTools",
      TOOLS.join(","),
      "--system-prompt-file",
      system,
      "--no-session-persistence",
      ...(process.env.CLAUDE_CODE_MODEL?.trim() ? ["--model", process.env.CLAUDE_CODE_MODEL.trim()] : []),
    ]

    let result: Awaited<ReturnType<typeof run>>
    try {
      result = await run(args, prompt, dir, env)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new AssistantError(NOT_INSTALLED, 503, SETUP)
      throw error
    }

    if (result.timedOut) {
      throw new AssistantError("That question took Claude Code too long. Try asking something narrower.", 504)
    }

    let parsed: { result?: string; is_error?: boolean; subtype?: string } | null = null
    try {
      parsed = JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "")
    } catch {
      parsed = null
    }
    const text = parsed?.result?.trim() ?? ""
    const problem = `${text}\n${result.stderr}`
    if (/not recognized as an internal or external command|command not found/i.test(result.stderr)) {
      throw new AssistantError(NOT_INSTALLED, 503, SETUP)
    }
    if (/\/login|not logged in|invalid api key|authentication|oauth token/i.test(problem) && (parsed?.is_error || !text)) {
      throw new AssistantError(NOT_SIGNED_IN, 503, SETUP)
    }
    if (/usage limit|rate limit|limit reached/i.test(problem) && (parsed?.is_error || !text)) {
      throw new AssistantError("Your Claude plan's usage limit is reached for now. Try again later.", 429)
    }
    if (!parsed || parsed.is_error || !text) {
      console.error("Claude Code chat failed:", result.code, result.stderr.slice(0, 500), text.slice(0, 500))
      throw new AssistantError(
        text && parsed?.is_error ? `Claude Code couldn't answer: ${text.slice(0, 300)}` : "Claude Code didn't answer. Try again.",
        502,
      )
    }
    return text
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

// Whether Claude Code is installed and signed in, for the chat's "Sign in with Claude" button.
export async function claudeStatus(): Promise<{ installed: boolean; loggedIn: boolean }> {
  try {
    const { stdout, stderr } = await run(["auth", "status", "--json"], "", tmpdir(), claudeEnv())
    if (/not recognized as an internal or external command|command not found/i.test(stderr)) {
      return { installed: false, loggedIn: false }
    }
    const status = JSON.parse(stdout.trim() || "{}") as { loggedIn?: boolean }
    return { installed: true, loggedIn: status.loggedIn === true }
  } catch (error) {
    return { installed: (error as NodeJS.ErrnoException).code !== "ENOENT", loggedIn: false }
  }
}

// Opens the sign-in: on Windows, setup-claude.bat in its own window (it installs Claude Code
// first if needed); elsewhere, Claude Code's own sign-in, which opens the browser.
export function startClaudeLogin() {
  const root = process.cwd()
  if (process.platform === "win32") {
    const bat = path.join(root, "setup-claude.bat")
    spawn("cmd.exe", ["/c", "start", '"Sign in to Claude"', `"${bat}"`], {
      cwd: root,
      env: claudeEnv(),
      detached: true,
      stdio: "ignore",
      windowsVerbatimArguments: true,
    })
      .on("error", (error) => console.error("Couldn't open the Claude sign-in:", error.message))
      .unref()
    return
  }
  spawn(claudeCommand(), ["auth", "login", "--claudeai"], { env: claudeEnv(), detached: true, stdio: "ignore" })
    .on("error", (error) => console.error("Couldn't open the Claude sign-in:", error.message))
    .unref()
}
