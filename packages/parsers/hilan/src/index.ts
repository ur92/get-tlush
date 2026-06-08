import type { PayslipParserPlugin } from "@tlush/parser-core";
import { detectHilan } from "./detect.js";
import { parseHilan } from "./parse.js";

export const hilanParser: PayslipParserPlugin = {
  id: "hilan",
  version: "1.0.0",
  displayNameKey: "vendors.hilan",
  detect: detectHilan,
  parse: parseHilan,
};

export { detectHilan, parseHilan };
