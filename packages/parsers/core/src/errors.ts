export class ParseError extends Error {
  override readonly name = "ParseError";

  constructor(message = "Unable to parse payslip structure") {
    super(message);
  }
}

export class UnrecognizedPayslipError extends Error {
  override readonly name = "UnrecognizedPayslipError";
  readonly supportedVendors: string[];

  constructor(supportedVendors: string[], message = "No supported payslip format detected") {
    super(message);
    this.supportedVendors = supportedVendors;
  }
}

export class ScannedPdfError extends Error {
  override readonly name = "ScannedPdfError";

  constructor(message = "Scanned PDFs are not supported") {
    super(message);
  }
}
