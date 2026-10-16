// Reloj y fechas deterministas en America/Argentina/Buenos_Aires (UTC-03:00 fijo, sin horario de verano).
// Nunca usamos la zona del sistema ni Date.now para hechos de muestra.

export const TZ_LABEL = 'America/Argentina/Buenos_Aires';
const OFFSET_MIN = -180;
const MIN = 60_000;

export type Iso = string; // 'YYYY-MM-DDTHH:mm:00-03:00'

export function toMs(iso: Iso): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Fecha inválida: ${iso}`);
  return ms;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function fromMs(ms: number): Iso {
  const d = new Date(ms + OFFSET_MIN * MIN);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00-03:00`;
}

export function at(date: string, hhmm: string): Iso {
  return `${date}T${hhmm}:00-03:00`;
}

export function addMinutes(iso: Iso, minutes: number): Iso {
  return fromMs(toMs(iso) + minutes * MIN);
}

export function diffMinutes(a: Iso, b: Iso): number {
  return Math.round((toMs(a) - toMs(b)) / MIN);
}

export interface LocalParts { date: string; hhmm: string; weekday: number; minutes: number; day: number; month: number; year: number }

export function parts(iso: Iso): LocalParts {
  const d = new Date(toMs(iso) + OFFSET_MIN * MIN);
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    hhmm: `${pad(hh)}:${pad(mm)}`,
    weekday: d.getUTCDay(),
    minutes: hh * 60 + mm,
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function addDays(date: string, days: number): string {
  return parts(addMinutes(at(date, '12:00'), days * 1440)).date;
}

export function startOfWeek(date: string): string {
  const wd = parts(at(date, '12:00')).weekday; // 0 domingo
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const dayName = (weekday: number) => DAYS[weekday];

export function fmtDay(iso: Iso): string {
  const p = parts(iso);
  return `${DAYS[p.weekday]} ${p.day} de ${MONTHS[p.month - 1]}`;
}

export function fmtShort(iso: Iso): string {
  const p = parts(iso);
  return `${DAYS_SHORT[p.weekday]} ${p.day}/${pad(p.month)} · ${p.hhmm}`;
}

export function fmtLong(iso: Iso): string {
  const p = parts(iso);
  return `${DAYS[p.weekday]} ${p.day} de ${MONTHS[p.month - 1]}, ${p.hhmm} h`;
}

export function fmtTime(iso: Iso): string {
  return parts(iso).hhmm;
}

export function fmtDateOnly(date: string): string {
  return fmtDay(at(date, '12:00'));
}

export function overlaps(aStart: Iso, aEnd: Iso, bStart: Iso, bEnd: Iso): boolean {
  // Intervalos [inicio, fin): contiguos no se solapan.
  return toMs(aStart) < toMs(bEnd) && toMs(bStart) < toMs(aEnd);
}
