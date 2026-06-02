/**
 * EnergyDualChart — single-panel monthly energy breakdown
 * Stacked bars (heating + electric) + smooth total curve
 * Season background zones + current-month highlight
 *
 * Props:
 *   data       [{month, heating, electric, total?, temp?, isCur?}, ...]
 *   lang       "mn" | "en"
 *   height     number  (default 210)
 */

import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceArea, ReferenceLine,
} from "recharts";

const C_HEAT  = "#e05252";
const C_ELEC  = "#4a9fe0";
const C_TOTAL = "#2db8a8";
const C_CUR   = "#e9c46a";

const TICK = { fill: "#6a8faa", fontSize: 10, fontFamily: "Inter, sans-serif" };

/* ─── Temperature → heating bar shade ──────────────────────────── */
function heatShade(temp) {
  if (temp == null) return C_HEAT;
  if (temp <= -15) return "#c23030";
  if (temp <= -5)  return "#d94444";
  if (temp <= 3)   return "#e05252";
  if (temp <= 10)  return "#e07848";
  return "#d98a3a";
}

/* ─── Custom tooltip ─────────────────────────────────────────────── */
function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d     = payload[0]?.payload ?? {};
  const heat  = d.heating  ?? 0;
  const elec  = d.electric ?? 0;
  const total = heat + elec;
  const mn    = d._mn;
  return (
    <div style={{
      background: "rgba(8,16,26,0.96)",
      backdropFilter: "blur(14px)",
      border: "1px solid rgba(58,143,212,0.28)",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 11,
      lineHeight: 1.75,
      minWidth: 160,
      boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
    }}>
      <div style={{ fontWeight: 700, color: d.isCur ? C_CUR : "#a8c5e0", marginBottom: 5, fontSize: 12 }}>
        {d.fullMonth || label}
        {d.isCur && (
          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 600, color: C_CUR,
            background: "rgba(233,196,106,0.15)", padding: "1px 5px", borderRadius: 4,
            border: "1px solid rgba(233,196,106,0.35)" }}>
            {mn ? "ОДОО" : "NOW"}
          </span>
        )}
      </div>
      <Row color={C_HEAT}  label={mn ? "Дулаалга"  : "Heating"}  val={heat}  />
      <Row color={C_ELEC}  label={mn ? "Цахилгаан" : "Electric"} val={elec}  />
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.09)", marginTop: 5, paddingTop: 5 }}>
        <Row color={C_TOTAL} label={mn ? "Нийт" : "Total"} val={total} bold />
        {d.temp != null && (
          <div style={{ color: "#667788", fontSize: 10, marginTop: 2 }}>
            🌡 {d.temp > 0 ? "+" : ""}{d.temp}°C
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ color, label, val, bold }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ color: "#8899aa", flex: 1 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: bold ? "#e8f4fd" : "#c5dcef",
        fontFamily: "monospace", fontSize: 11 }}>
        {val.toLocaleString()} kWh
      </span>
    </div>
  );
}

/* ─── Custom X-axis tick ─────────────────────────────────────────── */
function XTick({ x, y, payload, data }) {
  const d = data?.[payload?.index];
  const isCur = d?.isCur;
  return (
    <text x={x} y={y + 10} textAnchor="middle"
      fill={isCur ? C_CUR : "#5a7a94"}
      fontSize={isCur ? 10 : 9}
      fontWeight={isCur ? 700 : 400}>
      {payload.value}
    </text>
  );
}

/* ─── Legend pills ──────────────────────────────────────────────── */
function ChartLegend({ mn }) {
  const items = [
    { color: C_HEAT,  label: mn ? "Дулаалга"  : "Heating"  },
    { color: C_ELEC,  label: mn ? "Цахилгаан" : "Electric" },
    { color: C_TOTAL, label: mn ? "Нийт"      : "Total"    },
  ];
  return (
    <div style={{ display: "flex", gap: "1rem", justifyContent: "center",
      paddingTop: 6, flexWrap: "wrap" }}>
      {items.map(it => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color,
            flexShrink: 0, display: "inline-block" }} />
          <span style={{ fontSize: 10, color: "#6a8faa" }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Season zone labels (rendered as foreignObject via tick hack) ─ */
const SEASON_ZONES = [
  { x1: "1",  x2: "3",  fill: "rgba(224,82,82,0.05)",  labelMn: "ӨВӨЛ", labelEn: "WINTER" },
  { x1: "5",  x2: "9",  fill: "rgba(58,143,212,0.05)", labelMn: "ЗУН",  labelEn: "SUMMER" },
  { x1: "10", x2: "12", fill: "rgba(224,82,82,0.05)",  labelMn: "ӨВӨЛ", labelEn: "WINTER" },
];

/* ─── Main component ─────────────────────────────────────────────── */
export default function EnergyDualChart({ data = [], lang, height = 210 }) {
  const mn = lang === "mn";

  const enriched = data.map(d => ({
    ...d,
    _mn:     mn,
    total:   d.total ?? (d.heating + d.electric),
  }));

  const maxVal = Math.max(...enriched.map(d => d.total ?? 0));
  const yTop   = Math.ceil(maxVal / 20000) * 20000;

  function kFmt(v) {
    return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={enriched} margin={{ top: 18, right: 10, left: -8, bottom: 0 }}
          barCategoryGap="22%" barGap={0}>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(58,143,212,0.10)"
            vertical={false}
          />

          {/* Season background zones */}
          {SEASON_ZONES.map((z, i) => (
            <ReferenceArea key={i} x1={z.x1} x2={z.x2}
              fill={z.fill} strokeOpacity={0}
              label={{ value: mn ? z.labelMn : z.labelEn,
                position: "insideTop",
                style: { fill: "rgba(255,255,255,0.18)", fontSize: 8,
                  fontWeight: 700, letterSpacing: "0.08em" } }}
            />
          ))}

          {/* Current month vertical marker */}
          {enriched.find(d => d.isCur) && (
            <ReferenceLine
              x={enriched.find(d => d.isCur)?.month}
              stroke={C_CUR}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              strokeOpacity={0.6}
            />
          )}

          <XAxis dataKey="month"
            axisLine={false} tickLine={false}
            tick={props => <XTick {...props} data={enriched} />}
          />
          <YAxis
            tick={{ ...TICK, fontSize: 9 }}
            tickLine={false} axisLine={false}
            tickFormatter={kFmt}
            domain={[0, yTop]}
            width={38}
          />

          <Tooltip content={<Tip />} cursor={{ fill: "rgba(58,143,212,0.06)" }} />

          {/* Heating — temperature-tinted color per month */}
          <Bar dataKey="heating" stackId="e" maxBarSize={20} name={mn ? "Дулаалга" : "Heating"}>
            {enriched.map((d, i) => (
              <Cell key={i}
                fill={heatShade(d.temp)}
                opacity={d.isCur ? 1 : 0.82}
                stroke={d.isCur ? C_CUR : "none"}
                strokeWidth={d.isCur ? 1.5 : 0}
              />
            ))}
          </Bar>

          {/* Electric — cool blue */}
          <Bar dataKey="electric" stackId="e" maxBarSize={20}
            radius={[3, 3, 0, 0]} name={mn ? "Цахилгаан" : "Electric"}>
            {enriched.map((d, i) => (
              <Cell key={i}
                fill={C_ELEC}
                opacity={d.isCur ? 1 : 0.82}
                stroke={d.isCur ? C_CUR : "none"}
                strokeWidth={d.isCur ? 1.5 : 0}
              />
            ))}
          </Bar>

          {/* Total line — smooth teal curve */}
          <Line
            type="natural"
            dataKey="total"
            stroke={C_TOTAL}
            strokeWidth={2}
            dot={({ cx, cy, index }) => {
              const d = enriched[index];
              if (d?.isCur) return (
                <circle key={index} cx={cx} cy={cy} r={5}
                  fill={C_TOTAL} stroke={C_CUR} strokeWidth={2} />
              );
              return <circle key={index} cx={cx} cy={cy} r={2.5} fill={C_TOTAL} stroke="none" />;
            }}
            activeDot={{ r: 5, fill: C_TOTAL, stroke: "rgba(45,184,168,0.4)", strokeWidth: 2 }}
            name={mn ? "Нийт" : "Total"}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <ChartLegend mn={mn} />
    </div>
  );
}
