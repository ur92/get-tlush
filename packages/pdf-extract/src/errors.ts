export class PdfLoadError extends Error {
  override readonly name = "PdfLoadError";

  constructor(message = "Unable to load PDF") {
    super(message);
  }
}

export class PasswordProtectedPdfError extends Error {
  override readonly name = "PasswordProtectedPdfError";

  constructor(message = "PDF is password protected") {
    super(message);
  }
}
