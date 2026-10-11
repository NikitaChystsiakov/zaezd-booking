import { describe, expect, it } from 'vitest'
import { buildIcal, parseIcal } from './ical'

describe('ical', () => {
  it('разбирает то, что сам же собрал', () => {
    const text = buildIcal('Дом', [{ uid: 'a@gurtom', start: '2026-11-06', end: '2026-11-08', summary: 'Бронь, 8 гостей' }])
    expect(parseIcal(text)).toEqual([{ uid: 'a@gurtom', start: '2026-11-06', end: '2026-11-08', summary: 'Бронь, 8 гостей' }])
  })

  it('понимает даты со временем, перенос строк и событие без DTEND', () => {
    const text = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:1',
      'DTSTART;TZID=Europe/Minsk:20261201T140000',
      'DTEND;TZID=Europe/Minsk:20261203T120000',
      'SUMMARY:Длинное наз',
      ' вание',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:2',
      'DTSTART;VALUE=DATE:20261210',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    expect(parseIcal(text)).toEqual([
      { uid: '1', start: '2026-12-01', end: '2026-12-03', summary: 'Длинное название' },
      { uid: '2', start: '2026-12-10', end: '2026-12-11', summary: '' },
    ])
  })
})
