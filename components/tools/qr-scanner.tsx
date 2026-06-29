"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  BrowserQRCodeReader,
  type IScannerControls,
} from "@zxing/browser";
import {
  Camera,
  Check,
  Copy,
  ExternalLink,
  ImageIcon,
  LoaderCircle,
  ScanLine,
  ShieldCheck,
  Upload,
  VideoOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ScanSource = "camera" | "image";

interface ScanResult {
  source: ScanSource;
  text: string;
}

function getCameraErrorMessage(error: unknown) {
  if (!(error instanceof DOMException)) {
    return "The camera could not be started. Try uploading an image instead.";
  }

  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was denied. Allow camera permission in your browser, then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No usable camera was found on this device.";
    case "NotReadableError":
      return "The camera is already in use by another app or browser tab.";
    default:
      return "The camera could not be started. Try uploading an image instead.";
  }
}

function getWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function stopVideoStream(video: HTMLVideoElement | null) {
  const stream = video?.srcObject;

  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  if (video) {
    video.srcObject = null;
  }
}

export function QrScannerTool() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const cameraSessionRef = useRef(0);
  const uploadSessionRef = useRef(0);

  const [activeTab, setActiveTab] = useState<ScanSource>("camera");
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraScanning, setCameraScanning] = useState(false);
  const [imageScanning, setImageScanning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const getReader = useCallback(() => {
    if (!readerRef.current) {
      readerRef.current = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 750,
      });
    }

    return readerRef.current;
  }, []);

  const releaseCamera = useCallback(() => {
    cameraSessionRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    stopVideoStream(videoRef.current);
  }, []);

  const stopCamera = useCallback(() => {
    releaseCamera();
    setCameraStarting(false);
    setCameraScanning(false);
  }, [releaseCamera]);

  useEffect(() => {
    return () => {
      releaseCamera();
      uploadSessionRef.current += 1;

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [releaseCamera]);

  useEffect(() => {
    if (!result) return;

    const frame = window.requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [result]);

  const acceptResult = useCallback((text: string, source: ScanSource) => {
    setResult({ text, source });
    setError("");
    setCopied(false);
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
      setError("Camera scanning requires a secure browser connection and camera support. Try uploading an image instead.");
      return;
    }

    releaseCamera();
    setError("");
    setResult(null);
    setCameraStarting(true);
    setCameraScanning(false);

    const session = cameraSessionRef.current;

    try {
      const controls = await getReader().decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (decoded, _scanError, callbackControls) => {
          if (session !== cameraSessionRef.current) {
            callbackControls.stop();
            return;
          }

          if (!decoded) return;

          acceptResult(decoded.getText(), "camera");
          cameraSessionRef.current += 1;
          callbackControls.stop();
          controlsRef.current = null;
          stopVideoStream(videoRef.current);
          setCameraStarting(false);
          setCameraScanning(false);
        }
      );

      if (session !== cameraSessionRef.current) {
        controls.stop();
        return;
      }

      controlsRef.current = controls;
      setCameraStarting(false);
      setCameraScanning(true);
    } catch (cameraError) {
      if (session !== cameraSessionRef.current) return;

      stopVideoStream(videoRef.current);
      setCameraStarting(false);
      setCameraScanning(false);
      setError(getCameraErrorMessage(cameraError));
    }
  };

  const scanImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file containing a QR code.");
      return;
    }

    stopCamera();
    uploadSessionRef.current += 1;
    const session = uploadSessionRef.current;

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setSelectedFileName(file.name);
    setImageScanning(true);
    setError("");
    setResult(null);

    try {
      const decoded = await getReader().decodeFromImageUrl(objectUrl);

      if (session !== uploadSessionRef.current) return;
      acceptResult(decoded.getText(), "image");
    } catch {
      if (session !== uploadSessionRef.current) return;
      setError("No QR code was found in this image. Try a sharper image with the full code visible.");
    } finally {
      if (session === uploadSessionRef.current) {
        setImageScanning(false);
      }
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void scanImage(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files[0];
    if (file) void scanImage(file);
  };

  const handleTabChange = (value: string) => {
    const nextTab = value as ScanSource;
    setActiveTab(nextTab);
    setError("");

    if (nextTab !== "camera") {
      stopCamera();
    }
  };

  const copyResult = async () => {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
    } catch {
      setError("The result could not be copied. Select the text and copy it manually.");
    }
  };

  const resultUrl = result ? getWebUrl(result.text.trim()) : null;

  return (
    <div className="space-y-6">
      {result && (
        <Card
          ref={resultRef}
          className="border-primary bg-primary/5 shadow-[var(--notion-soft-shadow)] ring-1 ring-primary/10"
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>QR code found</CardTitle>
                <CardDescription>
                  Scanned from {result.source === "camera" ? "your camera" : "the uploaded image"}.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              readOnly
              value={result.text}
              aria-label="Decoded QR code content"
              className="min-h-32 resize-y bg-background font-mono text-sm"
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void copyResult()}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? "Copied" : "Copy result"}
              </Button>
              {resultUrl && (
                <Button asChild variant="outline">
                  <a href={resultUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden="true" />
                    Open link
                    <span className="sr-only"> in a new tab</span>
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-96">
          <TabsTrigger value="camera" className="py-2">
            <Camera aria-hidden="true" />
            Use camera
          </TabsTrigger>
          <TabsTrigger value="image" className="py-2">
            <ImageIcon aria-hidden="true" />
            Upload image
          </TabsTrigger>
        </TabsList>

        <TabsContent value="camera">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Scan with camera</CardTitle>
              <CardDescription>
                Point the rear camera at a QR code. Scanning stops as soon as a code is found.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative mx-auto aspect-video w-full max-w-2xl overflow-hidden rounded-xl bg-neutral-950">
                <video
                  ref={videoRef}
                  className={cn(
                    "size-full object-cover transition-opacity",
                    cameraScanning || cameraStarting ? "opacity-100" : "opacity-0"
                  )}
                  muted
                  playsInline
                  aria-label="Live camera preview for QR scanning"
                />

                {!cameraScanning && !cameraStarting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/70">
                    <VideoOff className="size-10" aria-hidden="true" />
                    <p className="max-w-sm text-sm">
                      Start the camera when you are ready. Your browser may ask for permission.
                    </p>
                  </div>
                )}

                {cameraStarting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                    <LoaderCircle className="size-8 animate-spin" aria-hidden="true" />
                    <span className="sr-only">Starting camera</span>
                  </div>
                )}

                {cameraScanning && (
                  <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]">
                    <span className="absolute left-1/2 top-0 h-0.5 w-4/5 -translate-x-1/2 animate-pulse bg-primary shadow-[0_0_12px_var(--primary)]" />
                    <span className="sr-only">Scanning for a QR code</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {cameraScanning || cameraStarting ? (
                  <Button variant="outline" onClick={stopCamera}>
                    <VideoOff aria-hidden="true" />
                    Stop camera
                  </Button>
                ) : (
                  <Button onClick={() => void startCamera()}>
                    <ScanLine aria-hidden="true" />
                    Start scanning
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image">
          <Card>
            <CardHeader>
              <CardTitle>Scan an image</CardTitle>
              <CardDescription>
                Choose, drag, or drop an image that contains a QR code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "flex min-h-64 w-full cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-dashed bg-muted/20 p-6 text-center outline-none transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring",
                  dragging && "border-primary bg-primary/5"
                )}
              >
                {previewUrl ? (
                  <>
                    {/* Blob URLs are local previews and cannot benefit from Next image optimization. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt={`Uploaded file preview: ${selectedFileName}`}
                      className="max-h-72 max-w-full rounded-lg object-contain"
                    />
                    <span className="max-w-full truncate text-sm text-muted-foreground">
                      {selectedFileName}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Upload className="size-6" aria-hidden="true" />
                    </span>
                    <span className="block">
                      <span className="block font-medium">Choose or drop an image</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        PNG, JPEG, WebP, GIF, or another browser-supported image
                      </span>
                    </span>
                  </>
                )}

                {imageScanning && (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    Looking for a QR code…
                  </span>
                )}
              </button>

              {previewUrl && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload aria-hidden="true" />
                    Choose another image
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p>
          Camera frames and uploaded images are decoded locally in your browser. Nothing is uploaded or stored.
        </p>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {cameraScanning
          ? "Camera scanning is active."
          : imageScanning
            ? "Scanning the uploaded image."
            : result
              ? "QR code found."
              : ""}
      </div>
    </div>
  );
}
