"use client";

import { useEffect, useState, type DragEvent } from "react";
import {
  Download,
  FileAudio,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";

type MetadataDraft = {
  fileName: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  track: string;
  genre: string;
  comment: string;
};

type CoverDraft = {
  bytes: Uint8Array;
  mimeType: string;
  name: string;
  url: string;
};

type TechnicalMetadata = {
  name: string;
  type: string;
  size: number;
  lastModified: string;
  duration: number | null;
  sampleRate: number | null;
  channels: number | null;
  bitrateKbps: number | null;
  isMp3: boolean;
};

type LoadedAudio = {
  file: File;
  buffer: ArrayBuffer;
  url: string;
};

type ParsedId3v2 = {
  tags: Partial<MetadataDraft>;
  cover: Omit<CoverDraft, "url" | "name"> | null;
};

const EMPTY_METADATA: MetadataDraft = {
  fileName: "",
  title: "",
  artist: "",
  album: "",
  year: "",
  track: "",
  genre: "",
  comment: "",
};

const TEXT_FRAME_MAP: Record<string, keyof MetadataDraft> = {
  TIT2: "title",
  TPE1: "artist",
  TALB: "album",
  TDRC: "year",
  TYER: "year",
  TRCK: "track",
  TCON: "genre",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "Unknown";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName || "audio";
}

function mp3FileName(fileName: string): string {
  const trimmed = fileName.trim() || "audio";
  return trimmed.toLowerCase().endsWith(".mp3") ? trimmed : `${trimmed}.mp3`;
}

function cleanText(value: string): string {
  return value.replace(/\0/g, "").trim();
}

function decodeLatin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

function decodeText(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

function readSyncsafe(view: DataView, offset: number): number {
  return (
    ((view.getUint8(offset) & 0x7f) << 21) |
    ((view.getUint8(offset + 1) & 0x7f) << 14) |
    ((view.getUint8(offset + 2) & 0x7f) << 7) |
    (view.getUint8(offset + 3) & 0x7f)
  );
}

function writeSyncsafe(value: number): Uint8Array {
  return new Uint8Array([
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f,
  ]);
}

function decodeId3Text(payload: Uint8Array): string {
  if (payload.length === 0) return "";
  const encoding = payload[0];
  const content = payload.slice(1);

  if (encoding === 0) return cleanText(decodeLatin1(content));
  if (encoding === 3) return cleanText(decodeText(content, "utf-8"));
  if (encoding === 2) return cleanText(decodeText(content, "utf-16be"));

  if (content[0] === 0xff && content[1] === 0xfe) {
    return cleanText(decodeText(content.slice(2), "utf-16le"));
  }
  if (content[0] === 0xfe && content[1] === 0xff) {
    return cleanText(decodeText(content.slice(2), "utf-16be"));
  }
  return cleanText(decodeText(content, "utf-16le"));
}

function decodeComment(payload: Uint8Array): string {
  if (payload.length < 5) return decodeId3Text(payload);
  const encoding = payload[0];
  const body = payload.slice(4);
  const terminator = encoding === 0 || encoding === 3 ? 1 : 2;
  let start = 0;

  for (let i = 0; i < body.length - terminator + 1; i += terminator) {
    if (terminator === 1 && body[i] === 0) {
      start = i + 1;
      break;
    }
    if (terminator === 2 && body[i] === 0 && body[i + 1] === 0) {
      start = i + 2;
      break;
    }
  }

  return decodeId3Text(new Uint8Array([encoding, ...Array.from(body.slice(start))]));
}

function parseCover(payload: Uint8Array): ParsedId3v2["cover"] {
  if (payload.length < 5) return null;
  const encoding = payload[0];
  let offset = 1;
  const mimeEnd = payload.indexOf(0, offset);
  if (mimeEnd < 0 || mimeEnd + 2 >= payload.length) return null;

  const mimeType = decodeLatin1(payload.slice(offset, mimeEnd)) || "image/jpeg";
  offset = mimeEnd + 2;
  const terminator = encoding === 0 || encoding === 3 ? 1 : 2;

  while (offset < payload.length - terminator + 1) {
    if (terminator === 1 && payload[offset] === 0) {
      offset += 1;
      break;
    }
    if (terminator === 2 && payload[offset] === 0 && payload[offset + 1] === 0) {
      offset += 2;
      break;
    }
    offset += terminator;
  }

  if (offset >= payload.length) return null;
  return { bytes: payload.slice(offset), mimeType };
}

function parseId3v1(bytes: Uint8Array): Partial<MetadataDraft> {
  if (bytes.length < 128) return {};
  const footer = bytes.slice(bytes.length - 128);
  if (decodeLatin1(footer.slice(0, 3)) !== "TAG") return {};

  return {
    title: cleanText(decodeLatin1(footer.slice(3, 33))),
    artist: cleanText(decodeLatin1(footer.slice(33, 63))),
    album: cleanText(decodeLatin1(footer.slice(63, 93))),
    year: cleanText(decodeLatin1(footer.slice(93, 97))),
    comment: cleanText(decodeLatin1(footer.slice(97, 127))),
  };
}

function parseId3v2(buffer: ArrayBuffer): ParsedId3v2 {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10 || decodeLatin1(bytes.slice(0, 3)) !== "ID3") {
    return { tags: {}, cover: null };
  }

  const view = new DataView(buffer);
  const major = view.getUint8(3);
  const tagSize = readSyncsafe(view, 6);
  const end = Math.min(10 + tagSize, bytes.length);
  const tags: Partial<MetadataDraft> = {};
  let cover: ParsedId3v2["cover"] = null;
  let offset = 10;

  while (offset + 10 <= end) {
    const frameId = decodeLatin1(bytes.slice(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

    const frameSize =
      major === 4 ? readSyncsafe(view, offset + 4) : view.getUint32(offset + 4);
    if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) break;

    const payload = bytes.slice(offset + 10, offset + 10 + frameSize);
    const key = TEXT_FRAME_MAP[frameId];
    if (key) tags[key] = decodeId3Text(payload);
    if (frameId === "COMM") tags.comment = decodeComment(payload);
    if (frameId === "APIC" && !cover) cover = parseCover(payload);

    offset += 10 + frameSize;
  }

  return { tags, cover };
}

function isMp3File(file: File, bytes: Uint8Array): boolean {
  return (
    file.type === "audio/mpeg" ||
    file.name.toLowerCase().endsWith(".mp3") ||
    decodeLatin1(bytes.slice(0, 3)) === "ID3" ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  );
}

function isAudioUpload(file: File): boolean {
  return (
    file.type.startsWith("audio/") ||
    /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)
  );
}

function isCoverUpload(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function firstAcceptedFile(
  files: FileList,
  accepts: (file: File) => boolean
): File | null {
  return Array.from(files).find(accepts) ?? null;
}

function id3v2End(bytes: Uint8Array): number {
  if (bytes.length < 10 || decodeLatin1(bytes.slice(0, 3)) !== "ID3") return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = view.getUint8(5);
  const footerSize = flags & 0x10 ? 10 : 0;
  return Math.min(10 + readSyncsafe(view, 6) + footerSize, bytes.length);
}

function audioPayloadWithoutTags(buffer: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(buffer);
  const start = id3v2End(bytes);
  const hasId3v1 =
    bytes.length >= 128 && decodeLatin1(bytes.slice(bytes.length - 128, bytes.length - 125)) === "TAG";
  const end = hasId3v1 ? bytes.length - 128 : bytes.length;
  return bytes.slice(start, end);
}

function asciiBytes(value: string): Uint8Array {
  return new Uint8Array(Array.from(value).map((char) => char.charCodeAt(0) & 0xff));
}

function utf16FrameText(value: string): Uint8Array {
  const text = cleanText(value);
  const bytes = new Uint8Array(1 + 2 + text.length * 2);
  bytes[0] = 1;
  bytes[1] = 0xff;
  bytes[2] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[3 + i * 2] = code & 0xff;
    bytes[4 + i * 2] = code >> 8;
  }
  return bytes;
}

function utf16Body(value: string): Uint8Array {
  const text = cleanText(value);
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[3 + i * 2] = code >> 8;
  }
  return bytes;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function createFrame(id: string, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(10 + payload.length);
  frame.set(asciiBytes(id), 0);
  const view = new DataView(frame.buffer);
  view.setUint32(4, payload.length, false);
  frame.set(payload, 10);
  return frame;
}

function createTextFrame(id: string, value: string): Uint8Array | null {
  const text = cleanText(value);
  return text ? createFrame(id, utf16FrameText(text)) : null;
}

function createCommentFrame(value: string): Uint8Array | null {
  const text = cleanText(value);
  if (!text) return null;
  return createFrame("COMM", concatBytes([
    new Uint8Array([1]),
    asciiBytes("eng"),
    new Uint8Array([0xff, 0xfe, 0, 0]),
    utf16Body(text),
  ]));
}

function createCoverFrame(cover: CoverDraft | null): Uint8Array | null {
  if (!cover) return null;
  return createFrame("APIC", concatBytes([
    new Uint8Array([0]),
    asciiBytes(cover.mimeType || "image/jpeg"),
    new Uint8Array([0, 3, 0]),
    cover.bytes,
  ]));
}

function createId3Tag(draft: MetadataDraft, cover: CoverDraft | null): Uint8Array {
  const frames = [
    createTextFrame("TIT2", draft.title),
    createTextFrame("TPE1", draft.artist),
    createTextFrame("TALB", draft.album),
    createTextFrame("TYER", draft.year),
    createTextFrame("TRCK", draft.track),
    createTextFrame("TCON", draft.genre),
    createCommentFrame(draft.comment),
    createCoverFrame(cover),
  ].filter((frame): frame is Uint8Array => frame !== null);

  const body = concatBytes(frames);
  const header = new Uint8Array(10);
  header.set(asciiBytes("ID3"), 0);
  header[3] = 3;
  header[4] = 0;
  header[5] = 0;
  header.set(writeSyncsafe(body.length), 6);
  return concatBytes([header, body]);
}

async function decodeTechnicalMetadata(
  file: File,
  arrayBuffer: ArrayBuffer,
  isMp3: boolean
): Promise<TechnicalMetadata> {
  const technical: TechnicalMetadata = {
    name: file.name,
    type: file.type || "Unknown",
    size: file.size,
    lastModified: new Date(file.lastModified).toLocaleString(),
    duration: null,
    sampleRate: null,
    channels: null,
    bitrateKbps: null,
    isMp3,
  };

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) return technical;

  const audioContext = new AudioContextCtor();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    technical.duration = decoded.duration;
    technical.sampleRate = decoded.sampleRate;
    technical.channels = decoded.numberOfChannels;
    technical.bitrateKbps =
      decoded.duration > 0 ? Math.round((file.size * 8) / decoded.duration / 1000) : null;
  } finally {
    await audioContext.close();
  }

  return technical;
}

export function AudioMetadataTool() {
  const [draft, setDraft] = useState<MetadataDraft>(EMPTY_METADATA);
  const [technical, setTechnical] = useState<TechnicalMetadata | null>(null);
  const [loadedAudio, setLoadedAudio] = useState<LoadedAudio | null>(null);
  const [cover, setCover] = useState<CoverDraft | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioDragging, setAudioDragging] = useState(false);
  const [coverDragging, setCoverDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (loadedAudio?.url) URL.revokeObjectURL(loadedAudio.url);
    };
  }, [loadedAudio]);

  useEffect(() => {
    return () => {
      if (cover?.url) URL.revokeObjectURL(cover.url);
    };
  }, [cover]);

  const selectFile = async (file: File) => {
    setLoading(true);
    setError("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const parsed = parseId3v2(arrayBuffer);
      const tags = {
        ...parseId3v1(bytes),
        ...parsed.tags,
      };
      const isMp3 = isMp3File(file, bytes);

      setDraft({ ...EMPTY_METADATA, fileName: baseName(file.name), ...tags });
      setTechnical(await decodeTechnicalMetadata(file, arrayBuffer, isMp3));
      setLoadedAudio({ file, buffer: arrayBuffer, url: URL.createObjectURL(file) });

      if (parsed.cover) {
        const blob = new Blob([toArrayBuffer(parsed.cover.bytes)], { type: parsed.cover.mimeType });
        setCover({
          ...parsed.cover,
          name: "Embedded cover",
          url: URL.createObjectURL(blob),
        });
      } else {
        setCover(null);
      }
    } catch (err) {
      setTechnical(null);
      setLoadedAudio(null);
      setCover(null);
      setDraft(EMPTY_METADATA);
      setError(err instanceof Error ? err.message : "Could not read this audio file.");
    } finally {
      setLoading(false);
    }
  };

  const selectCover = async (file: File) => {
    if (!isCoverUpload(file)) {
      setError("Choose a JPEG, PNG, or WebP image for the cover.");
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    setCover({
      bytes,
      mimeType: file.type || "image/jpeg",
      name: file.name,
      url: URL.createObjectURL(file),
    });
    setError("");
  };

  const updateDraft = (key: keyof MetadataDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleAudioDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setAudioDragging(true);
  };

  const handleAudioDragLeave = () => {
    setAudioDragging(false);
  };

  const handleAudioDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setAudioDragging(false);

    const file = firstAcceptedFile(event.dataTransfer.files, isAudioUpload);
    if (!file) {
      setError("Drop an audio file to load it here.");
      return;
    }

    void selectFile(file);
  };

  const handleCoverDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setCoverDragging(true);
  };

  const handleCoverDragLeave = (event: DragEvent<HTMLElement>) => {
    event.stopPropagation();
    setCoverDragging(false);
  };

  const handleCoverDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setCoverDragging(false);

    const file = firstAcceptedFile(event.dataTransfer.files, isCoverUpload);
    if (!file) {
      setError("Drop a JPEG, PNG, or WebP image for the cover.");
      return;
    }

    void selectCover(file);
  };

  const exportAudio = () => {
    if (!loadedAudio || !technical) return;
    if (!technical.isMp3) {
      setError("Audio metadata export currently supports MP3 files only.");
      return;
    }

    const tag = createId3Tag(draft, cover);
    const audioBytes = audioPayloadWithoutTags(loadedAudio.buffer);
    const blob = new Blob([toArrayBuffer(tag), toArrayBuffer(audioBytes)], { type: "audio/mpeg" });
    downloadBlob(blob, mp3FileName(draft.fileName));
  };

  const resetFields = () => {
    if (!loadedAudio) return;
    void selectFile(loadedAudio.file);
  };

  const clear = () => {
    setDraft(EMPTY_METADATA);
    setTechnical(null);
    setLoadedAudio(null);
    setCover(null);
    setError("");
  };

  return (
    <div className="space-y-6">
      <Input
        id="audio-metadata-file"
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void selectFile(file);
          event.target.value = "";
        }}
      />

      {!loadedAudio && (
        <Card>
          <CardContent className="pt-6">
            <Label
              htmlFor="audio-metadata-file"
              onDragOver={handleAudioDragOver}
              onDragLeave={handleAudioDragLeave}
              onDrop={handleAudioDrop}
              className={cn(
                "flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 p-8 text-center transition-colors hover:border-primary/60 hover:bg-primary/5",
                audioDragging && "border-primary/70 bg-primary/5"
              )}
            >
              {loading ? (
                <Loader2 className="size-8 animate-spin text-primary" />
              ) : (
                <Upload className="size-8 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {loading ? "Reading audio metadata" : "Choose or drop an audio file"}
              </span>
              <span className="text-xs text-muted-foreground">
                MP3 files can be exported again with edited ID3 metadata.
              </span>
            </Label>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {technical && loadedAudio && (
        <div className="grid items-start gap-4 xl:grid-cols-[430px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <FileAudio className="size-4 text-primary" />
                    Configuration
                  </span>
                  <Badge variant={technical.isMp3 ? "secondary" : "outline"}>
                    {technical.isMp3 ? "Writable MP3" : "Read only"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="File name" value={draft.fileName} onChange={(value) => updateDraft("fileName", value)} />
                <Field label="Title" value={draft.title} onChange={(value) => updateDraft("title", value)} />
                <Field label="Artist" value={draft.artist} onChange={(value) => updateDraft("artist", value)} />
                <Field label="Album" value={draft.album} onChange={(value) => updateDraft("album", value)} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Year" value={draft.year} onChange={(value) => updateDraft("year", value)} />
                  <Field label="Track" value={draft.track} onChange={(value) => updateDraft("track", value)} />
                </div>
                <Field label="Genre" value={draft.genre} onChange={(value) => updateDraft("genre", value)} />
                <div className="space-y-1.5">
                  <Label htmlFor="audio-comment">Comment</Label>
                  <Textarea
                    id="audio-comment"
                    value={draft.comment}
                    onChange={(event) => updateDraft("comment", event.target.value)}
                    className="min-h-24 resize-y"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-base">Track details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Stat label="File size" value={formatBytes(technical.size)} />
                  <Stat label="Duration" value={formatDuration(technical.duration)} />
                  <Stat label="Bitrate" value={technical.bitrateKbps ? `${technical.bitrateKbps} kbps` : "Unknown"} />
                  <Stat label="Channels" value={technical.channels ? `${technical.channels}` : "Unknown"} />
                </div>
                <audio src={loadedAudio.url} controls className="w-full" />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={exportAudio} disabled={!technical.isMp3}>
                    <Download className="size-4" />
                    Export audio
                  </Button>
                  <Button variant="outline" onClick={resetFields}>
                    <RotateCcw className="size-4" />
                    Reset
                  </Button>
                  <Button variant="ghost" onClick={clear}>
                    <X className="size-4" />
                    Clear
                  </Button>
                </div>
                {!technical.isMp3 && (
                  <p className="text-xs text-muted-foreground">
                    Metadata export is available for MP3 files. This file can still be inspected and previewed.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card
            onDragOver={handleAudioDragOver}
            onDragLeave={handleAudioDragLeave}
            onDrop={handleAudioDrop}
            className={cn(
              "w-full border-dashed bg-muted/10 transition-colors",
              audioDragging && "border-primary/70 bg-primary/5"
            )}
          >
            <CardContent className="flex min-h-[520px] flex-col items-center justify-center gap-8 px-8 py-10">
              <Label
                htmlFor="audio-cover-file"
                onDragOver={handleCoverDragOver}
                onDragLeave={handleCoverDragLeave}
                onDrop={handleCoverDrop}
                className={cn(
                  "flex size-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/20 text-center transition-colors hover:border-primary/60 hover:bg-primary/5",
                  coverDragging && "border-primary/70 bg-primary/5"
                )}
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover.url} alt="Album cover preview" className="size-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImagePlus className="size-10" />
                    <span className="text-sm font-medium">Add cover</span>
                  </span>
                )}
              </Label>
              <Input
                id="audio-cover-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void selectCover(file);
                  event.target.value = "";
                }}
              />

              <div className="w-full max-w-2xl space-y-3">
                <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3">
                  <span className="font-mono text-sm text-muted-foreground">00:00</span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div className="h-full w-0 rounded-full bg-primary" />
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">
                    {formatDuration(technical.duration)}
                  </span>
                </div>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" asChild>
                    <Label htmlFor="audio-metadata-file" className="cursor-pointer">
                      <RefreshCw className="size-4" />
                      Replace file
                    </Label>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `audio-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
