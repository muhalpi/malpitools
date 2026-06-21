"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import {
  Building2,
  Download,
  FileDown,
  ImageDown,
  ImagePlus,
  Landmark,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlob, downloadText } from "@/lib/download";
import type { InvoiceData, InvoiceItem } from "@/lib/invoice-pdf";

const CURRENCIES = ["USD", "EUR", "GBP", "IDR", "JPY", "AUD", "CAD", "SGD"] as const;

function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function newItem(description = "", quantity = 1, unitPrice = 0): InvoiceItem {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    description,
    quantity,
    unitPrice,
  };
}

function emptyInvoice(): InvoiceData {
  return {
    invoiceNumber: "INV-001",
    issueDate: dateOffset(0),
    dueDate: dateOffset(14),
    currency: "USD",
    senderName: "",
    senderEmail: "",
    senderPhone: "",
    senderAddress: "",
    clientName: "",
    clientEmail: "",
    clientAddress: "",
    taxRate: 0,
    discountRate: 0,
    notes: "Thank you for your business.",
    paymentDetails: "",
    accentColor: "#0075de",
    logoDataUrl: "",
    paymentQrDataUrl: "",
    items: [newItem()],
  };
}

function exampleInvoice(): InvoiceData {
  return {
    ...emptyInvoice(),
    invoiceNumber: "INV-1042",
    currency: "IDR",
    senderName: "Studio Malpi",
    senderEmail: "hello@example.com",
    senderPhone: "+62 812 3456 7890",
    senderAddress: "Jakarta, Indonesia",
    clientName: "Art Collector",
    clientEmail: "collector@example.com",
    clientAddress: "Bandung, Indonesia",
    taxRate: 11,
    notes: "Payment is due within 14 days. Thank you for supporting independent work.",
    paymentDetails: "BCA - 8390000000 - Studio Malpi",
    accentColor: "#e11d48",
    items: [
      newItem("Full body character commission", 1, 350000),
      newItem("Commercial use license", 1, 150000),
    ],
  };
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" || currency === "JPY" ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function safeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface PreviewProps {
  data: InvoiceData;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

function InvoicePreview({ data, subtotal, discount, tax, total }: PreviewProps) {
  return (
    <article className="min-h-[860px] w-full min-w-[620px] bg-white p-10 text-slate-900 shadow-sm" aria-label="Invoice preview">
      <header className="flex items-start justify-between gap-8">
        <div className="flex min-w-0 items-start gap-4">
          {data.logoDataUrl ? (
            <Image src={data.logoDataUrl} alt="Business logo" width={64} height={64} unoptimized className="size-16 rounded-lg object-contain" />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <Building2 className="size-7" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{data.senderName || "Your business"}</h2>
            {data.senderAddress && <p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-500">{data.senderAddress}</p>}
            {data.senderEmail && <p className="text-xs leading-5 text-slate-500">{data.senderEmail}</p>}
            {data.senderPhone && <p className="text-xs leading-5 text-slate-500">{data.senderPhone}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <h1 className="text-3xl font-black tracking-[0.18em]" style={{ color: data.accentColor }}>INVOICE</h1>
          <p className="mt-2 font-mono text-sm text-slate-500">#{data.invoiceNumber || "DRAFT"}</p>
        </div>
      </header>

      <section className="mt-10 grid grid-cols-[1fr_auto_auto] gap-10 border-y border-slate-200 py-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Bill to</p>
          <p className="mt-2 font-bold">{data.clientName || "Client name"}</p>
          {data.clientAddress && <p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-500">{data.clientAddress}</p>}
          {data.clientEmail && <p className="text-xs leading-5 text-slate-500">{data.clientEmail}</p>}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Issued</p>
          <p className="mt-2 font-mono text-sm font-semibold">{data.issueDate || "-"}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Due</p>
          <p className="mt-2 font-mono text-sm font-semibold">{data.dueDate || "-"}</p>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border border-slate-200">
        <div className="grid grid-cols-[56px_1fr_120px_120px] gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white" style={{ backgroundColor: data.accentColor }}>
          <span className="text-center">Qty</span><span>Description</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
        </div>
        {data.items.map((item) => (
          <div key={item.id} className="grid grid-cols-[56px_1fr_120px_120px] gap-2 border-t border-slate-100 px-4 py-4 text-sm">
            <span className="text-center font-mono text-slate-500">{item.quantity}</span>
            <span className="font-medium">{item.description || "Item description"}</span>
            <span className="text-right font-mono text-xs text-slate-500">{formatMoney(item.unitPrice, data.currency)}</span>
            <span className="text-right font-mono text-xs font-bold">{formatMoney(item.quantity * item.unitPrice, data.currency)}</span>
          </div>
        ))}
      </section>

      <section className="mt-6 ml-auto w-72 space-y-2">
        <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span className="font-mono">{formatMoney(subtotal, data.currency)}</span></div>
        {data.discountRate > 0 && <div className="flex justify-between text-sm text-slate-500"><span>Discount ({data.discountRate}%)</span><span className="font-mono">-{formatMoney(discount, data.currency)}</span></div>}
        {data.taxRate > 0 && <div className="flex justify-between text-sm text-slate-500"><span>Tax ({data.taxRate}%)</span><span className="font-mono">{formatMoney(tax, data.currency)}</span></div>}
        <div className="mt-3 flex items-center justify-between rounded-lg px-4 py-4 text-white" style={{ backgroundColor: data.accentColor }}>
          <span className="text-xs font-bold uppercase tracking-[0.14em] opacity-80">Total</span>
          <span className="font-mono text-lg font-bold">{formatMoney(total, data.currency)}</span>
        </div>
      </section>

      <footer className="mt-12 grid grid-cols-2 gap-12 border-t border-slate-200 pt-6">
        <div className="flex items-start gap-4">
          {data.paymentQrDataUrl && (
            <Image src={data.paymentQrDataUrl} alt="Payment QR code" width={72} height={72} unoptimized className="size-[72px] shrink-0 rounded-md border border-slate-200 object-contain" />
          )}
          <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Payment details</p>
          <p className="mt-2 whitespace-pre-line text-xs leading-5 text-slate-600">{data.paymentDetails || "Add payment instructions"}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Notes & terms</p>
          <p className="mt-2 whitespace-pre-line text-xs leading-5 text-slate-600">{data.notes || "No additional notes"}</p>
        </div>
      </footer>
    </article>
  );
}

export function InvoiceGeneratorTool() {
  const [data, setData] = useState<InvoiceData>(() => emptyInvoice());
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "image" | null>(null);
  const presetInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = subtotal * (Math.max(0, data.discountRate) / 100);
  const tax = (subtotal - discount) * (Math.max(0, data.taxRate) / 100);
  const total = subtotal - discount + tax;

  const updateField = <K extends keyof InvoiceData>(field: K, value: InvoiceData[K]) => {
    setData((current) => ({ ...current, [field]: value }));
  };

  const updateItem = (id: string, patch: Partial<InvoiceItem>) => {
    setData((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  };

  const removeItem = (id: string) => {
    setData((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  };

  const importPreset = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<InvoiceData>;
      const base = emptyInvoice();
      const items = Array.isArray(parsed.items) && parsed.items.length > 0
        ? parsed.items.map((item) => ({ ...newItem(), ...item, id: newItem().id }))
        : base.items;
      setData({ ...base, ...parsed, items });
      setStatus("Preset loaded");
    } catch {
      setStatus("Could not read that preset");
    } finally {
      event.target.value = "";
    }
  };

  const importImage = (event: ChangeEvent<HTMLInputElement>, field: "logoDataUrl" | "paymentQrDataUrl") => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Choose a PNG or JPEG image");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateField(field, String(reader.result ?? ""));
    reader.onerror = () => setStatus("Could not read that image");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const exportPreset = () => {
    downloadText(JSON.stringify(data, null, 2), `${data.invoiceNumber || "invoice"}-preset.json`, "application/json");
    setStatus("Preset downloaded");
  };

  const exportPdf = async () => {
    setExporting("pdf");
    setStatus("Creating PDF...");
    try {
      const { createInvoicePdf } = await import("@/lib/invoice-pdf");
      const bytes = await createInvoicePdf(data);
      const filename = (data.invoiceNumber || "invoice").replace(/[^a-z0-9_-]+/gi, "-");
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${filename}.pdf`);
      setStatus("PDF downloaded");
    } catch {
      setStatus("PDF export failed");
    } finally {
      setExporting(null);
    }
  };

  const exportImage = async () => {
    const preview = previewRef.current;
    if (!preview) return;

    setExporting("image");
    setStatus("Creating PNG...");
    try {
      await document.fonts.ready;
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(preview, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 2,
      });
      if (!blob) throw new Error("Image renderer returned no data");

      const filename = (data.invoiceNumber || "invoice").replace(/[^a-z0-9_-]+/gi, "-");
      downloadBlob(blob, `${filename}.png`);
      setStatus("PNG downloaded");
    } catch {
      setStatus("Image export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => { setData(exampleInvoice()); setStatus("Example loaded"); }}>
          <Plus className="size-4" /> Load example
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setData(emptyInvoice()); setStatus("Invoice cleared"); }}>
          <RotateCcw className="size-4" /> Clear
        </Button>
        <Button variant="outline" size="sm" onClick={() => presetInputRef.current?.click()}>
          <Upload className="size-4" /> Import preset
        </Button>
        <Button variant="outline" size="sm" onClick={exportPreset}>
          <FileDown className="size-4" /> Export preset
        </Button>
        <span className="ml-auto min-h-5 text-sm text-muted-foreground" role="status">{status}</span>
        <input ref={presetInputRef} type="file" accept="application/json,.json" className="hidden" onChange={importPreset} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(680px,1.2fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Invoice configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details"><UserRound />Details</TabsTrigger>
                <TabsTrigger value="brand"><Building2 />Brand</TabsTrigger>
                <TabsTrigger value="items"><Plus />Items</TabsTrigger>
                <TabsTrigger value="payment"><Landmark />Payment</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-5 pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="invoice-number">Invoice number</Label><Input id="invoice-number" value={data.invoiceNumber} onChange={(event) => updateField("invoiceNumber", event.target.value)} /></div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-currency">Currency</Label>
                    <select id="invoice-currency" value={data.currency} onChange={(event) => updateField("currency", event.target.value)} className="border-input h-9 w-full rounded-[4px] border bg-card px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20">
                      {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="issue-date">Issue date</Label><Input id="issue-date" type="date" value={data.issueDate} onChange={(event) => updateField("issueDate", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="due-date">Due date</Label><Input id="due-date" type="date" value={data.dueDate} onChange={(event) => updateField("dueDate", event.target.value)} /></div>
                </div>
                <div className="border-t pt-5">
                  <h3 className="mb-4 text-sm font-semibold">Client</h3>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label htmlFor="client-name">Name</Label><Input id="client-name" value={data.clientName} placeholder="Client or company name" onChange={(event) => updateField("clientName", event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="client-email">Email</Label><Input id="client-email" type="email" value={data.clientEmail} placeholder="client@example.com" onChange={(event) => updateField("clientEmail", event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="client-address">Address</Label><Textarea id="client-address" value={data.clientAddress} placeholder="Client billing address" onChange={(event) => updateField("clientAddress", event.target.value)} /></div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="brand" className="space-y-4 pt-4">
                <div className="space-y-2"><Label htmlFor="sender-name">Business name</Label><Input id="sender-name" value={data.senderName} placeholder="Your business" onChange={(event) => updateField("senderName", event.target.value)} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="sender-email">Email</Label><Input id="sender-email" type="email" value={data.senderEmail} placeholder="hello@example.com" onChange={(event) => updateField("senderEmail", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="sender-phone">Phone</Label><Input id="sender-phone" value={data.senderPhone} placeholder="+62 ..." onChange={(event) => updateField("senderPhone", event.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="sender-address">Address</Label><Textarea id="sender-address" value={data.senderAddress} placeholder="Business address" onChange={(event) => updateField("senderAddress", event.target.value)} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="accent-color">Accent colour</Label>
                    <div className="flex gap-2"><Input id="accent-color" type="color" value={data.accentColor} onChange={(event) => updateField("accentColor", event.target.value)} className="w-14 p-1" /><Input value={data.accentColor} onChange={(event) => updateField("accentColor", event.target.value)} aria-label="Accent colour hex value" /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <Button type="button" variant="outline" className="w-full" onClick={() => logoInputRef.current?.click()}><ImagePlus className="size-4" />Choose image</Button>
                    <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => importImage(event, "logoDataUrl")} />
                  </div>
                </div>
                {data.logoDataUrl && <Button type="button" variant="ghost" size="sm" onClick={() => updateField("logoDataUrl", "")}><Trash2 className="size-4" />Remove logo</Button>}
              </TabsContent>

              <TabsContent value="items" className="space-y-4 pt-4">
                {data.items.map((item, index) => (
                  <div key={item.id} className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between"><span className="text-sm font-semibold">Item {index + 1}</span><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove item ${index + 1}`} disabled={data.items.length === 1} onClick={() => removeItem(item.id)}><Trash2 className="size-4" /></Button></div>
                    <div className="space-y-2"><Label htmlFor={`description-${item.id}`}>Description</Label><Input id={`description-${item.id}`} value={item.description} placeholder="Service or product" onChange={(event) => updateItem(item.id, { description: event.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label htmlFor={`quantity-${item.id}`}>Quantity</Label><Input id={`quantity-${item.id}`} type="number" min="0" step="1" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: safeNumber(event.target.value) })} /></div>
                      <div className="space-y-2"><Label htmlFor={`price-${item.id}`}>Unit price</Label><Input id={`price-${item.id}`} type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: safeNumber(event.target.value) })} /></div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full" onClick={() => updateField("items", [...data.items, newItem()])}><Plus className="size-4" />Add line item</Button>
                <div className="grid grid-cols-2 gap-3 border-t pt-4">
                  <div className="space-y-2"><Label htmlFor="discount-rate">Discount %</Label><Input id="discount-rate" type="number" min="0" max="100" value={data.discountRate} onChange={(event) => updateField("discountRate", safeNumber(event.target.value))} /></div>
                  <div className="space-y-2"><Label htmlFor="tax-rate">Tax %</Label><Input id="tax-rate" type="number" min="0" value={data.taxRate} onChange={(event) => updateField("taxRate", safeNumber(event.target.value))} /></div>
                </div>
              </TabsContent>

              <TabsContent value="payment" className="space-y-4 pt-4">
                <div className="space-y-2"><Label htmlFor="payment-details">Payment details</Label><Textarea id="payment-details" value={data.paymentDetails} placeholder="Bank, account number, payment link, or instructions" className="min-h-28" onChange={(event) => updateField("paymentDetails", event.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Payment QR code (optional)</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => qrInputRef.current?.click()}><ImagePlus className="size-4" />Choose QR image</Button>
                    {data.paymentQrDataUrl && <Button type="button" variant="ghost" size="icon" aria-label="Remove payment QR code" onClick={() => updateField("paymentQrDataUrl", "")}><Trash2 className="size-4" /></Button>}
                  </div>
                  <input ref={qrInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => importImage(event, "paymentQrDataUrl")} />
                </div>
                <div className="space-y-2"><Label htmlFor="invoice-notes">Notes & terms</Label><Textarea id="invoice-notes" value={data.notes} placeholder="Payment terms or a short thank-you" className="min-h-28" onChange={(event) => updateField("notes", event.target.value)} /></div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b">
            <CardTitle>Live preview</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportImage} disabled={exporting !== null}>
                <ImageDown className="size-4" />{exporting === "image" ? "Creating PNG..." : "Download PNG"}
              </Button>
              <Button onClick={exportPdf} disabled={exporting !== null}>
                <Download className="size-4" />{exporting === "pdf" ? "Creating PDF..." : "Download PDF"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto bg-muted/40 p-4 sm:p-6">
            <div ref={previewRef} className="min-w-[620px]">
              <InvoicePreview data={data} subtotal={subtotal} discount={discount} tax={tax} total={total} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
