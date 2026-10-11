export function XTMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" role="img" fill="none" className={className}>
      <title>XT</title>
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="11"
        fill="#102421"
        stroke="#54dbc5"
        strokeOpacity=".35"
      />
      <path
        d="M8 12h4l8 16h-4L8 12Zm12 0h-4L8 28h4l8-16Zm2 0h12v4h-4v12h-4V16h-4v-4Z"
        fill="#54dbc5"
      />
      <path d="M32 23v8" stroke="#54dbc5" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
