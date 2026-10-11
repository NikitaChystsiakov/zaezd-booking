// Знак «Гуртом»: три фигуры рядом — компания, которая едет вместе.
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <circle cx="6" cy="9" r="3.2" fill="var(--ink)" />
        <circle cx="13" cy="7" r="3.6" fill="var(--accent)" />
        <circle cx="20" cy="9" r="3.2" fill="var(--ink)" />
        <path d="M1.5 21c0-3.6 2-6 4.5-6s4.5 2.4 4.5 6M8 21c0-4.4 2.2-7.3 5-7.3s5 2.9 5 7.3M15.5 21c0-3.6 2-6 4.5-6s4.5 2.4 4.5 6" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">Гуртом</span>
    </span>
  )
}
