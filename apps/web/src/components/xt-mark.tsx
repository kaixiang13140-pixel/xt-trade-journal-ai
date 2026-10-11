export function XTMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" role="img" fill="none" className={className}>
      <title>XT</title>
      <rect x="1" y="1" width="38" height="38" rx="10" fill="currentColor" opacity="0.12" />
      <path
        d="m8 13 10 14m0-14L8 27m15-14h10m-5-0v14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
