import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveSankey } from "@nivo/sankey";
import { formatNis } from "../lib/format";
import { useTheme } from "../lib/theme";
import type { SimpleProportions, SimpleSummary } from "../lib/simple-groups";

type PayslipFlowProps = {
  summary: SimpleSummary;
};

type FlowNode = { id: string; nodeLabel: string; amount: number };
type FlowLink = { source: string; target: string; value: number; startColor?: string; endColor?: string };

type ToneKey = "income" | "net" | "taxes" | "savings" | "other" | "gross";
type Palette = Record<ToneKey, string>;

const PALETTES: Record<"light" | "dark", Palette> = {
  light: { income: "#16a34a", net: "#16a34a", taxes: "#6366f1", savings: "#0891b2", other: "#94a3b8", gross: "#16a34a" },
  dark: { income: "#4ade80", net: "#4ade80", taxes: "#818cf8", savings: "#22d3ee", other: "#94a3b8", gross: "#4ade80" },
};

const LABEL_COLOR = { light: "#1d1d1f", dark: "#f5f5f7" } as const;

const OUTFLOWS: ReadonlyArray<{ key: keyof SimpleProportions; id: string; labelKey: string; tone: ToneKey }> = [
  { key: "net", id: "out-net", labelKey: "summary.flow.net", tone: "net" },
  { key: "taxes", id: "out-taxes", labelKey: "summary.group.taxes", tone: "taxes" },
  { key: "savings", id: "out-savings", labelKey: "summary.group.savings", tone: "savings" },
  { key: "other", id: "out-other", labelKey: "summary.group.other", tone: "other" },
];

function toneForNode(id: string): ToneKey {
  if (id === "gross") return "gross";
  if (id.startsWith("src")) return "income";
  return OUTFLOWS.find((o) => o.id === id)?.tone ?? "other";
}

export function PayslipFlow({ summary }: PayslipFlowProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const palette = PALETTES[theme];

  const data = useMemo<{ nodes: FlowNode[]; links: FlowLink[] }>(() => {
    const earned = Math.max(0, summary.earned);
    const nodes: FlowNode[] = [];
    const links: FlowLink[] = [];
    if (earned <= 0) return { nodes, links };

    // Reversed link direction so that, in an RTL page, income sits on the right
    // and deductions on the left (nivo always draws a link's source on the left).
    nodes.push({ id: "gross", nodeLabel: t("summary.flow.gross"), amount: earned });

    for (const outflow of OUTFLOWS) {
      const amount = Math.max(0, summary.proportions[outflow.key]);
      if (amount <= 0) continue;
      const color = palette[outflow.tone];
      nodes.push({ id: outflow.id, nodeLabel: t(outflow.labelKey), amount });
      links.push({ source: outflow.id, target: "gross", value: amount, startColor: color, endColor: color });
    }

    const details = (summary.groups.find((group) => group.id === "earnings")?.details ?? []).filter(
      (detail) => detail.amount > 0
    );
    const detailSum = details.reduce((sum, detail) => sum + detail.amount, 0);

    if (details.length > 0 && detailSum > 0) {
      const scale = earned / detailSum;
      details.forEach((detail, index) => {
        const amount = detail.amount * scale;
        const id = `src-${index}`;
        nodes.push({ id, nodeLabel: detail.label, amount });
        links.push({ source: "gross", target: id, value: amount, startColor: palette.income, endColor: palette.income });
      });
    } else {
      nodes.push({ id: "src-0", nodeLabel: t("summary.you_earned"), amount: earned });
      links.push({ source: "gross", target: "src-0", value: earned, startColor: palette.income, endColor: palette.income });
    }

    return { nodes, links };
  }, [summary, palette, t]);

  if (data.nodes.length === 0) {
    return null;
  }

  return (
    <div className="payslip-flow" role="img" aria-label={t("summary.flow.aria")}>
      <div className="payslip-flow__frame">
        <div className="payslip-flow__chart">
          <ResponsiveSankey<FlowNode, FlowLink>
          data={data}
          margin={{ top: 12, right: 96, bottom: 12, left: 96 }}
          align="justify"
          sort="input"
          colors={(node) => palette[toneForNode(node.id)]}
          nodeOpacity={1}
          nodeHoverOthersOpacity={0.35}
          nodeThickness={14}
          nodeSpacing={18}
          nodeBorderRadius={5}
          nodeBorderWidth={0}
          linkOpacity={0.4}
          linkHoverOthersOpacity={0.15}
          linkContract={1}
          enableLinkGradient={false}
          labelPosition="outside"
          labelOrientation="horizontal"
          labelPadding={12}
          label={(node) => node.nodeLabel}
          labelTextColor={LABEL_COLOR[theme]}
          animate
          theme={{
            text: { fontFamily: "inherit", fontSize: 12 },
            labels: { text: { fontFamily: "inherit", fontSize: 12, fontWeight: 600 } },
            tooltip: {
              container: {
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: 12,
                borderRadius: 10,
                boxShadow: "var(--shadow-card)",
              },
            },
          }}
          nodeTooltip={({ node }) => (
            <div className="payslip-flow__tooltip">
              <strong>{node.nodeLabel}</strong>
              <span className="payslip-flow__tooltip-amount">{formatNis(node.amount)}</span>
            </div>
          )}
        />
        </div>
      </div>
    </div>
  );
}
