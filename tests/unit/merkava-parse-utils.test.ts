import { describe, expect, it } from "vitest";
import {
  findHeaderSummaryNetPay,
  HEBREW_MONTHS,
  rowText,
  type Row,
} from "../../packages/parsers/merkava/src/utils.js";

function makeRow(page: number, y: number, tokens: string[]): Row {
  return {
    page,
    y,
    tokens: tokens.map((text, index) => ({ text, x: index * 10 })),
  };
}

describe("merkava parse utils", () => {
  it("findHeaderSummaryNetPay reconciles gross minus deductions", () => {
    const rows = [
      makeRow(1, 16, ["18,693.73"]),
      makeRow(1, 36, ["62.00", "2,960.89", "6,766.43", "28,483.05"]),
    ];

    expect(findHeaderSummaryNetPay(rows)).toBe(18693.73);
  });

  it("HEBREW_MONTHS includes March", () => {
    expect(HEBREW_MONTHS["מרץ"]).toBe(3);
  });

  it("parsePeriod row text includes Hebrew month and year", () => {
    const row = makeRow(2, 72, [
      "מרץ 2026,ענבל דיקרמן, ת.ז. 201321213",
      "תלוש משכורת לחודש",
    ]);
    const text = rowText(row);
    const yearMatch = text.match(/\b(20\d{2})\b/);
    const monthName = Object.keys(HEBREW_MONTHS).find((name) => text.includes(name));

    expect(yearMatch?.[1]).toBe("2026");
    expect(monthName).toBe("מרץ");
    expect(HEBREW_MONTHS[monthName!]).toBe(3);
  });
});
