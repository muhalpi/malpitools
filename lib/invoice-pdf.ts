import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  senderAddress: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  taxRate: number;
  discountRate: number;
  notes: string;
  paymentDetails: string;
  accentColor: string;
  logoDataUrl: string;
  paymentQrDataUrl: string;
  items: InvoiceItem[];
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

function safeText(value: string): string {
  return value.replace(/[^\x20-\xFF\n]/g, "?");
}

function colorFromHex(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return rgb(0.02, 0.45, 0.87);
  return rgb(
    Number.parseInt(match[1], 16) / 255,
    Number.parseInt(match[2], 16) / 255,
    Number.parseInt(match[3], 16) / 255
  );
}

function money(value: number, currency: string): string {
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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safeText(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${current} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
      else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

function drawLines(
  page: PDFPage,
  lines: string[],
  options: { x: number; y: number; font: PDFFont; size: number; color?: ReturnType<typeof rgb>; lineHeight?: number }
): number {
  const lineHeight = options.lineHeight ?? options.size * 1.35;
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * lineHeight,
      font: options.font,
      size: options.size,
      color: options.color ?? rgb(0.18, 0.2, 0.24),
    });
  });
  return options.y - lines.length * lineHeight;
}

function drawRightAlignedText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>
) {
  const safe = safeText(text);
  page.drawText(safe, {
    x: rightX - font.widthOfTextAtSize(safe, size),
    y,
    font,
    size,
    color,
  });
}

function drawTableHeader(page: PDFPage, y: number, bold: PDFFont, accent: ReturnType<typeof rgb>) {
  page.drawRectangle({ x: MARGIN, y: y - 24, width: PAGE_WIDTH - MARGIN * 2, height: 24, color: accent });
  const labels = [
    ["QTY", MARGIN + 10],
    ["DESCRIPTION", MARGIN + 60],
    ["RATE", 410],
    ["AMOUNT", 493],
  ] as const;
  labels.forEach(([label, x]) => page.drawText(label, { x, y: y - 16, font: bold, size: 8, color: rgb(1, 1, 1) }));
  return y - 24;
}

async function embedDataImage(document: PDFDocument, dataUrl: string) {
  if (!dataUrl.startsWith("data:image/")) return null;
  try {
    const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (char) => char.charCodeAt(0));
    return dataUrl.startsWith("data:image/png")
      ? await document.embedPng(bytes)
      : await document.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function createInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const accent = colorFromHex(data.accentColor);
  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  if (data.logoDataUrl) {
    const image = await embedDataImage(document, data.logoDataUrl);
    if (image) {
      const dimensions = image.scaleToFit(64, 48);
      page.drawImage(image, { x: MARGIN, y: y - dimensions.height + 4, ...dimensions });
    }
  }

  page.drawText("INVOICE", { x: 410, y: y - 3, font: bold, size: 25, color: accent });
  page.drawText(safeText(data.invoiceNumber || "DRAFT"), { x: 410, y: y - 22, font: regular, size: 10, color: rgb(0.4, 0.42, 0.46) });

  const senderX = data.logoDataUrl ? 124 : MARGIN;
  page.drawText(safeText(data.senderName || "Your business"), { x: senderX, y, font: bold, size: 15, color: rgb(0.12, 0.14, 0.17) });
  const senderLines = [data.senderAddress, data.senderEmail, data.senderPhone].filter(Boolean).flatMap((line) => wrapText(line, regular, 8.5, 250));
  drawLines(page, senderLines, { x: senderX, y: y - 16, font: regular, size: 8.5, color: rgb(0.4, 0.42, 0.46), lineHeight: 11 });

  y -= 92;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: rgb(0.86, 0.87, 0.89) });
  y -= 24;
  page.drawText("BILL TO", { x: MARGIN, y, font: bold, size: 8, color: rgb(0.46, 0.48, 0.52) });
  page.drawText("ISSUED", { x: 355, y, font: bold, size: 8, color: rgb(0.46, 0.48, 0.52) });
  page.drawText("DUE", { x: 472, y, font: bold, size: 8, color: rgb(0.46, 0.48, 0.52) });
  page.drawText(safeText(data.clientName || "Client"), { x: MARGIN, y: y - 18, font: bold, size: 11, color: rgb(0.12, 0.14, 0.17) });
  const clientLines = [data.clientAddress, data.clientEmail].filter(Boolean).flatMap((line) => wrapText(line, regular, 8.5, 260));
  drawLines(page, clientLines, { x: MARGIN, y: y - 32, font: regular, size: 8.5, color: rgb(0.4, 0.42, 0.46), lineHeight: 11 });
  page.drawText(safeText(data.issueDate || "-"), { x: 355, y: y - 18, font: regular, size: 9.5, color: rgb(0.2, 0.22, 0.26) });
  page.drawText(safeText(data.dueDate || "-"), { x: 472, y: y - 18, font: regular, size: 9.5, color: rgb(0.2, 0.22, 0.26) });

  y -= 84;
  y = drawTableHeader(page, y, bold, accent);

  const addContinuationPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText(`INVOICE ${safeText(data.invoiceNumber)}`, { x: MARGIN, y, font: bold, size: 13, color: accent });
    page.drawText("Continued", { x: PAGE_WIDTH - MARGIN - 55, y, font: regular, size: 9, color: rgb(0.46, 0.48, 0.52) });
    y -= 24;
    y = drawTableHeader(page, y, bold, accent);
  };

  for (const item of data.items) {
    const descriptionLines = wrapText(item.description || "Item", regular, 9, 270);
    const rowHeight = Math.max(34, descriptionLines.length * 12 + 14);
    if (y - rowHeight < 170) addContinuationPage();

    page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: PAGE_WIDTH - MARGIN * 2, height: rowHeight, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x: MARGIN, y: y - rowHeight }, end: { x: PAGE_WIDTH - MARGIN, y: y - rowHeight }, thickness: 0.6, color: rgb(0.9, 0.91, 0.92) });
    page.drawText(String(item.quantity || 0), { x: MARGIN + 16, y: y - 21, font: regular, size: 9, color: rgb(0.25, 0.27, 0.31) });
    drawLines(page, descriptionLines, { x: MARGIN + 60, y: y - 20, font: regular, size: 9, lineHeight: 12 });
    drawRightAlignedText(page, money(item.unitPrice || 0, data.currency), 458, y - 21, regular, 8.5, rgb(0.3, 0.32, 0.36));
    drawRightAlignedText(page, money((item.quantity || 0) * (item.unitPrice || 0), data.currency), PAGE_WIDTH - MARGIN - 10, y - 21, bold, 8.5, rgb(0.18, 0.2, 0.24));
    y -= rowHeight;
  }

  const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = subtotal * (Math.max(0, data.discountRate) / 100);
  const tax = (subtotal - discount) * (Math.max(0, data.taxRate) / 100);
  const total = subtotal - discount + tax;

  const totals = [
    { label: "Subtotal", value: subtotal },
    ...(data.discountRate > 0 ? [{ label: `Discount (${data.discountRate}%)`, value: -discount }] : []),
    ...(data.taxRate > 0 ? [{ label: `Tax (${data.taxRate}%)`, value: tax }] : []),
  ];
  const totalsHeight = 22 + totals.length * 18 + 10 + 38;
  if (y - totalsHeight < 110) addContinuationPage();
  y -= 22;
  const totalsX = 360;
  totals.forEach(({ label, value }) => {
    page.drawText(label, { x: totalsX, y, font: regular, size: 9, color: rgb(0.38, 0.4, 0.44) });
    drawRightAlignedText(page, money(value, data.currency), PAGE_WIDTH - MARGIN - 10, y, regular, 9, rgb(0.2, 0.22, 0.26));
    y -= 18;
  });
  y -= 10;
  page.drawRectangle({ x: totalsX - 10, y: y - 34, width: 198, height: 34, color: accent });
  page.drawText("TOTAL", { x: totalsX, y: y - 22, font: bold, size: 9, color: rgb(1, 1, 1) });
  drawRightAlignedText(page, money(total, data.currency), PAGE_WIDTH - MARGIN - 10, y - 23, bold, 12, rgb(1, 1, 1));
  y -= 60;

  const paymentQr = await embedDataImage(document, data.paymentQrDataUrl);
  const hasPayment = data.paymentDetails.trim().length > 0 || paymentQr !== null;
  const hasNotes = data.notes.trim().length > 0;
  if (hasPayment || hasNotes) {
    const columnGap = 28;
    const columnWidth = (PAGE_WIDTH - MARGIN * 2 - columnGap) / 2;
    const notesX = MARGIN + columnWidth + columnGap;
    const qrSize = 64;
    const paymentTextX = paymentQr ? MARGIN + qrSize + 12 : MARGIN;
    const paymentTextWidth = paymentQr ? columnWidth - qrSize - 12 : columnWidth;
    const paymentLines = data.paymentDetails.trim()
      ? wrapText(data.paymentDetails, regular, 8.5, paymentTextWidth)
      : [];
    const noteLines = hasNotes ? wrapText(data.notes, regular, 8.5, columnWidth) : [];
    const paymentHeight = hasPayment ? 16 + Math.max(paymentLines.length * 11, paymentQr ? qrSize : 0) : 0;
    const notesHeight = hasNotes ? 16 + noteLines.length * 11 : 0;
    const detailsHeight = Math.max(paymentHeight, notesHeight);

    if (y - detailsHeight < MARGIN) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      page.drawText(`INVOICE ${safeText(data.invoiceNumber)}`, { x: MARGIN, y, font: bold, size: 13, color: accent });
      y -= 34;
    }

    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.6, color: rgb(0.9, 0.91, 0.92) });
    y -= 22;

    if (hasPayment) {
      page.drawText("PAYMENT DETAILS", { x: MARGIN, y, font: bold, size: 8, color: accent });
      if (paymentQr) {
        const dimensions = paymentQr.scaleToFit(qrSize, qrSize);
        page.drawImage(paymentQr, { x: MARGIN, y: y - 16 - dimensions.height, ...dimensions });
      }
      if (paymentLines.length > 0) {
        drawLines(page, paymentLines, { x: paymentTextX, y: y - 16, font: regular, size: 8.5, color: rgb(0.36, 0.38, 0.42), lineHeight: 11 });
      }
    }

    if (hasNotes) {
      page.drawText("NOTES & TERMS", { x: notesX, y, font: bold, size: 8, color: accent });
      drawLines(page, noteLines, { x: notesX, y: y - 16, font: regular, size: 8.5, color: rgb(0.36, 0.38, 0.42), lineHeight: 11 });
    }
  }

  document.setTitle(`Invoice ${data.invoiceNumber}`);
  document.setCreator("malpitools Invoice Generator");
  return document.save();
}
