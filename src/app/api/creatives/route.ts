import { z } from "zod"

import { mockCreatives } from "@/lib/creatives-mock"
import { MAX_PHOTOS, businessSchema, profileSchema } from "@/lib/setup"

const requestSchema = z.object({
  business: businessSchema,
  profile: profileSchema,
  photoCount: z.number().int().min(1).max(MAX_PHOTOS),
})

// POST { business, profile, photoCount } → { creatives }
// Generates 9:16 ad variations for step 3 of setup.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Business, profile, or photos are missing." }, { status: 400 })
  }

  // Mocked for now: the photos stay in the browser and aren't uploaded. Simulate the time real
  // generation will take so the loading screen is realistic.
  await new Promise((resolve) => setTimeout(resolve, 2500))

  const { business, profile, photoCount } = parsed.data
  return Response.json({ creatives: mockCreatives(business, profile, photoCount) })
}
