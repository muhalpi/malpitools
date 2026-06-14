"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from "react";
import {
  Download,
  FileAudio,
  Loader2,
  Pause,
  Play,
  Plus,
  Scissors,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";

type ExportFormatId = "mp3" | "wav" | "webm-opus" | "ogg-opus" | "m4a-aac";

type ExportFormat = {
  id: ExportFormatId;
  label: string;
  buttonLabel: string;
  extension: string;
  mimeTypes: string[];
};

type AudioTrack = {
  id: string;
  file: File;
  buffer: AudioBuffer;
  url: string;
  start: number;
  end: number;
  peaks: number[];
};

type WaveformDrag =
  | { mode: "start" | "end" }
  | { length: number; mode: "move"; offset: number };

type PlaybackCursor = {
  time: number;
  trackId: string;
};

const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: "mp3",
    label: "MP3 (.mp3)",
    buttonLabel: "MP3",
    extension: "mp3",
    mimeTypes: ["audio/mpeg"],
  },
  {
    id: "wav",
    label: "WAV PCM (.wav)",
    buttonLabel: "WAV",
    extension: "wav",
    mimeTypes: ["audio/wav"],
  },
  {
    id: "webm-opus",
    label: "WebM Opus (.webm)",
    buttonLabel: "WebM",
    extension: "webm",
    mimeTypes: ["audio/webm;codecs=opus", "audio/webm"],
  },
  {
    id: "ogg-opus",
    label: "Ogg Opus (.ogg)",
    buttonLabel: "Ogg",
    extension: "ogg",
    mimeTypes: ["audio/ogg;codecs=opus", "audio/ogg"],
  },
  {
    id: "m4a-aac",
    label: "M4A AAC (.m4a)",
    buttonLabel: "M4A",
    extension: "m4a",
    mimeTypes: ["audio/mp4;codecs=mp4a.40.2", "audio/mp4"],
  },
];

const ACCEPTED_AUDIO =
  "audio/*,.mp3,.wav,.wave,.m4a,.m4b,.aac,.ogg,.oga,.opus,.flac,.webm,.aif,.aiff,.mp4";
const MIN_SELECTION_SECONDS = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00.000";
  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  const milliseconds = Math.round((seconds % 1) * 1000)
    .toString()
    .padStart(3, "0");
  return `${minutes}:${wholeSeconds}.${milliseconds}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function baseName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename || "audio";
}

function isAudioUpload(file: File): boolean {
  return (
    file.type.startsWith("audio/") ||
    /\.(mp3|wav|wave|m4a|m4b|aac|ogg|oga|opus|flac|webm|aif|aiff|mp4)$/i.test(file.name)
  );
}

function createTrackId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getExportFormat(id: ExportFormatId): ExportFormat {
  return EXPORT_FORMATS.find((format) => format.id === id) ?? EXPORT_FORMATS[0];
}

function supportedMediaRecorderMime(format: ExportFormat): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return format.mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? null;
}

function mergedOutputFilename(tracks: AudioTrack[], extension: string): string {
  const prefix =
    tracks.length === 1
      ? `${baseName(tracks[0]?.file.name ?? "audio")}-trimmed`
      : `merged-${tracks.length}-tracks`;

  return `${prefix}.${extension}`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function int16ChannelData(buffer: AudioBuffer, channelIndex: number): Int16Array {
  const source = buffer.getChannelData(Math.min(channelIndex, buffer.numberOfChannels - 1));
  const output = new Int16Array(buffer.length);

  for (let i = 0; i < source.length; i++) {
    const sample = clamp(source[i] ?? 0, -1, 1);
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}

function createWaveformPeaks(buffer: AudioBuffer, barCount = 180): number[] {
  const frameSize = Math.max(1, Math.floor(buffer.length / barCount));
  const peaks = Array.from({ length: barCount }, (_, index) => {
    const start = index * frameSize;
    const end = Math.min(buffer.length, start + frameSize);
    let peak = 0;

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      const stride = Math.max(1, Math.floor((end - start) / 80));

      for (let sampleIndex = start; sampleIndex < end; sampleIndex += stride) {
        peak = Math.max(peak, Math.abs(data[sampleIndex] ?? 0));
      }
    }

    return peak;
  });

  const maxPeak = Math.max(...peaks);
  if (maxPeak <= 0) return peaks.map(() => 0.08);

  return peaks.map((peak) => clamp(peak / maxPeak, 0.06, 1));
}

function audioBufferToWav(buffer: AudioBuffer, startSeconds: number, endSeconds: number): Blob {
  const sampleRate = buffer.sampleRate;
  const channelCount = buffer.numberOfChannels;
  const startSample = Math.floor(startSeconds * sampleRate);
  const endSample = Math.ceil(endSeconds * sampleRate);
  const frameCount = Math.max(1, endSample - startSample);
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const source = buffer.getChannelData(channel);
      const sample = clamp(source[startSample + i] ?? 0, -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error("This browser does not expose the Web Audio API.");
  }

  const audioContext = new AudioContextCtor();
  try {
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await audioContext.close();
  }
}

async function renderClipForMp3(
  buffer: AudioBuffer,
  startSeconds: number,
  endSeconds: number
): Promise<AudioBuffer> {
  const duration = Math.max(0.01, endSeconds - startSeconds);
  const channelCount = Math.min(2, Math.max(1, buffer.numberOfChannels));
  const OfflineAudioContextCtor =
    window.OfflineAudioContext ||
    (window as typeof window & { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;

  if (!OfflineAudioContextCtor) {
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextCtor) {
      throw new Error("This browser does not expose the Web Audio API.");
    }

    const audioContext = new AudioContextCtor();
    try {
      const startSample = Math.floor(startSeconds * buffer.sampleRate);
      const frameCount = Math.max(1, Math.ceil(duration * buffer.sampleRate));
      const clip = audioContext.createBuffer(channelCount, frameCount, buffer.sampleRate);

      for (let channel = 0; channel < channelCount; channel++) {
        clip.copyToChannel(
          buffer.getChannelData(channel).slice(startSample, startSample + frameCount),
          channel
        );
      }

      return clip;
    } finally {
      await audioContext.close();
    }
  }

  const sampleRate = 44100;
  const length = Math.max(1, Math.ceil(duration * sampleRate));
  const audioContext = new OfflineAudioContextCtor(channelCount, length, sampleRate);
  const source = audioContext.createBufferSource();

  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start(0, startSeconds, duration);

  return audioContext.startRendering();
}

async function renderMergedTracks(tracks: AudioTrack[]): Promise<AudioBuffer> {
  const playableTracks = tracks.filter((track) => track.end - track.start > 0);
  const totalDuration = playableTracks.reduce(
    (sum, track) => sum + Math.max(0.01, track.end - track.start),
    0
  );
  const channelCount = Math.min(
    2,
    Math.max(1, ...playableTracks.map((track) => track.buffer.numberOfChannels))
  );
  const sampleRate = 44100;
  const length = Math.max(1, Math.ceil(totalDuration * sampleRate));
  const OfflineAudioContextCtor =
    window.OfflineAudioContext ||
    (window as typeof window & { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;

  if (!OfflineAudioContextCtor) {
    throw new Error("This browser does not support offline audio rendering.");
  }

  const audioContext = new OfflineAudioContextCtor(channelCount, length, sampleRate);
  let offset = 0;

  for (const track of playableTracks) {
    const duration = Math.max(0.01, track.end - track.start);
    const source = audioContext.createBufferSource();

    source.buffer = track.buffer;
    source.connect(audioContext.destination);
    source.start(offset, track.start, duration);
    offset += duration;
  }

  return audioContext.startRendering();
}

async function audioBufferToMp3(
  buffer: AudioBuffer,
  startSeconds: number,
  endSeconds: number
): Promise<Blob> {
  const lamejs = (await import("lamejs")).default;
  const clip = await renderClipForMp3(buffer, startSeconds, endSeconds);
  const channelCount = Math.min(2, Math.max(1, clip.numberOfChannels));
  const encoder = new lamejs.Mp3Encoder(channelCount, clip.sampleRate, 192);
  const left = int16ChannelData(clip, 0);
  const right = channelCount > 1 ? int16ChannelData(clip, 1) : null;
  const chunks: ArrayBuffer[] = [];
  const blockSize = 1152;

  for (let offset = 0; offset < left.length; offset += blockSize) {
    const leftChunk = left.subarray(offset, offset + blockSize);
    const encoded = right
      ? encoder.encodeBuffer(leftChunk, right.subarray(offset, offset + blockSize))
      : encoder.encodeBuffer(leftChunk);

    if (encoded.length > 0) chunks.push(toArrayBuffer(encoded));
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(toArrayBuffer(flushed));

  return new Blob(chunks, { type: "audio/mpeg" });
}

async function mediaRecorderBlob(
  buffer: AudioBuffer,
  startSeconds: number,
  endSeconds: number,
  format: ExportFormat
): Promise<Blob> {
  const mimeType = supportedMediaRecorderMime(format);
  if (!mimeType) {
    throw new Error(`${format.label} export is not supported by this browser.`);
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error("This browser does not expose the Web Audio API.");
  }

  const audioContext = new AudioContextCtor();
  const source = audioContext.createBufferSource();
  const destination = audioContext.createMediaStreamDestination();
  const chunks: BlobPart[] = [];
  const clipDuration = Math.max(0.01, endSeconds - startSeconds);

  source.buffer = buffer;
  source.connect(destination);

  try {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const recorder = new MediaRecorder(destination.stream, {
      mimeType,
      audioBitsPerSecond: 192000,
    });

    const recorded = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        reject(new Error(`Could not encode ${format.label}.`));
      };
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };
    });

    recorder.start();
    source.start(0, startSeconds, clipDuration);
    source.onended = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };

    return await recorded;
  } finally {
    source.disconnect();
    await audioContext.close();
  }
}

export function AudioTrimCutTool() {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormatId>("mp3");
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const [playbackCursor, setPlaybackCursor] = useState<PlaybackCursor | null>(null);
  const tracksRef = useRef<AudioTrack[]>([]);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const playbackFrameRef = useRef<number | null>(null);

  const selectedFormat = getExportFormat(exportFormat);
  const playableTracks = useMemo(
    () => tracks.filter((track) => track.end - track.start > 0),
    [tracks]
  );
  const totalDuration = useMemo(
    () => playableTracks.reduce((sum, track) => sum + Math.max(0, track.end - track.start), 0),
    [playableTracks]
  );
  const totalSize = useMemo(
    () => tracks.reduce((sum, track) => sum + track.file.size, 0),
    [tracks]
  );

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    return () => {
      playerRef.current?.pause();
      tracksRef.current.forEach((track) => URL.revokeObjectURL(track.url));
    };
  }, []);

  const getPlayer = () => {
    if (!playerRef.current) playerRef.current = new Audio();
    return playerRef.current;
  };

  function stopPlaybackTick() {
    if (playbackFrameRef.current !== null) {
      cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = null;
    }
  }

  function startPlaybackTick(player: HTMLAudioElement, track: AudioTrack) {
    stopPlaybackTick();

    const tick = () => {
      setPlaybackCursor({
        time: clamp(player.currentTime, track.start, track.end),
        trackId: track.id,
      });

      if (!player.paused && player.currentTime < track.end) {
        playbackFrameRef.current = requestAnimationFrame(tick);
      }
    };

    tick();
  }

  function stopPlayback() {
    const player = playerRef.current;

    stopPlaybackTick();

    if (player) {
      player.pause();
      player.ontimeupdate = null;
      player.onended = null;
      player.removeAttribute("src");
      player.load();
    }

    setPlayingTrackId(null);
    setPlayingAll(false);
    setPlaybackCursor(null);
  }

  function playTrackQueue(queue: AudioTrack[], index: number) {
    const track = queue[index];
    if (!track) {
      stopPlayback();
      return;
    }

    const player = getPlayer();
    const advance = () => {
      player.pause();
      playTrackQueue(queue, index + 1);
    };

    player.pause();
    player.src = track.url;
    player.currentTime = track.start;
    setPlaybackCursor({ time: track.start, trackId: track.id });
    player.ontimeupdate = () => {
      if (player.currentTime >= track.end - 0.02) advance();
    };
    player.onended = advance;
    setPlayingTrackId(track.id);
    setPlayingAll(queue.length > 1);

    void player
      .play()
      .then(() => startPlaybackTick(player, track))
      .catch(() => {
        setError("Could not start audio playback.");
        stopPlayback();
      });
  }

  function toggleTrackPlayback(track: AudioTrack) {
    if (playingTrackId === track.id && !playingAll) {
      stopPlayback();
      return;
    }

    playTrackQueue([track], 0);
  }

  function togglePlayAll() {
    if (playingAll) {
      stopPlayback();
      return;
    }

    if (playableTracks.length === 0) return;
    playTrackQueue(playableTracks, 0);
  }

  const selectFiles = async (files: FileList | File[]) => {
    const nextFiles = Array.from(files).filter(isAudioUpload);

    if (nextFiles.length === 0) {
      setError("Drop an audio file to load it here.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const nextTracks = await Promise.all(
        nextFiles.map(async (file) => {
          const decoded = await decodeAudioFile(file);
          const url = URL.createObjectURL(file);

          return {
            id: createTrackId(),
            file,
            buffer: decoded,
            url,
            start: 0,
            end: decoded.duration,
            peaks: createWaveformPeaks(decoded),
          };
        })
      );

      setTracks((current) => [...current, ...nextTracks]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decode this audio file.");
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    void selectFiles(event.dataTransfer.files);
  };

  const updateTrackRange = (trackId: string, start: number, end: number) => {
    if (playingTrackId === trackId) stopPlayback();

    setTracks((current) =>
      current.map((track) =>
        track.id === trackId
          ? {
              ...track,
              start: clamp(start, 0, Math.max(0, track.buffer.duration - MIN_SELECTION_SECONDS)),
              end: clamp(end, MIN_SELECTION_SECONDS, track.buffer.duration),
            }
          : track
      )
    );
  };

  const removeTrack = (trackId: string) => {
    if (playingTrackId === trackId) stopPlayback();

    setTracks((current) => {
      const removed = current.find((track) => track.id === trackId);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((track) => track.id !== trackId);
    });
  };

  const clear = () => {
    stopPlayback();
    tracksRef.current.forEach((track) => URL.revokeObjectURL(track.url));
    setTracks([]);
    setError("");
  };

  const exportAudio = async () => {
    if (playableTracks.length === 0 || totalDuration <= 0) return;

    stopPlayback();
    setExporting(true);
    setError("");

    try {
      const mergedBuffer = await renderMergedTracks(playableTracks);
      const blob =
        selectedFormat.id === "mp3"
          ? await audioBufferToMp3(mergedBuffer, 0, mergedBuffer.duration)
          : selectedFormat.id === "wav"
            ? audioBufferToWav(mergedBuffer, 0, mergedBuffer.duration)
            : await mediaRecorderBlob(mergedBuffer, 0, mergedBuffer.duration, selectedFormat);

      downloadBlob(blob, mergedOutputFilename(playableTracks, selectedFormat.extension));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export this audio format.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Input
        id="audio-trim-file"
        type="file"
        multiple
        accept={ACCEPTED_AUDIO}
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void selectFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.72fr_1.58fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Scissors className="size-4 text-primary" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="audio-export-format">Target format</Label>
                <Select
                  value={exportFormat}
                  onValueChange={(value) => setExportFormat(value as ExportFormatId)}
                >
                  <SelectTrigger id="audio-export-format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_FORMATS.map((format) => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileAudio className="size-4 text-primary" />
                Merge Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Metric label="Total tracks" value={tracks.length.toString()} />
                <Metric label="Total duration" value={formatTime(totalDuration)} tone="primary" />
                <Metric label="Source size" value={formatBytes(totalSize)} />
                <Metric label="Output" value={selectedFormat.buttonLabel} tone="primary" />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Button
                  variant="secondary"
                  onClick={togglePlayAll}
                  disabled={playableTracks.length === 0}
                >
                  {playingAll ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {playingAll ? "Pause all" : "Play all"}
                </Button>
                <Button
                  onClick={exportAudio}
                  disabled={playableTracks.length === 0 || exporting}
                >
                  <Download className="size-4" />
                  {exporting ? "Exporting..." : "Export"}
                </Button>
              </div>

              {tracks.length > 0 && (
                <Button variant="ghost" className="w-full" onClick={clear}>
                  <X className="size-4" />
                  Clear tracks
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {tracks.length === 0 ? (
            <AddTracksDropzone
              dragging={dragging}
              loading={loading}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ) : (
            <>
              <div className="space-y-3">
                {tracks.map((track, index) => (
                  <WaveformTrack
                    key={track.id}
                    index={index}
                    isPlaying={playingTrackId === track.id}
                    playbackTime={
                      playbackCursor?.trackId === track.id ? playbackCursor.time : null
                    }
                    track={track}
                    onPlayToggle={() => toggleTrackPlayback(track)}
                    onRangeChange={(start, end) => updateTrackRange(track.id, start, end)}
                    onRemove={() => removeTrack(track.id)}
                  />
                ))}
              </div>

              <AddTracksDropzone
                compact
                dragging={dragging}
                loading={loading}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddTracksDropzone({
  compact = false,
  dragging,
  loading,
  onDragLeave,
  onDragOver,
  onDrop,
}: {
  compact?: boolean;
  dragging: boolean;
  loading: boolean;
  onDragLeave: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}) {
  return (
    <Card>
      <CardContent className={compact ? "p-4" : "pt-6"}>
        <Label
          htmlFor="audio-trim-file"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 p-8 text-center transition-colors hover:border-primary/60 hover:bg-primary/5",
            compact ? "min-h-36" : "min-h-64",
            dragging && "border-primary/70 bg-primary/5"
          )}
        >
          {loading ? (
            <Loader2 className="size-8 animate-spin text-primary" />
          ) : compact ? (
            <Plus className="size-8 text-muted-foreground" />
          ) : (
            <Upload className="size-8 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {loading
              ? "Decoding audio"
              : compact
                ? "Add more tracks to merge"
                : "Choose or drop audio files"}
          </span>
          <span className="max-w-md text-xs text-muted-foreground">
            Drop MP3, WAV, M4A, AAC, Ogg, FLAC, WebM, AIFF, or MP4 audio and export the trimmed tracks together.
          </span>
        </Label>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "primary";
  value: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 p-3",
        tone === "primary" && "border-primary/20 bg-primary/5"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function WaveformTrack({
  index,
  isPlaying,
  onPlayToggle,
  onRangeChange,
  onRemove,
  playbackTime,
  track,
}: {
  index: number;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onRangeChange: (start: number, end: number) => void;
  onRemove: () => void;
  playbackTime: null | number;
  track: AudioTrack;
}) {
  const dragRef = useRef<WaveformDrag | null>(null);
  const duration = track.buffer.duration;
  const selectionLength = Math.max(0, track.end - track.start);
  const startPercent = duration > 0 ? (track.start / duration) * 100 : 0;
  const endPercent = duration > 0 ? (track.end / duration) * 100 : 100;
  const widthPercent = Math.max(0.5, endPercent - startPercent);
  const playbackPercent =
    playbackTime !== null && duration > 0
      ? (clamp(playbackTime, 0, duration) / duration) * 100
      : null;
  const displayPlaybackTime =
    playbackTime !== null ? clamp(playbackTime, track.start, track.end) : null;

  const secondsFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    return ratio * duration;
  };

  const applyDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const seconds = secondsFromPointer(event);

    if (drag.mode === "start") {
      onRangeChange(clamp(seconds, 0, track.end - MIN_SELECTION_SECONDS), track.end);
      return;
    }

    if (drag.mode === "end") {
      onRangeChange(track.start, clamp(seconds, track.start + MIN_SELECTION_SECONDS, duration));
      return;
    }

    if (drag.mode === "move") {
      const nextStart = clamp(seconds - drag.offset, 0, duration - drag.length);
      onRangeChange(nextStart, nextStart + drag.length);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;

    const seconds = secondsFromPointer(event);
    const handleHitbox = Math.max(duration * 0.025, 0.25);

    if (Math.abs(seconds - track.start) <= handleHitbox) {
      dragRef.current = { mode: "start" };
    } else if (Math.abs(seconds - track.end) <= handleHitbox) {
      dragRef.current = { mode: "end" };
    } else if (seconds > track.start && seconds < track.end) {
      dragRef.current = {
        length: selectionLength,
        mode: "move",
        offset: seconds - track.start,
      };
    } else if (seconds < track.start) {
      dragRef.current = { mode: "start" };
      onRangeChange(clamp(seconds, 0, track.end - MIN_SELECTION_SECONDS), track.end);
    } else {
      dragRef.current = { mode: "end" };
      onRangeChange(track.start, clamp(seconds, track.start + MIN_SELECTION_SECONDS, duration));
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="min-w-0 text-sm">
            <span className="mr-2 text-muted-foreground">#{index + 1}</span>
            <span className="break-words uppercase tracking-wide">{track.file.name}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {formatBytes(track.file.size)}
            </span>
            <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${track.file.name}`}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
          <Button
            size="icon"
            className="size-12"
            onClick={onPlayToggle}
            aria-label={isPlaying ? `Pause ${track.file.name}` : `Play ${track.file.name}`}
          >
            {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
          </Button>

          <div
            className="relative h-24 touch-none overflow-hidden rounded-lg border bg-background"
            onPointerDown={handlePointerDown}
            onPointerMove={applyDrag}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="slider"
            aria-label={`Trim range for ${track.file.name}`}
            aria-valuemin={0}
            aria-valuemax={Number(duration.toFixed(2))}
            aria-valuenow={Number(selectionLength.toFixed(2))}
            aria-valuetext={`${formatTime(track.start)} to ${formatTime(track.end)}`}
            tabIndex={0}
          >
            <svg
              aria-hidden="true"
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
              viewBox={`0 0 ${track.peaks.length} 100`}
            >
              {track.peaks.map((peak, peakIndex) => (
                <line
                  key={`${track.id}-${peakIndex}`}
                  x1={peakIndex + 0.5}
                  x2={peakIndex + 0.5}
                  y1={50 - peak * 42}
                  y2={50 + peak * 42}
                  className="stroke-primary/35"
                  strokeWidth="0.72"
                  strokeLinecap="round"
                />
              ))}
            </svg>

            <div
              className="absolute inset-y-0 bg-background/70"
              style={{ left: 0, width: `${startPercent}%` }}
            />
            <div
              className="absolute inset-y-0 bg-background/70"
              style={{ left: `${endPercent}%`, right: 0 }}
            />
            <div
              className="absolute inset-y-2 rounded-md border border-primary/60 bg-primary/10 shadow-sm"
              style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
            />
            <div
              className="absolute inset-y-2 w-2 -translate-x-1/2 cursor-ew-resize rounded-full bg-primary shadow-sm"
              style={{ left: `${startPercent}%` }}
            />
            <div
              className="absolute inset-y-2 w-2 -translate-x-1/2 cursor-ew-resize rounded-full bg-primary shadow-sm"
              style={{ left: `${endPercent}%` }}
            />
            {isPlaying && playbackPercent !== null && displayPlaybackTime !== null && (
              <>
                <div
                  className="pointer-events-none absolute inset-y-1 z-20 w-0.5 -translate-x-1/2 bg-foreground shadow-sm"
                  style={{ left: `${playbackPercent}%` }}
                />
                <div
                  className="pointer-events-none absolute top-1 z-20 -translate-x-1/2 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold leading-none text-background shadow-sm"
                  style={{ left: `${playbackPercent}%` }}
                >
                  {formatTime(displayPlaybackTime)}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-2 text-xs font-medium uppercase text-muted-foreground sm:grid-cols-3">
          <span>Start: {formatTime(track.start)}</span>
          <span>End: {formatTime(track.end)}</span>
          <span className="sm:text-right">Len: {formatTime(selectionLength)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
