/**
 * The Pacwoods mark and wordmark, redrawn in SVG from the workshop sign
 * (docs/brand/logo-sample.jpeg). Replace with the master artwork once the
 * business supplies a vector file. src/app/icon.svg is the same mark.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={className}>
      <g fill="none" strokeWidth="9" strokeLinejoin="miter">
        <g className="stroke-brand-gold">
          <polyline points="14.97,86 14.97,34 60,8 105.03,34" />
          <polyline points="27.96,78.5 27.96,41.5 60,23 92.04,41.5" />
          <polyline points="40.95,71 40.95,49 60,38 79.05,49" />
        </g>
        <g className="stroke-brand-steel">
          <polyline points="105.03,34 105.03,86 60,112" />
          <polyline points="92.04,41.5 92.04,78.5 60,97" />
        </g>
      </g>
    </svg>
  );
}

/** "PaC WOODS" as lettered on the sign. Meant for the charcoal ground. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark className="h-[1.6em] w-auto" />
      <span className="font-extrabold tracking-tight text-white">
        Pa<span className="text-brand-gold">C</span> WOODS
        <span className="sr-only"> (Pacwoods)</span>
      </span>
    </span>
  );
}
