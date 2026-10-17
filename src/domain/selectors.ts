// Selectores derivados: ningún KPI se guarda ni se hardcodea; todo se calcula desde el store.
import { ACTIVE_STATUSES } from './scheduling';
import { hhmmToMinutes, overlaps, parts, toMs, addDays, at } from './time';
import type { Appointment, DemoState, Estimate } from './types';

export const byId = <T extends { id: string }>(list: T[], id: string | null | undefined): T | undefined => list.find((x) => x.id === id);
export const personName = (s: DemoState, id: string | null | undefined) => {
  const p = byId(s.persons, id);
  return p ? `${p.firstName} ${p.lastName}` : 'Sin identificar';
};
export const personLabel = (s: DemoState, id: string | null | undefined) => (id ? `${personName(s, id)} · ${id}` : 'Sin identificar');
export const serviceName = (s: DemoState, id: string) => byId(s.serviceTypes, id)?.name ?? id;
export const proName = (s: DemoState, id: string) => byId(s.professionals, id)?.name ?? id;
export const locName = (s: DemoState, id: string) => byId(s.locations, id)?.name ?? id;
export const chairName = (s: DemoState, id: string) => byId(s.chairs, id)?.name ?? id;
export const staffName = (s: DemoState, id: string | null) => (id ? byId(s.staff, id)?.name ?? id : 'Sin responsable');

export const sortByStart = (a: Appointment, b: Appointment) => toMs(a.start) - toMs(b.start);

export function upcomingFor(s: DemoState, personId: string) {
  return s.appointments.filter((a) => a.personId === personId && ACTIVE_STATUSES.includes(a.status) && toMs(a.end) > toMs(s.clock)).sort(sortByStart);
}
export function pastFor(s: DemoState, personId: string) {
  return s.appointments.filter((a) => a.personId === personId && !upcomingFor(s, personId).includes(a)).sort((a, b) => sortByStart(b, a));
}
export function dependentsOf(s: DemoState, personId: string) {
  return s.responsibleLinks.filter((l) => l.responsibleId === personId).map((l) => ({ link: l, person: byId(s.persons, l.dependentId)! })).filter((x) => x.person);
}
export function responsibleOf(s: DemoState, personId: string) {
  return s.responsibleLinks.filter((l) => l.dependentId === personId).map((l) => byId(s.persons, l.responsibleId)).filter(Boolean);
}
/** Quién puede aceptar o rechazar un presupuesto de esta persona: ella misma si es adulta; si es menor, sus responsables. */
export function decidersFor(s: DemoState, personId: string) {
  const p = byId(s.persons, personId);
  if (!p) return [];
  return p.kind === 'menor' ? responsibleOf(s, personId).filter((x): x is NonNullable<typeof x> => !!x && x.kind === 'adulto') : [p];
}
export function homonymsOf(s: DemoState, personId: string) {
  const p = byId(s.persons, personId);
  if (!p) return [];
  return s.persons.filter((x) => x.id !== p.id && x.firstName.toLowerCase() === p.firstName.toLowerCase() && x.lastName.toLowerCase() === p.lastName.toLowerCase());
}

export function estimateTotals(s: DemoState, e: Estimate) {
  const total = s.estimateLines.filter((l) => l.estimateId === e.id).reduce((acc, l) => acc + l.qty * l.unitMinor, 0);
  const paid = s.ledger.filter((l) => l.estimateId === e.id).reduce((acc, l) => acc + l.amountMinor, 0);
  return { total, paid, balance: e.status === 'aceptado' ? total - paid : null };
}

export function ledgerNet(s: DemoState, personId?: string) {
  return s.ledger.filter((l) => !personId || l.personId === personId).reduce((acc, l) => acc + l.amountMinor, 0);
}

export const money = (minor: number) => {
  const sign = minor < 0 ? '−' : '';
  const abs = Math.abs(minor);
  const ints = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$ ${ints},${String(abs % 100).padStart(2, '0')}`;
};

export interface Ratio { num: number; den: number; label: string; detail: string }
export const ratioText = (r: Ratio) => (r.den === 0 ? 'Sin datos (n=0)' : `${Math.round((r.num / r.den) * 100)} %`);

export interface KpiFilter { from: string; to: string; professionalId?: string; locationId?: string; status?: string }

export function filteredAppointments(s: DemoState, f: KpiFilter) {
  return s.appointments.filter((a) =>
    overlaps(a.start, a.end, at(f.from, '00:00'), at(addDays(f.to, 1), '00:00')) &&
    (!f.professionalId || a.professionalId === f.professionalId) &&
    (!f.locationId || a.locationId === f.locationId) &&
    (!f.status || a.status === f.status));
}

export function computeKpis(s: DemoState, f: KpiFilter) {
  const all = filteredAppointments(s, { ...f, status: undefined });
  const notCancelled = all.filter((a) => a.status !== 'cancelada');
  const now = toMs(s.clock);
  const future = notCancelled.filter((a) => toMs(a.start) > now && (a.status === 'confirmada' || a.status === 'solicitada'));
  const past = notCancelled.filter((a) => a.status === 'finalizada' || a.status === 'ausente');

  // Ocupación: minutos reservados / minutos de jornada (sin bloqueos) en el intervalo y filtros.
  let available = 0;
  for (let d = f.from; d <= f.to; d = addDays(d, 1)) {
    const wd = parts(at(d, '12:00')).weekday;
    for (const r of s.availabilityRules) {
      if (r.weekday !== wd || (f.professionalId && r.professionalId !== f.professionalId) || (f.locationId && r.locationId !== f.locationId)) continue;
      available += hhmmToMinutes(r.end) - hhmmToMinutes(r.start);
    }
    if (d > addDays(f.from, 62)) break;
  }
  const booked = notCancelled.reduce((acc, a) => acc + (toMs(a.end) - toMs(a.start)) / 60_000, 0);

  const tasksOpen = s.tasks.filter((t) => t.status !== 'resuelta');
  const learningOpened = s.learning.filter((l) => l.opens > 0 || l.state !== 'nuevo');
  return {
    n: all.length,
    active: notCancelled.filter((a) => ACTIVE_STATUSES.includes(a.status)).length,
    cancelled: all.length - notCancelled.length,
    pendingConfirmation: notCancelled.filter((a) => a.status === 'solicitada').length,
    confirmation: { num: future.filter((a) => a.status === 'confirmada').length, den: future.length, label: 'Turnos futuros confirmados', detail: 'confirmadas / (confirmadas + solicitadas) futuras; canceladas excluidas' } as Ratio,
    noShow: { num: past.filter((a) => a.status === 'ausente').length, den: past.length, label: 'Ausencias registradas', detail: 'ausentes / (finalizadas + ausentes)' } as Ratio,
    occupancy: { num: booked, den: available, label: 'Ocupación de jornada', detail: 'minutos reservados no cancelados / minutos de jornada' } as Ratio,
    tasksOpen: tasksOpen.length,
    tasksUnassigned: tasksOpen.filter((t) => !t.assigneeId).length,
    tasksOverdue: tasksOpen.filter((t) => t.dueAt && toMs(t.dueAt) < now).length,
    requestsPending: s.requests.filter((r) => r.status === 'pendiente' || r.status === 'asignada').length,
    outboxDelivered: s.outbox.filter((o) => o.status === 'entregado_simulado').length,
    outboxVoided: s.outbox.filter((o) => o.status === 'anulado').length,
    outboxBlocked: s.outbox.filter((o) => o.status === 'bloqueado_optout' || o.status === 'sin_cupo').length,
    estimatesIssued: s.estimates.filter((e) => e.status === 'emitido').length,
    estimatesAccepted: s.estimates.filter((e) => e.status === 'aceptado'),
    acceptedTotal: s.estimates.filter((e) => e.status === 'aceptado').reduce((acc, e) => acc + estimateTotals(s, e).total, 0),
    ledgerNet: ledgerNet(s),
    learning: { num: s.learning.filter((l) => l.state === 'comprendido' || l.state === 'completo').length, den: learningOpened.length, label: 'Tarjetas comprendidas', detail: 'comprendidas o completas / abiertas (ilustrativo)' } as Ratio,
  };
}

export const STATUS_LABEL: Record<string, string> = {
  solicitada: 'Pendiente de confirmación', confirmada: 'Confirmado', en_sala: 'En sala', en_atencion: 'En atención', finalizada: 'Finalizado', ausente: 'Ausente', cancelada: 'Cancelado',
  pendiente: 'Pendiente', asignada: 'Asignada', resuelta: 'Resuelta', descartada: 'Descartada', abierta: 'Abierta', en_curso: 'En curso',
  programado: 'Programado', entregado_simulado: 'Entregado (simulado)', anulado: 'Anulado', bloqueado_optout: 'Bloqueado por opt-out', sin_cupo: 'Sin cupo de muestra',
  borrador: 'Borrador', emitido: 'Emitido', aceptado: 'Aceptado (no cobrado)', rechazado: 'Rechazado', vencido: 'Vencido',
  activa: 'Activa', vencida: 'Vencida', aceptada: 'Aceptada', rechazada: 'Rechazada', tomada_por_otro: 'Tomada por otra persona', retirada: 'Retirada',
  derivada: 'Derivada', esperando_paciente: 'Esperando paciente', cerrada: 'Cerrada',
  indicado: 'Indicado', reservado: 'Reservado', realizado: 'Realizado', planificado: 'Planificado',
};
