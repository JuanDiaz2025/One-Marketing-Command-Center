import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth/session"

// The app has no public home page: signed-in people go to their dashboard, everyone else signs in.
export default async function Home() {
  redirect((await getSession()) ? "/dashboard" : "/login")
}
