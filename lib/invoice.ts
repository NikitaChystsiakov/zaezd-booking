import { stripe } from '@/lib/stripe'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { promises as fs } from 'fs'
import path from 'path'

type AnyMeta = Record<string, string | undefined>

function formatMoney(num: number) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function safeJsonParse<T>(value: string | undefined, fallback: T): T {
  try {
    if (!value) return fallback
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export async function generateInvoicePdfBySessionId(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  const meta: AnyMeta = session.metadata ?? {}

  const itemsRaw = safeJsonParse<any[]>(meta.items, [])
  const items = Array.isArray(itemsRaw) ? itemsRaw : []

  const total = items.reduce((s: number, i: any) => {
    const price = Number(i.price) || 0
    const qty = Number(i.quantity) || 0
    return s + price * qty
  }, 0)

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto-Regular.ttf')
  const fontBytes = await fs.readFile(fontPath)
  const font = await pdfDoc.embedFont(fontBytes)

  const PAGE_W = 595
  const PAGE_H = 842
  const M = 50
  const CONTENT_W = PAGE_W - M * 2

  const colors = {
    text: rgb(0.08, 0.1, 0.12),
    muted: rgb(0.45, 0.5, 0.56),
    line: rgb(0.86, 0.89, 0.92),
    soft: rgb(0.97, 0.98, 0.99),
    soft2: rgb(0.94, 0.96, 0.98),
  }

  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - M

  const ensureSpace = (need: number) => {
    if (y - need < M) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - M
    }
  }

  const textWidth = (t: string, size: number) => font.widthOfTextAtSize(t, size)

  const wrapText = (t: string, size: number, maxWidth: number) => {
    const text = String(t ?? '').trim()
    if (!text) return ['']
    const words = text.split(/\s+/)
    const lines: string[] = []
    let line = ''

    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (textWidth(test, size) <= maxWidth) {
        line = test
      } else {
        if (line) lines.push(line)
        if (textWidth(w, size) > maxWidth) {
          let chunk = ''
          for (const ch of w) {
            const testChunk = chunk + ch
            if (textWidth(testChunk, size) <= maxWidth) chunk = testChunk
            else {
              if (chunk) lines.push(chunk)
              chunk = ch
            }
          }
          line = chunk
        } else {
          line = w
        }
      }
    }
    if (line) lines.push(line)
    return lines
  }

  const drawText = (t: string, x: number, size = 12, color = colors.text) => {
    page.drawText(t, { x, y, size, font, color })
  }

  const drawRight = (t: string, rightX: number, size = 12, color = colors.text) => {
    const w = textWidth(t, size)
    page.drawText(t, { x: rightX - w, y, size, font, color })
  }

  const moveDown = (px: number) => {
    y -= px
  }

  const drawParagraph = (
    t: string,
    { x, size = 12, maxWidth = CONTENT_W, lineGap = 4, color = colors.text }: any
  ) => {
    const lh = size + lineGap
    const lines = wrapText(t, size, maxWidth)
    ensureSpace(lines.length * lh + 6)
    for (const line of lines) {
      page.drawText(line, { x, y, size, font, color })
      y -= lh
    }
  }

  const drawHr = (gapTop = 10, gapBottom = 14) => {
    moveDown(gapTop)
    page.drawLine({
      start: { x: M, y },
      end: { x: PAGE_W - M, y },
      thickness: 1,
      color: colors.line,
    })
    moveDown(gapBottom)
  }

  const drawBox = (lines: string[], { x, w, padding = 12 }: any) => {
    const size = 12
    const lh = size + 4
    const boxH = padding * 2 + lines.length * lh + 6
    ensureSpace(boxH + 10)

    page.drawRectangle({
      x,
      y: y - boxH + 10,
      width: w,
      height: boxH,
      color: colors.soft,
      borderColor: colors.line,
      borderWidth: 1,
    })

    const startY = y - padding
    let yy = startY
    for (const line of lines) {
      page.drawText(line, { x: x + padding, y: yy, size, font, color: colors.text })
      yy -= lh
    }

    y = y - boxH - 10
  }

  ensureSpace(140)

  drawText('Timber&Grain', M, 26, colors.text)
  moveDown(36)

  const createdAt = new Date((session.created ?? 0) * 1000)
  const dt = createdAt.toISOString().replace('T', ' ').slice(0, 19)

  drawText('Квитанция об оплате', M, 14, colors.muted)
  drawRight(`Дата: ${dt}`, PAGE_W - M, 12, colors.muted)
  moveDown(18)

  drawHr(6, 10)

  const fio = [meta.last_name, meta.name, meta.second_name].filter(Boolean).join(' ')
  const deliveryHuman =
    meta.deliveryType === 'pickup'
      ? 'Самовывоз'
      : meta.deliveryType === 'home_delivery'
        ? 'Доставка'
        : ''

  const addressLine =
    meta.deliveryType === 'home_delivery'
      ? [meta.city, meta.street, meta.house].filter(Boolean).join(', ')
      : meta.deliveryType === 'pickup'
        ? 'Самовывоз'
        : ''

  const extraAddr = [
    meta.apartment ? `кв. ${meta.apartment}` : null,
    meta.entrance ? `подъезд ${meta.entrance}` : null,
    meta.floor ? `этаж ${meta.floor}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const customerLines: string[] = []
  customerLines.push('Данные покупателя')
  if (fio) customerLines.push(`ФИО: ${fio}`)
  if (meta.phone) customerLines.push(`Телефон: ${meta.phone}`)
  if (meta.email) customerLines.push(`Email: ${meta.email}`)
  if (deliveryHuman) customerLines.push(`Получение: ${deliveryHuman}`)
  if (addressLine) customerLines.push(`Адрес: ${addressLine}`)
  if (extraAddr) customerLines.push(`Дополнительно: ${extraAddr}`)
  if (meta.note) customerLines.push(`Комментарий: ${String(meta.note).slice(0, 180)}`)

  const boxedLines: string[] = []
  for (const l of customerLines) boxedLines.push(...wrapText(l, 12, CONTENT_W - 24))
  drawBox(boxedLines, { x: M, w: CONTENT_W, padding: 12 })

  ensureSpace(260)

  drawText('Состав заказа', M, 14, colors.text)
  moveDown(18)

  const colNoW = 28
  const colQtyW = 90
  const colSumW = 110
  const colNameW = CONTENT_W - colNoW - colQtyW - colSumW

  const xNo = M
  const xName = xNo + colNoW
  const xQty = xName + colNameW
  const xSum = xQty + colQtyW

  const headerH = 28
  page.drawRectangle({
    x: M,
    y: y - headerH + 8,
    width: CONTENT_W,
    height: headerH,
    color: colors.soft2,
    borderColor: colors.line,
    borderWidth: 1,
  })

  const headerY = y - 12
  page.drawText('№', { x: xNo + 8, y: headerY, size: 11, font, color: colors.muted })
  page.drawText('Товар', { x: xName + 8, y: headerY, size: 11, font, color: colors.muted })
  page.drawText('Кол-во', { x: xQty + 8, y: headerY, size: 11, font, color: colors.muted })
  page.drawText('Сумма', { x: xSum + 16, y: headerY, size: 11, font, color: colors.muted })

  moveDown(headerH + 6)

  const rowPaddingY = 10
  const baseRowH = 28

  items.forEach((it: any, idx: number) => {
    const productName = String(it.productName ?? 'Товар')
    const materialName = String(it.materialName ?? 'Материал')

    const qty = Number(it.quantity) || 0
    const price = Number(it.price) || 0
    const lineTotal = price * qty

    const nameText = `${productName} (${materialName})`
    const nameLines = wrapText(nameText, 12, colNameW - 16)
    const rowH = Math.max(baseRowH, rowPaddingY + nameLines.length * 16 + 8)

    ensureSpace(rowH + 8)

    page.drawRectangle({
      x: M,
      y: y - rowH + 8,
      width: CONTENT_W,
      height: rowH,
      borderColor: colors.line,
      borderWidth: 1,
    })

    page.drawText(String(idx + 1), { x: xNo + 8, y: y - 18, size: 12, font, color: colors.text })

    let yy = y - 18
    for (const line of nameLines) {
      page.drawText(line, { x: xName + 8, y: yy, size: 12, font, color: colors.text })
      yy -= 16
    }

    page.drawText(String(qty), { x: xQty + 18, y: y - 18, size: 12, font, color: colors.text })

    const sumText = `${formatMoney(lineTotal)} BYN`
    const sumW = textWidth(sumText, 12)
    page.drawText(sumText, {
      x: xSum + colSumW - 8 - sumW,
      y: y - 18,
      size: 12,
      font,
      color: colors.text,
    })

    moveDown(rowH + 6)
  })

  ensureSpace(120)

  moveDown(10)
  page.drawRectangle({
    x: M,
    y: y - 70,
    width: CONTENT_W,
    height: 70,
    color: colors.soft,
    borderColor: colors.line,
    borderWidth: 1,
  })

  page.drawText('Итого к оплате:', { x: M + 14, y: y - 22, size: 12, font, color: colors.muted })

  const totalText = `${formatMoney(total)} BYN`
  const totalW = textWidth(totalText, 22)
  page.drawText(totalText, {
    x: PAGE_W - M - 14 - totalW,
    y: y - 50,
    size: 22,
    font,
    color: colors.text,
  })

  y -= 95
  drawParagraph('Спасибо за покупку!', { x: M, size: 12, color: colors.muted, maxWidth: CONTENT_W })

  return await pdfDoc.save()
}
