export const formatNumber = (n: number) => n.toLocaleString("en-US")

// Amounts in an ad account's own currency. Whole units by default, cents when asked.
export const formatMoney = (n: number, currency = "USD", cents = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents ? 2 : 0,
    minimumFractionDigits: cents ? 2 : 0,
  }).format(n)

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
