/**
 * Raw token values for places that can't take Tailwind classes (Recharts props, PDFs, canvas).
 * Mirrors /DESIGN.md and the @theme block in src/app/globals.css — keep them in sync.
 */
export const colors = {
  primary: "#0066cc",
  primaryFocus: "#0071e3",
  primaryOnDark: "#2997ff",
  ink: "#1d1d1f",
  ink80: "#333333",
  ink48: "#7a7a7a",
  bodyMuted: "#cccccc",
  dividerSoft: "#f0f0f0",
  hairline: "#e0e0e0",
  canvas: "#ffffff",
  parchment: "#f5f5f7",
  pearl: "#fafafc",
  tile1: "#272729",
  chip: "#d2d2d7",
  // Status gap-fills (see globals.css)
  destructive: "#e30000",
  success: "#008009",
  warning: "#b64400",
} as const;

/**
 * Chart series order: Action Blue leads, then the ink ladder. One accent only —
 * additional series step down through neutrals rather than introducing new hues.
 */
export const chartSeries = [colors.primary, colors.ink, colors.ink48, colors.chip, colors.ink80] as const;

/** Shared Recharts chrome: hairline grid, ink-48 caption-sized ticks, white tooltip with hairline border. */
export const chartTheme = {
  grid: { stroke: colors.dividerSoft, strokeDasharray: "0" },
  axisTick: { fill: colors.ink48, fontSize: 12 },
  axisLine: { stroke: colors.hairline },
  tooltip: {
    contentStyle: {
      background: colors.canvas,
      border: `1px solid ${colors.hairline}`,
      borderRadius: 11,
      boxShadow: "none",
      fontSize: 14,
      color: colors.ink,
    },
    labelStyle: { color: colors.ink48, fontSize: 12 },
    cursor: { fill: colors.parchment },
  },
} as const;
