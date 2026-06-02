/**
 * EnergyDualChart — monthly energy breakdown
 * Stacked bars (heating + electric) + smooth total line
 */

import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceArea, ReferenceLine,
} from "recharts";

const C_HEAT  = "#e05252";
const C_ELEC  = "#4a9fe0";
const C_TOTAL = "#2db8a8";
const C_ACT   = "#2a9d8f";
const C_CUR   = "#e9c46a";

function kFmt(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;
}

/* ─── Tooltip ───────────────────────────────────────────────────── */
function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d     = payload[0]?.payload ?? {};
  const heat  = d.heating  ?? 0;
  const elec  = d.electric ?? 0;
  const mn    = d._mn;
  return (
    <div style={{
      background: "rgba(8,16,26,0.95)",
      border: "1px solid rgba(58,143,212,0.25)",
      borderRadius: 8, padding: "9px 13px",
      fontSize: 11, lineHeight: 1.7, minWidth: 152,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4,
        color: d.isCur ? C_CUR : "#a8c5e0", fontSize: 12 }}>
        {d.fullMonth || d.month}
        {d.isCur && <span style={{
          marginLeft: 6, fontSize: 9, color: C_CUR,
          background: "rgba(233,196,106,0.12)",
          border: "1px solid rgba(233,196,106,0.3)",
          borderRadius: 3, padding: "1px 5px",
        }}>{mn ? "ОДОО" : "NOW"}</span>}
      </div>
      <TipRow color={C_HEAT} label={mn ? "Дулаалга"  : "Heating"}  val={heat} />
      <TipRow color={C_ELEC} label={mn ? "Цахилгаан" : "Electric"} val={elec} />
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)",
        marginTop: 4, paddingTop: 4 }}>
        <TipRow color={C_TOTAL} label={mn ? "Нийт" : "Total"} val={heat + elec} bold />
        {d.temp != null && (
          <div style={{ color: "#556677", fontSize: 10, marginTop: 1 }}>
            {d.temp > 0 ? "+" : ""}{d.temp}°C
          </div>
        )}
      </div>
    </div>
  );
}

function TipRow({ color, label, val, bold }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: 2,
        background: color, flexShrink: 0 }} />
      <span style={{ color: "#7a99b4", flex: 1 }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontSize: 11,
        fontWeight: bold ? 700 : 400,
        color: bold ? "#ddeeff" : "#aac5de" }}>
        {val.toLocaleString()} kWh
      </span>
    </div>
  );
}

/* ─── X-axis tick (current month = gold) ───────────────────────── */
function XTick({ x, y, payload, data }) {
  const isCur = data?.[payload?.index]?.isCur;
  return (
    <text x={x} y={y + 10} textAnchor="middle"
      fill={isCur ? C_CUR : "#4a6880"}
      fontSize={isCur ? 10 : 9}
      fontWeight={isCur ? 700 : 400}>
      {payload.value}
    </text>
  );
}

/* ─── Bottom legend ─────────────────────────────────────────────── */
function Legend({ mn, hasActual }) {
  const items = [
    { color: C_HEAT,  type: "box",  label: mn ? "Дулаалга"    : "Heating"     },
    { color: C_ELEC,  type: "box",  label: mn ? "Цахилгаан"   : "Electric"    },
    { color: C_TOTAL, type: "line", label: mn ? "Нийт"        : "Total"       },
    ...(hasActual ? [{ color: C_ACT, type: "dash", label: mn ? "Бодит дундаж" : "Actual avg" }] : []),
  ];
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center",
      flexWrap: "wrap", paddingTop: 5 }}>
      {items.map(it => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {it.type === "box"  && <span style={{ width: 9, height: 9, borderRadius: 2, background: it.color, display: "inline-block" }} />}
          {it.type === "line" && <span style={{ width: 13, height: 2.5, borderRadius: 2, background: it.color, display: "inline-block" }} />}
          {it.type === "dash" && <span style={{ width: 13, borderTop: `2px dashed ${it.color}`, display: "inline-block" }} />}
          <span style={{ fontSize: 10, color: it.type === "dash" ? C_ACT : "#5a7e9a",
            fontWeight: it.type === "dash" ? 600 : 400 }}>
            {it.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────────────────── */
export default function EnergyDualChart({ data = [], lang, height = 210, actualMonthly }) {
  const mn = lang === "mn";

  const enriched = data.map(d => ({
    ...d,
    _mn:   mn,
    total: d.total ?? (d.heating + d.electric),
  }));

  const maxVal = Math.max(...enriched.map(d => d.total ?? 0), actualMonthly ?? 0);
  const yTop   = Math.ceil(maxVal / 20000) * 20000 || 20000;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={enriched}
          margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
          barCategoryGap="20%">

          {/* Subtle season backgrounds — no labels inside the chart */}
          <ReferenceArea x1={enriched[0]?.month} x2={enriched[2]?.month}
            fill="rgba(224,82,82,0.04)" strokeOpacity={0} />
          <ReferenceArea x1={enriched[4]?.month} x2={enriched[8]?.month}
            fill="rgba(58,143,212,0.04)" strokeOpacity={0} />
          <ReferenceArea x1={enriched[9]?.month} x2={enriched[11]?.month}
            fill="rgba(224,82,82,0.04)" strokeOpacity={0} />

          <CartesianGrid strokeDasharray="3 3"
            stroke="rgba(58,143,212,0.09)" vertical={false} />

          {/* Actual monthly avg — dashed line, no inline label */}
          {actualMonthly != null && (
            <ReferenceLine y={actualMonthly}
              stroke={C_ACT} strokeWidth={1.6} strokeDasharray="6 3" />
          )}

          {/* Current month — thin vertical gold guide */}
          {enriched.find(d => d.isCur) && (
            <ReferenceLine x={enriched.find(d => d.isCur)?.month}
              stroke={C_CUR} strokeWidth={1.2}
              strokeDasharray="4 3" strokeOpacity={0.5} />
          )}

          <XAxis dataKey="month" axisLine={false} tickLine={false}
            tick={props => <XTick {...props} data={enriched} />} />
          <YAxis tick={{ fill: "#4a6880", fontSize: 9 }}
            tickLine={false} axisLine={false}
            tickFormatter={kFmt} domain={[0, yTop]} width={34} />

          <Tooltip content={<Tip />}
            cursor={{ fill: "rgba(58,143,212,0.06)" }} />

          {/* Heating bars */}
          <Bar dataKey="heating" stackId="s" maxBarSize={18}
            name={mn ? "Дулаалга" : "Heating"}>
            {enriched.map((d, i) => (
              <Cell key={i} fill={C_HEAT}
                opacity={d.isCur ? 1 : 0.78}
                stroke={d.isCur ? C_CUR : "none"}
                strokeWidth={d.isCur ? 1.5 : 0} />
            ))}
          </Bar>

          {/* Electric bars */}
          <Bar dataKey="electric" stackId="s" maxBarSize={18}
            radius={[3, 3, 0, 0]} name={mn ? "Цахилгаан" : "Electric"}>
            {enriched.map((d, i) => (
              <Cell key={i} fill={C_ELEC}
                opacity={d.isCur ? 1 : 0.78}
                stroke={d.isCur ? C_CUR : "none"}
                strokeWidth={d.isCur ? 1.5 : 0} />
            ))}
          </Bar>

          {/* Total line */}
          <Line type="monotone" dataKey="total" stroke={C_TOTAL}
            strokeWidth={2} dot={false}
            activeDot={{ r: 4, fill: C_TOTAL, strokeWidth: 0 }}
            name={mn ? "Нийт" : "Total"}
            isAnimationActive animationDuration={700} animationEasing="ease-out" />

        </ComposedChart>
      </ResponsiveContainer>

      <Legend mn={mn} hasActual={actualMonthly != null} />
    </div>
  );
}
