// Mock QR codes and conversions for the Golden Goat Coffee demo. The store seeds itself from
// these the first time it runs; replace the store with a database later.
import { attribute } from "@/lib/conversions/match"
import { priceOrder, ringUp, seededRandom } from "@/lib/conversions/menu"
import { DEFAULT_OFFER } from "@/lib/conversions/qr-schema"
import type { Conversion, QrCode } from "@/lib/conversions/types"
import { CAMPAIGN_PERIOD, demoCampaign } from "@/lib/demo-campaign"

const qr = (id: string, placement: string, createdAt: string): QrCode => ({
  id,
  businessName: demoCampaign.business.businessName,
  placement,
  ...DEFAULT_OFFER,
  active: true,
  createdAt,
})

export const mockQrCodes: QrCode[] = [
  qr("gg4k2p9m", "Front counter", "2026-09-01T15:00:00Z"),
  qr("gg7t3w5x", "Pastry case", "2026-09-06T15:00:00Z"),
  qr("gg2n8r6q", "Window decal", "2026-09-12T15:00:00Z"),
]

const firstNames = [
  "maya",
  "jordan",
  "sam",
  "leila",
  "chris",
  "nina",
  "omar",
  "grace",
  "diego",
  "hannah",
  "kenji",
  "rosa",
  "ben",
  "ava",
  "luis",
  "zoe",
  "priya",
  "marcus",
  "elena",
  "tom",
]
const lastNames = [
  "patel",
  "nguyen",
  "garcia",
  "kim",
  "johnson",
  "silva",
  "chen",
  "okafor",
  "martin",
  "rossi",
  "brown",
  "cohen",
]
const domains = ["gmail.com", "icloud.com", "yahoo.com", "outlook.com"]

type Customer = Pick<Conversion, "email" | "phone" | "attribution">

function generate(): Conversion[] {
  const rand = seededRandom(26)
  const customers: Customer[] = []
  const out: Conversion[] = []
  const start = Date.parse(`${CAMPAIGN_PERIOD.start}T00:00:00Z`)
  const end = Date.parse(`${CAMPAIGN_PERIOD.end}T00:00:00Z`)

  for (let day = start, d = 0; day <= end; day += 86_400_000, d++) {
    const weekday = new Date(day).getUTCDay()
    if (weekday === 0) continue // closed Sundays
    const saturday = weekday === 6
    // Open Mon–Fri 8am–3pm, Sat 9am–2pm (Pacific, UTC-7). Conversions grow as the ads learn.
    const [open, hours] = saturday ? [16, 5] : [15, 7]
    const count = Math.round((2.5 + d * 0.18) * (saturday ? 1.3 : 1) * (0.6 + rand() * 0.8))

    for (let i = 0; i < count; i++) {
      const at = new Date(day + (open + rand() * hours) * 3_600_000)
      const returning = customers.length > 5 && rand() < 0.32
      let customer: Customer
      if (returning) {
        customer = customers[Math.floor(rand() * customers.length)]
      } else {
        const first = firstNames[Math.floor(rand() * firstNames.length)]
        const last = lastNames[Math.floor(rand() * lastNames.length)]
        const contact =
          rand() < 0.68
            ? {
                email: `${first}.${last}${Math.floor(rand() * 90) + 10}@${domains[Math.floor(rand() * domains.length)]}`,
              }
            : { phone: `(415) 555-${String(1000 + Math.floor(rand() * 9000))}` }
        customer = { ...contact, attribution: attribute(rand, contact) }
        customers.push(customer)
      }
      const code = rand() < 0.6 ? mockQrCodes[0] : rand() < 0.75 ? mockQrCodes[1] : mockQrCodes[2]
      if (Date.parse(code.createdAt) > at.getTime()) continue
      const items = ringUp(rand)
      // The first-coffee offer only applies to a customer's first visit.
      const price = priceOrder(items, returning ? 0 : code.percentOff)
      out.push({
        id: `c${String(out.length + 1).padStart(4, "0")}`,
        qrCodeId: code.id,
        createdAt: at.toISOString(),
        email: customer.email,
        phone: customer.phone,
        items,
        ...price,
        firstVisit: !returning,
        attribution: customer.attribution,
        sentTo: ["meta", "google"],
      })
    }
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export const mockConversions: Conversion[] = generate()
