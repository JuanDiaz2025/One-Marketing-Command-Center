export const formatNumber = (n: number) => n.toLocaleString("en-US")

export const formatCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)

export const formatUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

// Order amounts, to the cent.
export const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)

export const formatPercent = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function formatDateRange(start: string, end: string) {
  const year = end.slice(0, 4)
  return `${formatDate(start)} – ${formatDate(end)}, ${year}`
}

export function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1
}
