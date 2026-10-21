import QRCode from 'qrcode'

export interface TableQrEntry {
  number: number
  url: string
}

const CELL = 260
const QR = 220
const COLS = 4
const PAD = 20

/** Compone un único PNG (grilla de QRs con rótulo "Mesa N") con <canvas> y lo descarga. */
export async function downloadAllTableQrs(
  entries: TableQrEntry[],
  fileName = 'mesas-qr.png',
): Promise<void> {
  const cols = Math.min(COLS, entries.length)
  const rows = Math.ceil(entries.length / COLS)
  const sheet = document.createElement('canvas')
  sheet.width = cols * CELL + PAD * 2
  sheet.height = rows * (CELL + 20) + PAD * 2
  const ctx = sheet.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, sheet.width, sheet.height)
  ctx.fillStyle = '#111111'
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'

  for (let i = 0; i < entries.length; i++) {
    const tmp = document.createElement('canvas')
    await QRCode.toCanvas(tmp, entries[i].url, { width: QR, margin: 1, errorCorrectionLevel: 'M' })
    const x = PAD + (i % COLS) * CELL
    const y = PAD + Math.floor(i / COLS) * (CELL + 20)
    ctx.drawImage(tmp, x + (CELL - QR) / 2, y)
    ctx.fillText(`Mesa ${entries[i].number}`, x + CELL / 2, y + QR + 28)
  }

  const anchor = document.createElement('a')
  anchor.href = sheet.toDataURL('image/png')
  anchor.download = fileName
  anchor.click()
}
