import React from "react";

// Confluence Score circular arc meter with metallic gold sweep.
// score: 0-100. NOT a win probability — measures factor agreement.
export default function ConfluenceGauge({ score = 0, size = 160, label = "CONFLUENCE" }) {
  const s = Math.max(0, Math.min(100, score));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // Arc from 135deg to 405deg (270deg sweep)
  const startAngle = 135;
  const sweep = 270;
  const valueAngle = startAngle + (s / 100) * sweep;

  const polarToCartesian = (angle, radius) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const arcPath = (a1, a2) => {
    const start = polarToCartesian(a1, r);
    const end = polarToCartesian(a2, r);
    const large = a2 - a1 > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
  };

  const trackEnd = polarToCartesian(startAngle + sweep, r);
  const trackStart = polarToCartesian(startAngle, r);
  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 1 1 ${trackEnd.x} ${trackEnd.y}`;

  const color =
    s >= 90 ? "hsl(var(--gold))" : s >= 80 ? "hsl(var(--gold))" : s >= 70 ? "hsl(var(--bull))" : s >= 50 ? "hsl(var(--text-secondary))" : "hsl(var(--bear))";

  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} className="overflow-visible">
        <defs>
          <linearGradient id="goldSweep" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8A6A12" />
            <stop offset="50%" stopColor="#F5C242" />
            <stop offset="100%" stopColor="#FFE9A8" />
          </linearGradient>
        </defs>
        <path d={trackPath} fill="none" stroke="hsl(var(--hairline))" strokeWidth={stroke} strokeLinecap="round" />
        {s > 0 && (
          <path
            d={arcPath(startAngle, valueAngle)}
            fill="none"
            stroke="url(#goldSweep)"
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 6px rgba(245,194,66,0.5))" }}
          />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" className="font-display" fill={color} fontSize={size * 0.26} fontWeight={700}>
          {Math.round(s)}
        </text>
        <text x={cx} y={cy + size * 0.13} textAnchor="middle" fill="hsl(var(--text-secondary))" fontSize={size * 0.075} fontWeight={500} letterSpacing="0.08em">
          / 100
        </text>
      </svg>
      <span className="mt-1 text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{label}</span>
    </div>
  );
}