// One Marketing Command Center's mark: a vertical 9:16 ad with a play button, and a spark for the AI that makes and
// tunes it. Drawn in currentColor so it sits on the brand gradient tile.
export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect x="3" y="3" width="11" height="18" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M7 8.75 12 12l-5 3.25z" fill="currentColor" />
      <path
        d="M19 2.75 20 5.5 22.75 6.5 20 7.5 19 10.25 18 7.5 15.25 6.5 18 5.5z"
        fill="currentColor"
      />
    </svg>
  )
}
