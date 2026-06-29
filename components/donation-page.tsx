"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Check,
  Clipboard,
  Download,
  HeartHandshake,
  Landmark,
  QrCode,
  ShieldCheck,
  Smartphone,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATIC_QRIS =
  "00020101021126610014COM.GO-JEK.WWW01189360091436973596810210G6973596810303UMI51440014ID.CO.QRIS.WWW0215ID10253734280240303UMI5204504553033605802ID5921Dejitaru Shop, SMBKRP6008SURABAYA61056019562070703A016304C747";

const ACCOUNT_HOLDER = "Muhammad Alfi";

type DonationMethod = {
  id: string;
  name: string;
  number: string;
  Icon: LucideIcon;
  note: string;
};

const DONATION_METHODS: DonationMethod[] = [
  {
    id: "bca",
    name: "BCA",
    number: "8620415481",
    Icon: Landmark,
    note: "Transfer bank",
  },
  {
    id: "bri",
    name: "BRI",
    number: "313601028277532",
    Icon: Landmark,
    note: "Transfer bank",
  },
  {
    id: "seabank",
    name: "SeaBank",
    number: "901901068426",
    Icon: Landmark,
    note: "Transfer bank",
  },
  {
    id: "wallet",
    name: "ShopeePay / DANA / OVO / GoPay",
    number: "089514317357",
    Icon: Smartphone,
    note: "E-wallet",
  },
];

const PRESET_AMOUNTS = [10000, 25000, 50000, 100000];

function tlv(tag: string, value: string) {
  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

function parseTlv(payload: string) {
  const items: Array<[string, string]> = [];
  let i = 0;

  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const length = Number.parseInt(payload.slice(i + 2, i + 4), 10);
    const value = payload.slice(i + 4, i + 4 + length);

    items.push([tag, value]);
    i += 4 + length;
  }

  return items;
}

function crc16(data: string) {
  let crc = 0xffff;

  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function makeQrisNominal(staticQris: string, amount: number) {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error("Nominal tidak valid.");
  }

  const payload = staticQris.trim().replace(/6304[0-9A-Fa-f]{4}$/, "");
  const items = parseTlv(payload);
  let result = "";

  for (const [tag, rawValue] of items) {
    let value = rawValue;

    if (tag === "01") {
      value = "12";
    }

    if (tag === "54") {
      continue;
    }

    result += tlv(tag, value);

    if (tag === "53") {
      result += tlv("54", amount.toString());
    }
  }

  result += "6304";
  return result + crc16(result);
}

function sanitizeAmount(value: string) {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function parseAmount(value: string) {
  if (!value) return 0;
  return Number.parseInt(value, 10);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function DonationPage() {
  const [amount, setAmount] = useState("25000");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const amountValue = useMemo(() => parseAmount(amount), [amount]);
  const formattedAmount = amountValue > 0 ? formatRupiah(amountValue) : "Rp0";

  useEffect(() => {
    if (!amount) {
      setQrDataUrl(null);
      setError(null);
      setGenerating(false);
      return;
    }

    if (!Number.isInteger(amountValue) || amountValue < 1) {
      setQrDataUrl(null);
      setError("Nominal tidak valid.");
      setGenerating(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setGenerating(true);
      setError(null);

      try {
        const payload = makeQrisNominal(STATIC_QRIS, amountValue);
        const QRCodeStyling = (await import("qr-code-styling")).default;
        const qrCode = new QRCodeStyling({
          width: 320,
          height: 320,
          type: "svg",
          data: payload,
          margin: 14,
          qrOptions: {
            errorCorrectionLevel: "M",
          },
          dotsOptions: {
            type: "square",
            color: "#111111",
          },
          cornersSquareOptions: {
            type: "square",
            color: "#111111",
          },
          cornersDotOptions: {
            type: "square",
            color: "#111111",
          },
          backgroundOptions: {
            color: "#ffffff",
          },
        });

        const blob = await qrCode.getRawData("png");
        if (!cancelled && blob instanceof Blob) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setQrDataUrl(null);
          setError("QRIS belum bisa dibuat. Coba nominal lain.");
        }
      } finally {
        if (!cancelled) {
          setGenerating(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [amount, amountValue]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const copyText = async (id: string, value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiedId(id);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      setCopiedId(null);
    }
  };

  const downloadQris = () => {
    if (!qrDataUrl || amountValue < 1) return;

    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qris-donasi-${amountValue}.png`;
    link.click();
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      <section className="border-b border-border bg-primary/5">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-card px-3 py-1 text-sm font-medium text-foreground shadow-[var(--notion-soft-shadow)]">
              <HeartHandshake className="size-4 text-primary" aria-hidden="true" />
              Donasi untuk Malpitools
            </div>
            <div className="max-w-2xl space-y-3">
              <h1
                className="text-4xl font-bold leading-none text-foreground md:text-5xl"
              >
                Dukung pengembangan tools ini agar tetap ada dan gratis.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Kamu bisa berdonasi lewat transfer bank, e-wallet, atau QRIS.
                Semua rekening di bawah ini atas nama {ACCOUNT_HOLDER}.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-5 shadow-[var(--notion-soft-shadow)]">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold">QRIS resmi dan aman</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                QRIS ini resmi untuk halaman donasi ini dan aman digunakan. Kode
                tidak meminta PIN, OTP, kata sandi, atau akses akun, sehingga
                tidak membahayakan user.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Transfer bank dan e-wallet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Salin nomor tujuan, lalu lanjutkan dari aplikasi pembayaranmu.
              </p>
            </div>
            <div className="hidden size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
              <WalletCards className="size-5" aria-hidden="true" />
            </div>
          </div>

          <div className="grid gap-3">
            {DONATION_METHODS.map((method) => {
              const Icon = method.Icon;
              const isCopied = copiedId === method.id;

              return (
                <div
                  key={method.id}
                  className="rounded-lg border border-border bg-card p-4 shadow-[var(--notion-soft-shadow)]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{method.name}</h3>
                          <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {method.note}
                          </span>
                        </div>
                        <p className="break-all font-mono text-lg font-semibold text-foreground">
                          {method.number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          a.n. {ACCOUNT_HOLDER}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 rounded-[4px]"
                      onClick={() => copyText(method.id, method.number)}
                    >
                      {isCopied ? (
                        <>
                          <Check className="mr-2 size-4" aria-hidden="true" />
                          Tersalin
                        </>
                      ) : (
                        <>
                          <Clipboard className="mr-2 size-4" aria-hidden="true" />
                          Salin
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--notion-soft-shadow)]">
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <QrCode className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">QRIS donasi</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Selain rekening di atas, kamu bisa menggunakan QRIS resmi
                    dari halaman donasi.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="donation-amount">Nominal donasi</Label>
                <div className="relative">
                  <Banknote
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="donation-amount"
                    value={amount}
                    onChange={(event) => setAmount(sanitizeAmount(event.target.value))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="25000"
                    className="h-12 rounded-[4px] bg-background pl-10 font-mono text-base"
                    aria-describedby={error ? "qris-error" : "qris-amount-preview"}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                  {PRESET_AMOUNTS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={amountValue === preset ? "default" : "outline"}
                      size="sm"
                      className="h-9 rounded-[4px]"
                      onClick={() => setAmount(preset.toString())}
                      aria-pressed={amountValue === preset}
                    >
                      {formatRupiah(preset)}
                    </Button>
                  ))}
                </div>
                <p
                  id="qris-amount-preview"
                  className="text-sm text-muted-foreground"
                >
                  QRIS dibuat untuk nominal {formattedAmount}.
                </p>
                {error ? (
                  <p id="qris-error" role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                className="h-11 w-full rounded-[4px]"
                disabled={!qrDataUrl || generating}
                onClick={downloadQris}
              >
                <Download className="mr-2 size-4" aria-hidden="true" />
                Unduh QRIS
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-background p-5">
              <div className="flex aspect-square w-full max-w-[320px] items-center justify-center rounded-lg border border-border bg-card p-3">
                {generating ? (
                  <div className="text-center text-sm text-muted-foreground">
                    Membuat QRIS...
                  </div>
                ) : qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt={`QRIS donasi ${formattedAmount}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
                    <QrCode className="size-12" aria-hidden="true" />
                    Isi nominal untuk membuat QRIS.
                  </div>
                )}
              </div>

              <div className="w-full rounded-lg border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                  Cek sebelum bayar
                </div>
                Pastikan aplikasi pembayaran menampilkan nominal yang sama dan
                tidak pernah membagikan PIN, OTP, atau kata sandi ke siapa pun.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
