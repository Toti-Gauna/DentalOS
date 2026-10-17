// Contenido real y único para las tres propuestas: sale del store de la demo, así la comparación es justa.
import { useMemo } from 'react';
import { useDemo } from '../../app/store';
import { findSlots, type DemoState } from '../../domain';
import { byId, chairName, locName, personName, proName, serviceName, STATUS_LABEL, upcomingFor } from '../../domain/selectors';
import { parts } from '../../domain/time';

const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MON_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export interface AgendaItem { id: string; start: string; end: string; startMin: number; endMin: number; patient: string; service: string; pro: string; status: string; statusLabel: string }
export interface Content {
  person: { first: string; id: string };
  next: null | { id: string; chair: string; dateShort: string; service: string; dow: string; dowLong: string; day: number; month: string; monthLong: string; time: string; pro: string; loc: string; status: string; statusLabel: string; daysAway: number };
  today: { label: string; short: string; kpis: { label: string; value: number; hint: string }[]; chairs: { id: string; name: string; loc: string; items: AgendaItem[] }[]; fromMin: number; toMin: number; nowMin: number };
  booking: { service: string; minutes: number; days: { date: string; dow: string; day: number; count: number }[]; selectedDate: string; morning: string[]; afternoon: string[]; selectedTime: string | null };
  chat: { from: 'paciente' | 'clinica'; text: string; chips?: string[] }[];
}

const minutesOf = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

export function buildContent(s: DemoState): Content {
  const clock = parts(s.clock);
  const person = byId(s.persons, 'P-001');
  const nextAppt = person ? upcomingFor(s, person.id)[0] : undefined;
  const np = nextAppt ? parts(nextAppt.start) : null;
  const dayMs = 86_400_000;
  const next = nextAppt && np ? {
    id: nextAppt.id, chair: chairName(s, nextAppt.chairId), dateShort: `${String(np.day).padStart(2, '0')}/${String(np.month).padStart(2, '0')}`, service: serviceName(s, nextAppt.serviceTypeId), dow: DOW[np.weekday], dowLong: DOW_LONG[np.weekday], day: np.day,
    month: MON[np.month - 1], monthLong: MON_LONG[np.month - 1], time: np.hhmm, pro: proName(s, nextAppt.professionalId), loc: locName(s, nextAppt.locationId),
    status: nextAppt.status, statusLabel: STATUS_LABEL[nextAppt.status] ?? nextAppt.status,
    daysAway: Math.round((Date.parse(`${np.date}T00:00:00Z`) - Date.parse(`${clock.date}T00:00:00Z`)) / dayMs),
  } : null;

  const todays = s.appointments.filter((a) => parts(a.start).date === clock.date && a.status !== 'cancelada');
  const items = (chairId: string): AgendaItem[] => todays.filter((a) => a.chairId === chairId).map((a) => {
    const st = parts(a.start).hhmm; const en = parts(a.end).hhmm;
    return { id: a.id, start: st, end: en, startMin: minutesOf(st), endMin: minutesOf(en), patient: personName(s, a.personId), service: serviceName(s, a.serviceTypeId), pro: proName(s, a.professionalId), status: a.status, statusLabel: STATUS_LABEL[a.status] ?? a.status };
  }).sort((x, y) => x.startMin - y.startMin);
  const chairs = s.chairs.map((c) => ({ id: c.id, name: chairName(s, c.id), loc: locName(s, c.locationId), items: items(c.id) }));
  const all = chairs.flatMap((c) => c.items);
  const fromMin = Math.min(9 * 60, ...all.map((i) => i.startMin));
  const toMin = Math.max(16 * 60, ...all.map((i) => i.endMin));

  const service = byId(s.serviceTypes, 'ST-PRIMERA');
  const slots = findSlots(s, { serviceTypeId: 'ST-PRIMERA', days: 7, limit: 400 });
  const byDate = new Map<string, Set<string>>();
  for (const sl of slots) { const p = parts(sl.start); if (!byDate.has(p.date)) byDate.set(p.date, new Set()); byDate.get(p.date)!.add(p.hhmm); }
  const days = [...byDate.entries()].slice(0, 5).map(([date, set]) => { const p = parts(`${date}T12:00:00-03:00`); return { date, dow: DOW[p.weekday], day: p.day, count: set.size }; });
  const selectedDate = days[1]?.date ?? days[0]?.date ?? clock.date;
  const times = [...(byDate.get(selectedDate) ?? [])].sort();
  const morning = times.filter((t) => minutesOf(t) < 13 * 60);
  const afternoon = times.filter((t) => minutesOf(t) >= 13 * 60);

  return {
    person: { first: person?.firstName ?? 'Paciente', id: person?.id ?? '—' },
    next,
    today: {
      label: `${DOW_LONG[clock.weekday]} ${clock.day} de ${MON_LONG[clock.month - 1]}`,
      short: `${DOW[clock.weekday]} ${clock.day}/${String(clock.month).padStart(2, '0')}`,
      kpis: [
        { label: 'Turnos hoy', value: todays.length, hint: 'sin cancelados' },
        { label: 'Confirmados', value: todays.filter((a) => a.status === 'confirmada').length, hint: 'por recepción o paciente' },
        { label: 'Por confirmar', value: todays.filter((a) => a.status === 'solicitada').length, hint: 'solicitudes de hoy' },
        { label: 'Sillones en uso', value: chairs.filter((c) => c.items.length > 0).length, hint: `de ${chairs.length}` },
      ],
      chairs, fromMin, toMin, nowMin: minutesOf(clock.hhmm),
    },
    booking: { service: service?.name ?? 'Primera consulta', minutes: service?.durationMin ?? 45, days, selectedDate, morning, afternoon, selectedTime: morning[0] ?? afternoon[0] ?? null },
    chat: [
      { from: 'paciente', text: 'Hola, quiero cambiar mi turno del jueves.' },
      { from: 'clinica', text: next ? `Encontré tu turno ${next.id} · ${next.service}, ${next.dow} ${next.day}/${String(np!.month).padStart(2, '0')} a las ${next.time}. ¿Qué día te queda mejor?` : '¿Qué turno querés cambiar?', chips: ['mar 20/10 · 10:00', 'Otro día'] },
      { from: 'paciente', text: 'mar 20/10 · 10:00' },
      { from: 'clinica', text: 'Ese horario ya está ocupado: conservamos tu turno actual. Puedo ofrecerte:', chips: ['mar 20/10 · 11:00', 'mié 21/10 · 15:00'] },
      { from: 'paciente', text: 'mar 20/10 · 11:00' },
      { from: 'clinica', text: next ? `Listo: ${next.id} pasa al martes 20/10 a las 11:00 (versión 2). El recordatorio anterior quedó anulado.` : 'Listo.' },
    ],
  };
}

export function useProposalContent(): Content {
  const s = useDemo();
  return useMemo(() => buildContent(s), [s]);
}
