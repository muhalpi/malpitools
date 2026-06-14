import type { PDFDocumentProxy } from "pdfjs-dist";

export const MAX_PDF_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_TOTAL_PDF_BYTES = 250 * 1024 * 1024;
export const LARGE_PDF_OPERATION_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_FILES = 20;
export const MAX_PDF_PAGES = 500;

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPdfFile(file: File): boolean {
  const nameIsPdf = file.name.toLowerCase().endsWith(".pdf");
  const typeIsPdf =
    !file.type ||
    file.type === "application/pdf" ||
    file.type === "application/x-pdf";
  return nameIsPdf && typeIsPdf;
}

export function assertPdfHeader(bytes: Uint8Array): void {
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (!header.startsWith("%PDF")) {
    throw new Error("The file does not appear to be a valid PDF.");
  }
}

export function friendlyPdfError(error: unknown): string {
  const err = error as { name?: string; message?: string };
  const text = `${err.name ?? ""} ${err.message ?? ""}`.toLowerCase();

  if (text.includes("password") || text.includes("encrypted")) {
    return "This PDF appears to be password-protected. Please unlock it and try again.";
  }

  return "This PDF could not be opened. It may be corrupted or unsupported.";
}

export async function getPdfPageCount(bytes: Uint8Array): Promise<number> {
  let doc: PDFDocumentProxy | null = null;

  try {
    const pdfjs = await getPdfJs();
    doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    return doc.numPages;
  } finally {
    await doc?.destroy();
  }
}

export async function readPdfFile(file: File): Promise<{
  name: string;
  size: number;
  bytes: Uint8Array;
  pageCount: number;
}> {
  if (!isPdfFile(file)) {
    throw new Error("Please upload a PDF file.");
  }

  if (file.size > MAX_PDF_FILE_BYTES) {
    throw new Error(
      `Each PDF must be ${formatFileSize(MAX_PDF_FILE_BYTES)} or smaller.`
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  assertPdfHeader(bytes);

  try {
    const pageCount = await getPdfPageCount(bytes);
    return {
      name: file.name,
      size: file.size,
      bytes,
      pageCount,
    };
  } catch (error) {
    throw new Error(friendlyPdfError(error));
  }
}

export function parsePageRanges(input: string, totalPages: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Enter at least one page or page range.");
  }

  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new Error("This PDF does not have any pages to split.");
  }

  const selected: number[] = [];
  const seen = new Set<number>();
  const parts = trimmed.split(",");

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) {
      throw new Error("Page ranges cannot contain empty sections.");
    }

    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = part.match(/^\d+$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);

      validatePageNumber(start, totalPages);
      validatePageNumber(end, totalPages);

      if (start > end) {
        throw new Error(`Page range ${start}-${end} must start before it ends.`);
      }

      for (let page = start; page <= end; page++) {
        const index = page - 1;
        if (!seen.has(index)) {
          selected.push(index);
          seen.add(index);
        }
      }
      continue;
    }

    if (singleMatch) {
      const page = Number(part);
      validatePageNumber(page, totalPages);
      const index = page - 1;
      if (!seen.has(index)) {
        selected.push(index);
        seen.add(index);
      }
      continue;
    }

    throw new Error(
      `Page range "${part}" is invalid. Use ranges like 1-3,5,7-10.`
    );
  }

  if (selected.length === 0) {
    throw new Error("Enter at least one page or page range.");
  }

  return selected;
}

function validatePageNumber(page: number, totalPages: number): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("Page numbers must be 1 or higher.");
  }

  if (page > totalPages) {
    throw new Error(
      `Page ${page} is greater than the total page count (${totalPages}).`
    );
  }
}
