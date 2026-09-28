import type { OrderItem } from "@/lib/conversions/types"

// Stand-in for the register (POS) connection: the demo shop's menu, and "what was just rung up"
// when a customer scans. Swap for a Square, Toast, or Clover order lookup later.

export const menu = {
  drinks: [
    { name: "Golden Goat Latte", price: 6.5 },
    { name: "Latte", price: 5.5 },
    { name: "Cortado", price: 4.75 },
    { name: "Cappuccino", price: 5 },
    { name: "Cold brew", price: 5.25 },
    { name: "Pour-over", price: 6 },
    { name: "Ube latte", price: 6.75 },
    { name: "Pandan banana matcha", price: 7 },
  ],
  pastries: [
    { name: "Croissant", price: 4.5 },
    { name: "Almond croissant", price: 4.75 },
    { name: "Financier", price: 3.75 },
    { name: "Chocolate chip cookie", price: 3.5 },
  ],
} satisfies Record<string, OrderItem[]>

// A small deterministic random generator, so the same seed gives the same order.
export function seededRandom(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One or two drinks, and often a pastry.
export function ringUp(rand: () => number): OrderItem[] {
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]
  const items = [pick(menu.drinks)]
  if (rand() < 0.2) items.push(pick(menu.drinks))
  if (rand() < 0.55) items.push(pick(menu.pastries))
  return items
}

// The order shown in previews.
export const sampleOrder: OrderItem[] = [menu.drinks[0], menu.pastries[1]]

// The order at the register right now. Changes every few minutes so each scan looks live.
export function currentOrderSeed(now = Date.now()) {
  return Math.floor(now / (3 * 60_000))
}

export function currentOrder(seed: number) {
  return ringUp(seededRandom(seed))
}

const round = (n: number) => Math.round(n * 100) / 100

// The first drink in the order gets the discount.
export function priceOrder(items: OrderItem[], percentOff: number) {
  const subtotal = round(items.reduce((sum, item) => sum + item.price, 0))
  const discount = round(((items[0]?.price ?? 0) * percentOff) / 100)
  return { subtotal, discount, total: round(subtotal - discount) }
}
