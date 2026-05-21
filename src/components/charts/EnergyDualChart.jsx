/**
 * EnergyDualChart — two-panel monthly energy breakdown chart
 *
 * Left panel : ComposedChart — Heating (red) + Electric (blue) stacked bars
 *              with a total "Use" line (green, with dots)
 * Right panel: BarChart — grouped bars for Heating / Electric / Total in MWh
 *
 * Props:
 *   data        [{month, heating, electric, total?}, ...]  — kWh values
 *   lang        "mn" | "en"
 *   height      number  (default 220)
 *   leftTitle   string  (optional subtitle above left panel)
 *   rightTitle  string  (optional subtitle above right panel)
 */

import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const C_HEAT  = "#e63946";
const C_ELEC  = "#1a6eb5";
const C_TOTAL = "#2a9d8f";

const TICK  = { fill: "#6a9bbf", fontSize: 9 };
const TT_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: 11,
};

function kFmt(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return v;
}

export default function EnergyDualChart({ data, lang, height = 220, leftTitle, rightTitle }) {
  const mn = lang === "mn";
  const heatLbl  = mn ? "Дулаалга (kWh)" : "Heating (kWh)";
  const elecLbl  = mn ? "Цахилгаан (kWh)" : "Electric (kWh)";
  const totalLbl = mn ? "Нийт (Use)" : "Total (Use)";

  // Compute total if not pre-computed
  const enriched = data.map(d => ({
    ...d,
    total: d.total ?? (d.heating + d.electric),
  }));

  // MWh version for right panel
  const mwhData = enriched.map(d => ({
    month: d.month,
    [mn ? "Дулаалга" : "Heating"]:   +(d.heating / 1000).toFixed(2),
    [mn ? "Цахилгаан" : "Electric"]: +(d.electric / 1000).toFixed(2),
    [mn ? "Нийт" : "Total"]:         +((d.heating + d.electric) / 1000).toFixed(2),
  }));

  const mwhHeat  = mn ? "Дулаалга"   : "Heating";
  const mwhElec  = mn ? "Цахилгаан"  : "Electric";
  const mwhTotal = mn ? "Нийт"       : "Total";

  const subStyle = {
    fontSize: "0.68rem", color: "var(--text3)",
    textAlign: "center", marginBottom: 4,
  };
  const yAxisLabel = {
    angle: -90, position: "insideLeft", offset: 18,
    style: { fill: "#6a9bbf", fontSize: 9 },
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>

      {/* ── Left: Stacked bar + total line ── */}
      <div>
        {leftTitle && <div style={subStyle}>{leftTitle}</div>}
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={enriched} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.3)" />
            <XAxis dataKey="month" tick={TICK} tickLine={false} />
            <YAxis tick={TICK} tickLine={false} axisLine={false}
              tickFormatter={kFmt}
              label={{ value: mn ? "кВт·цаг" : "kWh", ...yAxisLabel }}
            />
            <Tooltip
              contentStyle={TT_STYLE}
              formatter={(v, name) => [`${v.toLocaleString()} kWh`, name]}
            />
            <Legend iconSize={9} wrapperStyle={{ fontSize: 9, paddingTop: 2 }} />
            <Bar dataKey="heating" stackId="a" fill={C_HEAT}  name={heatLbl} />
            <Bar dataKey="electric" stackId="a" fill={C_ELEC} name={elecLbl} radius={[3, 3, 0, 0]} />
            <Line
              type="monotone" dataKey="total" stroke={C_TOTAL} strokeWidth={2}
              dot={{ fill: C_TOTAL, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              name={totalLbl}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Right: Grouped bars in MWh ── */}
      <div>
        {rightTitle && <div style={subStyle}>{rightTitle}</div>}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={mwhData} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}
            barCategoryGap="22%" barGap={1}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.3)" />
            <XAxis dataKey="month" tick={TICK} tickLine={false} />
            <YAxis tick={TICK} tickLine={false} axisLine={false}
              label={{ value: "MWh", ...yAxisLabel }}
            />
            <Tooltip
              contentStyle={TT_STYLE}
              formatter={(v, name) => [`${v.toFixed(2)} MWh`, name]}
            />
            <Legend iconSize={9} wrapperStyle={{ fontSize: 9, paddingTop: 2 }} />
            <Bar dataKey={mwhHeat}  fill={C_HEAT}  radius={[2, 2, 0, 0]} />
            <Bar dataKey={mwhElec}  fill={C_ELEC}  radius={[2, 2, 0, 0]} />
            <Bar dataKey={mwhTotal} fill={C_TOTAL} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
