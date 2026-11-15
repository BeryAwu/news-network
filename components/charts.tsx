import type { CSSProperties } from "react";

/** Day bars: one accent series, zero baseline, 3 gridlines. Inline SVG, no chart library. */
export function DayBars({ data, label }: { data: { date: string; count: number }[]; label: string }) {
  const width = 640;
  const height = 190;
  const left = 28;
  const bottom = 26;
  const top = 12;
  const max = Math.max(1, ...data.map((d) => d.count));
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const plotH = height - bottom - top;
  const slot = (width - left) / Math.max(1, data.length);
  const barW = Math.min(24, slot - 6);
  const fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}. Total ${total} dalam ${data.length} hari.`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const y = top + plotH - (plotH * i) / 4;
          return (
            <g key={i}>
              <line className="chart-grid" x1={left} x2={width} y1={y} y2={y} />
              <text className="chart-axis-label" x={left - 6} y={y + 4} textAnchor="end">{Math.round((niceMax * i) / 4)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (plotH * d.count) / niceMax;
          const x = left + i * slot + (slot - barW) / 2;
          const y = top + plotH - h;
          return (
            <g key={d.date}>
              {d.count > 0 && <rect className="chart-bar" x={x} y={y} width={barW} height={h} rx={2}><title>{`${fmt.format(new Date(d.date + "T12:00:00+07:00"))}: ${d.count} naskah terbit`}</title></rect>}
              {d.count > 0 && <text className="chart-value" x={x + barW / 2} y={y - 4} textAnchor="middle">{d.count}</text>}
              {(i % 3 === 0 || i === data.length - 1) && <text className="chart-axis-label" x={x + barW / 2} y={height - 8} textAnchor="middle">{fmt.format(new Date(d.date + "T12:00:00+07:00"))}</text>}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export interface Part { label: string; value: number; color: string }

/** Parts of a whole as one stacked horizontal bar with a labelled legend. */
export function StackedBar({ parts, ariaLabel }: { parts: Part[]; ariaLabel: string }) {
  const shown = parts.filter((p) => p.value > 0);
  const total = shown.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className="stack-sm">
      <div className="stack-bar" role="img" aria-label={`${ariaLabel}: ${shown.map((p) => `${p.label} ${p.value}`).join(", ") || "belum ada data"}`}>
        {shown.map((p) => <span key={p.label} style={{ flexGrow: p.value, "--swatch": p.color } as CSSProperties} title={`${p.label}: ${p.value}`} />)}
      </div>
      <div className="chart-legend">
        {parts.map((p) => <span key={p.label} className="num"><span className="chart-swatch" style={{ "--swatch": p.color } as CSSProperties} />{p.label} <strong>{p.value}</strong>{total > 0 && p.value > 0 ? ` (${Math.round((p.value / total) * 100)}%)` : ""}</span>)}
      </div>
    </div>
  );
}

/** Horizontal bars compared on one zero-based scale. */
export function HorizontalBars({ rows, unit }: { rows: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="stack-sm">
      {rows.map((r) => (
        <div className="hbar" key={r.label}>
          <span title={r.label} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          <span className="hbar-track" role="img" aria-label={`${r.label}: ${r.value} ${unit}`}><span className="hbar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <strong className="num">{r.value}</strong>
        </div>
      ))}
    </div>
  );
}
