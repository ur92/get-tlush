import { createParserRegistry } from "@tlush/parser-core";
import { hilanParser } from "@tlush/parser-hilan";
import { merkavaParser } from "@tlush/parser-merkava";

export const parserRegistry = createParserRegistry();

parserRegistry.register(hilanParser);
parserRegistry.register(merkavaParser);
