import type { PayslipParserPlugin } from "@tlush/parser-core";
import { detectMerkava } from "./detect.js";
import { parseMerkava } from "./parse.js";

export const merkavaParser: PayslipParserPlugin = {
  id: "merkava",
  version: "1.0.0",
  displayNameKey: "vendors.merkava",
  detect: detectMerkava,
  parse: parseMerkava,
};

export { detectMerkava, parseMerkava };
