// Builds a one-page US Letter PDF poster with the QR code drawn as vector
// squares, so it prints sharp at any size. No PDF library needed.
import QRCode from "qrcode"

const PAGE_W = 612
const PAGE_H = 792

// PDF standard fonts only cover basic Latin; swap common typographic characters.
function pdfText(s: string) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/([\\()])/g, "\\$1")
}

// Measure with a canvas in Arial, which has the same widths as the PDF's
// Helvetica. Falls back to a rough estimate outside the browser.
let ctx: CanvasRenderingContext2D | null | undefined
function textWidth(s: string, size: number, bold: boolean) {
  if (ctx === undefined)
    ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d")
  if (!ctx) return s.length * size * (bold ? 0.56 : 0.5)
  ctx.font = `${bold ? "bold " : ""}${size}px Helvetica, Arial, sans-serif`
  return ctx.measureText(s).width
}

function wrap(text: string, size: number, maxWidth: number) {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (line && textWidth(next, size, true) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function centered(text: string, y: number, size: number, bold: boolean) {
  const x = (PAGE_W - textWidth(text, size, bold)) / 2
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfText(text)}) Tj ET`
}

export function buildPosterPdf({
  url,
  title,
  message,
}: {
  url: string
  title: string
  message: string
}) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" })
  const n = qr.modules.size
  const quiet = 2
  const qrSize = 320
  const cell = qrSize / (n + quiet * 2)
  const qrX = (PAGE_W - qrSize) / 2
  const qrY = 150

  const ops: string[] = []
  // Business name
  ops.push("0.4 0.4 0.45 rg", centered(title, 700, 18, false))
  // Headline
  ops.push("0.07 0.07 0.1 rg")
  wrap(message, 36, PAGE_W - 110).forEach((line, i) =>
    ops.push(centered(line, 640 - i * 44, 36, true)),
  )
  // QR code
  ops.push("0 0 0 rg")
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        const x = qrX + (c + quiet) * cell
        const y = qrY + qrSize - (r + quiet + 1) * cell
        ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${cell.toFixed(2)} ${cell.toFixed(2)} re`)
      }
    }
  }
  ops.push("f")
  // Instructions and link
  ops.push("0.07 0.07 0.1 rg", centered("Scan with your phone camera", 115, 20, true))
  ops.push("0.4 0.4 0.45 rg", centered(url, 88, 11, false))
  ops.push("0.6 0.6 0.65 rg", centered("Powered by One Marketing Command Center", 40, 9, false))

  const content = ops.join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ]

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([pdf], { type: "application/pdf" })
}
