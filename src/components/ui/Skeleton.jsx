import "./Skeleton.css";

/**
 * Base Skeleton block — use for any inline placeholder.
 *   <Skeleton width="60%" height="1rem" />
 *   <Skeleton width={48} height={48} style={{ borderRadius: "50%" }} />
 */
export function Skeleton({ width = "100%", height = "1rem", className = "", style = {}, rounded = false }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: rounded ? "999px" : undefined,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Multiple lines of text skeleton.
 *   <SkeletonText lines={3} lastWidth="55%" />
 */
export function SkeletonText({ lines = 3, lastWidth = "60%", gap = "0.45rem" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="0.875rem"
          width={i === lines - 1 ? lastWidth : "100%"}
        />
      ))}
    </div>
  );
}

/**
 * Stat card skeleton (icon + large number + label).
 */
export function SkeletonStatCard() {
  return (
    <div className="card skeleton-stat-card">
      <Skeleton width={52} height={52} style={{ borderRadius: 12 }} />
      <Skeleton width="55%" height="1.75rem" />
      <Skeleton width="70%" height="0.8rem" />
      <Skeleton width="50%" height="0.7rem" rounded />
    </div>
  );
}

/**
 * Generic feature card skeleton.
 */
export function SkeletonFeatureCard() {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Skeleton width={56} height={56} style={{ borderRadius: 10 }} />
      <Skeleton width="65%" height="1rem" />
      <SkeletonText lines={2} lastWidth="40%" />
    </div>
  );
}

/**
 * Table skeleton with configurable rows and columns.
 *   <SkeletonTable rows={5} cols={4} />
 */
export function SkeletonTable({ rows = 4, cols = 4 }) {
  const colWidths = ["80%", "100%", "100%", "60%"];
  return (
    <div className="skeleton-table-wrap">
      {/* Header row */}
      <div className="skeleton-table-row skeleton-table-header">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} height="0.8rem" width={colWidths[c % colWidths.length]} style={{ flex: 1 }} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div className="skeleton-table-row" key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              height="0.8rem"
              width={c === 0 ? "75%" : c === cols - 1 ? "55%" : "100%"}
              style={{ flex: 1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Bar chart skeleton — random-height bars.
 *   <SkeletonChart height={200} bars={12} />
 */
export function SkeletonChart({ height = 200, bars = 12 }) {
  const heights = [60, 85, 45, 75, 90, 55, 70, 80, 65, 95, 50, 78];
  return (
    <div className="skeleton-chart" style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="skeleton-chart-bar"
          style={{
            height: `${heights[i % heights.length]}%`,
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Page-level content skeleton (header + stats + chart).
 */
export function SkeletonPage() {
  return (
    <div className="container" style={{ padding: "2rem 0" }}>
      {/* Page header */}
      <div style={{ marginBottom: "2rem" }}>
        <Skeleton width="35%" height="2rem" style={{ marginBottom: "0.6rem" }} />
        <Skeleton width="55%" height="0.9rem" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-4" style={{ marginBottom: "1.5rem" }}>
        {[1, 2, 3, 4].map(i => <SkeletonStatCard key={i} />)}
      </div>
      {/* Chart area */}
      <div className="card">
        <Skeleton width="25%" height="1rem" style={{ marginBottom: "1rem" }} />
        <SkeletonChart height={220} bars={12} />
      </div>
    </div>
  );
}
