import { describe, expect, it } from "vitest";
import {
  amountLeftOfLabel,
  findCombinedStatutoryDeductions,
  findCreditPointsSummary,
  findHeaderSummaryNetPay,
  HEBREW_MONTHS,
  isCombinedStatutoryRow,
  isYtdFundRow,
  reconcileIncomeTaxWithholding,
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
  it("findCreditPointsSummary reads gross and credit points from page 1", () => {
    const rows = [makeRow(1, 416, ["19,836.64", "8,646.41", "9.25", "נקודות זיכוי"])];

    expect(findCreditPointsSummary(rows)).toEqual({
      grossCash: 19836.64,
      creditPoints: 9.25,
    });
  });

  it("findCombinedStatutoryDeductions pairs amounts with RTL labels", () => {
    const rows = [
      makeRow(1, 396, [
        "945.60",
        "ביטוח בריאות",
        "1,023.55",
        "ביטוח לאומי",
        "3,745.00",
        "מס הכנסה",
      ]),
    ];

    expect(findCombinedStatutoryDeductions(rows)).toEqual({
      healthTax: 945.6,
      ni: 1023.55,
      incomeTax: 3745,
    });
  });

  it("reconcileIncomeTaxWithholding caps tax to gross minus net", () => {
    expect(reconcileIncomeTaxWithholding(3745, 19836.64, 18693.73)).toBe(1142.91);
  });

  it("isYtdFundRow ignores large earnings rows", () => {
    const earningsRow = makeRow(1, 608, ["17,276.68", "משולב אופק חדש", "7.00", "10"]);
    const fundRow = makeRow(1, 304, ["1,179.11", "1,473.89", "1,223.13", "19,651.86", "הראל מנוף - פנסיה"]);

    expect(isYtdFundRow(earningsRow)).toBe(false);
    expect(isYtdFundRow(fundRow)).toBe(true);
  });

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
