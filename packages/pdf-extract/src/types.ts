export type PositionedToken = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  dir?: string;
};

export type ExtractedPage = {
  pageNumber: number;
  width: number;
  height: number;
  tokens: PositionedToken[];
};

export type ExtractedPdf = {
  pages: ExtractedPage[];
  pageCount: number;
  isScanned: boolean;
  metadata?: Record<string, unknown>;
  warnings?: string[];
};

export type ExtractOptions = {
  locale?: string;
};
