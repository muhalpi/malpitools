"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Info, Loader2, Upload, X } from "lucide-react";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { downloadBlob } from "@/lib/download";
import {
  formatFileSize,
  friendlyPdfError,
  getPdfJs,
  MAX_PDF_PAGES,
  parsePageRanges,
  readPdfFile,
} from "@/lib/pdf-tools";
import { cn } from "@/lib/utils";
import { useFilePaste } from "@/hooks/use-file-paste";

interface SplitPdfFile {
  name: string;
  size: number;
  pageCount: number;
  bytes: Uint8Array;
}

type PDFDocumentProxy = import("pdfjs-dist").PDFDocumentProxy;

const INITIAL_THUMBNAIL_COUNT = 20;
const THUMBNAIL_BATCH_SIZE = 20;

export function SplitPdfTool() {
  const [file, setFile] = useState<SplitPdfFile | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const thumbnailsRef = useRef<Record<number, string>>({});
  const [visibleCount, setVisibleCount] = useState(INITIAL_THUMBNAIL_COUNT);
  const [rangeInput, setRangeInput] = useState("");
  const [splitEveryPage, setSplitEveryPage] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isRenderingThumbnails, setIsRenderingThumbnails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visiblePageNumbers = useMemo(
    () =>
      file
        ? Array.from(
            { length: Math.min(visibleCount, file.pageCount) },
            (_, index) => index + 1
          )
        : [],
    [file, visibleCount]
  );

  const selectedPageIndexes = useMemo(() => {
    if (!file || splitEveryPage) return new Set<number>();

    try {
      return new Set(parsePageRanges(rangeInput, file.pageCount));
    } catch {
      return new Set<number>();
    }
  }, [file, rangeInput, splitEveryPage]);

  useEffect(() => {
    pdfDocRef.current = pdfDoc;
  }, [pdfDoc]);

  useEffect(() => {
    return () => {
      void pdfDocRef.current?.destroy();
    };
  }, []);

  const loadFile = useCallback(async (candidate: File) => {
    setIsLoadingFile(true);
    setError(null);

    try {
      const parsed = await readPdfFile(candidate);

      if (parsed.pageCount > MAX_PDF_PAGES) {
        throw new Error(`PDFs must be ${MAX_PDF_PAGES} pages or fewer.`);
      }

      await pdfDocRef.current?.destroy();
      pdfDocRef.current = null;

      const pdfjs = await getPdfJs();
      let nextPdfDoc: PDFDocumentProxy;
      try {
        nextPdfDoc = await pdfjs.getDocument({ data: parsed.bytes.slice() }).promise;
      } catch (error) {
        throw new Error(friendlyPdfError(error));
      }

      setFile(parsed);
      setPdfDoc(nextPdfDoc);
      thumbnailsRef.current = {};
      setThumbnails({});
      setVisibleCount(Math.min(INITIAL_THUMBNAIL_COUNT, parsed.pageCount));
      setRangeInput("");
      setSplitEveryPage(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this PDF.");
    } finally {
      setIsLoadingFile(false);
    }
  }, []);

  const loadSingleFile = useCallback(
    (files: FileList | File[]) => {
      const selected = Array.from(files);
      if (selected.length === 0) return;
      if (selected.length > 1) {
        setError("Upload one PDF file for splitting.");
        return;
      }
      void loadFile(selected[0]);
    },
    [loadFile]
  );

  useFilePaste(loadFile, ".pdf,application/pdf");

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files;
      if (selected) loadSingleFile(selected);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [loadSingleFile]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragActive(false);
      loadSingleFile(event.dataTransfer.files);
    },
    [loadSingleFile]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(false);
  }, []);

  const clearFile = useCallback(async () => {
    await pdfDocRef.current?.destroy();
    pdfDocRef.current = null;
    setFile(null);
    setPdfDoc(null);
    thumbnailsRef.current = {};
    setThumbnails({});
    setVisibleCount(INITIAL_THUMBNAIL_COUNT);
    setRangeInput("");
    setSplitEveryPage(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!pdfDoc || !file || visiblePageNumbers.length === 0) return;

    let cancelled = false;
    const missingPages = visiblePageNumbers.filter(
      (pageNumber) => !thumbnailsRef.current[pageNumber]
    );

    if (missingPages.length === 0) return;

    async function renderMissingThumbnails() {
      if (!pdfDoc) return;
      setIsRenderingThumbnails(true);

      try {
        for (const pageNumber of missingPages) {
          if (cancelled) return;
          if (pageNumber < 1 || pageNumber > pdfDoc.numPages) continue;

          const thumbnail = await renderPageThumbnail(pdfDoc, pageNumber);
          if (cancelled) return;

          thumbnailsRef.current = {
            ...thumbnailsRef.current,
            [pageNumber]: thumbnail,
          };
          setThumbnails((current) => ({
            ...current,
            [pageNumber]: thumbnail,
          }));
        }
      } finally {
        if (!cancelled) setIsRenderingThumbnails(false);
      }
    }

    void renderMissingThumbnails();

    return () => {
      cancelled = true;
    };
  }, [file, pdfDoc, visiblePageNumbers]);

  const togglePreviewPage = useCallback(
    (pageNumber: number) => {
      if (!file || splitEveryPage) return;

      let currentIndexes: number[] = [];
      try {
        currentIndexes = rangeInput.trim()
          ? parsePageRanges(rangeInput, file.pageCount)
          : [];
      } catch {
        currentIndexes = [];
      }

      const pageIndex = pageNumber - 1;
      const nextIndexes = currentIndexes.includes(pageIndex)
        ? currentIndexes.filter((index) => index !== pageIndex)
        : [...currentIndexes, pageIndex];

      setRangeInput(formatPageIndexesAsRanges(nextIndexes));
      setError(null);
    },
    [file, rangeInput, splitEveryPage]
  );

  const splitPdf = useCallback(async () => {
    if (!file) {
      setError("Upload a PDF file first.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const sourcePdf = await PDFDocument.load(file.bytes);

      if (splitEveryPage) {
        const zip = new JSZip();

        for (let index = 0; index < file.pageCount; index++) {
          const outputPdf = await PDFDocument.create();
          const [page] = await outputPdf.copyPages(sourcePdf, [index]);
          outputPdf.addPage(page);
          const pageBytes = await outputPdf.save();
          const pageNumber = String(index + 1).padStart(3, "0");
          zip.file(`page-${pageNumber}.pdf`, new Uint8Array(pageBytes));
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "split-pages.zip");
        return;
      }

      const pageIndexes = parsePageRanges(rangeInput, file.pageCount);
      const outputPdf = await PDFDocument.create();
      const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndexes);
      copiedPages.forEach((page) => outputPdf.addPage(page));

      const splitBytes = await outputPdf.save();
      downloadBlob(
        new Blob([new Uint8Array(splitBytes)], { type: "application/pdf" }),
        "split.pdf"
      );
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not split this PDF.");
      }
    } finally {
      setIsProcessing(false);
    }
  }, [file, rangeInput, splitEveryPage]);

  return (
    <div className="space-y-6">
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
            isDragActive ? "border-primary bg-primary/5" : "hover:border-primary/50"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Drop a PDF here</p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to select a file, or paste
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Info className="size-3.5" />
            Your PDF files are processed locally in your browser and are not uploaded to any server.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <FileText className="size-10 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(file.size)} x {file.pageCount} page
                {file.pageCount !== 1 ? "s" : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => void clearFile()}>
              <X className="size-4" />
              <span className="sr-only">Remove file</span>
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoadingFile && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Reading PDF...
        </div>
      )}

      {file && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="page-ranges">Page ranges</Label>
              <Input
                id="page-ranges"
                value={rangeInput}
                onChange={(event) => setRangeInput(event.target.value)}
                placeholder="1-3,5,7-10"
                disabled={splitEveryPage}
              />
              <p className="text-xs text-muted-foreground">
                Examples: 1-3, 5, 7-10, or 1-3,5,7-10. Click preview pages to add or remove them.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="split-every-page">Split every page into separate PDF</Label>
                <p className="text-xs text-muted-foreground">
                  Downloads a ZIP containing one PDF per page.
                </p>
              </div>
              <Switch
                id="split-every-page"
                checked={splitEveryPage}
                onCheckedChange={setSplitEveryPage}
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Page preview</h3>
                  <p className="text-xs text-muted-foreground">
                    First {visiblePageNumbers.length} of {file.pageCount} pages shown
                  </p>
                </div>
                {isRenderingThumbnails && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Rendering previews...
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {visiblePageNumbers.map((pageNumber) => (
                  <PreviewPageCard
                    key={pageNumber}
                    pageNumber={pageNumber}
                    thumbnail={thumbnails[pageNumber]}
                    selected={selectedPageIndexes.has(pageNumber - 1)}
                    disabled={splitEveryPage}
                    onToggle={() => togglePreviewPage(pageNumber)}
                  />
                ))}
              </div>

              {visiblePageNumbers.length < file.pageCount && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setVisibleCount((count) =>
                        Math.min(count + THUMBNAIL_BATCH_SIZE, file.pageCount)
                      )
                    }
                  >
                    Load more pages
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border p-4">
            <h3 className="text-sm font-semibold">Output</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Pages</dt>
              <dd className="text-right tabular-nums">{file.pageCount}</dd>
              <dt className="text-muted-foreground">Size</dt>
              <dd className="text-right">{formatFileSize(file.size)}</dd>
              <dt className="text-muted-foreground">Mode</dt>
              <dd className="text-right">{splitEveryPage ? "ZIP" : "PDF"}</dd>
            </dl>
            <Button onClick={splitPdf} disabled={isProcessing} className="w-full gap-2">
              {isProcessing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {isProcessing
                ? "Splitting..."
                : splitEveryPage
                  ? "Download split-pages.zip"
                  : "Download split.pdf"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewPageCard({
  pageNumber,
  thumbnail,
  selected,
  disabled,
  onToggle,
}: {
  pageNumber: number;
  thumbnail?: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "rounded-lg border bg-card p-2 text-left transition-colors",
        selected && "border-primary bg-primary/5",
        disabled ? "cursor-default opacity-70" : "hover:border-primary/50"
      )}
    >
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border bg-muted/40">
        {thumbnail ? (
          // Generated PDF thumbnail data URLs are local browser output, not optimizable remote assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={`Page ${pageNumber}`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">Page {pageNumber}</span>
        {selected && !disabled && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            Selected
          </span>
        )}
      </div>
    </button>
  );
}

function formatPageIndexesAsRanges(indexes: number[]): string {
  const sortedPages = Array.from(new Set(indexes))
    .sort((a, b) => a - b)
    .map((index) => index + 1);

  const ranges: string[] = [];
  let start = sortedPages[0];
  let previous = sortedPages[0];

  for (let i = 1; i <= sortedPages.length; i++) {
    const page = sortedPages[i];
    if (page === previous + 1) {
      previous = page;
      continue;
    }

    if (start != null && previous != null) {
      ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    }
    start = page;
    previous = page;
  }

  return ranges.join(",");
}

async function renderPageThumbnail(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  let page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>> | null = null;

  try {
    page = await withTimeout(
      pdfDoc.getPage(pageNumber),
      8000,
      `Could not load page ${pageNumber}.`
    );
    const viewport = page.getViewport({ scale: 1 });
    const targetWidth = 220;
    const scale = targetWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(scaledViewport.width);
    canvas.height = Math.ceil(scaledViewport.height);

    const renderTask = page.render({
      canvas,
      viewport: scaledViewport,
    });
    await withTimeout(
      renderTask.promise,
      8000,
      `Could not render page ${pageNumber}.`,
      () => renderTask.cancel()
    );

    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return createUnavailableThumbnail(pageNumber);
  } finally {
    page?.cleanup();
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
  onTimeout?: () => void
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout?.();
      reject(new Error(message));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function createUnavailableThumbnail(pageNumber: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = 294;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="294"><rect width="100%" height="100%" fill="#f8fafc"/><rect x="1" y="1" width="218" height="292" fill="none" stroke="#d4d4d8" stroke-width="2"/><text x="110" y="139" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#71717a">Preview unavailable</text><text x="110" y="161" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#71717a">Page ${pageNumber}</text></svg>`
    )}`;
  }

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#d4d4d8";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

  ctx.fillStyle = "#71717a";
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Preview unavailable", canvas.width / 2, canvas.height / 2 - 8);
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(`Page ${pageNumber}`, canvas.width / 2, canvas.height / 2 + 14);

  return canvas.toDataURL("image/png");
}
