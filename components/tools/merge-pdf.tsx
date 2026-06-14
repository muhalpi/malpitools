"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Download,
  GripVertical,
  Info,
  Loader2,
  RotateCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { degrees, PDFDocument } from "pdf-lib";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { downloadBlob } from "@/lib/download";
import {
  formatFileSize,
  friendlyPdfError,
  getPdfJs,
  LARGE_PDF_OPERATION_BYTES,
  MAX_PDF_FILES,
  MAX_PDF_PAGES,
  MAX_TOTAL_PDF_BYTES,
  readPdfFile,
} from "@/lib/pdf-tools";
import { cn } from "@/lib/utils";

type PDFDocumentProxy = import("pdfjs-dist").PDFDocumentProxy;

interface SourceColour {
  bg: string;
  border: string;
  text: string;
}

interface SourcePdfFile {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  bytes: Uint8Array;
  pdfDoc: PDFDocumentProxy;
  colour: SourceColour;
}

interface MergePageState {
  id: string;
  sourceFileId: string;
  originalPageIndex: number;
  currentOrder: number;
  rotation: 0 | 90 | 180 | 270;
  deleted: boolean;
  selected: boolean;
}

const INITIAL_THUMBNAIL_COUNT = 20;
const THUMBNAIL_BATCH_SIZE = 20;

const SOURCE_COLOURS: SourceColour[] = [
  { bg: "rgba(37, 99, 235, 0.12)", border: "#2563eb", text: "#1d4ed8" },
  { bg: "rgba(22, 163, 74, 0.12)", border: "#16a34a", text: "#15803d" },
  { bg: "rgba(234, 88, 12, 0.13)", border: "#ea580c", text: "#c2410c" },
  { bg: "rgba(147, 51, 234, 0.12)", border: "#9333ea", text: "#7e22ce" },
  { bg: "rgba(219, 39, 119, 0.12)", border: "#db2777", text: "#be185d" },
  { bg: "rgba(8, 145, 178, 0.12)", border: "#0891b2", text: "#0e7490" },
  { bg: "rgba(202, 138, 4, 0.14)", border: "#ca8a04", text: "#a16207" },
  { bg: "rgba(79, 70, 229, 0.12)", border: "#4f46e5", text: "#4338ca" },
];

function makeId(): string {
  return crypto.randomUUID();
}

function thumbnailKey(page: MergePageState): string {
  return `${page.sourceFileId}:${page.originalPageIndex}`;
}

export function MergePdfTool() {
  const [sourceFiles, setSourceFiles] = useState<SourcePdfFile[]>([]);
  const sourceFilesRef = useRef<SourcePdfFile[]>([]);
  const [pages, setPages] = useState<MergePageState[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const thumbnailsRef = useRef<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(INITIAL_THUMBNAIL_COUNT);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isRenderingThumbnails, setIsRenderingThumbnails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const totalSize = useMemo(
    () => sourceFiles.reduce((sum, file) => sum + file.size, 0),
    [sourceFiles]
  );
  const totalPages = useMemo(
    () => sourceFiles.reduce((sum, file) => sum + file.pageCount, 0),
    [sourceFiles]
  );
  const activePages = useMemo(
    () => pages.filter((page) => !page.deleted),
    [pages]
  );
  const visiblePages = useMemo(
    () => activePages.slice(0, visibleCount),
    [activePages, visibleCount]
  );
  const selectedCount = useMemo(
    () => activePages.filter((page) => page.selected).length,
    [activePages]
  );
  const deletedCount = pages.length - activePages.length;
  const sourceById = useMemo(
    () => new Map(sourceFiles.map((file) => [file.id, file])),
    [sourceFiles]
  );

  useEffect(() => {
    sourceFilesRef.current = sourceFiles;
  }, [sourceFiles]);

  useEffect(() => {
    return () => {
      for (const file of sourceFilesRef.current) {
        void file.pdfDoc.destroy();
      }
    };
  }, []);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setError(null);

      if (sourceFiles.length + files.length > MAX_PDF_FILES) {
        setError(`You can upload up to ${MAX_PDF_FILES} PDF files at once.`);
        return;
      }

      setIsLoadingFiles(true);

      const loadedSources: SourcePdfFile[] = [];

      try {
        const pdfjs = await getPdfJs();
        let nextTotalSize = totalSize;
        let nextTotalPages = totalPages;

        for (const file of files) {
          const parsed = await readPdfFile(file);
          nextTotalSize += parsed.size;
          nextTotalPages += parsed.pageCount;

          if (nextTotalSize > MAX_TOTAL_PDF_BYTES) {
            throw new Error(
              `Total PDF size must be ${formatFileSize(MAX_TOTAL_PDF_BYTES)} or smaller.`
            );
          }

          if (nextTotalPages > MAX_PDF_PAGES) {
            throw new Error(
              `Total page count must be ${MAX_PDF_PAGES} pages or fewer.`
            );
          }

          let pdfDoc: PDFDocumentProxy;
          try {
            pdfDoc = await pdfjs.getDocument({ data: parsed.bytes.slice() }).promise;
          } catch (error) {
            throw new Error(friendlyPdfError(error));
          }
          const sourceIndex = sourceFiles.length + loadedSources.length;
          loadedSources.push({
            id: makeId(),
            name: parsed.name,
            size: parsed.size,
            pageCount: parsed.pageCount,
            bytes: parsed.bytes,
            pdfDoc,
            colour: SOURCE_COLOURS[sourceIndex % SOURCE_COLOURS.length],
          });
        }

        setSourceFiles((current) => {
          const nextSources = [...current, ...loadedSources];
          sourceFilesRef.current = nextSources;
          return nextSources;
        });
        setPages((current) => {
          const nextPages = [...current];
          for (const source of loadedSources) {
            for (let index = 0; index < source.pageCount; index++) {
              nextPages.push({
                id: makeId(),
                sourceFileId: source.id,
                originalPageIndex: index,
                currentOrder: nextPages.length,
                rotation: 0,
                deleted: false,
                selected: false,
              });
            }
          }
          return reindexPages(nextPages);
        });
      } catch (err) {
        for (const source of loadedSources) {
          void source.pdfDoc.destroy();
        }
        setError(err instanceof Error ? err.message : "Could not load the PDF files.");
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [sourceFiles.length, totalPages, totalSize]
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files;
      if (selected) void addFiles(selected);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragActive(false);
      void addFiles(event.dataTransfer.files);
    },
    [addFiles]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(false);
  }, []);

  const removeSourceFile = useCallback((sourceId: string) => {
    setError(null);
    const source = sourceFilesRef.current.find((file) => file.id === sourceId);
    if (source) void source.pdfDoc.destroy();

    setSourceFiles((current) => {
      const nextSources = current.filter((file) => file.id !== sourceId);
      sourceFilesRef.current = nextSources;
      return nextSources;
    });
    setPages((current) =>
      reindexPages(current.filter((page) => page.sourceFileId !== sourceId))
    );
    setThumbnails((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${sourceId}:`)) delete next[key];
      }
      thumbnailsRef.current = next;
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    for (const source of sourceFilesRef.current) {
      void source.pdfDoc.destroy();
    }
    sourceFilesRef.current = [];
    thumbnailsRef.current = {};
    setSourceFiles([]);
    setPages([]);
    setThumbnails({});
    setVisibleCount(INITIAL_THUMBNAIL_COUNT);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (visiblePages.length === 0 || sourceFiles.length === 0) return;

    let cancelled = false;
    const sourceSnapshot = new Map(sourceFiles.map((file) => [file.id, file]));
    const missingPages = visiblePages.filter(
      (page) => !thumbnailsRef.current[thumbnailKey(page)]
    );

    if (missingPages.length === 0) return;

    async function renderMissingThumbnails() {
      setIsRenderingThumbnails(true);

      try {
        for (const page of missingPages) {
          if (cancelled) return;
          const source = sourceSnapshot.get(page.sourceFileId);
          if (!source) continue;

          const pageNumber = page.originalPageIndex + 1;
          if (pageNumber < 1 || pageNumber > source.pdfDoc.numPages) continue;

          const thumbnail = await renderPageThumbnail(
            source.pdfDoc,
            pageNumber
          );
          if (cancelled) return;

          const key = thumbnailKey(page);
          thumbnailsRef.current = {
            ...thumbnailsRef.current,
            [key]: thumbnail,
          };
          setThumbnails((current) => ({
            ...current,
            [key]: thumbnail,
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
  }, [sourceFiles, visiblePages]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPages((current) => {
      const activeList = current.filter((page) => !page.deleted);
      const deletedList = current.filter((page) => page.deleted);
      const oldIndex = activeList.findIndex((page) => page.id === active.id);
      const newIndex = activeList.findIndex((page) => page.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      return reindexPages([...arrayMove(activeList, oldIndex, newIndex), ...deletedList]);
    });
  }, []);

  const togglePage = useCallback((id: string) => {
    setPages((current) =>
      current.map((page) =>
        page.id === id ? { ...page, selected: !page.selected } : page
      )
    );
  }, []);

  const selectVisible = useCallback(() => {
    const visibleIds = new Set(visiblePages.map((page) => page.id));
    setPages((current) =>
      current.map((page) =>
        visibleIds.has(page.id) ? { ...page, selected: true } : page
      )
    );
  }, [visiblePages]);

  const clearSelection = useCallback(() => {
    setPages((current) => current.map((page) => ({ ...page, selected: false })));
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedCount === 0) {
      setError("Select one or more pages to delete.");
      return;
    }

    if (selectedCount >= activePages.length) {
      setError("Keep at least one page in the merged PDF.");
      return;
    }

    setError(null);
    setPages((current) =>
      reindexPages(
        current.map((page) =>
          page.selected
            ? { ...page, deleted: true, selected: false }
            : page
        )
      )
    );
  }, [activePages.length, selectedCount]);

  const rotateSelected = useCallback(() => {
    if (selectedCount === 0) {
      setError("Select one or more pages to rotate.");
      return;
    }

    setError(null);
    setPages((current) =>
      current.map((page) =>
        page.selected
          ? {
              ...page,
              rotation: ((page.rotation + 90) % 360) as MergePageState["rotation"],
            }
          : page
      )
    );
  }, [selectedCount]);

  const downloadMergedPdf = useCallback(async () => {
    const outputPages = pages
      .filter((page) => !page.deleted)
      .sort((a, b) => a.currentOrder - b.currentOrder);

    if (outputPages.length === 0) {
      setError("Add at least one page to export.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const outputPdf = await PDFDocument.create();
      const sourceDocs = new Map<string, PDFDocument>();

      for (const source of sourceFiles) {
        sourceDocs.set(source.id, await PDFDocument.load(source.bytes));
      }

      for (const pageState of outputPages) {
        const sourceDoc = sourceDocs.get(pageState.sourceFileId);
        if (!sourceDoc) continue;

        const [copiedPage] = await outputPdf.copyPages(sourceDoc, [
          pageState.originalPageIndex,
        ]);
        if (pageState.rotation !== 0) {
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees((currentRotation + pageState.rotation) % 360));
        }
        outputPdf.addPage(copiedPage);
      }

      const mergedBytes = await outputPdf.save();
      downloadBlob(
        new Blob([new Uint8Array(mergedBytes)], { type: "application/pdf" }),
        "merged.pdf"
      );
    } catch (err) {
      console.error("Failed to merge PDFs:", err);
      setError("Could not create the merged PDF. One file may be encrypted or corrupted.");
    } finally {
      setIsProcessing(false);
    }
  }, [pages, sourceFiles]);

  return (
    <div className="space-y-6">
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
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className="size-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Drop PDFs here</p>
        <p className="text-sm text-muted-foreground mt-1">
          or click to select up to {MAX_PDF_FILES} files
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <Info className="size-3.5" />
          Your PDF files are processed locally in your browser and are not uploaded to any server.
        </p>
      </div>

      {totalSize > LARGE_PDF_OPERATION_BYTES && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          This is a large PDF operation and may take longer depending on your device.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoadingFiles && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Reading PDF files...
        </div>
      )}

      {sourceFiles.length > 0 && (
        <div className="space-y-5">
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Source files</h3>
                <p className="text-sm text-muted-foreground">
                  {sourceFiles.length} file{sourceFiles.length !== 1 ? "s" : ""} x{" "}
                  {totalPages} page{totalPages !== 1 ? "s" : ""} x{" "}
                  {formatFileSize(totalSize)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sourceFiles.map((file, index) => (
                <div
                  key={file.id}
                  className="flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs"
                  style={{
                    backgroundColor: file.colour.bg,
                    borderColor: file.colour.border,
                    color: file.colour.text,
                  }}
                >
                  <span className="font-medium">File {index + 1}</span>
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted-foreground">
                    {file.pageCount}p
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSourceFile(file.id)}
                    className="rounded-full p-0.5 hover:bg-background/60"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Pages</h3>
              <p className="text-sm text-muted-foreground">
                {activePages.length} active x {selectedCount} selected
                {deletedCount > 0 ? ` x ${deletedCount} deleted` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={selectVisible}>
                Select visible
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear selection
              </Button>
              <Button variant="outline" size="sm" onClick={rotateSelected} className="gap-2">
                <RotateCw className="size-4" />
                Rotate
              </Button>
              <Button variant="outline" size="sm" onClick={deleteSelected} className="gap-2">
                <Trash2 className="size-4" />
                Delete
              </Button>
              <Button
                size="sm"
                onClick={downloadMergedPdf}
                disabled={isProcessing || activePages.length === 0}
                className="gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {isProcessing ? "Preparing..." : "Download merged.pdf"}
              </Button>
            </div>
          </div>

          <Separator />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visiblePages.map((page) => page.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {visiblePages.map((page) => {
                  const source = sourceById.get(page.sourceFileId);
                  if (!source) return null;
                  const sourceIndex = sourceFiles.findIndex(
                    (file) => file.id === source.id
                  );

                  return (
                    <SortablePageCard
                      key={page.id}
                      page={page}
                      source={source}
                      sourceLabel={`File ${sourceIndex + 1}`}
                      thumbnail={thumbnails[thumbnailKey(page)]}
                      onToggle={() => togglePage(page.id)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex flex-col items-center justify-center gap-3 pt-2">
            {isRenderingThumbnails && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Rendering thumbnails...
              </div>
            )}
            {visiblePages.length < activePages.length && (
              <Button
                variant="outline"
                onClick={() =>
                  setVisibleCount((count) =>
                    Math.min(count + THUMBNAIL_BATCH_SIZE, activePages.length)
                  )
                }
              >
                Load more pages
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SortablePageCard({
  page,
  source,
  sourceLabel,
  thumbnail,
  onToggle,
}: {
  page: MergePageState;
  source: SourcePdfFile;
  sourceLabel: string;
  thumbnail?: string;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    borderColor: page.selected ? source.colour.border : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-lg border bg-card p-2 transition-colors",
        page.selected && "bg-primary/5"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 z-10 rounded-md bg-background/90 p-1 text-muted-foreground shadow-sm hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        aria-label={`Reorder ${sourceLabel} page ${page.originalPageIndex + 1}`}
      >
        <GripVertical className="size-4" />
      </button>

      <button
        type="button"
        onClick={onToggle}
        className="block w-full text-left"
        aria-pressed={page.selected}
      >
        <div
          className="mb-2 inline-flex max-w-[calc(100%-2rem)] items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{
            backgroundColor: source.colour.bg,
            borderColor: source.colour.border,
            color: source.colour.text,
          }}
        >
          <span>{sourceLabel}</span>
          <span className="truncate opacity-80">{source.name}</span>
        </div>
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border bg-muted/40">
          {thumbnail ? (
            // Generated PDF thumbnail data URLs are local browser output, not optimizable remote assets.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt={`${sourceLabel} page ${page.originalPageIndex + 1}`}
              className="max-h-full max-w-full object-contain transition-transform"
              style={{ transform: `rotate(${page.rotation}deg)` }}
            />
          ) : (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-medium">Page {page.originalPageIndex + 1}</span>
          {page.rotation !== 0 && (
            <span className="tabular-nums text-muted-foreground">
              {page.rotation} deg
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

function reindexPages(pages: MergePageState[]): MergePageState[] {
  return pages.map((page, index) => ({
    ...page,
    currentOrder: index,
  }));
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
