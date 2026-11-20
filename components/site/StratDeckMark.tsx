/** The StratDeck logo mark, drawn to match app/icon.svg. */
export default function StratDeckMark({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx={13} cy={20} r={4.4} stroke="#34d399" strokeWidth={1} strokeOpacity={0.32} />
      <path d="M5 20h22" stroke="#facc15" strokeWidth={2.6} />
      <path d="M6 25L13 20L26 6.5" stroke="#34d399" strokeWidth={3.2} />
      <circle cx={13} cy={20} r={2.4} fill="#34d399" />
    </svg>
  );
}
