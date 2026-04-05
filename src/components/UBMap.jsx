// Ulaanbaatar SVG map component — displays building locations as interactive dots

const DISTRICTS = [
  { id: "Баянгол",        x: 80,  y: 180, w: 100, h: 80  },
  { id: "Баянзүрх",       x: 280, y: 160, w: 120, h: 90  },
  { id: "Чингэлтэй",      x: 160, y: 130, w: 110, h: 80  },
  { id: "Сүхбаатар",      x: 170, y: 70,  w: 120, h: 70  },
  { id: "Сонгинохайрхан", x: 30,  y: 100, w: 80,  h: 90  },
  { id: "Хан-Уул",        x: 90,  y: 270, w: 120, h: 80  },
];

const mapLng = (lng) => (lng - 106.84) * 900;
const mapLat = (lat) => (47.94 - lat) * 700;
const getColor = (usage) =>
  usage > 80000 ? "#e63946" : usage > 40000 ? "#f4a261" : "#2a9d8f";

export default function UBMap({ buildings, selected, onSelect, northLabel, usageUnit, ariaLabel }) {
  return (
    <svg
      viewBox="0 0 480 360"
      className="ub-map"
      role="img"
      aria-label={ariaLabel}
    >
      {/* Background */}
      <rect width="240" height="180" fill="#162433" rx="8" />

      {/* Grid */}
      {Array.from({ length: 10 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 36} x2={480} y2={i * 36}
          stroke="rgba(42,74,107,0.3)" strokeWidth={0.5} />
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <line key={`v${i}`} x1={i * 36} y1={0} x2={i * 36} y2={360}
          stroke="rgba(42,74,107,0.3)" strokeWidth={0.5} />
      ))}

      {/* District zones */}
      {DISTRICTS.map(d => (
        <g key={d.id}>
          <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={6}
            fill="rgba(26,110,181,0.12)" stroke="rgba(26,110,181,0.4)" strokeWidth={1} />
          <text x={d.x + d.w / 2} y={d.y + d.h / 2}
            textAnchor="middle" dominantBaseline="middle"
            fill="rgba(168,197,224,0.6)" fontSize="10" fontWeight="500">
            {d.id}
          </text>
        </g>
      ))}

      {/* Buildings */}
      {buildings.map(b => {
        const x = mapLng(b.lng);
        const y = mapLat(b.lat);
        const color = getColor(b.usage);
        const r = Math.max(6, Math.min(14, b.area / 400));
        const isSelected = selected?.id === b.id;
        return (
          <g key={b.id} onClick={() => onSelect(b)} style={{ cursor: "pointer" }}>
            {isSelected && (
              <circle cx={x} cy={y} r={r + 6} fill="none" stroke={color} strokeWidth={2} opacity={0.6}>
                <animate attributeName="r" from={r + 4} to={r + 10} dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from={0.6} to={0} dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={x} cy={y} r={r}
              fill={color} opacity={0.85}
              stroke={isSelected ? "#fff" : "transparent"}
              strokeWidth={isSelected ? 2 : 0}
            />
            <title>{b.name}: {b.usage.toLocaleString()} {usageUnit}</title>
          </g>
        );
      })}

      {/* North compass */}
      <g transform="translate(450, 30)">
        <circle cx={0} cy={0} r={14}
          fill="rgba(26,110,181,0.2)" stroke="rgba(26,110,181,0.4)" strokeWidth={1} />
        <text x={0} y={-4} textAnchor="middle" fill="#3a8fd4" fontSize="10" fontWeight="700">
          {northLabel}
        </text>
        <line x1={0} y1={-2} x2={0} y2={-10} stroke="#3a8fd4" strokeWidth={1.5} />
      </g>
    </svg>
  );
}
