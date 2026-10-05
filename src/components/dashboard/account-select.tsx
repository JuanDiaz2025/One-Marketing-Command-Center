"use client"

// The Account dropdown: picking an account switches to it straight away (no "Show" click to
// forget), so what it shows is always the account the whole app is using.
export default function AccountSelect({
  current,
  options,
}: {
  current: string
  options: { value: string; label: string }[]
}) {
  return (
    <select
      // Re-drawn when the account changes, so it never keeps an old choice on screen.
      key={current}
      id="customerId"
      name="customerId"
      defaultValue={current}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="h-10 max-w-full min-w-0 rounded-lg border bg-card px-3 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
