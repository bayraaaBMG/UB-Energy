/**
 * EnergyDualChart — monthly heating + electric grouped bar chart
 * Style: professional, reference-matched — red=heating, blue=electric
 */

import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

const C_HEAT  = "#e05252";
const C_ELEC  = "#4a9fe0";
const C_TOTAL = "#2db8a8";
const C_ACT   = "#2a9d8f";
const C_CUR   = "#e9c46a";
const C_GRID  = "rgba(120,160,200,0.12)";
const TICK    = { fill: "#7a9ab8", fontSize: 10, fontFamily: "Inter,sans-serif" };

function kFmt(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;
}

/* ─── Tooltip ───────────────────────────────────────────────────── */
function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d   = payload[0]?.payload ?? {};
  const mn  = d._mn;
  const tot = (d.heating ?? 0) + (d.electric ?? 0);
  return (
    <div style={{
      background: "rgba(6,14,24,0.96)",
      border: "1px solid rgba(74,159,224,0.22)",
      borderRadius: 8, padding: "9px 13px",
      fontSize: 11, lineHeight: 1.75, minWidth: 158,
      boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
    }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 5,
        color: d.isCur ? C_CUR : "#9dc8e8" }}>
        {d.fullMonth || d.month}
        {d.temp != null && (
          <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 400,
            color: "#556677" }}>{d.temp > 0 ? "+" : ""}{d.temp}°C</span>
        )}
      </div>
      {[
        { c: C_HEAT, lbl: mn ? "Халаалт"    : "Heating",  v: d.heating  },
        { c: C_ELEC, lbl: mn ? "Цахилгаан"  : "Electric", v: d.electric },
      ].map(r => r.v != null && (
        <div key={r.lbl} style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:7, height:7, borderRadius:2, background:r.c, flexShrink:0 }} />
          <span style={{ color:"#7a99b4", flex:1 }}>{r.lbl}</span>
          <span style={{ fontFamily:"monospace", color:"#b8d8f0" }}>
            {r.v.toLocaleString()} kWh
          </span>
        </div>
      ))}
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.07)",
        marginTop:4, paddingTop:4,
        display:"flex", justifyContent:"space-between" }}>
        <span style={{ color:"#5a8caa" }}>{mn ? "Нийт" : "Total"}</span>
        <span style={{ fontFamily:"monospace", fontWeight:700, color:"#ddeeff" }}>
          {tot.toLocaleString()} kWh
        </span>
      </div>
    </div>
  );
}

/* ─── Custom X tick ─────────────────────────────────────────────── */
function XTick({ x, y, payload, data }) {
  const isCur = data?.[payload?.index]?.isCur;
  return (
    <text x={x} y={y + 11} textAnchor="middle"
      fill={isCur ? C_CUR : "#5a7e9a"}
      fontSize={isCur ? 10 : 9} fontWeight={isCur ? 700 : 400}>
      {payload.value}
    </text>
  );
}

/* ─── Main ──────────────────────────────────────────────────────── */
export default function EnergyDualChart({
  data = [], lang, height = 220, actualMonthly,
}) {
  const mn = lang === "mn";

  const enriched = data.map(d => ({
    ...d,
    _mn:   mn,
    total: d.total ?? (d.heating + d.electric),
  }));

  const maxVal = Math.max(...enriched.map(d => d.total ?? 0), actualMonthly ?? 0);
  const yTop   = Math.ceil((maxVal * 1.1) / 20000) * 20000 || 20000;

  const heatLbl = mn ? "Халаалт (kWh)"    : "Heating (kWh)";
  const elecLbl = mn ? "Цахилгаан (kWh)"  : "Electric (kWh)";
  const totLbl  = mn ? "Нийт"             : "Total";

  return (
    <div style={{ width: "100%" }}>

      {/* ── Section title ── */}
      <div style={{
        textAlign: "center", fontWeight: 700, fontSize: "0.72rem",
        color: "#7ab4d8", letterSpacing: "0.06em", textTransform: "uppercase",
        marginBottom: 8, paddingBottom: 6,
        borderBottom: "1px solid rgba(74,159,224,0.14)",
      }}>
        {mn ? "САРЫН ДУНДАЖ ХЭРЭГЛЭЭ" : "MONTHLY AVERAGE CONSUMPTION"}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={enriched}
          margin={{ top: 6, right: 10, left: -6, bottom: 2 }}
          barCategoryGap="28%" barGap={3}>

          <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} />

          {/* Actual avg line */}
          {actualMonthly != null && (
            <ReferenceLine y={actualMonthly}
              stroke={C_ACT} strokeWidth={1.8} strokeDasharray="6 3" />
          )}

          {/* Current month guide */}
          {enriched.find(d => d.isCur) && (
            <ReferenceLine
              x={enriched.find(d => d.isCur)?.month}
              stroke={C_CUR} strokeWidth={1}
              strokeDasharray="4 3" strokeOpacity={0.45} />
          )}

          <XAxis dataKey="month" axisLine={false} tickLine={false}
            tick={props => <XTick {...props} data={enriched} />} />

          <YAxis tick={TICK} tickLine={false} axisLine={false}
            tickFormatter={kFmt} domain={[0, yTop]} width={36} />

          <Tooltip content={<Tip />}
            cursor={{ fill: "rgba(74,159,224,0.06)" }} />

          <Legend
            iconType="square" iconSize={9}
            wrapperStyle={{ paddingTop: 8, fontSize: 10, color: "#6a8faa" }}
            formatter={v => <span style={{ color: "#6a8faa" }}>{v}</span>}
          />

          {/* Heating bars */}
          <Bar dataKey="heating" name={heatLbl} maxBarSize={14}
            fill={C_HEAT} radius={[2, 2, 0, 0]}>
            {enriched.map((d, i) => (
              <Cell key={i} fill={C_HEAT}
                opacity={d.isCur ? 1 : 0.80}
                stroke={d.isCur ? C_CUR : "none"}
                strokeWidth={d.isCur ? 1.5 : 0} />
            ))}
          </Bar>

          {/* Electric bars */}
          <Bar dataKey="electric" name={elecLbl} maxBarSize={14}
            fill={C_ELEC} radius={[2, 2, 0, 0]}>
            {enriched.map((d, i) => (
              <Cell key={i} fill={C_ELEC}
                opacity={d.isCur ? 1 : 0.80}
                stroke={d.isCur ? C_CUR : "none"}
                strokeWidth={d.isCur ? 1.5 : 0} />
            ))}
          </Bar>

          {/* Total smooth line */}
          <Line type="monotone" dataKey="total" name={totLbl}
            stroke={C_TOTAL} strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: C_TOTAL, strokeWidth: 0 }}
            isAnimationActive animationDuration={600} />

        </ComposedChart>
      </ResponsiveContainer>

      {/* Actual avg note */}
      {actualMonthly != null && (
        <div style={{
          textAlign: "center", fontSize: "0.65rem",
          color: C_ACT, marginTop: 2,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}>
          <span style={{ display:"inline-block", width:16,
            borderTop:`2px dashed ${C_ACT}` }} />
          {mn
            ? `Бодит дундаж: ${actualMonthly.toLocaleString()} kWh/сар`
            : `Actual avg: ${actualMonthly.toLocaleString()} kWh/mo`}
        </div>
      )}
    </div>
  );
}
