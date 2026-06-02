/**
 * EnergyDualChart — two-panel monthly energy chart
 *
 * Left : stacked bars (heating + electric) + smooth total line   [kWh]
 * Right: grouped bars (heating / electric / total)               [MWh]
 *
 * Props
 *   data          [{month, heating, electric, total?, fullMonth?, temp?, isCur?}]
 *   lang          "mn" | "en"
 *   height        number (default 220)
 *   actualMonthly number | null  — real bill average → dashed line on left
 */

import {
  ComposedChart, BarChart,
  Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

/* ── palette ──────────────────────────────────────────────────────── */
const C_HEAT  = "#e05252";
const C_ELEC  = "#4a9fe0";
const C_TOTAL = "#2ca87f";
const C_ACT   = "#2a9d8f";
const C_CUR   = "#e9c46a";
const C_GRID  = "rgba(100,150,200,0.13)";
const TICK    = { fill: "#6a8faa", fontSize: 9, fontFamily: "Inter,sans-serif" };

function kFmt(v)   { return v >= 1000  ? `${(v / 1000).toFixed(0)}k`  : `${v}`;  }
function mFmt(v)   { return v >= 1     ? `${v.toFixed(0)}`             : `${v}`;  }

/* ── shared panel title ───────────────────────────────────────────── */
function PanelTitle({ text }) {
  return (
    <p style={{
      textAlign: "center", margin: "0 0 6px",
      fontSize: "0.67rem", fontWeight: 700,
      color: "#7ab4d8", letterSpacing: "0.04em",
      textTransform: "uppercase",
    }}>{text}</p>
  );
}

/* ── tooltip ──────────────────────────────────────────────────────── */
function Tip({ active, payload, unit = "kWh" }) {
  if (!active || !payload?.length) return null;
  const d  = payload[0]?.payload ?? {};
  const mn = d._mn;
  return (
    <div style={{
      background: "rgba(6,14,24,0.96)",
      border: "1px solid rgba(74,159,224,0.2)",
      borderRadius: 8, padding: "8px 12px",
      fontSize: 11, lineHeight: 1.7, minWidth: 150,
      boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontWeight: 700, color: d.isCur ? C_CUR : "#8ec8e8",
        marginBottom: 4, fontSize: 12 }}>
        {d.fullMonth || d.month}
        {d.temp != null && (
          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 400,
            color: "#445566" }}>{d.temp > 0 ? "+" : ""}{d.temp}°C</span>
        )}
      </div>
      {payload.map(({ name, value, color }) => (
        <div key={name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2,
            background: color, flexShrink: 0 }} />
          <span style={{ color: "#6a8faa", flex: 1 }}>{name}</span>
          <span style={{ fontFamily: "monospace", color: "#b0cfe8" }}>
            {typeof value === "number" ? value.toLocaleString() : value} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

function MwhTip(props) { return <Tip {...props} unit="MWh" />; }

/* ── custom X tick (current month = gold) ─────────────────────────── */
function XTick({ x, y, payload, data }) {
  const isCur = data?.[payload?.index]?.isCur;
  return (
    <text x={x} y={y + 11} textAnchor="middle"
      fill={isCur ? C_CUR : "#4a7090"}
      fontSize={isCur ? 10 : 9}
      fontWeight={isCur ? 700 : 400}>
      {payload.value}
    </text>
  );
}

/* ── legend style ──────────────────────────────────────────────────── */
const LEG = {
  wrapperStyle: { paddingTop: 6, fontSize: 10 },
  iconSize: 9, iconType: "square",
  formatter: v => <span style={{ color: "#6a8faa" }}>{v}</span>,
};

/* ════════════════════════════════════════════════════════════════════ */
export default function EnergyDualChart({
  data = [], lang, height = 220, actualMonthly,
}) {
  const mn = lang === "mn";

  const enriched = data.map(d => ({
    ...d,
    _mn:   mn,
    total: d.total ?? (d.heating + d.electric),
  }));

  /* MWh data for right panel */
  const mwhData = enriched.map(d => ({
    month:     d.month,
    fullMonth: d.fullMonth,
    isCur:     d.isCur,
    _mn:       mn,
    [mn ? "Дулаалга"  : "Heating"]:  +(d.heating  / 1000).toFixed(2),
    [mn ? "Цахилгаан" : "Electric"]: +(d.electric / 1000).toFixed(2),
    [mn ? "Нийт"      : "Total"]:    +((d.heating + d.electric) / 1000).toFixed(2),
  }));

  const heatKey  = mn ? "Дулаалга"  : "Heating";
  const elecKey  = mn ? "Цахилгаан" : "Electric";
  const totalKey = mn ? "Нийт"      : "Total";

  const maxKwh = Math.max(...enriched.map(d => d.total ?? 0), actualMonthly ?? 0);
  const yTopKwh = Math.ceil((maxKwh * 1.08) / 20000) * 20000 || 20000;

  const maxMwh  = Math.max(...mwhData.map(d => d[totalKey] ?? 0));
  const yTopMwh = Math.ceil((maxMwh * 1.08) / 0.5) * 0.5 || 1;

  const titleLeft  = mn ? "Стэк: Дулаалга + Цахилгаан = Нийт"
                        : "Stacked: Heating + Electric = Total";
  const titleRight = mn ? "Сар бүрийн нийт хэрэглээ (MWh)"
                        : "Monthly total consumption (MWh)";

  const heatLblL = mn ? "Дулаалга (kWh)"   : "Heating (kWh)";
  const elecLblL = mn ? "Цахилгаан (kWh)"  : "Electric (kWh)";
  const totLblL  = mn ? "Нийт"             : "Total";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>

      {/* ═══ LEFT — stacked + line ═══════════════════════════════════ */}
      <div>
        <PanelTitle text={titleLeft} />
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={enriched}
            margin={{ top: 4, right: 6, left: -10, bottom: 0 }}
            barCategoryGap="28%">

            <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} />

            {actualMonthly != null && (
              <ReferenceLine y={actualMonthly}
                stroke={C_ACT} strokeWidth={1.6} strokeDasharray="6 3" />
            )}
            {enriched.find(d => d.isCur) && (
              <ReferenceLine x={enriched.find(d => d.isCur)?.month}
                stroke={C_CUR} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.4} />
            )}

            <XAxis dataKey="month" axisLine={false} tickLine={false}
              tick={p => <XTick {...p} data={enriched} />} />
            <YAxis tick={TICK} tickLine={false} axisLine={false}
              tickFormatter={kFmt} domain={[0, yTopKwh]} width={36}
              label={{ value: mn ? "kWh" : "kWh", angle: -90,
                position: "insideLeft", offset: 14,
                style: { fill: "#4a6880", fontSize: 9 } }} />

            <Tooltip content={<Tip />}
              cursor={{ fill: "rgba(74,159,224,0.06)" }} />
            <Legend {...LEG} />

            <Bar dataKey="heating"  stackId="s" name={heatLblL}
              fill={C_HEAT} maxBarSize={16}>
              {enriched.map((d, i) => (
                <Cell key={i} fill={C_HEAT} opacity={d.isCur ? 1 : 0.82}
                  stroke={d.isCur ? C_CUR : "none"} strokeWidth={d.isCur ? 1.5 : 0} />
              ))}
            </Bar>

            <Bar dataKey="electric" stackId="s" name={elecLblL}
              fill={C_ELEC} maxBarSize={16} radius={[2, 2, 0, 0]}>
              {enriched.map((d, i) => (
                <Cell key={i} fill={C_ELEC} opacity={d.isCur ? 1 : 0.82}
                  stroke={d.isCur ? C_CUR : "none"} strokeWidth={d.isCur ? 1.5 : 0} />
              ))}
            </Bar>

            <Line type="monotone" dataKey="total" name={totLblL}
              stroke={C_TOTAL} strokeWidth={2}
              dot={{ fill: C_TOTAL, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: C_TOTAL, strokeWidth: 0 }}
              isAnimationActive animationDuration={700} />

          </ComposedChart>
        </ResponsiveContainer>

        {actualMonthly != null && (
          <div style={{ textAlign: "center", fontSize: "0.63rem",
            color: C_ACT, marginTop: 2,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <span style={{ display: "inline-block", width: 14,
              borderTop: `2px dashed ${C_ACT}` }} />
            {mn
              ? `Бодит дундаж: ${actualMonthly.toLocaleString()} kWh/сар`
              : `Actual avg: ${actualMonthly.toLocaleString()} kWh/mo`}
          </div>
        )}
      </div>

      {/* ═══ RIGHT — grouped MWh ═════════════════════════════════════ */}
      <div>
        <PanelTitle text={titleRight} />
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={mwhData}
            margin={{ top: 4, right: 6, left: -10, bottom: 0 }}
            barCategoryGap="22%" barGap={2}>

            <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} />

            {mwhData.find(d => d.isCur) && (
              <ReferenceLine x={mwhData.find(d => d.isCur)?.month}
                stroke={C_CUR} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.4} />
            )}

            <XAxis dataKey="month" axisLine={false} tickLine={false}
              tick={p => <XTick {...p} data={mwhData} />} />
            <YAxis tick={TICK} tickLine={false} axisLine={false}
              tickFormatter={mFmt} domain={[0, yTopMwh]} width={36}
              label={{ value: "MWh", angle: -90,
                position: "insideLeft", offset: 14,
                style: { fill: "#4a6880", fontSize: 9 } }} />

            <Tooltip content={<MwhTip />}
              cursor={{ fill: "rgba(74,159,224,0.06)" }} />
            <Legend {...LEG} />

            <Bar dataKey={heatKey}  fill={C_HEAT}  maxBarSize={10}
              radius={[2, 2, 0, 0]}
              isAnimationActive animationDuration={600} />
            <Bar dataKey={elecKey}  fill={C_ELEC}  maxBarSize={10}
              radius={[2, 2, 0, 0]}
              isAnimationActive animationDuration={700} />
            <Bar dataKey={totalKey} fill={C_TOTAL} maxBarSize={10}
              radius={[2, 2, 0, 0]}
              isAnimationActive animationDuration={800} />

          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
