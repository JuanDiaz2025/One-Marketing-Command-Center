// The Google Ads mark, used only to label the Google Ads parts of the app (not as the app's own
// logo, which Google's brand guidelines don't allow).
export default function GoogleAdsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 192 192" aria-hidden="true" className={className}>
      <line x1="56" y1="136" x2="96" y2="60" stroke="#FBBC04" strokeWidth="40" strokeLinecap="round" />
      <circle cx="56" cy="136" r="20" fill="#34A853" />
      <line x1="96" y1="60" x2="136" y2="136" stroke="#4285F4" strokeWidth="40" strokeLinecap="round" />
    </svg>
  )
}
