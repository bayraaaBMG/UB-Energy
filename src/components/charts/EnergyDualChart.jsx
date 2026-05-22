/**
 * EnergyDualChart — two-panel monthly energy breakdown
 *
 * Left : ComposedChart — Heating + Electric stacked bars + total line
 * Right: BarChart — grouped Heating / Electric / Total in MWh
 *
 * Props:
 *   data       [{month, heating, electric, total?}, ...]  — kWh
 *   lang       "mn" | "en"
 *   height     number  (default 230)
 *   leftTitle  string
 *   rightTitle string
 */

import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const C_HEAT  = "#e05252";
const C_ELEC  = "#3a8fd4";
const C_TOTAL = "#2db8a8";

const TICK_STYLE = { fill: "#6a9bbf", fontSize: 10, fontFamily: "Inter, sans-serif" };
const GRID_PROPS = { strokeDasharray: "4 4", stroke: "rgba(42,74,107,0.22)", strokeWidth: 1 };

function kFmt(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v;
}

/* ─── Custom tooltip ─────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, unit = "kWh" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15, 25, 35, 0.92)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(58,143,212,0.25)",
      borderRadius: 10,
      padding: "0.65rem 0.9rem",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      minWidth: 140,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#a8c5e0", marginBottom: 6, letterSpacing: "0.02em" }}>
        {label}
      </p>
      {payload.map(({ name, value, color }) => (
        <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#a8c5e0", flex: 1 }}>{name}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#e8f4fd", fontFamily: "monospace" }}>
            {typeof value === "number" ? value.toLocaleString() : value} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

function MwhTooltip(props) {
  return <ChartTooltip {...props} unit="MWh" />;
}

/* ─── Shared legend style ────────────────────────────────────────────────── */
const LEGEND_STYLE = { fontSize: 10, paddingTop: 4, color: "#6a9bbf" };

/* ─── Panel label ────────────────────────────────────────────────────────── */
function PanelLabel({ text }) {
  if (!text) return null;
  return (
    <p style={{
      fontSize: "0.68rem",
      color: "var(--text3)",
      textAlign: "center",
      marginBottom: 6,
      letterSpacing: "0.03em",
      textTransform: "uppercase",
      fontWeight: 600,
    }}>
      {text}
    </p>
  );
}

/* ─── Main chart ──────────────────────────────────────────────────────────── */
export default function EnergyDualChart({ data, lang, height = 230, leftTitle, rightTitle }) {
  const mn = lang === "mn";

  const heatLbl  = mn ? "Дулаалга (кВт·ц)" : "Heating (kWh)";
  const elecLbl  = mn ? "Цахилгаан (кВт·ц)" : "Electric (kWh)";
  const totalLbl = mn ? "Нийт"              : "Total";

  const enriched = data.map(d => ({
    ...d,
    total: d.total ?? (d.heating + d.electric),
  }));

  const mwhHeat  = mn ? "Дулаалга"  : "Heating";
  const mwhElec  = mn ? "Цахилгаан" : "Electric";
  const mwhTotal = mn ? "Нийт"      : "Total";

  const mwhData = enriched.map(d => ({
    month: d.month,
    [mwhHeat]:  +(d.heating  / 1000).toFixed(2),
    [mwhElec]:  +(d.electric / 1000).toFixed(2),
    [mwhTotal]: +((d.heating + d.electric) / 1000).toFixed(2),
  }));

  const yLabel = {
    angle: -90, position: "insideLeft", offset: 18,
    style: { fill: "#6a9bbf", fontSize: 9 },
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

      {/* ── Left: Stacked bars + total line ── */}
      <div>
        <PanelLabel text={leftTitle} />
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={enriched} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="month" tick={TICK_STYLE} tickLine={false} axisLine={false} />
            <YAxis
              tick={TICK_STYLE} tickLine={false} axisLine={false}
              tickFormatter={kFmt}
              label={{ value: mn ? "кВт·ц" : "kWh", ...yLabel }}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(58,143,212,0.06)" }} />
            <Legend iconSize={8} iconType="square" wrapperStyle={LEGEND_STYLE} />
            <Bar dataKey="heating"  stackId="a" fill={C_HEAT}  name={heatLbl} />
            <Bar dataKey="electric" stackId="a" fill={C_ELEC}  name={elecLbl} radius={[3, 3, 0, 0]} />
            <Line
              type="natural"
              dataKey="total"
              stroke={C_TOTAL}
              strokeWidth={2.5}
              dot={{ fill: C_TOTAL, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "rgba(45,184,168,0.4)" }}
              name={totalLbl}
              isAnimationActive
              animationDuration={800}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Right: Grouped bars in MWh ── */}
      <div>
        <PanelLabel text={rightTitle} />
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={mwhData}
            margin={{ top: 8, right: 8, left: -14, bottom: 0 }}
            barCategoryGap="24%"
            barGap={2}
          >
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="month" tick={TICK_STYLE} tickLine={false} axisLine={false} />
            <YAxis
              tick={TICK_STYLE} tickLine={false} axisLine={false}
              label={{ value: "MWh", ...yLabel }}
            />
            <Tooltip content={<MwhTooltip />} cursor={{ fill: "rgba(58,143,212,0.06)" }} />
            <Legend iconSize={8} iconType="square" wrapperStyle={LEGEND_STYLE} />
            <Bar dataKey={mwhHeat}  fill={C_HEAT}  radius={[3, 3, 0, 0]} isAnimationActive animationDuration={700} />
            <Bar dataKey={mwhElec}  fill={C_ELEC}  radius={[3, 3, 0, 0]} isAnimationActive animationDuration={800} />
            <Bar dataKey={mwhTotal} fill={C_TOTAL} radius={[3, 3, 0, 0]} isAnimationActive animationDuration={900} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
