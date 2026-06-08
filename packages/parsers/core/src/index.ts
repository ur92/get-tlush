export { ParseError, ScannedPdfError, UnrecognizedPayslipError } from "./errors.js";
export { createParserRegistry, DefaultParserRegistry } from "./registry.js";
export { countMatches, getFullText } from "./text.js";
export type {
  CanonicalPayslip,
  Context,
  ContextEquity,
  ContextLeave,
  ContextYtd,
  CreditPointsBreakdown,
  DetectionResult,
  Employee,
  Employer,
  ExtractedPage,
  ExtractedPdf,
  LineItem,
  LineItemCategory,
  LineItemConfidence,
  LineItemSourceRegion,
  LineItemUnit,
  ParseMeta,
  ParserRegistry,
  PayslipFlag,
  PayslipParserPlugin,
  Period,
  PositionedToken,
  Totals,
  Vendor,
  VendorId,
} from "./types.js";

/** @deprecated Use PayslipParserPlugin */
export type { PayslipParserPlugin as ParserPlugin } from "./types.js";
