// Минимальный iCalendar (RFC 5545): экспорт занятости и разбор чужих лент.
// Google Календарь, Куфар, Реалт, Booking и Airbnb обмениваются занятостью именно так.

import { toISO, type ISODate } from './dates'

export type IcalEvent = { uid: string; start: ISODate; end: ISODate; summary: string }

const compact = (d: ISODate) => d.replaceAll('-', '')
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

export function buildIcal(calName: string, events: IcalEvent[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gurtom//Booking//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(calName)}`,
    ...events.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.start)}`,
      `DTEND;VALUE=DATE:${compact(e.end)}`,
      `SUMMARY:${escape(e.summary)}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}

/** Разбор ленты: только то, что нужно для занятости — UID, начало, конец, название */
export function parseIcal(text: string): IcalEvent[] {
  // Склеиваем перенесённые строки (RFC 5545 §3.1)
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
  const events: IcalEvent[] = []
  let cur: Partial<IcalEvent> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {}
    else if (line === 'END:VEVENT') {
      if (cur?.start) {
        const start = cur.start
        // Событие без DTEND длится один день
        const end = cur.end && cur.end > start ? cur.end : nextDay(start)
        events.push({ uid: cur.uid ?? `${start}-${end}`, start, end, summary: cur.summary ?? '' })
      }
      cur = null
    } else if (cur) {
      const idx = line.indexOf(':')
      if (idx < 0) continue
      const key = line.slice(0, idx).split(';')[0].toUpperCase()
      const value = line.slice(idx + 1)
      if (key === 'UID') cur.uid = value
      else if (key === 'SUMMARY') cur.summary = value.replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ')
      else if (key === 'DTSTART') cur.start = parseIcalDate(value)
      else if (key === 'DTEND') cur.end = parseIcalDate(value)
    }
  }
  return events
}

function parseIcalDate(v: string): ISODate | undefined {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined
}

function nextDay(iso: ISODate): ISODate {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return toISO(d)
}
