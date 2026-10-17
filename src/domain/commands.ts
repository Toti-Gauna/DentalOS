// Comandos puros y atómicos. Cada comando trabaja sobre una copia; si falla, el estado original no cambia.
// Idempotencia: el resultado de cada commandId aplicado se guarda y se devuelve ante reintentos.
import { addMinutes, fmtShort, parts, toMs, type Iso } from './time';
import { ACTIVE_STATUSES, findSlots, isActive, resolveChair, slotFor, slotKey, validateSlot } from './scheduling';
import { reminderText } from './seed';
import { LEARNING_CARDS } from './learning';
import type {
  Appointment, AppointmentStatus, Block, CallLine, CallSession, Channel, CommandResult, CommandResultErr, CommandResultOk,
  DemoSettings, DemoState, OutboxKind, Person, Request, RequestKind, RequestStatus, SlotRef, Surface, Task, TaskKind,
} from './types';

export class DomainError extends Error {
  constructor(public result: CommandResultErr) { super(result.message); }
}
const fail = (code: string, message: string, extra: Partial<CommandResultErr> = {}): never => {
  throw new DomainError({ ok: false, code, message, ...extra });
};
const ok = (message: string, ids?: Record<string, string>, info?: Record<string, unknown>): CommandResultOk => ({ ok: true, message, ids, info });

const WIDTH: Record<string, number> = { A: 4, M: 4, O: 4, EV: 4 };
export function nextId(d: DemoState, prefix: string): string {
  const n = (d.seq[prefix] ?? 0) + 1;
  d.seq[prefix] = n;
  return `${prefix}-${String(n).padStart(WIDTH[prefix] ?? 3, '0')}`;
}

function audit(d: DemoState, commandId: string, type: string, entity: string, entityId: string, detail: string) {
  d.audit.push({ id: nextId(d, 'EV'), at: d.clock, type, entity, entityId, detail, commandId });
}

/** Simulador: fuerza el fallo del siguiente commit para probar que nada se pierde. */
function commitGate(d: DemoState) {
  if (d.settings.failNextCommits > 0) fail('COMMIT_FALLIDO', 'Error simulado al guardar. No se aplicó ningún cambio.');
}

/** Reglas locales que el operador puede pausar. El resto es obligatorio (seguridad, consistencia o derivación humana). */
export const TOGGLEABLE_RULES = ['A05', 'A06', 'A09'] as const;
const ruleOn = (d: DemoState, id: string) => d.automationRules.find((r) => r.id === id)?.enabled !== false;

const getAppt = (d: DemoState, id: string) => d.appointments.find((a) => a.id === id) ?? fail('NO_EXISTE', `No existe el turno ${id}.`);
const getPerson = (d: DemoState, id: string) => d.persons.find((p) => p.id === id) ?? fail('PERSONA_INEXISTENTE', `No existe la persona ${id}.`);
const personName = (d: DemoState, id: string | null) => {
  const p = d.persons.find((x) => x.id === id);
  return p ? `${p.firstName} ${p.lastName} (${p.id})` : 'Persona sin identificar';
};
const serviceName = (d: DemoState, id: string) => d.serviceTypes.find((s) => s.id === id)?.name ?? id;

// ---------- Outbox (todo simulado) ----------
function addOutbox(d: DemoState, kind: OutboxKind, a: Appointment, text: string, status: 'programado' | 'entregado_simulado' | 'bloqueado_optout', dueAt: Iso, ruleId: string) {
  const dedupeKey = `${kind === 'recordatorio_24h' ? 'rem' : kind}:${a.id}:v${a.version}:${kind === 'recordatorio_24h' ? '24h' : d.clock}`;
  if (d.outbox.some((o) => o.dedupeKey === dedupeKey)) return;
  d.outbox.push({ id: nextId(d, 'O'), kind, appointmentId: a.id, appointmentVersion: a.version, personId: a.personId, channel: 'whatsapp', dedupeKey, status, dueAt, createdAt: d.clock, text, ruleId });
}
function scheduleReminder(d: DemoState, a: Appointment) {
  const p = d.persons.find((x) => x.id === a.personId);
  const due = addMinutes(a.start, -d.settings.reminderLeadHours * 60);
  addOutbox(d, 'recordatorio_24h', a, reminderText(a), p && !p.reminderOptIn ? 'bloqueado_optout' : 'programado', toMs(due) < toMs(d.clock) ? d.clock : due, 'A05');
}
function voidReminders(d: DemoState, appointmentId: string) {
  for (const o of d.outbox) if (o.appointmentId === appointmentId && o.status === 'programado') o.status = 'anulado';
}
function notify(d: DemoState, kind: OutboxKind, a: Appointment, text: string, ruleId: string) {
  addOutbox(d, kind, a, text, 'entregado_simulado', d.clock, ruleId);
}

function upsertTask(d: DemoState, t: Omit<Task, 'id' | 'createdAt' | 'status' | 'note'> & { status?: Task['status'] }): { task: Task; created: boolean } {
  const existing = d.tasks.find((x) => x.dedupeKey === t.dedupeKey && x.status !== 'resuelta');
  if (existing) return { task: existing, created: false };
  const task: Task = { ...t, id: nextId(d, 'T'), status: t.status ?? 'abierta', note: '', createdAt: d.clock };
  d.tasks.push(task);
  return { task, created: true };
}

function createRequestRecord(d: DemoState, r: { kind: RequestKind; personId: string | null; channel: Channel; summary: string; appointmentId?: string | null; nextStep?: string }): Request {
  const req: Request = { id: nextId(d, 'R'), kind: r.kind, personId: r.personId, status: 'pendiente', channel: r.channel, appointmentId: r.appointmentId ?? null, summary: r.summary, assigneeId: null, note: '', nextStep: r.nextStep ?? '', createdAt: d.clock, updatedAt: d.clock };
  d.requests.push(req);
  return req;
}

// ---------- Validaciones de formularios ----------
export interface NewPersonInput { firstName: string; lastName: string; birthYear: number | null; preferredChannel: string }
export function validateNewPerson(input: NewPersonInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.firstName.trim()) errors.firstName = 'Escribí el nombre.';
  else if (input.firstName.trim().length > 60) errors.firstName = 'Máximo 60 caracteres.';
  if (!input.lastName.trim()) errors.lastName = 'Escribí el apellido.';
  if (input.birthYear !== null && (!Number.isInteger(input.birthYear) || input.birthYear < 1920 || input.birthYear > 2026)) errors.birthYear = 'Año entre 1920 y 2026.';
  if (!['whatsapp', 'llamada', 'portal'].includes(input.preferredChannel)) errors.preferredChannel = 'Elegí cómo preferís que te contacte recepción (simulado).';
  return errors;
}

// ---------- Commands ----------
type Base = { commandId: string };
export type Command = Base & (
  | { type: 'book'; personId?: string; newPerson?: NewPersonInput; serviceTypeId: string; professionalId: string; chairId?: string; locationId: string; start: Iso; channel: Channel; requestId?: string; controlId?: string }
  | { type: 'reschedule'; appointmentId: string; start: Iso; professionalId?: string; chairId?: string; channel: Channel; expectedVersion?: number }
  | { type: 'cancel'; appointmentId: string; reason?: string; channel: Channel }
  | { type: 'confirmAppointment'; appointmentId: string }
  | { type: 'patientConfirm'; appointmentId: string }
  | { type: 'transition'; appointmentId: string; to: AppointmentStatus }
  | { type: 'requestHumanChange'; appointmentId: string; channel: Channel; note?: string }
  | { type: 'createRequest'; kind: RequestKind; personId: string | null; channel: Channel; summary: string }
  | { type: 'updateRequest'; requestId: string; status?: RequestStatus; assigneeId?: string | null; note?: string; nextStep?: string; personId?: string }
  | { type: 'chatStaffReply'; conversationId: string; text: string }
  | { type: 'createTask'; kind: TaskKind; title: string; detail: string; personId?: string | null; requestId?: string | null; appointmentId?: string | null; dedupeKey: string; ruleId?: string | null }
  | { type: 'updateTask'; taskId: string; status?: Task['status']; assigneeId?: string | null; note?: string }
  | { type: 'createPerson'; input: NewPersonInput; responsibleId?: string }
  | { type: 'updatePerson'; personId: string; expectedVersion: number; patch: Partial<Pick<Person, 'firstName' | 'lastName' | 'preferredChannel' | 'adminNote' | 'birthYear'>> }
  | { type: 'setReminderOptIn'; personId: string; optIn: boolean }
  | { type: 'addBlock'; scope: Block['scope']; targetId: string; start: Iso; end: Iso; reason: string }
  | { type: 'removeBlock'; blockId: string }
  | { type: 'updateRule'; ruleId: string; start: string; end: string }
  | { type: 'updateServiceDuration'; serviceTypeId: string; durationMin: number }
  | { type: 'setAutomationRule'; ruleId: string; enabled: boolean }
  | { type: 'setSetting'; key: keyof Pick<DemoSettings, 'failNextCommits' | 'reminderQuota'>; value: number }
  | { type: 'advanceClock'; minutes: number }
  | { type: 'toothMark'; personId: string; dentition: 'permanente' | 'temporal'; tooth: number; surface: Surface; procedure: string; state: 'planificado' | 'realizado' }
  | { type: 'toothUndo'; entryId: string }
  | { type: 'toothDone'; entryId: string }
  | { type: 'episodeIndicateControl'; episodeId: string; note: string }
  | { type: 'episodeNote'; episodeId: string; text: string }
  | { type: 'episodeSetAppliance'; episodeId: string; appliance: string }
  | { type: 'estimateCreate'; personId: string; professionalId: string }
  | { type: 'estimateAddLine'; estimateId: string; description: string; tooth: number | null; qty: number; unitMinor: number }
  | { type: 'estimateRemoveLine'; lineId: string }
  | { type: 'estimateTransition'; estimateId: string; to: 'emitido' | 'aceptado' | 'rechazado' | 'vencido' }
  | { type: 'estimateFollowUp'; estimateId: string }
  | { type: 'ledgerRecord'; personId: string; estimateId: string | null; amountMinor: number; note: string }
  | { type: 'ledgerReverse'; entryId: string }
  | { type: 'waitlistAdd'; personId: string; serviceTypeId: string; professionalId: string | null; locationId: string | null; period: 'mañana' | 'tarde' | 'cualquiera'; validDays: number }
  | { type: 'waitlistRemove'; entryId: string }
  | { type: 'offerCreate'; waitlistEntryId: string; slot: SlotRef }
  | { type: 'offerAccept'; offerId: string }
  | { type: 'offerReject'; offerId: string }
  | { type: 'learningOpen'; cardId: string }
  | { type: 'learningAnswer'; cardId: string; choiceId: string }
  | { type: 'learningComplete'; cardId: string }
  | { type: 'learningReset' }
  | { type: 'callSave'; personId: string | null; requestId: string | null; branch: string; status: CallSession['status']; transcript: CallLine[]; startedAt: Iso; appointmentId: string | null }
  | { type: 'chatSend'; conversationId: string; text: string }
  | { type: 'chatChoose'; conversationId: string; replyId: string }
  | { type: 'chatOpen'; conversationId: string }
  | { type: 'chatLinkRequest'; conversationId: string; requestId: string | null }
);

export type CommandInput = Command extends infer C ? (C extends Command ? Omit<C, 'commandId'> : never) : never;

type Handler<T extends Command['type']> = (d: DemoState, c: Extract<Command, { type: T }>) => CommandResultOk;

// ---- Turnos ----
function createAppointment(d: DemoState, c: { commandId: string; personId: string; slot: SlotRef; status: AppointmentStatus; origin: Channel; requestId: string | null; controlId: string | null }): Appointment {
  const episode = c.controlId ? d.careEpisodes.find((e) => e.controls.some((x) => x.id === c.controlId)) : undefined;
  const a: Appointment = {
    id: nextId(d, 'A'), personId: c.personId, serviceTypeId: c.slot.serviceTypeId, professionalId: c.slot.professionalId, chairId: c.slot.chairId,
    locationId: c.slot.locationId, start: c.slot.start, end: c.slot.end, status: c.status, version: 1, origin: c.origin,
    requestId: c.requestId, episodeId: episode?.id ?? null, controlId: c.controlId, createdAt: d.clock, updatedAt: d.clock,
  };
  d.appointments.push(a);
  if (episode && c.controlId) {
    const ctl = episode.controls.find((x) => x.id === c.controlId)!;
    ctl.status = 'reservado'; ctl.appointmentId = a.id;
    episode.timeline.push({ at: d.clock, kind: 'reserva', text: `Control ${ctl.id} reservado: ${a.id} (${fmtShort(a.start)}).` });
    for (const t of d.tasks) if (t.dedupeKey === `control:${ctl.id}` && t.status !== 'resuelta') { t.status = 'resuelta'; t.note = `Reservado ${a.id}.`; t.appointmentId = a.id; }
  }
  scheduleReminder(d, a);
  audit(d, c.commandId, 'cita_creada', 'Appointment', a.id, `${serviceName(d, a.serviceTypeId)} · ${fmtShort(a.start)} · estado ${a.status} · origen ${a.origin}`);
  return a;
}

const book: Handler<'book'> = (d, c) => {
  const st = d.serviceTypes.find((s) => s.id === c.serviceTypeId) ?? fail('SERVICIO_INEXISTENTE', 'Elegí un motivo válido.');
  if (!st.selfService && c.channel !== 'recepcion') fail('NO_AUTOSERVICIO', `"${st.name}" lo coordina recepción. Podés pedir ayuda.`);
  let personId = c.personId;
  if (!personId) {
    if (!c.newPerson) fail('PERSONA_REQUERIDA', 'Falta identificar a la persona.');
    const errors = validateNewPerson(c.newPerson!);
    if (Object.keys(errors).length) fail('DATOS_INVALIDOS', 'Revisá los datos marcados.', { conflicts: Object.entries(errors).map(([code, message]) => ({ code, message })) });
  } else getPerson(d, personId);

  let controlId: string | null = c.controlId ?? null;
  if (st.requiresIndicatedControl) {
    const ep = d.careEpisodes.find((e) => e.personId === personId && e.status === 'activo' && e.controls.some((x) => x.status === 'indicado' && (!controlId || x.id === controlId)));
    if (!ep) fail('CONTROL_NO_INDICADO', 'El control de ortodoncia se reserva solo cuando la profesional lo indicó. Recepción puede ayudarte.');
    controlId = ep!.controls.find((x) => x.status === 'indicado' && (!controlId || x.id === controlId))!.id;
  }

  const chairResolved = c.chairId ? { slot: slotFor(d, st.id, c.professionalId, c.chairId, c.start), conflicts: [] } : resolveChair(d, st.id, c.professionalId, c.locationId, c.start, { personId, skipLeadCheck: c.channel === 'recepcion' });
  const slot = chairResolved.slot;
  if (personId) {
    const dup = d.appointments.find((a) => a.personId === personId && a.serviceTypeId === st.id && a.start === c.start && isActive(a));
    if (dup) fail('DUPLICADO', `Ya existe ese turno (${dup.id}). Podés abrirlo o cambiarlo.`, { existingId: dup.id });
  }
  if (!slot) fail('CONFLICTO', 'Ese horario no está disponible.', { conflicts: chairResolved.conflicts });
  const conflicts = validateSlot(d, slot!, { personId, skipLeadCheck: c.channel === 'recepcion' });
  if (conflicts.length) fail('CONFLICTO', 'Ese horario no está disponible.', { conflicts });
  commitGate(d);

  if (!personId) {
    const np = c.newPerson!;
    const p: Person = { id: nextId(d, 'P'), firstName: np.firstName.trim(), lastName: np.lastName.trim(), birthYear: np.birthYear ?? 0, kind: 'adulto', preferredChannel: np.preferredChannel as Person['preferredChannel'], reminderOptIn: true, adminNote: 'Alta desde solicitud (muestra).', version: 1 };
    d.persons.push(p);
    personId = p.id;
    audit(d, c.commandId, 'persona_creada', 'Person', p.id, `Alta administrativa ficticia ${p.firstName} ${p.lastName}`);
  }
  const status: AppointmentStatus = c.channel === 'recepcion' ? 'confirmada' : st.needsReceptionConfirmation ? 'solicitada' : 'confirmada';
  const a = createAppointment(d, { commandId: c.commandId, personId: personId!, slot: slot!, status, origin: c.channel, requestId: c.requestId ?? null, controlId });
  let requestId = c.requestId ?? null;
  if (status === 'solicitada') {
    if (!requestId) {
      requestId = createRequestRecord(d, { kind: st.id === 'ST-PRIMERA' ? 'primera_visita' : 'reserva', personId: personId!, channel: c.channel, summary: `${st.name} pedida por ${c.channel}. Cupo reservado, falta confirmación de recepción.`, appointmentId: a.id, nextStep: 'Recepción revisa y confirma.' }).id;
    }
    a.requestId = requestId;
    upsertTask(d, { kind: 'confirmar_solicitud', title: `Confirmar ${st.name.toLowerCase()} de ${personName(d, personId!)}`, detail: `Solicitud ${requestId} · ${fmtShort(a.start)}`, assigneeId: null, dueAt: addMinutes(a.start, -60), personId: personId!, requestId, appointmentId: a.id, estimateId: null, dedupeKey: `confirm:${requestId}`, ruleId: c.channel === 'whatsapp' ? 'A02' : 'A01' });
    notify(d, 'confirmacion', a, 'Solicitud recibida (simulado). Recepción la revisa; todavía no es un turno confirmado.', c.channel === 'whatsapp' ? 'A02' : 'A01');
  } else {
    notify(d, 'confirmacion', a, 'Turno confirmado en esta demo. No enviamos mensajes reales.', 'A07');
  }
  if (requestId) {
    const r = d.requests.find((x) => x.id === requestId);
    if (r) { r.appointmentId = a.id; r.updatedAt = d.clock; }
  }
  return ok(status === 'solicitada' ? 'Solicitud enviada. El cupo queda reservado hasta que recepción la confirme.' : 'Turno confirmado.', { appointmentId: a.id, personId: personId!, ...(requestId ? { requestId } : {}) }, { status });
};

const reschedule: Handler<'reschedule'> = (d, c) => {
  const a = getAppt(d, c.appointmentId);
  if (a.status !== 'confirmada' && a.status !== 'solicitada') fail('ESTADO_INVALIDO', `El turno está ${a.status}; no se puede mover.`);
  if (c.expectedVersion !== undefined && c.expectedVersion !== a.version) fail('VERSION_OBSOLETA', `El turno cambió (versión actual ${a.version}). Revisá el estado actual.`);
  const hoursLeft = (toMs(a.start) - toMs(d.clock)) / 3_600_000;
  if (c.channel !== 'recepcion' && hoursLeft < d.settings.changeWindowHours) fail('FUERA_DE_VENTANA', `Faltan menos de ${d.settings.changeWindowHours} h. El cambio lo revisa recepción.`);
  const pro = c.professionalId ?? a.professionalId;
  const loc = c.chairId ? d.chairs.find((x) => x.id === c.chairId)?.locationId ?? a.locationId : a.locationId;
  const resolved = c.chairId
    ? { slot: slotFor(d, a.serviceTypeId, pro, c.chairId, c.start), conflicts: [] }
    : resolveChair(d, a.serviceTypeId, pro, loc, c.start, { ignoreAppointmentId: a.id, personId: a.personId, skipLeadCheck: c.channel === 'recepcion' });
  if (!resolved.slot) fail('CONFLICTO', 'Ese horario no está disponible. Conservamos tu turno anterior.', { conflicts: resolved.conflicts });
  const slot = resolved.slot!;
  if (slot.start === a.start && slot.professionalId === a.professionalId && slot.chairId === a.chairId) fail('SIN_CAMBIOS', 'Elegiste el mismo horario que ya tenés.');
  const conflicts = validateSlot(d, slot, { ignoreAppointmentId: a.id, personId: a.personId, skipLeadCheck: c.channel === 'recepcion' });
  if (conflicts.length) fail('CONFLICTO', 'Ese horario no está disponible. Conservamos tu turno anterior.', { conflicts });
  commitGate(d);

  const before = { start: a.start, version: a.version, professionalId: a.professionalId, chairId: a.chairId };
  voidReminders(d, a.id);
  Object.assign(a, { start: slot.start, end: slot.end, professionalId: slot.professionalId, chairId: slot.chairId, locationId: slot.locationId, version: a.version + 1, updatedAt: d.clock });
  notify(d, 'cambio', a, 'Cambio guardado en esta demo. Recepción ve el mismo turno actualizado. No enviamos mensajes reales.', c.channel === 'whatsapp' ? 'A03' : 'A07');
  scheduleReminder(d, a);
  if (a.episodeId) d.careEpisodes.find((e) => e.id === a.episodeId)?.timeline.push({ at: d.clock, kind: 'reprogramacion', text: `${a.id} reprogramado: ${fmtShort(before.start)} → ${fmtShort(a.start)} (v${before.version}→v${a.version}). Episodio conservado.` });
  for (const t of d.tasks) if (t.appointmentId === a.id && t.kind === 'excepcion_cambio' && t.status !== 'resuelta') { t.status = 'resuelta'; t.note = `Resuelta por cambio a ${fmtShort(a.start)}.`; }
  audit(d, c.commandId, 'cita_reprogramada', 'Appointment', a.id, `${fmtShort(before.start)} → ${fmtShort(a.start)} · v${before.version}→v${a.version} · canal ${c.channel} · recordatorio v${before.version} anulado`);
  return ok('Cambio guardado. Mismo turno, nueva versión.', { appointmentId: a.id }, { before, after: { start: a.start, version: a.version } });
};

function hasWaitlistCandidate(d: DemoState, a: Appointment) {
  return d.waitlist.some((w) => w.status === 'activa' && w.serviceTypeId === a.serviceTypeId && (!w.locationId || w.locationId === a.locationId) && (!w.professionalId || w.professionalId === a.professionalId));
}

const cancel: Handler<'cancel'> = (d, c) => {
  const a = getAppt(d, c.appointmentId);
  if (a.status === 'cancelada') fail('YA_CANCELADA', `El turno ${a.id} ya estaba cancelado. No se registró un nuevo evento.`);
  if (a.status !== 'confirmada' && a.status !== 'solicitada') fail('ESTADO_INVALIDO', `El turno está ${a.status}; no se puede cancelar.`);
  if (toMs(a.start) <= toMs(d.clock)) fail('PASADO', 'El turno ya empezó o pasó; recepción registra lo ocurrido.');
  commitGate(d);
  a.status = 'cancelada'; a.updatedAt = d.clock; a.cancelReason = c.reason?.trim() || 'Sin motivo indicado';
  voidReminders(d, a.id);
  notify(d, 'cancelacion', a, 'Cancelación registrada en esta demo. No enviamos mensajes reales.', 'A07');
  if (a.controlId) {
    const ep = d.careEpisodes.find((e) => e.id === a.episodeId);
    const ctl = ep?.controls.find((x) => x.id === a.controlId);
    if (ep && ctl) { ctl.status = 'indicado'; ctl.appointmentId = null; ep.timeline.push({ at: d.clock, kind: 'cancelacion', text: `${a.id} cancelado; el control ${ctl.id} sigue indicado.` }); }
  }
  for (const t of d.tasks) if (t.appointmentId === a.id && t.status !== 'resuelta') { t.status = 'resuelta'; t.note = 'Cerrada por cancelación del turno.'; }
  if (ruleOn(d, 'A06') && hasWaitlistCandidate(d, a)) {
    upsertTask(d, { kind: 'general', title: `Vacante liberada (${fmtShort(a.start)}): revisar lista de espera`, detail: `${serviceName(d, a.serviceTypeId)} · hay candidatos compatibles.`, assigneeId: null, dueAt: a.start, personId: null, requestId: null, appointmentId: a.id, estimateId: null, dedupeKey: `vacante:${a.id}`, ruleId: 'A06' });
  }
  audit(d, c.commandId, 'cita_cancelada', 'Appointment', a.id, `Cancelada por ${c.channel}. Motivo: ${a.cancelReason}. Recordatorios anulados.`);
  return ok('Turno cancelado. El cupo quedó libre.', { appointmentId: a.id });
};

const confirmAppointment: Handler<'confirmAppointment'> = (d, c) => {
  const a = getAppt(d, c.appointmentId);
  if (a.status === 'confirmada') fail('YA_CONFIRMADA', 'El turno ya estaba confirmado.');
  if (a.status !== 'solicitada') fail('ESTADO_INVALIDO', `No se confirma un turno ${a.status}.`);
  const conflicts = validateSlot(d, { start: a.start, end: a.end, professionalId: a.professionalId, chairId: a.chairId, locationId: a.locationId, serviceTypeId: a.serviceTypeId }, { ignoreAppointmentId: a.id, personId: a.personId, skipLeadCheck: true });
  if (conflicts.length) fail('CONFLICTO', 'Al revalidar, el horario ya no está disponible. Proponé otro horario.', { conflicts });
  commitGate(d);
  a.status = 'confirmada'; a.updatedAt = d.clock;
  notify(d, 'confirmacion', a, 'Recepción confirmó el turno (simulado).', 'A01');
  for (const t of d.tasks) if (t.appointmentId === a.id && t.kind === 'confirmar_solicitud' && t.status !== 'resuelta') { t.status = 'resuelta'; t.note = 'Turno confirmado por recepción.'; }
  const r = d.requests.find((x) => x.id === a.requestId);
  if (r) { r.nextStep = 'Turno confirmado por recepción. Resolver la solicitud cuando corresponda.'; r.updatedAt = d.clock; }
  audit(d, c.commandId, 'cita_confirmada', 'Appointment', a.id, 'Confirmada por recepción tras revalidar disponibilidad.');
  return ok('Turno confirmado por recepción.', { appointmentId: a.id });
};

const patientConfirm: Handler<'patientConfirm'> = (d, c) => {
  const a = getAppt(d, c.appointmentId);
  if (a.status === 'solicitada') fail('PENDIENTE_RECEPCION', 'Todavía es una solicitud: primero la confirma recepción.');
  if (a.status !== 'confirmada') fail('ESTADO_INVALIDO', `El turno está ${a.status}.`);
  if (a.patientConfirmedVersion === a.version) fail('YA_CONFIRMADA', 'Ya habías confirmado tu asistencia a este turno. No se registró otro evento.');
  a.patientConfirmedVersion = a.version; a.updatedAt = d.clock;
  audit(d, c.commandId, 'asistencia_confirmada', 'Appointment', a.id, `La persona confirmó asistencia (v${a.version}).`);
  return ok('Asistencia confirmada en esta demo. Recepción lo ve en la agenda.', { appointmentId: a.id });
};

const TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  confirmada: ['en_sala', 'ausente'], solicitada: ['ausente'], en_sala: ['en_atencion'], en_atencion: ['finalizada'],
};
const transition: Handler<'transition'> = (d, c) => {
  const a = getAppt(d, c.appointmentId);
  if (!TRANSITIONS[a.status]?.includes(c.to)) fail('TRANSICION_INVALIDA', `No se puede pasar de ${a.status} a ${c.to}.`);
  if (c.to === 'en_sala' && parts(a.start).date !== parts(d.clock).date) fail('NO_ES_HOY', 'El check-in solo se registra el día del turno.');
  if (c.to === 'ausente' && toMs(a.end) > toMs(d.clock)) fail('CITA_FUTURA', 'La ausencia se registra cuando el turno ya terminó.');
  const from = a.status;
  a.status = c.to; a.updatedAt = d.clock;
  if (c.to === 'ausente') voidReminders(d, a.id);
  if (c.to === 'finalizada' && a.controlId) {
    const ep = d.careEpisodes.find((e) => e.id === a.episodeId);
    const ctl = ep?.controls.find((x) => x.id === a.controlId);
    if (ep && ctl) { ctl.status = 'realizado'; ep.timeline.push({ at: d.clock, kind: 'control', text: `Turno ${a.id} finalizado (registro administrativo, sin evaluación clínica).` }); }
  }
  audit(d, c.commandId, 'cita_estado', 'Appointment', a.id, `${from} → ${c.to}`);
  return ok(`Estado actualizado: ${c.to.replace('_', ' ')}.`, { appointmentId: a.id });
};

const requestHumanChange: Handler<'requestHumanChange'> = (d, c) => {
  const a = getAppt(d, c.appointmentId);
  if (!ACTIVE_STATUSES.includes(a.status)) fail('ESTADO_INVALIDO', 'El turno no está activo.');
  const dedupeKey = `exc:${a.id}:v${a.version}`;
  const existing = d.tasks.find((t) => t.dedupeKey === dedupeKey && t.status !== 'resuelta');
  if (existing) return ok('Ya pediste ayuda para este turno. Recepción lo revisa; no se creó otra tarea.', { taskId: existing.id, requestId: existing.requestId ?? '' }, { existing: true });
  const req = createRequestRecord(d, { kind: 'reprogramacion', personId: a.personId, channel: c.channel, summary: `Pide cambiar ${a.id} (${fmtShort(a.start)}) dentro de la ventana de ${d.settings.changeWindowHours} h.`, appointmentId: a.id, nextStep: 'Recepción contacta y decide; el turno sigue vigente.' });
  const { task } = upsertTask(d, { kind: 'excepcion_cambio', title: `Cambio fuera de ventana: ${a.id}`, detail: `${personName(d, a.personId)} · ${fmtShort(a.start)} · ${c.note ?? ''}`.trim(), assigneeId: null, dueAt: addMinutes(a.start, -60), personId: a.personId, requestId: req.id, appointmentId: a.id, estimateId: null, dedupeKey, ruleId: 'A03' });
  audit(d, c.commandId, 'excepcion_creada', 'Task', task.id, `Excepción de cambio para ${a.id}. El turno no se movió.`);
  return ok('Pedido enviado a recepción. Tu turno sigue igual hasta que recepción lo revise.', { taskId: task.id, requestId: req.id });
};

// ---- Bandeja / tareas ----
const createRequest: Handler<'createRequest'> = (d, c) => {
  if (!c.summary.trim()) fail('DATOS_INVALIDOS', 'Escribí un resumen.');
  const r = createRequestRecord(d, { kind: c.kind, personId: c.personId, channel: c.channel, summary: c.summary.trim() });
  audit(d, c.commandId, 'solicitud_creada', 'Request', r.id, r.summary);
  return ok('Solicitud creada.', { requestId: r.id });
};
const updateRequest: Handler<'updateRequest'> = (d, c) => {
  const r = d.requests.find((x) => x.id === c.requestId) ?? fail('NO_EXISTE', 'La solicitud no existe.');
  if (c.status === 'resuelta' && !(c.nextStep ?? r.nextStep).trim() && !(c.note ?? r.note).trim()) fail('DATOS_INVALIDOS', 'Antes de resolver, dejá una nota o el próximo paso.');
  if (c.assigneeId !== undefined) {
    if (c.assigneeId && !d.staff.some((s) => s.id === c.assigneeId)) fail('DATOS_INVALIDOS', 'Responsable inexistente.');
    r.assigneeId = c.assigneeId;
    if (r.status === 'pendiente' && c.assigneeId) r.status = 'asignada';
  }
  if (c.personId !== undefined) {
    getPerson(d, c.personId);
    if (r.personId && r.personId !== c.personId) fail('IDENTIDAD_DISTINTA', 'La solicitud ya tiene otra persona. No se reasigna ni se fusiona por nombre.');
    r.personId = c.personId;
    for (const cv of d.conversations) if (cv.requestId === r.id && !cv.personId) { cv.personId = c.personId; cv.contactLabel = `${personName(d, c.personId)}`; }
  }
  if (c.note !== undefined) r.note = c.note.slice(0, 500);
  if (c.nextStep !== undefined) r.nextStep = c.nextStep.slice(0, 200);
  if (c.status) r.status = c.status;
  r.updatedAt = d.clock;
  audit(d, c.commandId, 'solicitud_actualizada', 'Request', r.id, `Estado ${r.status}; responsable ${r.assigneeId ?? 'sin asignar'}`);
  return ok('Solicitud actualizada. Esto no confirma ningún turno.', { requestId: r.id });
};
const chatStaffReply: Handler<'chatStaffReply'> = (d, c) => {
  const conv = d.conversations.find((x) => x.id === c.conversationId) ?? fail('NO_EXISTE', 'Conversación inexistente.');
  const text = c.text.trim();
  if (!text) fail('VACIO', 'Escribí la respuesta.');
  d.messages.push({ id: nextId(d, 'M'), conversationId: conv.id, from: 'recepcion', text: text.slice(0, 500), at: d.clock, simulated: 'entregado_simulado' });
  conv.updatedAt = d.clock;
  if (conv.status === 'derivada' || conv.status === 'cerrada') conv.status = 'esperando_paciente';
  audit(d, c.commandId, 'respuesta_recepcion', 'Conversation', conv.id, 'Respuesta de recepción (simulada, no se envió).');
  return ok('Respuesta registrada en el emulador. No se envió nada real.');
};

const createTask: Handler<'createTask'> = (d, c) => {
  const { task, created } = upsertTask(d, { kind: c.kind, title: c.title, detail: c.detail, assigneeId: null, dueAt: null, personId: c.personId ?? null, requestId: c.requestId ?? null, appointmentId: c.appointmentId ?? null, estimateId: null, dedupeKey: c.dedupeKey, ruleId: c.ruleId ?? null });
  if (created) audit(d, c.commandId, 'tarea_creada', 'Task', task.id, task.title);
  return ok(created ? 'Tarea creada para recepción.' : 'Ya había una tarea abierta para esto; no se duplicó.', { taskId: task.id }, { created });
};
const updateTask: Handler<'updateTask'> = (d, c) => {
  const t = d.tasks.find((x) => x.id === c.taskId) ?? fail('NO_EXISTE', 'La tarea no existe.');
  if (c.assigneeId !== undefined) t.assigneeId = c.assigneeId;
  if (c.note !== undefined) t.note = c.note.slice(0, 500);
  if (c.status) t.status = c.status;
  audit(d, c.commandId, 'tarea_actualizada', 'Task', t.id, `Estado ${t.status}; responsable ${t.assigneeId ?? 'sin asignar'}`);
  return ok('Tarea actualizada.', { taskId: t.id });
};

// ---- Personas ----
const createPerson: Handler<'createPerson'> = (d, c) => {
  const errors = validateNewPerson(c.input);
  if (Object.keys(errors).length) fail('DATOS_INVALIDOS', 'Revisá los datos marcados.', { conflicts: Object.entries(errors).map(([code, message]) => ({ code, message })) });
  const p: Person = { id: nextId(d, 'P'), firstName: c.input.firstName.trim(), lastName: c.input.lastName.trim(), birthYear: c.input.birthYear ?? 0, kind: c.responsibleId ? 'menor' : 'adulto', preferredChannel: c.input.preferredChannel as Person['preferredChannel'], reminderOptIn: true, adminNote: '', version: 1 };
  d.persons.push(p);
  if (c.responsibleId) { getPerson(d, c.responsibleId); d.responsibleLinks.push({ id: nextId(d, 'RL'), responsibleId: c.responsibleId, dependentId: p.id, relation: 'Responsable (muestra)' }); }
  audit(d, c.commandId, 'persona_creada', 'Person', p.id, `Alta administrativa ficticia ${p.firstName} ${p.lastName}`);
  return ok(`Persona ${p.id} creada.`, { personId: p.id });
};
const updatePerson: Handler<'updatePerson'> = (d, c) => {
  const p = getPerson(d, c.personId);
  if (p.version !== c.expectedVersion) fail('VERSION_OBSOLETA', `La ficha cambió (versión ${p.version}). Recargá antes de guardar.`);
  if (c.patch.firstName !== undefined && !c.patch.firstName.trim()) fail('DATOS_INVALIDOS', 'El nombre no puede quedar vacío.', { conflicts: [{ code: 'firstName', message: 'Escribí el nombre.' }] });
  if (c.patch.lastName !== undefined && !c.patch.lastName.trim()) fail('DATOS_INVALIDOS', 'El apellido no puede quedar vacío.', { conflicts: [{ code: 'lastName', message: 'Escribí el apellido.' }] });
  const changed = Object.keys(c.patch).filter((k) => (c.patch as Record<string, unknown>)[k] !== (p as unknown as Record<string, unknown>)[k]);
  if (!changed.length) fail('SIN_CAMBIOS', 'No hay cambios para guardar.');
  Object.assign(p, c.patch, { version: p.version + 1 });
  if (c.patch.firstName) p.firstName = c.patch.firstName.trim();
  if (c.patch.lastName) p.lastName = c.patch.lastName.trim();
  audit(d, c.commandId, 'persona_editada', 'Person', p.id, `Campos: ${changed.join(', ')} · v${p.version - 1}→v${p.version}`);
  return ok('Ficha guardada.', { personId: p.id });
};
const setReminderOptIn: Handler<'setReminderOptIn'> = (d, c) => {
  const p = getPerson(d, c.personId);
  if (p.reminderOptIn === c.optIn) fail('SIN_CAMBIOS', 'La preferencia ya estaba así.');
  p.reminderOptIn = c.optIn; p.version += 1;
  audit(d, c.commandId, 'preferencia', 'Person', p.id, `Recordatorios simulados: ${c.optIn ? 'sí' : 'no'} (opt-${c.optIn ? 'in' : 'out'} ficticio)`);
  return ok('Preferencia guardada.');
};

// ---- Configuración ----
const addBlock: Handler<'addBlock'> = (d, c) => {
  if (!c.reason.trim()) fail('DATOS_INVALIDOS', 'Indicá un motivo administrativo.');
  if (toMs(c.end) <= toMs(c.start)) fail('DATOS_INVALIDOS', 'El fin debe ser posterior al inicio.');
  const exists = c.scope === 'professional' ? d.professionals.some((p) => p.id === c.targetId) : c.scope === 'chair' ? d.chairs.some((x) => x.id === c.targetId) : d.locations.some((l) => l.id === c.targetId);
  if (!exists) fail('DATOS_INVALIDOS', 'El recurso a bloquear no existe.');
  const hit = d.appointments.filter((a) => isActive(a) && toMs(a.start) < toMs(c.end) && toMs(c.start) < toMs(a.end) &&
    ((c.scope === 'professional' && a.professionalId === c.targetId) || (c.scope === 'chair' && a.chairId === c.targetId) || (c.scope === 'location' && a.locationId === c.targetId)));
  if (hit.length) fail('BLOQUEO_CON_TURNOS', `Hay ${hit.length} turno(s) activo(s) en ese intervalo. Movelos antes de bloquear; no hay cambios silenciosos.`, { conflicts: hit.map((a) => ({ code: 'TURNO', message: `${a.id} · ${fmtShort(a.start)}`, refId: a.id })) });
  const b: Block = { id: nextId(d, 'B'), scope: c.scope, targetId: c.targetId, start: c.start, end: c.end, reason: c.reason.trim() };
  d.blocks.push(b);
  audit(d, c.commandId, 'bloqueo_creado', 'Block', b.id, `${c.scope} ${c.targetId} · ${fmtShort(c.start)}–${parts(c.end).hhmm} · ${b.reason}`);
  return ok('Bloqueo guardado.', { blockId: b.id });
};
const removeBlock: Handler<'removeBlock'> = (d, c) => {
  const i = d.blocks.findIndex((b) => b.id === c.blockId);
  if (i < 0) fail('NO_EXISTE', 'El bloqueo no existe.');
  const [b] = d.blocks.splice(i, 1);
  audit(d, c.commandId, 'bloqueo_eliminado', 'Block', b.id, b.reason);
  return ok('Bloqueo eliminado.');
};
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const updateRule: Handler<'updateRule'> = (d, c) => {
  const r = d.availabilityRules.find((x) => x.id === c.ruleId) ?? fail('NO_EXISTE', 'Regla inexistente.');
  if (!HHMM.test(c.start) || !HHMM.test(c.end) || c.start >= c.end) fail('DATOS_INVALIDOS', 'Usá horas HH:MM y un fin posterior al inicio.');
  const outside = d.appointments.filter((a) => isActive(a) && toMs(a.start) >= toMs(d.clock) && a.professionalId === r.professionalId && a.locationId === r.locationId && parts(a.start).weekday === r.weekday && (parts(a.start).hhmm < c.start || parts(a.end).hhmm > c.end));
  if (outside.length) fail('REGLA_CON_TURNOS', `${outside.length} turno(s) quedarían fuera de la jornada. Reprogramalos primero.`, { conflicts: outside.map((a) => ({ code: 'TURNO', message: `${a.id} · ${fmtShort(a.start)}`, refId: a.id })) });
  const before = `${r.start}–${r.end}`;
  r.start = c.start; r.end = c.end;
  audit(d, c.commandId, 'jornada_editada', 'AvailabilityRule', r.id, `${before} → ${r.start}–${r.end}`);
  return ok('Jornada actualizada.');
};
const updateServiceDuration: Handler<'updateServiceDuration'> = (d, c) => {
  const st = d.serviceTypes.find((s) => s.id === c.serviceTypeId) ?? fail('NO_EXISTE', 'Motivo inexistente.');
  if (!Number.isInteger(c.durationMin) || c.durationMin < 15 || c.durationMin > 120 || c.durationMin % 15) fail('DATOS_INVALIDOS', 'Duración entre 15 y 120 minutos, en pasos de 15.');
  const before = st.durationMin;
  st.durationMin = c.durationMin;
  audit(d, c.commandId, 'duracion_editada', 'ServiceType', st.id, `${before} → ${c.durationMin} min (aplica a turnos nuevos)`);
  return ok('Duración actualizada para turnos nuevos.');
};
const setAutomationRule: Handler<'setAutomationRule'> = (d, c) => {
  if (!(TOGGLEABLE_RULES as readonly string[]).includes(c.ruleId)) fail('REGLA_OBLIGATORIA', `${c.ruleId} no se puede pausar: protege consistencia o derivación humana.`);
  const r = d.automationRules.find((x) => x.id === c.ruleId) ?? fail('NO_EXISTE', 'Regla inexistente.');
  if (r.enabled === c.enabled) fail('SIN_CAMBIOS', 'La regla ya estaba así.');
  r.enabled = c.enabled;
  audit(d, c.commandId, 'regla', 'AutomationRule', r.id, `${r.id} ${c.enabled ? 'activada' : 'pausada'}`);
  return ok(`${r.id} ${c.enabled ? 'activada' : 'pausada'}.`);
};
const setSetting: Handler<'setSetting'> = (d, c) => {
  if (!Number.isInteger(c.value) || c.value < 0 || c.value > 999) fail('DATOS_INVALIDOS', 'Valor entero entre 0 y 999.');
  d.settings[c.key] = c.value;
  audit(d, c.commandId, 'simulador', 'Settings', c.key, `${c.key} = ${c.value}`);
  return ok('Ajuste de simulación guardado.');
};

// ---- Reloj y automatizaciones locales ----
export function runAutomations(d: DemoState, commandId: string): string[] {
  const log: string[] = [];
  for (const o of d.offers) if (o.status === 'activa' && toMs(o.holdUntil) <= toMs(d.clock)) {
    o.status = 'vencida';
    log.push(`Oferta ${o.id} vencida; el cupo se liberó.`);
    audit(d, commandId, 'oferta_vencida', 'Offer', o.id, 'Hold de muestra vencido.');
  }
  for (const w of d.waitlist) if (w.status === 'activa' && toMs(w.validUntil) <= toMs(d.clock)) { w.status = 'vencida'; log.push(`Espera ${w.id} vencida.`); }
  for (const o of d.outbox) {
    if (o.kind !== 'recordatorio_24h' || o.status !== 'programado' || toMs(o.dueAt) > toMs(d.clock)) continue;
    const a = d.appointments.find((x) => x.id === o.appointmentId);
    if (!a || !isActive(a) || a.version !== o.appointmentVersion || toMs(a.start) <= toMs(d.clock)) { o.status = 'anulado'; continue; }
    const p = d.persons.find((x) => x.id === a.personId);
    if (!ruleOn(d, 'A05')) { log.push(`Recordatorio ${o.id} sigue programado: A05 está pausada.`); continue; }
    if (!p?.reminderOptIn || d.settings.reminderQuota <= 0) {
      o.status = p?.reminderOptIn === false ? 'bloqueado_optout' : 'sin_cupo';
      upsertTask(d, { kind: 'contacto_manual', title: `Contacto manual por recordatorio de ${a.id}`, detail: o.status === 'sin_cupo' ? 'Cuota de muestra agotada.' : 'La persona no quiere recordatorios automáticos.', assigneeId: null, dueAt: a.start, personId: a.personId, requestId: null, appointmentId: a.id, estimateId: null, dedupeKey: `manual:${o.dedupeKey}`, ruleId: 'A05' });
      log.push(`Recordatorio ${o.id} no enviado (${o.status}); tarea manual creada.`);
      continue;
    }
    o.status = 'entregado_simulado';
    d.settings.reminderQuota -= 1;
    const conv = d.conversations.find((cv) => cv.personId === a.personId);
    if (conv) d.messages.push({ id: nextId(d, 'M'), conversationId: conv.id, from: 'sistema', text: `Recordatorio simulado: ${serviceName(d, a.serviceTypeId)} el ${fmtShort(a.start)} (${a.id}, v${a.version}). No se envió nada real.`, at: d.clock, simulated: 'entregado_simulado' });
    log.push(`Recordatorio ${o.id} entregado (simulado) para ${a.id} v${a.version}.`);
    audit(d, commandId, 'recordatorio_simulado', 'OutboxItem', o.id, `${a.id} v${a.version} · clave ${o.dedupeKey}`);
  }
  for (const e of d.estimates) if (e.status === 'emitido' && e.validUntil && toMs(e.validUntil) <= toMs(d.clock)) {
    e.status = 'vencido'; e.decidedAt = d.clock;
    if (ruleOn(d, 'A09')) upsertTask(d, { kind: 'seguimiento_presupuesto', title: `Presupuesto ${e.id} vencido: consulta administrativa`, detail: 'Aclarar dudas si la persona lo pide. No es venta ni cobro.', assigneeId: null, dueAt: null, personId: e.personId, requestId: null, appointmentId: null, estimateId: e.id, dedupeKey: `est:${e.id}:seguimiento`, ruleId: 'A09' });
    log.push(`Presupuesto ${e.id} vencido; tarea de seguimiento administrativo.`);
    audit(d, commandId, 'presupuesto_vencido', 'Estimate', e.id, 'Vencido por reloj de muestra.');
  }
  return log;
}

const advanceClock: Handler<'advanceClock'> = (d, c) => {
  if (!Number.isInteger(c.minutes) || c.minutes <= 0 || c.minutes > 60 * 24 * 31) fail('DATOS_INVALIDOS', 'Avance entre 1 minuto y 31 días.');
  const before = d.clock;
  d.clock = addMinutes(d.clock, c.minutes);
  audit(d, c.commandId, 'reloj', 'Clock', 'demo', `${fmtShort(before)} → ${fmtShort(d.clock)}`);
  const log = runAutomations(d, c.commandId);
  return ok(`Reloj de muestra: ${fmtShort(d.clock)}. ${log.length ? log.length + ' automatización(es) ejecutada(s).' : 'Sin automatizaciones pendientes.'}`, undefined, { log });
};

// ---- Odontograma ----
// Registros que la profesional puede cargar (cada uno tiene su ilustración en src/ui/art/teeth.tsx).
// "Restauración" y "Corona" se mantienen por compatibilidad con fichas guardadas.
export const PROCEDURES = [
  'Caries (hallazgo)', 'Restauración de resina', 'Restauración de amalgama', 'Sellador', 'Corona de porcelana', 'Corona de oro',
  'Tratamiento de conducto', 'Implante', 'Fractura (hallazgo)', 'Bracket', 'Extracción indicada', 'Pieza ausente', 'Control',
  'Restauración', 'Corona',
] as const;
export const APPLIANCE_IDS = ['brackets_metalicos', 'brackets_esteticos', 'alineadores', 'retenedor_fijo', 'retenedor_removible'] as const;
export function isValidTooth(dentition: 'permanente' | 'temporal', tooth: number): boolean {
  const q = Math.floor(tooth / 10); const n = tooth % 10;
  return dentition === 'permanente' ? q >= 1 && q <= 4 && n >= 1 && n <= 8 : q >= 5 && q <= 8 && n >= 1 && n <= 5;
}
export function surfacesFor(tooth: number): Surface[] {
  const n = tooth % 10;
  return n <= 3 ? ['V', 'L', 'M', 'D', 'I', 'pieza'] : ['V', 'L', 'M', 'D', 'O', 'pieza'];
}
const toothMark: Handler<'toothMark'> = (d, c) => {
  getPerson(d, c.personId);
  if (!isValidTooth(c.dentition, c.tooth)) fail('PIEZA_INVALIDA', `La pieza ${c.tooth} no corresponde a la dentición ${c.dentition} (FDI).`);
  if (!surfacesFor(c.tooth).includes(c.surface)) fail('SUPERFICIE_INVALIDA', `La superficie ${c.surface} no aplica a la pieza ${c.tooth}.`);
  if (!(PROCEDURES as readonly string[]).includes(c.procedure)) fail('DATOS_INVALIDOS', 'Elegí un registro de la lista.');
  if (d.toothChart.some((t) => t.personId === c.personId && t.status === 'vigente' && t.tooth === c.tooth && t.surface === c.surface && t.procedure === c.procedure && t.state === c.state)) fail('DUPLICADO', 'Ese registro ya existe para esa pieza y superficie.');
  const id = nextId(d, 'TC');
  d.toothChart.push({ id, personId: c.personId, dentition: c.dentition, tooth: c.tooth, surface: c.surface, procedure: c.procedure, state: c.state, status: 'vigente', createdAt: d.clock, by: 'Profesional (vista de muestra)' });
  audit(d, c.commandId, 'odontograma', 'ToothChartEntry', id, `${c.procedure} ${c.state} · pieza ${c.tooth} ${c.surface} (${c.personId})`);
  return ok('Registro guardado en la ficha.', { entryId: id });
};
const toothUndo: Handler<'toothUndo'> = (d, c) => {
  const t = d.toothChart.find((x) => x.id === c.entryId) ?? fail('NO_EXISTE', 'Registro inexistente.');
  if (t.status === 'deshecho') fail('YA_DESHECHO', 'Ese registro ya estaba deshecho.');
  t.status = 'deshecho';
  audit(d, c.commandId, 'odontograma_deshacer', 'ToothChartEntry', t.id, `Deshecho: ${t.procedure} pieza ${t.tooth}`);
  return ok('Registro deshecho (queda en la auditoría).');
};
const toothDone: Handler<'toothDone'> = (d, c) => {
  const t = d.toothChart.find((x) => x.id === c.entryId) ?? fail('NO_EXISTE', 'Registro inexistente.');
  if (t.status !== 'vigente' || t.state !== 'planificado') fail('ESTADO_INVALIDO', 'Solo un registro planificado vigente pasa a realizado.');
  t.state = 'realizado';
  audit(d, c.commandId, 'odontograma_realizado', 'ToothChartEntry', t.id, `${t.procedure} pieza ${t.tooth} marcado realizado por la profesional`);
  return ok('Marcado como realizado.');
};

// ---- Episodios ----
const episodeIndicateControl: Handler<'episodeIndicateControl'> = (d, c) => {
  const ep = d.careEpisodes.find((e) => e.id === c.episodeId) ?? fail('NO_EXISTE', 'Episodio inexistente.');
  if (ep.status !== 'activo') fail('ESTADO_INVALIDO', 'El episodio está cerrado.');
  if (!c.note.trim()) fail('DATOS_INVALIDOS', 'La indicación la escribe la profesional; no inventamos frecuencia.');
  const id = nextId(d, 'IC');
  ep.controls.push({ id, note: c.note.trim().slice(0, 200), indicatedBy: ep.professionalId, indicatedAt: d.clock, status: 'indicado', appointmentId: null });
  ep.timeline.push({ at: d.clock, kind: 'indicacion', text: `La profesional indicó control ${id}: ${c.note.trim()}` });
  upsertTask(d, { kind: 'control_indicado', title: `Coordinar control indicado ${id} de ${personName(d, ep.personId)}`, detail: 'Ofrecer turno. Sin calcular frecuencia ni avance.', assigneeId: null, dueAt: null, personId: ep.personId, requestId: null, appointmentId: null, estimateId: null, dedupeKey: `control:${id}`, ruleId: null });
  audit(d, c.commandId, 'control_indicado', 'CareEpisode', ep.id, `Control ${id} indicado manualmente`);
  return ok('Control indicado y tarea creada para recepción. No se reservó turno.', { controlId: id });
};
const episodeSetAppliance: Handler<'episodeSetAppliance'> = (d, c) => {
  const ep = d.careEpisodes.find((e) => e.id === c.episodeId) ?? fail('NO_EXISTE', 'Episodio inexistente.');
  if (!(APPLIANCE_IDS as readonly string[]).includes(c.appliance)) fail('DATOS_INVALIDOS', 'Aparatología no reconocida.');
  if (ep.appliance === c.appliance) fail('SIN_CAMBIOS', 'Ya estaba registrada esa aparatología.');
  const before = ep.appliance ?? 'sin registrar';
  ep.appliance = c.appliance as typeof ep.appliance;
  ep.timeline.push({ at: d.clock, kind: 'aparatologia', text: `La profesional registró la aparatología: ${c.appliance.replace(/_/g, ' ')}.` });
  audit(d, c.commandId, 'aparatologia', 'CareEpisode', ep.id, `${before} → ${c.appliance}`);
  return ok('Aparatología registrada (dato administrativo; no evalúa el tratamiento).');
};
const episodeNote: Handler<'episodeNote'> = (d, c) => {
  const ep = d.careEpisodes.find((e) => e.id === c.episodeId) ?? fail('NO_EXISTE', 'Episodio inexistente.');
  if (!c.text.trim()) fail('DATOS_INVALIDOS', 'Escribí la nota administrativa.');
  ep.timeline.push({ at: d.clock, kind: 'nota', text: c.text.trim().slice(0, 300) });
  audit(d, c.commandId, 'episodio_nota', 'CareEpisode', ep.id, 'Nota administrativa');
  return ok('Nota agregada al timeline.');
};

// ---- Presupuestos y caja ficticia ----
const getEstimate = (d: DemoState, id: string) => d.estimates.find((e) => e.id === id) ?? fail('NO_EXISTE', 'Presupuesto inexistente.');
const estimateCreate: Handler<'estimateCreate'> = (d, c) => {
  getPerson(d, c.personId);
  const id = nextId(d, 'EST');
  d.estimates.push({ id, personId: c.personId, professionalId: c.professionalId, status: 'borrador', validUntil: null, issuedAt: null, decidedAt: null, createdAt: d.clock, coverageNote: 'Cobertura a verificar por recepción.' });
  audit(d, c.commandId, 'presupuesto_creado', 'Estimate', id, `Borrador para ${c.personId}`);
  return ok('Borrador creado.', { estimateId: id });
};
const estimateAddLine: Handler<'estimateAddLine'> = (d, c) => {
  const e = getEstimate(d, c.estimateId);
  if (e.status !== 'borrador') fail('ESTADO_INVALIDO', 'Solo se editan líneas en borrador.');
  const errors: { code: string; message: string }[] = [];
  if (!c.description.trim()) errors.push({ code: 'description', message: 'Escribí la descripción.' });
  if (!Number.isInteger(c.qty) || c.qty < 1 || c.qty > 99) errors.push({ code: 'qty', message: 'Cantidad entera entre 1 y 99.' });
  if (!Number.isInteger(c.unitMinor) || c.unitMinor < 0) errors.push({ code: 'unitMinor', message: 'Importe entero no negativo (centavos).' });
  else if (c.unitMinor > 1_000_000_000) errors.push({ code: 'unitMinor', message: 'Importe fuera de rango de muestra.' });
  if (c.tooth !== null && !isValidTooth('permanente', c.tooth) && !isValidTooth('temporal', c.tooth)) errors.push({ code: 'tooth', message: 'Pieza FDI inválida.' });
  if (errors.length) fail('DATOS_INVALIDOS', 'Revisá la línea.', { conflicts: errors });
  if (d.estimateLines.some((l) => l.estimateId === e.id && l.description.trim().toLowerCase() === c.description.trim().toLowerCase() && l.tooth === c.tooth)) fail('LINEA_DUPLICADA', 'Esa línea ya está en el presupuesto.');
  const id = nextId(d, 'EL');
  d.estimateLines.push({ id, estimateId: e.id, description: c.description.trim().slice(0, 120), tooth: c.tooth, qty: c.qty, unitMinor: c.unitMinor });
  audit(d, c.commandId, 'presupuesto_linea', 'Estimate', e.id, `+ ${c.description.trim()} × ${c.qty}`);
  return ok('Línea agregada.', { lineId: id });
};
const estimateRemoveLine: Handler<'estimateRemoveLine'> = (d, c) => {
  const i = d.estimateLines.findIndex((l) => l.id === c.lineId);
  if (i < 0) fail('NO_EXISTE', 'Línea inexistente.');
  const e = getEstimate(d, d.estimateLines[i].estimateId);
  if (e.status !== 'borrador') fail('ESTADO_INVALIDO', 'Solo se editan líneas en borrador.');
  const [l] = d.estimateLines.splice(i, 1);
  audit(d, c.commandId, 'presupuesto_linea', 'Estimate', e.id, `− ${l.description}`);
  return ok('Línea quitada.');
};
const ESTIMATE_FLOW: Record<string, string[]> = { borrador: ['emitido'], emitido: ['aceptado', 'rechazado', 'vencido'] };
const estimateTransition: Handler<'estimateTransition'> = (d, c) => {
  const e = getEstimate(d, c.estimateId);
  if (!ESTIMATE_FLOW[e.status]?.includes(c.to)) fail('TRANSICION_INVALIDA', `No se pasa de ${e.status} a ${c.to}.`);
  if (c.to === 'emitido' && !d.estimateLines.some((l) => l.estimateId === e.id)) fail('SIN_LINEAS', 'Agregá al menos una línea antes de emitir.');
  if (c.to === 'vencido' && e.validUntil && toMs(e.validUntil) > toMs(d.clock)) fail('VIGENTE', 'Todavía está vigente según el reloj de muestra.');
  if (c.to === 'aceptado' && e.validUntil && toMs(e.validUntil) <= toMs(d.clock)) fail('VENCIDO', 'La vigencia terminó; no se puede aceptar.');
  const from = e.status;
  e.status = c.to;
  if (c.to === 'emitido') { e.issuedAt = d.clock; e.validUntil = addMinutes(d.clock, 15 * 1440); } else e.decidedAt = d.clock;
  for (const t of d.tasks) if (t.estimateId === e.id && t.kind === 'seguimiento_presupuesto' && t.status !== 'resuelta' && (c.to === 'aceptado' || c.to === 'rechazado')) { t.status = 'resuelta'; t.note = `Presupuesto ${c.to}.`; }
  audit(d, c.commandId, 'presupuesto_estado', 'Estimate', e.id, `${from} → ${c.to}${c.to === 'aceptado' ? ' (no genera cobro ni tratamiento realizado)' : ''}`);
  return ok(c.to === 'aceptado' ? 'Presupuesto aceptado (simulado). No es un cobro ni un tratamiento realizado.' : `Presupuesto ${c.to}.`);
};
const estimateFollowUp: Handler<'estimateFollowUp'> = (d, c) => {
  const e = getEstimate(d, c.estimateId);
  if (e.status === 'aceptado' || e.status === 'rechazado') fail('ESTADO_INVALIDO', 'El presupuesto ya tiene decisión; no se crea seguimiento.');
  const { task, created } = upsertTask(d, { kind: 'seguimiento_presupuesto', title: `Consulta administrativa sobre ${e.id}`, detail: 'La persona pidió una explicación. No es venta ni cobro.', assigneeId: null, dueAt: null, personId: e.personId, requestId: null, appointmentId: null, estimateId: e.id, dedupeKey: `est:${e.id}:seguimiento`, ruleId: 'A09' });
  if (created) audit(d, c.commandId, 'tarea_creada', 'Task', task.id, task.title);
  return ok(created ? 'Tarea de consulta administrativa creada.' : 'Ya existe una tarea abierta para este presupuesto.', { taskId: task.id });
};
const ledgerRecord: Handler<'ledgerRecord'> = (d, c) => {
  getPerson(d, c.personId);
  if (!Number.isInteger(c.amountMinor) || c.amountMinor <= 0) fail('IMPORTE_INVALIDO', 'Importe entero positivo en centavos.', { conflicts: [{ code: 'amountMinor', message: 'Importe entero positivo.' }] });
  if (c.amountMinor > 1_000_000_000) fail('IMPORTE_INVALIDO', 'Importe fuera de rango de muestra.', { conflicts: [{ code: 'amountMinor', message: 'Fuera de rango.' }] });
  if (c.estimateId) { const e = getEstimate(d, c.estimateId); if (e.personId !== c.personId) fail('DATOS_INVALIDOS', 'El presupuesto es de otra persona.'); }
  commitGate(d);
  const id = nextId(d, 'L');
  d.ledger.push({ id, personId: c.personId, estimateId: c.estimateId, kind: 'pago_simulado', amountMinor: c.amountMinor, reversesId: null, reversedById: null, commandId: c.commandId, at: d.clock, note: c.note.trim().slice(0, 120) || 'Movimiento ficticio' });
  audit(d, c.commandId, 'caja_movimiento', 'LedgerEntry', id, `Movimiento simulado +${c.amountMinor} (centavos)`);
  return ok('Movimiento simulado registrado. No hubo cobro real.', { entryId: id });
};
const ledgerReverse: Handler<'ledgerReverse'> = (d, c) => {
  const l = d.ledger.find((x) => x.id === c.entryId) ?? fail('NO_EXISTE', 'Movimiento inexistente.');
  if (l.kind !== 'pago_simulado') fail('ESTADO_INVALIDO', 'Solo se revierte un movimiento original.');
  if (l.reversedById) fail('YA_REVERTIDO', `Ya fue revertido por ${l.reversedById}.`, { existingId: l.reversedById });
  const id = nextId(d, 'L');
  d.ledger.push({ id, personId: l.personId, estimateId: l.estimateId, kind: 'contrapartida', amountMinor: -l.amountMinor, reversesId: l.id, reversedById: null, commandId: c.commandId, at: d.clock, note: `Reversión de ${l.id}` });
  l.reversedById = id;
  audit(d, c.commandId, 'caja_reversion', 'LedgerEntry', id, `Contrapartida de ${l.id} (−${l.amountMinor})`);
  return ok('Reversión registrada por contrapartida.', { entryId: id });
};

// ---- Lista de espera y ofertas ----
const waitlistAdd: Handler<'waitlistAdd'> = (d, c) => {
  getPerson(d, c.personId);
  if (!d.serviceTypes.some((s) => s.id === c.serviceTypeId)) fail('DATOS_INVALIDOS', 'Motivo inválido.');
  if (!Number.isInteger(c.validDays) || c.validDays < 1 || c.validDays > 60) fail('DATOS_INVALIDOS', 'Vigencia entre 1 y 60 días.');
  const dup = d.waitlist.find((w) => w.personId === c.personId && w.serviceTypeId === c.serviceTypeId && w.status === 'activa');
  if (dup) fail('DUPLICADO', `Ya está en espera para ese motivo (${dup.id}).`, { existingId: dup.id });
  const id = nextId(d, 'W');
  d.waitlist.push({ id, personId: c.personId, serviceTypeId: c.serviceTypeId, professionalId: c.professionalId, locationId: c.locationId, period: c.period, validUntil: addMinutes(d.clock, c.validDays * 1440), status: 'activa', rejectedSlotKeys: [], createdAt: d.clock });
  audit(d, c.commandId, 'espera_alta', 'WaitlistEntry', id, `${c.personId} · ${serviceName(d, c.serviceTypeId)} · ${c.period}`);
  return ok('Quedaste en lista de espera de muestra. No es una reserva.', { entryId: id });
};
const waitlistRemove: Handler<'waitlistRemove'> = (d, c) => {
  const w = d.waitlist.find((x) => x.id === c.entryId) ?? fail('NO_EXISTE', 'Entrada inexistente.');
  if (w.status !== 'activa') fail('ESTADO_INVALIDO', 'La entrada ya no está activa.');
  w.status = 'retirada';
  for (const o of d.offers) if (o.waitlistEntryId === w.id && o.status === 'activa') o.status = 'rechazada';
  audit(d, c.commandId, 'espera_baja', 'WaitlistEntry', w.id, 'Retirada sin penalización');
  return ok('Salida de la lista de espera registrada.');
};
const offerCreate: Handler<'offerCreate'> = (d, c) => {
  const w = d.waitlist.find((x) => x.id === c.waitlistEntryId) ?? fail('NO_EXISTE', 'Entrada inexistente.');
  if (w.status !== 'activa') fail('ESTADO_INVALIDO', 'La entrada no está activa.');
  if (c.slot.serviceTypeId !== w.serviceTypeId) fail('DATOS_INVALIDOS', 'El cupo no corresponde al motivo pedido.');
  const key = slotKey(c.slot);
  if (w.rejectedSlotKeys.includes(key)) fail('RECHAZADA_PREVIAMENTE', 'La persona ya rechazó ese cupo; no se insiste.');
  const dedupeKey = `offer:${w.id}:${key}`;
  const dup = d.offers.find((o) => o.dedupeKey === dedupeKey && o.status === 'activa');
  if (dup) fail('DUPLICADO', `Ya hay una oferta activa (${dup.id}).`, { existingId: dup.id });
  const conflicts = validateSlot(d, c.slot, { personId: w.personId, ignoreOfferSlot: true });
  if (conflicts.length) fail('CONFLICTO', 'El cupo ya no está libre.', { conflicts });
  const id = nextId(d, 'OF');
  d.offers.push({ id, waitlistEntryId: w.id, personId: w.personId, slot: c.slot, holdUntil: addMinutes(d.clock, d.settings.holdMinutes), status: 'activa', dedupeKey, appointmentId: null, createdAt: d.clock });
  audit(d, c.commandId, 'oferta_creada', 'Offer', id, `${w.personId} · ${fmtShort(c.slot.start)} · hold ${d.settings.holdMinutes} min (muestra)`);
  return ok(`Oferta enviada (simulada). Vence en ${d.settings.holdMinutes} minutos de muestra. No es una reserva.`, { offerId: id });
};
const offerAccept: Handler<'offerAccept'> = (d, c) => {
  const o = d.offers.find((x) => x.id === c.offerId) ?? fail('NO_EXISTE', 'Oferta inexistente.');
  if (o.status === 'tomada_por_otro') fail('OFERTA_TOMADA', 'Otra persona aceptó primero. Seguís en lista de espera; recepción te ofrecerá otra opción.');
  if (o.status !== 'activa' || toMs(o.holdUntil) <= toMs(d.clock)) fail('OFERTA_VENCIDA', 'La oferta ya no está vigente. Seguís en lista de espera.');
  const conflicts = validateSlot(d, o.slot, { personId: o.personId, ignoreOfferSlot: true });
  if (conflicts.length) fail('OFERTA_TOMADA', 'El cupo ya fue ocupado. Seguís en lista de espera.', { conflicts });
  commitGate(d);
  const a = createAppointment(d, { commandId: c.commandId, personId: o.personId, slot: o.slot, status: 'confirmada', origin: 'espera', requestId: null, controlId: null });
  notify(d, 'confirmacion', a, 'Aceptaste la oferta de muestra: turno confirmado. No enviamos mensajes reales.', 'A06');
  o.status = 'aceptada'; o.appointmentId = a.id;
  const key = slotKey(o.slot);
  for (const other of d.offers) if (other.id !== o.id && other.status === 'activa' && (slotKey(other.slot) === key || other.waitlistEntryId === o.waitlistEntryId)) other.status = 'tomada_por_otro';
  const w = d.waitlist.find((x) => x.id === o.waitlistEntryId);
  if (w) w.status = 'asignada';
  for (const t of d.tasks) if (t.dedupeKey.startsWith('vacante:') && t.status !== 'resuelta' && d.appointments.find((x) => x.id === t.appointmentId)?.start === o.slot.start) { t.status = 'resuelta'; t.note = `Cupo asignado a ${o.personId} (${a.id}).`; }
  audit(d, c.commandId, 'oferta_aceptada', 'Offer', o.id, `Ganador ${o.personId} → ${a.id}. Otras ofertas del cupo liberadas.`);
  return ok('Oferta aceptada: turno confirmado.', { appointmentId: a.id });
};
const offerReject: Handler<'offerReject'> = (d, c) => {
  const o = d.offers.find((x) => x.id === c.offerId) ?? fail('NO_EXISTE', 'Oferta inexistente.');
  if (o.status !== 'activa') fail('ESTADO_INVALIDO', `La oferta está ${o.status}.`);
  o.status = 'rechazada';
  const w = d.waitlist.find((x) => x.id === o.waitlistEntryId);
  if (w) w.rejectedSlotKeys.push(slotKey(o.slot));
  audit(d, c.commandId, 'oferta_rechazada', 'Offer', o.id, 'Rechazo sin penalización; sigue en espera.');
  return ok('Oferta rechazada. Seguís en lista de espera, sin penalización.');
};

// ---- Educación ----
const getProgress = (d: DemoState, cardId: string) => {
  if (!LEARNING_CARDS.some((c) => c.id === cardId)) fail('NO_EXISTE', 'Tarjeta inexistente.');
  let p = d.learning.find((x) => x.cardId === cardId);
  if (!p) { p = { cardId, state: 'nuevo', attempts: 0, lastChoiceId: null, opens: 0, rereads: 0, completedAt: null }; d.learning.push(p); }
  return p;
};
const learningOpen: Handler<'learningOpen'> = (d, c) => {
  const p = getProgress(d, c.cardId);
  p.opens += 1;
  if (p.state === 'completo') p.rereads += 1;
  if (p.state === 'nuevo') p.state = 'en_curso';
  return ok(p.state === 'completo' ? 'Relectura: tu sello se mantiene.' : 'Tarjeta abierta.');
};
const learningAnswer: Handler<'learningAnswer'> = (d, c) => {
  const p = getProgress(d, c.cardId);
  const card = LEARNING_CARDS.find((x) => x.id === c.cardId)!;
  const choice = card.options.find((o) => o.id === c.choiceId) ?? fail('DATOS_INVALIDOS', 'Opción inexistente.');
  p.attempts += 1; p.lastChoiceId = choice.id;
  if (p.state === 'nuevo') p.state = 'en_curso';
  if (choice.correct && p.state === 'en_curso') p.state = 'comprendido';
  return ok(choice.correct ? 'Comprendido.' : 'Podés intentar de nuevo, sin penalización.', undefined, { correct: choice.correct });
};
const learningComplete: Handler<'learningComplete'> = (d, c) => {
  const p = getProgress(d, c.cardId);
  if (p.state === 'completo') fail('YA_COMPLETA', 'Ya tenías este sello; completar de nuevo no suma.');
  if (p.state !== 'comprendido') fail('ESTADO_INVALIDO', 'Primero elegí la opción que resuelve la situación.');
  p.state = 'completo'; p.completedAt = d.clock;
  return ok('Sello guardado en este dispositivo.');
};
const learningReset: Handler<'learningReset'> = (d) => {
  d.learning = LEARNING_CARDS.map((c) => ({ cardId: c.id, state: 'nuevo', attempts: 0, lastChoiceId: null, opens: 0, rereads: 0, completedAt: null }));
  return ok('Colección reiniciada.');
};

// ---- Llamada ----
const callSave: Handler<'callSave'> = (d, c) => {
  const id = nextId(d, 'CS');
  const session: CallSession = { id, personId: c.personId, requestId: c.requestId, branch: c.branch, status: c.status, transcript: c.transcript.slice(0, 80).map((l) => ({ from: l.from, text: l.text.slice(0, 400) })), startedAt: c.startedAt, endedAt: d.clock, appointmentId: c.appointmentId };
  d.callSessions.push(session);
  audit(d, c.commandId, 'llamada_simulada', 'CallSession', id, `Rama ${c.branch} · ${c.status} · ${session.transcript.length} líneas${c.requestId ? ' · gestión ' + c.requestId : ''}`);
  return ok('Transcripción de la llamada simulada guardada.', { callSessionId: id });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HANDLERS: Record<string, (d: DemoState, c: any) => CommandResultOk> = {
  book, reschedule, cancel, confirmAppointment, patientConfirm, transition, requestHumanChange, createRequest, updateRequest, chatStaffReply, createTask, updateTask,
  createPerson, updatePerson, setReminderOptIn, addBlock, removeBlock, updateRule, updateServiceDuration, setAutomationRule, setSetting, advanceClock,
  toothMark, toothUndo, toothDone, episodeIndicateControl, episodeNote, episodeSetAppliance, estimateCreate, estimateAddLine, estimateRemoveLine,
  estimateTransition, estimateFollowUp, ledgerRecord, ledgerReverse, waitlistAdd, waitlistRemove, offerCreate, offerAccept, offerReject,
  learningOpen, learningAnswer, learningComplete, learningReset, callSave,
};

export function registerHandler(type: string, h: (d: DemoState, c: Command) => CommandResultOk) { HANDLERS[type] = h; }

export interface ExecResult { state: DemoState; result: CommandResult; replayed: boolean }

/** Transacción local: valida y aplica sobre una copia; sólo si todo sale bien se sustituye el estado. */
export function execute(state: DemoState, cmd: Command): ExecResult {
  const prev = state.processed[cmd.commandId];
  if (prev) return { state, result: prev, replayed: true };
  const handler = HANDLERS[cmd.type];
  if (!handler) return { state, result: { ok: false, code: 'COMANDO_DESCONOCIDO', message: `Comando ${cmd.type} desconocido.` }, replayed: false };
  const draft: DemoState = structuredClone(state);
  try {
    const result = handler(draft, cmd);
    draft.processed[cmd.commandId] = result;
    draft.revision = state.revision + 1;
    return { state: draft, result, replayed: false };
  } catch (e) {
    if (e instanceof DomainError) {
      if (e.result.code === 'COMMIT_FALLIDO') {
        // El fallo simulado se consume, pero no toca ningún dato de dominio.
        return { state: { ...state, revision: state.revision + 1, settings: { ...state.settings, failNextCommits: state.settings.failNextCommits - 1 } }, result: e.result, replayed: false };
      }
      return { state, result: e.result, replayed: false };
    }
    throw e;
  }
}

/** Ejecuta un comando interno dentro de otro (chat): si falla, el borrador externo no cambia salvo el consumo del fallo simulado. */
export function runInner(draft: DemoState, cmd: Command): CommandResult {
  const r = execute(draft, cmd);
  if (r.result.ok) {
    const { processed: _p, revision: _r, ...rest } = r.state;
    void _p; void _r;
    Object.assign(draft, rest);
    draft.processed[cmd.commandId] = r.result;
  } else if (r.result.code === 'COMMIT_FALLIDO') {
    draft.settings.failNextCommits = Math.max(0, draft.settings.failNextCommits - 1);
  }
  return r.result;
}

export { findSlots };
