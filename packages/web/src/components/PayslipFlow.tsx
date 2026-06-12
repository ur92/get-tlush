import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildFlowLayout, type FlowNode, type FlowNodeTone } from "../lib/flow-layout";
import { formatNis } from "../lib/format";
import type { SimpleSummary } from "../lib/simple-groups";

type PayslipFlowProps = {
  summary: SimpleSummary;
};

const FLOW_WIDTH = 600;
const FLOW_HEIGHT = 280;

const OUTFLOW_LABEL_KEYS: Record<Exclude<FlowNodeTone, "source" | "gross">, string> = {
  net: "summary.flow.net",
  taxes: "summary.group.taxes",
  savings: "summary.group.savings",
  other: "summary.group.other",
};

function nodeLabel(node: FlowNode, t: (key: string) => string): string {
  if (node.tone === "gross") {
    return t("summary.flow.gross");
  }
  if (node.tone === "source") {
    return node.detailLabel ?? t("summary.you_earned");
  }
  return t(OUTFLOW_LABEL_KEYS[node.tone]);
}

export function PayslipFlow({ summary }: PayslipFlowProps) {
  const { t } = useTranslation();

  const layout = useMemo(
    () =>
      buildFlowLayout(summary, {
        width: FLOW_WIDTH,
        height: FLOW_HEIGHT,
      }),
    [summary]
  );

  if (summary.earned <= 0 || layout.nodes.length === 0) {
    return null;
  }

  return (
    <div className="payslip-flow">
      <svg
        className="payslip-flow__svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t("summary.flow.aria")}
      >
        <g aria-hidden="true">
          {layout.links.map((link) => (
            <path
              key={link.id}
              className={`payslip-flow__link payslip-flow__link--${link.tone}`}
              d={link.path}
            />
          ))}
          {layout.nodes.map((node) => (
            <g key={node.id}>
              <rect
                className={`payslip-flow__node payslip-flow__node--${node.tone}`}
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={4}
              />
              <text
                className="payslip-flow__label"
                x={node.x + node.width / 2}
                y={node.y + node.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                <tspan className="payslip-flow__label-title" x={node.x + node.width / 2} dy="-0.55em">
                  {nodeLabel(node, t)}
                </tspan>
                <tspan className="payslip-flow__label-amount" x={node.x + node.width / 2} dy="1.2em">
                  {formatNis(node.amount)}
                </tspan>
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
