import { normalize } from './core'
import { addDays, dayName, dateKeyOf, fmtDateShort, hhmm, weekdayOf } from './time'

// NLU determinista (sin IA real, sin red): minúsculas, sin acentos, sinónimos y expresiones regulares.

const NUM_WORDS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
}
const WEEKDAYS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 }

export function numberWord(n: number): string {
  const e = Object.entries(NUM_WORDS).find(([w, v]) => v === n && w !== 'un' && w !== 'una')
  return e ? e[0].replace('dieciseis', 'dieciséis') : String(n)
}

export function parseParty(n: string): number | null {
  let m = /(?:para|somos|de|x)\s+(\d{1,2})\b(?!\s*(?::|hs|h\b|de la))/.exec(n)
  if (m) return Number(m[1])
  m = /\b(\d{1,2})\s+(?:personas|comensales|pax|lugares)\b/.exec(n)
  if (m) return Number(m[1])
  for (const mm of n.matchAll(/(?:para|somos|mesa de|mesa para)\s+([a-z]+)\b/g)) {
    if (NUM_WORDS[mm[1]]) return NUM_WORDS[mm[1]]
  }
  m = /\b([a-z]+)\s+personas\b/.exec(n)
  if (m && NUM_WORDS[m[1]]) return NUM_WORDS[m[1]]
  return null
}

export interface TimeParse {
  startMin: number
  /** hora 1–11 sin indicar mañana/tarde: se resuelve contra el horario de atención */
  ambiguous12: boolean
  raw: number
}
export function parseTime(n: string, within?: (min: number) => boolean): TimeParse | null {
  let m = /\b(\d{1,2}):(\d{2})\b/.exec(n)
  if (m) return fix(Number(m[1]), Number(m[2]), n, within)
  m = /\ba las\s+(\d{1,2})(?:\s*(?:hs|h|horas))?(\s+y\s+(media|cuarto))?/.exec(n)
  if (m) return fix(Number(m[1]), m[3] === 'media' ? 30 : m[3] === 'cuarto' ? 15 : 0, n, within)
  m = /\ba las\s+([a-z]+)(\s+y\s+(media|cuarto))?/.exec(n)
  if (m && NUM_WORDS[m[1]] !== undefined && NUM_WORDS[m[1]] <= 12) return fix(NUM_WORDS[m[1]], m[3] === 'media' ? 30 : m[3] === 'cuarto' ? 15 : 0, n, within)
  m = /\b(\d{1,2})\s*(?:hs|h)\b/.exec(n)
  if (m) return fix(Number(m[1]), 0, n, within)
  return null
}
function fix(h: number, min: number, n: string, within?: (m: number) => boolean): TimeParse | null {
  if (h > 24 || min > 59) return null
  if (h === 24) h = 0
  let hour = h
  let ambiguous = false
  if (h >= 1 && h <= 11) {
    if (/\b(noche|tarde)\b/.test(n)) hour = h + 12
    else if (/de la manana/.test(n)) hour = h
    else {
      const am = h * 60 + min
      const pm = (h + 12) * 60 + min
      if (within) {
        const okAm = within(am)
        const okPm = within(pm)
        if (okPm && !okAm) hour = h + 12
        else if (okAm && !okPm) hour = h
        else {
          hour = h
          ambiguous = okAm && okPm
        }
      }
    }
  }
  return { startMin: hour * 60 + min, ambiguous12: ambiguous, raw: h }
}

export interface DateParse {
  dateKey?: string
  /** fecha libre ambigua → pedir confirmación */
  ambiguous?: boolean
  candidate?: string
  needsDay?: boolean
}
export function parseDate(n: string, nowMs: number, nowMin: number): DateParse | null {
  const today = dateKeyOf(nowMs)
  if (/\bpasado manana\b/.test(n)) return { dateKey: addDays(today, 2) }
  if (/\bmanana\b/.test(n) && !/\bde la manana\b/.test(n)) return { dateKey: addDays(today, 1) }
  if (/\bhoy\b/.test(n)) return { dateKey: today }
  for (const [name, wd] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(n)) {
      const cur = weekdayOf(today)
      // "el lunes" dicho un lunes = el día simulado de hoy (criterio del guion)
      void nowMin
      return { dateKey: addDays(today, (wd - cur + 7) % 7) }
    }
  }
  let m = /\b(\d{1,2})\/(\d{1,2})\b/.exec(n)
  if (m) {
    const y = Number(today.slice(0, 4))
    let dk = `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
    if (dk < today) dk = `${y + 1}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
    return { dateKey: dk, ambiguous: true, candidate: dk }
  }
  m = /\bel\s+(\d{1,2})\b(?!\s*(?::|hs|h\b))/.exec(n)
  if (m) {
    const day = Number(m[1])
    if (day >= 1 && day <= 31) {
      const [y, mo, d] = today.split('-').map(Number)
      let cand = new Date(Date.UTC(y, mo - 1, day))
      if (day < d) cand = new Date(Date.UTC(y, mo, day))
      const dk = `${cand.getUTCFullYear()}-${String(cand.getUTCMonth() + 1).padStart(2, '0')}-${String(cand.getUTCDate()).padStart(2, '0')}`
      return { ambiguous: true, candidate: dk }
    }
  }
  if (/\b(finde|fin de semana|semana que viene|proxima semana|pronto|esta semana|despues)\b/.test(n)) return { needsDay: true, ambiguous: true }
  return null
}

export type Intent =
  | 'greeting'
  | 'reserve'
  | 'cancel'
  | 'reschedule'
  | 'menu'
  | 'status'
  | 'order'
  | 'human'
  | 'dietary'
  | 'gluten'
  | 'webdone'
  | 'yes'
  | 'no'
  | 'thanks'
  | 'unknown'

const GREET = /^(hola+|holis|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|ola)\b/
export function detectIntent(raw: string): Intent {
  const n = normalize(raw)
  if (!n) return 'unknown'
  if (/\b(r|o)-\d{1,4}\b/.test(n)) return 'status'
  if (/\b(sin gluten|libre de gluten|sin tacc|libre de tacc)\b/.test(n)) return 'gluten'
  if (/\b(alergi|alergic|celiac|intoleran|frutos secos|mani\b|lactosa|restriccion alimentaria|vegano|vegetarian)/.test(n)) return 'dietary'
  if (/\b(ya lo hice|lo hice por la web|ya pedi|ya hice el pedido|pedi por la web)\b/.test(n)) return 'webdone'
  if (/\b(cancel|anular|dar de baja)/.test(n)) return 'cancel'
  if (/\b(cambiar|reprogram|mover|modificar|pasar)\b.*\b(reserva|fecha|hora|dia|mesa)\b/.test(n) || /\b(cambiar|reprogramar)\b/.test(n)) return 'reschedule'
  if (/\b(hablar con|equipo|humano|persona real|asesor|operador|recepcion)\b/.test(n)) return 'human'
  if (/\b(seguir|seguimiento|estado|donde esta|como va|folio)\b/.test(n) || /\b(mi pedido|mi reserva)\b/.test(n)) return 'status'
  if (GREET.test(n)) return 'greeting'
  if (/\b(reserv|mesa|lugar para|quiero ir|cupo)\b/.test(n)) return 'reserve'
  if (/\b(carta|menu|platos?|que hay|que tienen)\b/.test(n)) return 'menu'
  if (/\b(quiero|quisiera|queria|dame|pedir|pedido|me trae|un|una|dos|tres)\b/.test(n)) return 'order'
  if (/^(si|sii+|dale|ok|okay|confirmo|confirmar|claro|perfecto|de una|sip|yes)\b/.test(n)) return 'yes'
  if (/^(no|nop|nope|mejor no|cambiar)\b/.test(n)) return 'no'
  if (/\b(gracias|genial|buenisimo)\b/.test(n)) return 'thanks'
  return 'unknown'
}

export function summarizeDay(dateKey: string): string {
  return `${dayName(dateKey)} ${Number(dateKey.slice(8))}`
}
export function fmtSlot(dateKey: string, startMin: number): string {
  return `${fmtDateShort(dateKey)} a las ${hhmm(startMin)}`
}
