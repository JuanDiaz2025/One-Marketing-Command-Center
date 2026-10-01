import { getSession } from "@/lib/auth/session"
import { webhookSecret } from "@/lib/leads/webhook"
import { PLUGIN_FOLDER, wordpressPluginZip } from "@/lib/leads/wordpress-plugin"

// GET /leads/wordpress-plugin → the Lead Saver plugin for WordPress, with this app's key in it.
export async function GET() {
  if (!(await getSession())) return new Response("Sign in first.", { status: 401 })
  const zip = wordpressPluginZip(await webhookSecret())
  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${PLUGIN_FOLDER}.zip"`,
      "cache-control": "no-store",
    },
  })
}
