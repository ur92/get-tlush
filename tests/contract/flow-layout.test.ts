import { describe, expect, it } from "vitest";
import { buildFlowLayout } from "../../packages/web/src/lib/flow-layout.ts";
import type { SimpleSummary } from "../../packages/web/src/lib/simple-groups.ts";

const DIMS = { width: 600, height: 280 };

function makeSummary(overrides: Partial<SimpleSummary> = {}): SimpleSummary {
  const earned = overrides.earned ?? 100_000;
  const net = overrides.net ?? 50_000;
  const taxes = overrides.proportions?.taxes ?? 30_000;
  const savings = overrides.proportions?.savings ?? 15_000;
  const other = overrides.proportions?.other ?? earned - net - taxes - savings;

  return {
    earned,
    net,
    groups: overrides.groups ?? [
      {
        id: "earnings",
        amount: earned,
        tone: "in",
        details: overrides.groups?.find((g) => g.id === "earnings")?.details ?? [
          { label: "משכורת", amount: 80_000, text: "" },
          { label: "בונוס", amount: 20_000, text: "" },
        ],
      },
      {
        id: "taxes",
        amount: taxes,
        tone: "out",
        details: [],
      },
      {
        id: "savings",
        amount: savings,
        tone: "out",
        details: [],
      },
      ...(other > 0
        ? [
            {
              id: "other" as const,
              amount: other,
              tone: "out" as const,
              details: [],
            },
          ]
        : []),
    ],
    proportions: {
      net,
      taxes,
      savings,
      other: Math.max(0, other),
      ...overrides.proportions,
    },
  };
}

function assertFiniteGeometry(layout: ReturnType<typeof buildFlowLayout>) {
  for (const node of layout.nodes) {
    expect(node.height).toBeGreaterThanOrEqual(0);
    expect(node.width).toBeGreaterThan(0);
    expect(Number.isFinite(node.x)).toBe(true);
    expect(Number.isFinite(node.y)).toBe(true);
    expect(Number.isFinite(node.height)).toBe(true);
  }
  for (const link of layout.links) {
    expect(link.path).toBeTruthy();
    expect(link.path).not.toMatch(/NaN/);
  }
}

describe("flow-layout contract", () => {
  it("conserves amounts: gross equals outflows and source sum", () => {
    const summary = makeSummary();
    const layout = buildFlowLayout(summary, DIMS);

    const gross = layout.nodes.find((node) => node.id === "gross");
    const sources = layout.nodes.filter((node) => node.id.startsWith("source-"));
    const outflows = layout.nodes.filter((node) => node.id.startsWith("out-"));

    expect(gross?.amount).toBe(summary.earned);

    const sourceSum = sources.reduce((sum, node) => sum + node.amount, 0);
    expect(sourceSum).toBeCloseTo(summary.earned, 2);

    const outflowSum = outflows.reduce((sum, node) => sum + node.amount, 0);
    expect(outflowSum).toBeCloseTo(summary.earned, 2);
    expect(outflowSum).toBeCloseTo(
      summary.proportions.net +
        summary.proportions.taxes +
        summary.proportions.savings +
        summary.proportions.other,
      2
    );

    assertFiniteGeometry(layout);
  });

  it("handles no earnings details with a single source node", () => {
    const summary = makeSummary({
      earned: 50_000,
      net: 20_000,
      groups: [
        {
          id: "earnings",
          amount: 50_000,
          tone: "in",
          details: [],
        },
        {
          id: "taxes",
          amount: 20_000,
          tone: "out",
          details: [],
        },
        {
          id: "savings",
          amount: 10_000,
          tone: "out",
          details: [],
        },
      ],
      proportions: { net: 20_000, taxes: 20_000, savings: 10_000, other: 0 },
    });

    const layout = buildFlowLayout(summary, DIMS);
    const sources = layout.nodes.filter((node) => node.id.startsWith("source-"));

    expect(sources).toHaveLength(1);
    expect(sources[0].amount).toBe(50_000);
    assertFiniteGeometry(layout);
  });

  it("omits zero savings and other outflow nodes", () => {
    const summary = makeSummary({
      earned: 40_000,
      net: 25_000,
      proportions: { net: 25_000, taxes: 15_000, savings: 0, other: 0 },
      groups: [
        {
          id: "earnings",
          amount: 40_000,
          tone: "in",
          details: [{ label: "משכורת", amount: 40_000, text: "" }],
        },
        { id: "taxes", amount: 15_000, tone: "out", details: [] },
        { id: "savings", amount: 0, tone: "out", details: [] },
      ],
    });

    const layout = buildFlowLayout(summary, DIMS);
    const outflowIds = layout.nodes.filter((node) => node.id.startsWith("out-")).map((n) => n.id);

    expect(outflowIds).toContain("out-net");
    expect(outflowIds).toContain("out-taxes");
    expect(outflowIds).not.toContain("out-savings");
    expect(outflowIds).not.toContain("out-other");
    assertFiniteGeometry(layout);
  });

  it("returns empty layout when earned <= 0", () => {
    const summary = makeSummary({ earned: 0, net: 0, proportions: { net: 0, taxes: 0, savings: 0, other: 0 } });
    const layout = buildFlowLayout(summary, DIMS);

    expect(layout.nodes).toHaveLength(0);
    expect(layout.links).toHaveLength(0);
  });
});
