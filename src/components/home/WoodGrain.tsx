/** A faint wood-grain texture: long, gently wavering growth lines. */
export default function WoodGrain({ className = "" }: { className?: string }) {
  const lines = Array.from({ length: 26 }, (_, i) => {
    const y = 12 + i * 15;
    const a = 6 + ((i * 7) % 9);
    const b = 4 + ((i * 5) % 7);
    return `M-20 ${y} C 180 ${y - a}, 320 ${y + b}, 520 ${y - b / 2} S 860 ${y + a}, 1220 ${y}`;
  });
  return (
    <svg aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} preserveAspectRatio="none" viewBox="0 0 1200 400">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        {lines.map((d, i) => (
          <path key={i} d={d} opacity={0.35 + ((i * 3) % 5) / 10} vectorEffect="non-scaling-stroke" />
        ))}
        <ellipse cx="860" cy="210" rx="70" ry="16" vectorEffect="non-scaling-stroke" />
        <ellipse cx="860" cy="210" rx="44" ry="9" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
