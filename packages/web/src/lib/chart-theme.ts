import { useMemo } from "react";
import { useTheme, type Theme as AppTheme } from "./theme";

export type ToneKey = "income" | "net" | "taxes" | "savings" | "other" | "gross" | "health" | "ni";

export type ChartPalette = Record<ToneKey, string>;

export const CHART_PALETTES: Record<AppTheme, ChartPalette> = {
  light: {
    income: "#16a34a",
    net: "#16a34a",
    taxes: "#6366f1",
    savings: "#0891b2",
    other: "#94a3b8",
    gross: "#16a34a",
    health: "#818cf8",
    ni: "#a5b4fc",
  },
  dark: {
    income: "#4ade80",
    net: "#4ade80",
    taxes: "#818cf8",
    savings: "#22d3ee",
    other: "#94a3b8",
    gross: "#4ade80",
    health: "#a5b4fc",
    ni: "#6366f1",
  },
};

export const CHART_LABEL_COLOR: Record<AppTheme, string> = {
  light: "#1d1d1f",
  dark: "#f5f5f7",
};

export function buildNivoTheme() {
  return {
    text: { fontFamily: "inherit", fontSize: 12 },
    labels: { text: { fontFamily: "inherit", fontSize: 12, fontWeight: 600 } },
    axis: {
      ticks: { text: { fontFamily: "inherit", fontSize: 11, fill: "var(--color-muted)" } },
      legend: { text: { fontFamily: "inherit", fontSize: 12, fill: "var(--color-text)" } },
    },
    tooltip: {
      container: {
        background: "var(--color-surface)",
        color: "var(--color-text)",
        fontSize: 12,
        borderRadius: 10,
        boxShadow: "var(--shadow-card)",
      },
    },
  };
}

export function useChartTheme() {
  const { theme } = useTheme();

  return useMemo(
    () => ({
      theme,
      palette: CHART_PALETTES[theme],
      labelColor: CHART_LABEL_COLOR[theme],
      nivoTheme: buildNivoTheme(),
    }),
    [theme]
  );
}
