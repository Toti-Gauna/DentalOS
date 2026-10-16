// Motor de disponibilidad: intervalos [inicio, fin) que reservan profesional Y sillón en una sede compatible.
import { addDays, addMinutes, at, hhmmToMinutes, overlaps, parts, toMs, type Iso } from './time';
import type { Appointment, AppointmentStatus, Conflict, DemoState, SlotRef } from './types';

export const ACTIVE_STATUSES: AppointmentStatus[] = ['solicitada', 'confirmada', 'en_sala', 'en_atencion'];
export const OCCUPYING_STATUSES: AppointmentStatus[] = ['solicitada', 'confirmada', 'en_sala', 'en_atencion', 'finalizada', 'ausente'];

export const isActive = (a: Appointment) => ACTIVE_STATUSES.includes(a.status);
export const slotKey = (s: Pick<SlotRef, 'start' | 'professionalId' | 'chairId'>) => `${s.professionalId}|${s.chairId}|${s.start}`;

export interface ValidateOptions {
  ignoreAppointmentId?: string;
  personId?: string;
  ignoreOfferSlot?: boolean; // al aceptar una oferta, su propio hold no bloquea
  skipLeadCheck?: boolean; // recepción puede cargar en el día (igual valida pasado)
}

export function validateSlot(state: DemoState, slot: SlotRef, opts: ValidateOptions = {}): Conflict[] {
  const conflicts: Conflict[] = [];
  const st = state.serviceTypes.find((s) => s.id === slot.serviceTypeId);
  const pro = state.professionals.find((p) => p.id === slot.professionalId);
  const chair = state.chairs.find((c) => c.id === slot.chairId);
  const loc = state.locations.find((l) => l.id === slot.locationId);
  if (!st) return [{ code: 'SERVICIO_INEXISTENTE', message: 'El motivo elegido no existe.' }];
  if (!pro) return [{ code: 'PROFESIONAL_INEXISTENTE', message: 'La profesional elegida no existe.' }];
  if (!loc) return [{ code: 'SEDE_INEXISTENTE', message: 'La sede elegida no existe.' }];
  if (!chair) return [{ code: 'SILLON_INEXISTENTE', message: 'El sillón elegido no existe.' }];

  if (!pro.serviceTypeIds.includes(st.id)) conflicts.push({ code: 'SERVICIO_INCOMPATIBLE', message: `${pro.name} no atiende "${st.name}".` });
  if (chair.locationId !== loc.id) conflicts.push({ code: 'SEDE_INCOMPATIBLE', message: `${chair.name} no pertenece a ${loc.name}.` });
  if (toMs(slot.end) - toMs(slot.start) !== st.durationMin * 60_000) {
    conflicts.push({ code: 'DURACION', message: `"${st.name}" dura ${st.durationMin} minutos; el intervalo no coincide.` });
  }

  const now = state.clock;
  const startMs = toMs(slot.start);
  if (startMs < toMs(now)) {
    conflicts.push({ code: 'PASADO', message: 'El horario ya pasó en el reloj de la demo.' });
  } else if (!opts.skipLeadCheck && startMs < toMs(now) + state.settings.minLeadHours * 3_600_000) {
    conflicts.push({ code: 'ANTICIPACION_MINIMA', message: `Se necesitan al menos ${state.settings.minLeadHours} h de anticipación.` });
  }
  if (startMs >= toMs(now) + state.settings.horizonDays * 86_400_000) {
    conflicts.push({ code: 'FUERA_DE_HORIZONTE', message: `Solo se reservan turnos dentro de ${state.settings.horizonDays} días.` });
  }

  // Jornada: el intervalo completo debe caber en una regla del profesional en esa sede.
  const p = parts(slot.start);
  const endP = parts(slot.end);
  const fits = p.date === endP.date && state.availabilityRules.some((r) =>
    r.professionalId === pro.id && r.locationId === loc.id && r.weekday === p.weekday &&
    hhmmToMinutes(r.start) <= p.minutes && endP.minutes <= hhmmToMinutes(r.end));
  if (!fits) conflicts.push({ code: 'FUERA_DE_JORNADA', message: `${pro.name} no atiende en ${loc.name} en ese horario.` });

  for (const b of state.blocks) {
    const hits = (b.scope === 'professional' && b.targetId === pro.id) || (b.scope === 'chair' && b.targetId === chair.id) || (b.scope === 'location' && b.targetId === loc.id);
    if (hits && overlaps(b.start, b.end, slot.start, slot.end)) conflicts.push({ code: 'BLOQUEADO', message: `Horario bloqueado: ${b.reason}.`, refId: b.id });
  }

  for (const a of state.appointments) {
    if (a.id === opts.ignoreAppointmentId || !OCCUPYING_STATUSES.includes(a.status)) continue;
    if (!overlaps(a.start, a.end, slot.start, slot.end)) continue;
    if (a.professionalId === pro.id) conflicts.push({ code: 'PROFESIONAL_OCUPADO', message: `${pro.name} ya tiene un turno en ese horario.`, refId: a.id });
    if (a.chairId === chair.id) conflicts.push({ code: 'SILLON_OCUPADO', message: `${chair.name} ya está ocupado en ese horario.`, refId: a.id });
    if (opts.personId && a.personId === opts.personId && a.professionalId !== pro.id) {
      conflicts.push({ code: 'PACIENTE_OCUPADO', message: 'La persona ya tiene otro turno superpuesto.', refId: a.id });
    }
  }

  if (!opts.ignoreOfferSlot) {
    for (const o of state.offers) {
      if (o.status !== 'activa' || toMs(o.holdUntil) <= toMs(now)) continue;
      const sameResource = o.slot.professionalId === pro.id || o.slot.chairId === chair.id;
      if (sameResource && overlaps(o.slot.start, o.slot.end, slot.start, slot.end)) {
        conflicts.push({ code: 'RESERVADO_POR_OFERTA', message: 'Ese cupo está ofrecido a la lista de espera hasta que venza la oferta.', refId: o.id });
        break;
      }
    }
  }
  return conflicts;
}

export interface FindSlotsQuery {
  serviceTypeId: string;
  professionalId?: string | null;
  locationId?: string | null;
  from?: Iso;
  days?: number;
  limit?: number;
  period?: 'mañana' | 'tarde' | 'cualquiera';
  ignoreAppointmentId?: string;
  personId?: string;
  excludeKeys?: string[];
  ignoreOfferSlot?: boolean;
}

/** Busca cupos válidos en pasos de 15 minutos; orden determinista por fecha, profesional y sillón preferido. */
export function findSlots(state: DemoState, q: FindSlotsQuery): SlotRef[] {
  const st = state.serviceTypes.find((s) => s.id === q.serviceTypeId);
  if (!st) return [];
  const limit = q.limit ?? 6;
  const fromIso = q.from && toMs(q.from) > toMs(state.clock) ? q.from : state.clock;
  const startDate = parts(fromIso).date;
  const days = Math.min(q.days ?? state.settings.horizonDays, state.settings.horizonDays + 1);
  const pros = state.professionals.filter((p) => p.serviceTypeIds.includes(st.id) && (!q.professionalId || p.id === q.professionalId));
  const out: SlotRef[] = [];
  for (let d = 0; d <= days && out.length < limit; d++) {
    const date = addDays(startDate, d);
    const weekday = parts(at(date, '12:00')).weekday;
    const candidates: SlotRef[] = [];
    for (const pro of pros) {
      for (const rule of state.availabilityRules) {
        if (rule.professionalId !== pro.id || rule.weekday !== weekday) continue;
        if (q.locationId && rule.locationId !== q.locationId) continue;
        const chairs = [...state.chairs.filter((c) => c.locationId === rule.locationId)].sort((a, b) => {
          const ia = pro.preferredChairIds.indexOf(a.id); const ib = pro.preferredChairIds.indexOf(b.id);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        });
        for (let m = hhmmToMinutes(rule.start); m + st.durationMin <= hhmmToMinutes(rule.end); m += 15) {
          if (q.period === 'mañana' && m >= 13 * 60) continue;
          if (q.period === 'tarde' && m < 13 * 60) continue;
          const start = addMinutes(at(date, '00:00'), m);
          if (toMs(start) < toMs(fromIso)) continue;
          for (const chair of chairs) {
            const slot: SlotRef = { start, end: addMinutes(start, st.durationMin), professionalId: pro.id, chairId: chair.id, locationId: rule.locationId, serviceTypeId: st.id };
            if (q.excludeKeys?.includes(slotKey(slot))) continue;
            if (validateSlot(state, slot, { ignoreAppointmentId: q.ignoreAppointmentId, personId: q.personId, ignoreOfferSlot: q.ignoreOfferSlot }).length === 0) {
              candidates.push(slot);
              break; // un sillón por horario y profesional
            }
          }
        }
      }
    }
    candidates.sort((a, b) => toMs(a.start) - toMs(b.start) || a.professionalId.localeCompare(b.professionalId));
    for (const c of candidates) { if (out.length < limit) out.push(c); }
  }
  return out;
}

export function slotFor(state: DemoState, serviceTypeId: string, professionalId: string, chairId: string, start: Iso): SlotRef | null {
  const st = state.serviceTypes.find((s) => s.id === serviceTypeId);
  const chair = state.chairs.find((c) => c.id === chairId);
  if (!st || !chair) return null;
  return { start, end: addMinutes(start, st.durationMin), professionalId, chairId, locationId: chair.locationId, serviceTypeId };
}

/** Elige el primer sillón válido (preferencia del profesional) para un horario dado. */
export function resolveChair(state: DemoState, serviceTypeId: string, professionalId: string, locationId: string, start: Iso, opts: ValidateOptions = {}): { slot: SlotRef | null; conflicts: Conflict[] } {
  const pro = state.professionals.find((p) => p.id === professionalId);
  const chairs = state.chairs.filter((c) => c.locationId === locationId).sort((a, b) => {
    const ia = pro?.preferredChairIds.indexOf(a.id) ?? 99; const ib = pro?.preferredChairIds.indexOf(b.id) ?? 99;
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  let first: Conflict[] = [];
  for (const c of chairs) {
    const slot = slotFor(state, serviceTypeId, professionalId, c.id, start);
    if (!slot) continue;
    const conflicts = validateSlot(state, slot, opts);
    if (conflicts.length === 0) return { slot, conflicts: [] };
    if (first.length === 0) first = conflicts;
  }
  return { slot: null, conflicts: first.length ? first : [{ code: 'SIN_SILLON', message: 'No hay sillón en esa sede.' }] };
}
