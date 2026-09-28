import { businessSchema } from "@/lib/setup"
import { mockProfileSuggestion } from "@/lib/profile-mock"

// POST { business } → { profile, sources }
// Suggests a business profile (location, brand, products, audience, budget) for step 2 of setup.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = businessSchema.safeParse(body?.business)
  if (!parsed.success) {
    return Response.json({ error: "Business details are missing or invalid." }, { status: 400 })
  }

  // Mocked for now. Simulate the time real research will take so the loading screen is realistic.
  await new Promise((resolve) => setTimeout(resolve, 2000))

  return Response.json(mockProfileSuggestion(parsed.data))
}
