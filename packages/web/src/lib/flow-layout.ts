import type { SimpleSummary } from "./simple-groups";

export type FlowNodeTone = "net" | "taxes" | "savings" | "other" | "gross" | "source";

export type FlowNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  amount: number;
  tone: FlowNodeTone;
  /** Present for earnings source nodes — raw label from payslip line item. */
  detailLabel?: string;
};

export type FlowLink = {
  id: string;
  path: string;
  tone: FlowNodeTone;
  sourceId: string;
  targetId: string;
};

export type FlowLayoutDims = {
  width: number;
  height: number;
  nodeWidth?: number;
  columnGap?: number;
  nodeGap?: number;
  padding?: number;
  minNodeHeight?: number;
};

export type FlowLayout = {
  nodes: FlowNode[];
  links: FlowLink[];
  width: number;
  height: number;
};

type StackItem = {
  id: string;
  amount: number;
  tone: FlowNodeTone;
  detailLabel?: string;
};

const DEFAULT_DIMS = {
  nodeWidth: 88,
  columnGap: 72,
  nodeGap: 6,
  padding: 16,
  minNodeHeight: 4,
};

const OUTFLOW_ORDER: Array<{ key: keyof SimpleSummary["proportions"]; tone: FlowNodeTone }> = [
  { key: "net", tone: "net" },
  { key: "taxes", tone: "taxes" },
  { key: "savings", tone: "savings" },
  { key: "other", tone: "other" },
];

function clampAmount(amount: number): number {
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function stackColumn(
  items: StackItem[],
  x: number,
  totalAmount: number,
  dims: Required<FlowLayoutDims>
): FlowNode[] {
  if (items.length === 0 || totalAmount <= 0) {
    return [];
  }

  const innerHeight = dims.height - dims.padding * 2;
  const totalGap = Math.max(0, items.length - 1) * dims.nodeGap;
  const scale = (innerHeight - totalGap) / totalAmount;
  const nodes: FlowNode[] = [];
  let y = dims.padding;

  for (const item of items) {
    const amount = clampAmount(item.amount);
    const height = Math.max(dims.minNodeHeight, amount * scale);
    nodes.push({
      id: item.id,
      x,
      y,
      width: dims.nodeWidth,
      height,
      amount,
      tone: item.tone,
      detailLabel: item.detailLabel,
    });
    y += height + dims.nodeGap;
  }

  return nodes;
}

function ribbonPath(
  source: FlowNode,
  target: FlowNode,
  sourceSide: "left" | "right",
  targetSide: "left" | "right"
): string {
  const sx = sourceSide === "left" ? source.x : source.x + source.width;
  const tx = targetSide === "left" ? target.x : target.x + target.width;
  const sy1 = source.y;
  const sy2 = source.y + source.height;
  const ty1 = target.y;
  const ty2 = target.y + target.height;
  const cx1 = sx + (tx - sx) * 0.45;
  const cx2 = sx + (tx - sx) * 0.55;

  return [
    `M ${sx} ${sy1}`,
    `C ${cx1} ${sy1}, ${cx2} ${ty1}, ${tx} ${ty1}`,
    `L ${tx} ${ty2}`,
    `C ${cx2} ${ty2}, ${cx1} ${sy2}, ${sx} ${sy2}`,
    "Z",
  ].join(" ");
}

function resolveDims(dims: FlowLayoutDims): Required<FlowLayoutDims> {
  return {
    width: dims.width,
    height: dims.height,
    nodeWidth: dims.nodeWidth ?? DEFAULT_DIMS.nodeWidth,
    columnGap: dims.columnGap ?? DEFAULT_DIMS.columnGap,
    nodeGap: dims.nodeGap ?? DEFAULT_DIMS.nodeGap,
    padding: dims.padding ?? DEFAULT_DIMS.padding,
    minNodeHeight: dims.minNodeHeight ?? DEFAULT_DIMS.minNodeHeight,
  };
}

export function buildFlowLayout(summary: SimpleSummary, dims: FlowLayoutDims): FlowLayout {
  const resolved = resolveDims(dims);
  const earned = clampAmount(summary.earned);

  if (earned <= 0) {
    return { nodes: [], links: [], width: resolved.width, height: resolved.height };
  }

  const earningsGroup = summary.groups.find((group) => group.id === "earnings");
  const sourceDetails = earningsGroup?.details ?? [];

  const sourceItems: StackItem[] =
    sourceDetails.length > 0
      ? sourceDetails.map((detail, index) => ({
          id: `source-${index}`,
          amount: clampAmount(detail.amount),
          tone: "source" as const,
          detailLabel: detail.label,
        }))
      : [{ id: "source-0", amount: earned, tone: "source" as const }];

  const outflowItems: StackItem[] = OUTFLOW_ORDER.flatMap(({ key, tone }) => {
    const amount = clampAmount(summary.proportions[key]);
    if (amount <= 0) {
      return [];
    }
    return [{ id: `out-${key}`, amount, tone }];
  });

  const outflowX = resolved.padding;
  const grossX = outflowX + resolved.nodeWidth + resolved.columnGap;
  const sourceX = grossX + resolved.nodeWidth + resolved.columnGap;

  const outflowNodes = stackColumn(outflowItems, outflowX, earned, resolved);
  const sourceNodes = stackColumn(sourceItems, sourceX, earned, resolved);

  const grossHeight =
    sourceNodes.length > 0
      ? sourceNodes[sourceNodes.length - 1].y +
        sourceNodes[sourceNodes.length - 1].height -
        sourceNodes[0].y
      : Math.max(resolved.minNodeHeight, earned * ((resolved.height - resolved.padding * 2) / earned));

  const grossNode: FlowNode = {
    id: "gross",
    x: grossX,
    y: sourceNodes[0]?.y ?? resolved.padding,
    width: resolved.nodeWidth,
    height: grossHeight,
    amount: earned,
    tone: "gross",
  };

  const nodes = [...outflowNodes, grossNode, ...sourceNodes];
  const links: FlowLink[] = [];

  for (const source of sourceNodes) {
    links.push({
      id: `link-${source.id}-gross`,
      path: ribbonPath(source, grossNode, "left", "right"),
      tone: "gross",
      sourceId: source.id,
      targetId: grossNode.id,
    });
  }

  for (const outflow of outflowNodes) {
    links.push({
      id: `link-gross-${outflow.id}`,
      path: ribbonPath(grossNode, outflow, "left", "right"),
      tone: outflow.tone,
      sourceId: grossNode.id,
      targetId: outflow.id,
    });
  }

  return { nodes, links, width: resolved.width, height: resolved.height };
}
