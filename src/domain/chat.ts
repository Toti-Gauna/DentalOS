// Emulador local de WhatsApp: intenciones por reglas, sin IA ni red. Ningún mensaje se envía de verdad.
import { DomainError, nextId, registerHandler, runInner, type Command } from './commands';
import { findSlots, isActive, resolveChair } from './scheduling';
import { addDays, at, fmtShort, parts, toMs } from './time';
import type { ChatFlow, CommandResultOk, Conversation, DemoState, QuickReply, SlotRef } from './types';

export const GREETING = 'Hola, soy el asistente administrativo de esta demo de Clínica Brisa. Podés pedir un turno, cambiarlo o hablar con recepción. No evalúo problemas clínicos.';
export const SAVED_CHANGE = 'Cambio guardado en esta demo. Recepción ve el mismo turno actualizado. No enviamos mensajes reales.';
export const KEPT_ORIGINAL = 'Conservamos tu turno anterior';

export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9:\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export type Intent = 'clinico' | 'negacion' | 'ambiguo' | 'humano' | 'cancelar' | 'reprogramar' | 'horarios' | 'ubicacion' | 'reservar' | 'saludo' | 'si' | 'no' | 'desconocido';

const has = (t: string, re: RegExp) => re.test(t);
const CLINICO = /\b(duel\w*|dolor\w*|medicament\w*|remedio\w*|pastilla\w*|antibiotic\w*|ibuprofeno|paracetamol|sangr\w*|hinchad\w*|hinchazon|infecc\w*|fiebre|absceso|flemon|inflamad\w*|urgencia|urgente|me rompi|se me rompio|se me cayo)\b/;
const CANCELAR = /\b(cancel\w*|anul\w*|dar de baja|borrar el turno)\b/;
const REPROGRAMAR = /\b(mover|movel\w*|cambi\w*|reprogram\w*|posterg\w*|pospon\w*|adelant\w*|otro dia|otro horario|pasar el turno)\b/;
const HUMANO = /\b(humano|recepcion|persona|operador\w*|alguien|secretari\w*|hablar con)\b/;
const HORARIOS = /\b(horario\w*|cuando atienden|que dias|abren|atienden|sabado\w*|domingo\w*)\b/;
const UBICACION = /\b(direccion|ubicacion|ubicados|donde quedan|donde estan|donde es|como llego|sede\w*|mapa)\b/;
const RESERVAR = /\b(turno\w*|cita\w*|reserv\w*|sacar|pedir hora|primera consulta|consulta)\b/;
const SALUDO = /^(hola+|holis|buen dia|buenos dias|buenas|buenas tardes|buenas noches|que tal)( .*)?$/;
const NEGACION = /\bno\b.*\b(cancel\w*|anul\w*|mover|cambi\w*|reprogram\w*)/;

export function detectIntent(raw: string): Intent {
  const t = normalize(raw);
  if (!t) return 'desconocido';
  if (has(t, CLINICO)) return 'clinico';
  if (has(t, NEGACION)) return 'negacion';
  const c = has(t, CANCELAR); const r = has(t, REPROGRAMAR);
  if (c && r) return 'ambiguo';
  if (has(t, HUMANO)) return 'humano';
  if (c) return 'cancelar';
  if (r) return 'reprogramar';
  if (has(t, HORARIOS)) return 'horarios';
  if (has(t, UBICACION)) return 'ubicacion';
  if (has(t, RESERVAR)) return 'reservar';
  if (has(t, SALUDO)) return 'saludo';
  if (/^(si|sii+|dale|ok|confirmo|de acuerdo|perfecto)$/.test(t)) return 'si';
  if (/^(no|nop|mejor no)$/.test(t)) return 'no';
  return 'desconocido';
}

const DAY_WORDS: Record<string, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0 };
/** "martes 11", "miércoles 15:00", "jueves a las 9.30" → fecha futura más próxima. */
export function parseDayTime(raw: string, clock: string): string | null {
  const t = normalize(raw).replace(/(\d)\.(\d)/g, '$1:$2');
  const day = Object.keys(DAY_WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(t));
  const hm = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:h|hs|horas)?\b/);
  if (!day || !hm) return null;
  const h = Number(hm[1]); const m = Number(hm[2] ?? '0');
  if (h > 23 || m > 59) return null;
  const today = parts(clock);
  let delta = (DAY_WORDS[day] - today.weekday + 7) % 7;
  const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (delta === 0 && toMs(at(today.date, hhmm)) <= toMs(clock)) delta = 7;
  return at(addDays(today.date, delta), hhmm);
}

const MENU: QuickReply[] = [
  { id: 'menu:reservar', label: 'Pedir un turno' },
  { id: 'menu:reprogramar', label: 'Cambiar mi turno' },
  { id: 'menu:cancelar', label: 'Cancelar un turno' },
  { id: 'menu:info', label: 'Horarios y ubicación' },
  { id: 'menu:humano', label: 'Hablar con recepción' },
];
const BACK: QuickReply = { id: 'back', label: 'Volver al menú' };

const fail = (code: string, message: string): never => { throw new DomainError({ ok: false, code, message }); };

function say(d: DemoState, conv: Conversation, text: string, replies?: QuickReply[]) {
  d.messages.push({ id: nextId(d, 'M'), conversationId: conv.id, from: 'asistente', text, at: d.clock, replies, simulated: 'entregado_simulado' });
  conv.updatedAt = d.clock;
}
function setFlow(conv: Conversation, flow: ChatFlow) { conv.flow = flow; }

const svcName = (d: DemoState, id: string) => d.serviceTypes.find((s) => s.id === id)?.name ?? id;
const proName = (d: DemoState, id: string) => d.professionals.find((p) => p.id === id)?.name ?? id;
const locName = (d: DemoState, id: string) => d.locations.find((l) => l.id === id)?.name ?? id;
const chairName = (d: DemoState, id: string) => d.chairs.find((c) => c.id === id)?.name ?? id;
const apptLabel = (d: DemoState, id: string) => {
  const a = d.appointments.find((x) => x.id === id)!;
  return `${svcName(d, a.serviceTypeId)} · ${fmtShort(a.start)} (${a.id})`;
};
const slotLabel = (d: DemoState, s: SlotRef) => `${fmtShort(s.start)} · ${proName(d, s.professionalId)}`;

function activeFutureAppointments(d: DemoState, personId: string) {
  return d.appointments
    .filter((a) => a.personId === personId && (a.status === 'confirmada' || a.status === 'solicitada') && toMs(a.start) > toMs(d.clock))
    .sort((a, b) => toMs(a.start) - toMs(b.start));
}

function showMenu(d: DemoState, conv: Conversation, text = '¿Qué querés hacer?') {
  setFlow(conv, { step: 'menu' });
  say(d, conv, text, MENU);
}

function requireIdentity(d: DemoState, conv: Conversation): boolean {
  if (conv.personId) return true;
  setFlow(conv, { step: 'offer_human', intent: 'humano' });
  say(d, conv, 'Para gestionar turnos necesito que recepción te identifique por tu ID de paciente. No uso tu nombre para buscar porque puede haber homónimos.', [{ id: 'human_yes', label: 'Sí, hablar con recepción' }, BACK]);
  return false;
}

function ensureRequest(d: DemoState, conv: Conversation, kind: 'reprogramacion' | 'cancelacion' | 'reserva' | 'derivacion' | 'consulta', summary: string, appointmentId: string | null): string {
  const existing = d.requests.find((r) => r.id === conv.requestId && r.status !== 'resuelta' && r.status !== 'descartada' && r.kind === kind);
  if (existing) return existing.id;
  const id = nextId(d, 'R');
  d.requests.push({ id, kind, personId: conv.personId, status: 'pendiente', channel: 'whatsapp', appointmentId, summary, assigneeId: null, note: '', nextStep: 'Seguir la conversación; nada se confirma sin acción explícita.', createdAt: d.clock, updatedAt: d.clock });
  conv.requestId = id;
  return id;
}

// ---------- Reprogramar (A03) ----------
function startChangeFor(d: DemoState, conv: Conversation, apptId: string) {
  const a = d.appointments.find((x) => x.id === apptId)!;
  const hours = (toMs(a.start) - toMs(d.clock)) / 3_600_000;
  if (hours < d.settings.changeWindowHours) {
    setFlow(conv, { step: 'window_help', intent: 'reprogramar', appointmentId: a.id, appointmentVersion: a.version });
    say(d, conv, `Tu turno ${apptLabel(d, a.id)} es en menos de ${d.settings.changeWindowHours} h. No puedo moverlo desde acá; puedo pedirle a recepción que lo revise. Tu turno sigue igual.`, [{ id: 'window_help', label: 'Pedir ayuda a recepción' }, BACK]);
    return;
  }
  const requestId = ensureRequest(d, conv, 'reprogramacion', `Gestión de cambio de ${a.id} iniciada por WhatsApp.`, a.id);
  const pref = sameTimeOtherDay(d, a.id);
  const replies: QuickReply[] = [];
  if (pref) replies.push({ id: 'pref', label: `Mismo horario: ${fmtShort(pref)}` });
  replies.push({ id: 'more', label: 'Ver horarios libres' }, BACK);
  setFlow(conv, { step: 'pick_slot', intent: 'reprogramar', appointmentId: a.id, appointmentVersion: a.version, requestId, chosen: undefined, candidates: [] });
  say(d, conv, `Tu turno actual: ${apptLabel(d, a.id)}, versión ${a.version}. Sigue reservado mientras elegimos. Gestión ${requestId}. ¿Qué horario preferís? También podés escribir, por ejemplo, "martes 11".`, replies);
}

/** Mismo horario del turno, en el primer día laborable de la profesional después de hoy (no valida ocupación: eso lo hace el motor). */
function sameTimeOtherDay(d: DemoState, apptId: string): string | null {
  const a = d.appointments.find((x) => x.id === apptId)!;
  const hhmm = parts(a.start).hhmm;
  const today = parts(d.clock).date;
  for (let i = 1; i <= 14; i++) {
    const date = addDays(today, i);
    if (date === parts(a.start).date) continue;
    const wd = parts(at(date, '12:00')).weekday;
    if (d.availabilityRules.some((r) => r.professionalId === a.professionalId && r.locationId === a.locationId && r.weekday === wd && r.start <= hhmm && hhmm < r.end)) return at(date, hhmm);
  }
  return null;
}

function tryCandidate(d: DemoState, conv: Conversation, start: string) {
  const f = conv.flow;
  const a = d.appointments.find((x) => x.id === f.appointmentId)!;
  const { slot, conflicts } = resolveChair(d, a.serviceTypeId, a.professionalId, a.locationId, start, { ignoreAppointmentId: a.id, personId: a.personId });
  if (slot) return review(d, conv, slot);
  const reason = conflicts[0]?.message ?? 'Ese horario no está disponible.';
  const alternatives = findSlots(d, { serviceTypeId: a.serviceTypeId, professionalId: a.professionalId, locationId: a.locationId, from: start, limit: 2, ignoreAppointmentId: a.id, personId: a.personId });
  setFlow(conv, { ...f, step: 'pick_slot', candidates: alternatives, chosen: undefined });
  const kept = `${KEPT_ORIGINAL}: ${apptLabel(d, a.id)}.`;
  if (!alternatives.length) {
    say(d, conv, `${fmtShort(start)} no está disponible: ${reason} ${kept} No encontré alternativas cercanas.`, [{ id: 'more', label: 'Ver horarios libres' }, { id: 'human_yes', label: 'Hablar con recepción' }, BACK]);
    return;
  }
  say(d, conv, `${fmtShort(start)} está ocupado: ${reason} ${kept} Opciones compatibles:`, [
    ...alternatives.map((s, i) => ({ id: `slot:${i}`, label: slotLabel(d, s) })),
    { id: 'more', label: 'Ver más horarios' }, BACK,
  ]);
}

function listFree(d: DemoState, conv: Conversation) {
  const f = conv.flow;
  const a = d.appointments.find((x) => x.id === f.appointmentId)!;
  const slots = findSlots(d, { serviceTypeId: a.serviceTypeId, professionalId: a.professionalId, locationId: a.locationId, limit: 3, ignoreAppointmentId: a.id, personId: a.personId }).filter((s) => s.start !== a.start);
  setFlow(conv, { ...f, step: 'pick_slot', candidates: slots });
  if (!slots.length) { say(d, conv, `No encontré horarios libres en los próximos ${d.settings.horizonDays} días. ${KEPT_ORIGINAL}.`, [{ id: 'human_yes', label: 'Hablar con recepción' }, BACK]); return; }
  say(d, conv, `Horarios libres con ${proName(d, a.professionalId)} (${locName(d, a.locationId)}):`, [...slots.map((s, i) => ({ id: `slot:${i}`, label: slotLabel(d, s) })), BACK]);
}

function review(d: DemoState, conv: Conversation, slot: SlotRef) {
  const f = conv.flow;
  const a = d.appointments.find((x) => x.id === f.appointmentId)!;
  setFlow(conv, { ...f, step: 'review_change', chosen: slot });
  say(d, conv, `Revisá el cambio. Antes: ${fmtShort(a.start)}. Después: ${fmtShort(slot.start)}. Mismo turno ${a.id} (versión ${a.version} → ${a.version + 1}), ${proName(d, slot.professionalId)}, ${locName(d, slot.locationId)}, ${chairName(d, slot.chairId)}. ¿Confirmás el cambio?`, [
    { id: 'confirm', label: 'Confirmar cambio' }, { id: 'more', label: 'Elegir otro horario' }, { id: 'back', label: 'Volver sin cambiar' },
  ]);
}

function confirmChange(d: DemoState, conv: Conversation) {
  const f = conv.flow;
  const a = d.appointments.find((x) => x.id === f.appointmentId);
  if (!a || !f.chosen) return showMenu(d, conv, 'No hay un cambio pendiente de confirmar.');
  if (a.version !== f.appointmentVersion || !isActive(a)) {
    setFlow(conv, { step: 'menu' });
    say(d, conv, `Tu turno cambió mientras tanto. Estado actual: ${apptLabel(d, a.id)}, versión ${a.version}, ${a.status}. No apliqué nada.`, MENU);
    return;
  }
  const cmd: Command = { commandId: `resched:${a.id}:v${a.version}:${f.chosen.start}`, type: 'reschedule', appointmentId: a.id, start: f.chosen.start, chairId: f.chosen.chairId, channel: 'whatsapp', expectedVersion: a.version };
  const r = runInner(d, cmd);
  const after = d.appointments.find((x) => x.id === a.id)!;
  if (r.ok) {
    const req = d.requests.find((x) => x.id === f.requestId);
    if (req) { req.status = 'resuelta'; req.note = `Resuelta por autoservicio: ${after.id} v${after.version} confirmado por la persona.`; req.nextStep = 'Nada pendiente.'; req.updatedAt = d.clock; }
    setFlow(conv, { step: 'menu' });
    say(d, conv, `${SAVED_CHANGE} ${after.id} ahora: ${fmtShort(after.start)} (versión ${after.version}). El recordatorio de la versión anterior quedó anulado.`, MENU);
    return;
  }
  if (r.code === 'COMMIT_FALLIDO') {
    say(d, conv, `No pudimos guardar el cambio (error simulado). ${KEPT_ORIGINAL}: ${apptLabel(d, a.id)}, versión ${after.version}.`, [{ id: 'confirm', label: 'Reintentar' }, { id: 'more', label: 'Elegir otro horario' }, { id: 'human_yes', label: 'Hablar con recepción' }]);
    return;
  }
  setFlow(conv, { ...f, step: 'pick_slot', chosen: undefined });
  tryCandidate(d, conv, f.chosen.start);
}

// ---------- Cancelar ----------
function startCancelFor(d: DemoState, conv: Conversation, apptId: string) {
  const a = d.appointments.find((x) => x.id === apptId)!;
  setFlow(conv, { step: 'confirm_cancel', intent: 'cancelar', appointmentId: a.id, appointmentVersion: a.version });
  say(d, conv, `Vas a cancelar: ${apptLabel(d, a.id)} con ${proName(d, a.professionalId)}, ${locName(d, a.locationId)}. El cupo queda libre. ¿Confirmás la cancelación?`, [{ id: 'cancel_yes', label: 'Sí, cancelar este turno' }, { id: 'cancel_no', label: 'No, mantenerlo' }]);
}
function confirmCancel(d: DemoState, conv: Conversation) {
  const f = conv.flow;
  const a = d.appointments.find((x) => x.id === f.appointmentId);
  if (!a || a.version !== f.appointmentVersion || !isActive(a)) return showMenu(d, conv, 'El turno cambió o ya no está activo. No cancelé nada.');
  const r = runInner(d, { commandId: `cancel:${a.id}:v${a.version}`, type: 'cancel', appointmentId: a.id, channel: 'whatsapp', reason: 'Pedido por WhatsApp (muestra)' });
  if (r.ok) { setFlow(conv, { step: 'menu' }); say(d, conv, `Cancelación registrada en esta demo para ${a.id}. Recepción ve el mismo estado. No enviamos mensajes reales.`, MENU); return; }
  say(d, conv, `No pude cancelar: ${r.message} ${KEPT_ORIGINAL}.`, [{ id: 'cancel_yes', label: 'Reintentar' }, { id: 'cancel_no', label: 'Mantener turno' }]);
}

// ---------- Reservar (A02) ----------
function startBook(d: DemoState, conv: Conversation) {
  if (!requireIdentity(d, conv)) return;
  const hasControl = d.careEpisodes.some((e) => e.personId === conv.personId && e.status === 'activo' && e.controls.some((c) => c.status === 'indicado'));
  const services = d.serviceTypes.filter((s) => s.selfService && (!s.requiresIndicatedControl || hasControl));
  setFlow(conv, { step: 'pick_service', intent: 'reservar' });
  say(d, conv, '¿Qué motivo administrativo querés reservar?', [...services.map((s) => ({ id: `svc:${s.id}`, label: `${s.name} (${s.durationMin} min)` })), BACK]);
}
function pickService(d: DemoState, conv: Conversation, serviceTypeId: string) {
  const slots = findSlots(d, { serviceTypeId, limit: 3, personId: conv.personId! });
  if (!slots.length) {
    setFlow(conv, { step: 'offer_waitlist', intent: 'reservar', serviceTypeId });
    say(d, conv, `No hay cupos de ${svcName(d, serviceTypeId)} en los próximos ${d.settings.horizonDays} días. Puedo sumarte a la lista de espera (no es una reserva) o derivarte a recepción.`, [{ id: 'wait_yes', label: 'Sumarme a la lista de espera' }, { id: 'human_yes', label: 'Hablar con recepción' }, BACK]);
    return;
  }
  setFlow(conv, { step: 'pick_new_slot', intent: 'reservar', serviceTypeId, candidates: slots });
  say(d, conv, `Cupos de ${svcName(d, serviceTypeId)}:`, [...slots.map((s, i) => ({ id: `slot:${i}`, label: `${slotLabel(d, s)} · ${locName(d, s.locationId)}` })), BACK]);
}
function reviewBook(d: DemoState, conv: Conversation, slot: SlotRef) {
  const st = d.serviceTypes.find((s) => s.id === slot.serviceTypeId)!;
  setFlow(conv, { ...conv.flow, step: 'review_book', chosen: slot });
  const note = st.needsReceptionConfirmation ? 'Queda como solicitud: recepción la confirma.' : 'Queda confirmado al aceptar.';
  say(d, conv, `Revisá: ${st.name}, ${fmtShort(slot.start)}, ${proName(d, slot.professionalId)}, ${locName(d, slot.locationId)}. ${note} ¿Confirmás?`, [{ id: 'confirm', label: st.needsReceptionConfirmation ? 'Enviar solicitud' : 'Confirmar turno' }, BACK]);
}
function confirmBook(d: DemoState, conv: Conversation) {
  const s = conv.flow.chosen;
  if (!s) return showMenu(d, conv);
  const r = runInner(d, { commandId: `book:${conv.id}:${s.serviceTypeId}:${s.start}`, type: 'book', personId: conv.personId!, serviceTypeId: s.serviceTypeId, professionalId: s.professionalId, chairId: s.chairId, locationId: s.locationId, start: s.start, channel: 'whatsapp', requestId: conv.requestId ?? undefined });
  if (r.ok) {
    const a = d.appointments.find((x) => x.id === r.ids?.appointmentId)!;
    if (a.requestId) conv.requestId = a.requestId;
    setFlow(conv, { step: 'menu' });
    say(d, conv, a.status === 'solicitada'
      ? `Solicitud ${a.requestId} enviada para ${fmtShort(a.start)} (${a.id}). El cupo queda reservado y recepción la confirma: todavía no es un turno confirmado. No enviamos mensajes reales.`
      : `Turno confirmado en esta demo: ${apptLabel(d, a.id)}. No enviamos mensajes reales.`, MENU);
    return;
  }
  if (r.code === 'DUPLICADO') { setFlow(conv, { step: 'menu' }); say(d, conv, `${r.message}`, MENU); return; }
  if (r.code === 'COMMIT_FALLIDO') { say(d, conv, 'No pudimos guardar (error simulado). No se creó ningún turno.', [{ id: 'confirm', label: 'Reintentar' }, BACK]); return; }
  pickServiceAfterConflict(d, conv, s.serviceTypeId, r.message);
}
function pickServiceAfterConflict(d: DemoState, conv: Conversation, serviceTypeId: string, why: string) {
  say(d, conv, `No se pudo reservar: ${why}`);
  pickService(d, conv, serviceTypeId);
}

// ---------- Humano / clínico (A08) ----------
function offerHuman(d: DemoState, conv: Conversation, clinical: boolean) {
  setFlow(conv, { step: 'offer_human', intent: clinical ? 'clinico' : 'humano' });
  if (clinical) {
    say(d, conv, 'Soy un asistente administrativo: no puedo evaluar síntomas, indicar medicación ni decir si es urgente. Si querés, paso tu consulta a recepción para que una persona del equipo te contacte; no puedo garantizar un tiempo de respuesta. Ante una emergencia, comunicate con un servicio de emergencias.', [{ id: 'human_yes', label: 'Sí, hablar con recepción' }, BACK]);
  } else {
    say(d, conv, '¿Querés que derive esta conversación a recepción? Una persona la va a tomar; no puedo garantizar un tiempo de respuesta.', [{ id: 'human_yes', label: 'Sí, derivar' }, { id: 'back', label: 'No, volver al menú' }]);
  }
}
function deriveHuman(d: DemoState, conv: Conversation, commandId: string) {
  const clinical = conv.flow.intent === 'clinico';
  const reqId = ensureRequest(d, conv, 'derivacion', clinical ? 'Pidió hablar con una persona sobre un tema clínico. Sin clasificar gravedad.' : 'Pidió hablar con recepción por WhatsApp.', conv.flow.appointmentId ?? null);
  const dedupeKey = `deriv:${conv.id}:${reqId}`;
  if (!d.tasks.some((t) => t.dedupeKey === dedupeKey && t.status !== 'resuelta')) {
    const id = nextId(d, 'T');
    d.tasks.push({ id, kind: 'derivacion', title: `Derivación desde WhatsApp (${conv.contactLabel})`, detail: clinical ? 'Contenido clínico: derivar a una persona. El asistente no evaluó ni clasificó.' : 'Pedido de atención humana.', status: 'abierta', assigneeId: null, dueAt: null, personId: conv.personId, requestId: reqId, appointmentId: conv.flow.appointmentId ?? null, estimateId: null, dedupeKey, note: '', createdAt: d.clock, ruleId: 'A08' });
    d.audit.push({ id: nextId(d, 'EV'), at: d.clock, type: 'derivacion', entity: 'Task', entityId: id, detail: `Derivación humana desde ${conv.id}`, commandId });
  }
  conv.status = 'derivada';
  setFlow(conv, { step: 'menu' });
  say(d, conv, `Listo: tu conversación quedó derivada a recepción (gestión ${reqId}). Queda pendiente hasta que una persona la tome. No enviamos mensajes reales.`, MENU);
}

function requestWindowHelp(d: DemoState, conv: Conversation, commandId: string) {
  const f = conv.flow;
  const r = runInner(d, { commandId: `exc:${f.appointmentId}:v${f.appointmentVersion}:${commandId}`, type: 'requestHumanChange', appointmentId: f.appointmentId!, channel: 'whatsapp', note: 'Pedido desde WhatsApp' });
  setFlow(conv, { step: 'menu' });
  say(d, conv, r.ok ? `${r.message}` : `No pude crear el pedido: ${r.message}`, MENU);
}

function infoText(d: DemoState) {
  return d.locations.map((l) => `${l.name}: ${l.address}. ${l.hoursText}.`).join(' ') + ' Direcciones ficticias de la demo.';
}

// ---------- Ruteo ----------
function handleIntent(d: DemoState, conv: Conversation, intent: Intent, commandId: string) {
  const f = conv.flow;
  switch (intent) {
    case 'clinico': return offerHuman(d, conv, true);
    case 'negacion': return showMenu(d, conv, 'Entendido, no cancelo ni cambio nada. Tus turnos siguen igual.');
    case 'ambiguo':
      setFlow(conv, { step: 'menu' });
      return say(d, conv, '¿Querés cambiar el turno a otro horario o cancelarlo? Elegí una opción.', [{ id: 'menu:reprogramar', label: 'Cambiarlo de horario' }, { id: 'menu:cancelar', label: 'Cancelarlo' }, BACK]);
    case 'humano': return offerHuman(d, conv, false);
    case 'cancelar': return startAppointmentFlow(d, conv, 'cancelar');
    case 'reprogramar': return startAppointmentFlow(d, conv, 'reprogramar');
    case 'horarios': case 'ubicacion': setFlow(conv, { step: 'menu' }); return say(d, conv, infoText(d), MENU);
    case 'reservar': return startBook(d, conv);
    case 'saludo': setFlow(conv, { step: 'menu' }); return say(d, conv, GREETING, MENU);
    case 'si':
      if (f.step === 'review_change') return confirmChange(d, conv);
      if (f.step === 'confirm_cancel') return confirmCancel(d, conv);
      if (f.step === 'review_book') return confirmBook(d, conv);
      if (f.step === 'offer_human') return deriveHuman(d, conv, commandId);
      return showMenu(d, conv, 'No hay nada pendiente de confirmar.');
    case 'no':
      if (f.step === 'confirm_cancel') return showMenu(d, conv, 'Perfecto, mantengo tu turno sin cambios.');
      return showMenu(d, conv, 'De acuerdo, no hice ningún cambio.');
    default: {
      const n = (f.fallbackCount ?? 0) + 1;
      setFlow(conv, { step: 'menu', fallbackCount: n });
      return say(d, conv, n > 1 ? 'Sigo sin entender ese mensaje y no quiero inventar una respuesta. ¿Querés hablar con recepción?' : 'No entendí ese mensaje. Puedo ayudarte con estas tareas:', n > 1 ? [{ id: 'menu:humano', label: 'Hablar con recepción' }, ...MENU.slice(0, 4)] : MENU);
    }
  }
}

function startAppointmentFlow(d: DemoState, conv: Conversation, intent: 'cancelar' | 'reprogramar') {
  if (!requireIdentity(d, conv)) return;
  const appts = activeFutureAppointments(d, conv.personId!);
  if (!appts.length) return showMenu(d, conv, 'No encontré turnos activos a tu nombre (por ID). ¿Querés pedir uno?');
  if (appts.length > 1) {
    setFlow(conv, { step: 'pick_appt', intent });
    say(d, conv, `Tenés ${appts.length} turnos activos. ¿Cuál querés ${intent === 'cancelar' ? 'cancelar' : 'cambiar'}?`, [...appts.map((a) => ({ id: `appt:${a.id}`, label: apptLabel(d, a.id) })), BACK]);
    return;
  }
  if (intent === 'cancelar') startCancelFor(d, conv, appts[0].id); else startChangeFor(d, conv, appts[0].id);
}

function handleReply(d: DemoState, conv: Conversation, replyId: string, commandId: string) {
  const f = conv.flow;
  if (replyId === 'back') return showMenu(d, conv, 'Volvimos al menú. No se cambió nada.');
  if (replyId.startsWith('menu:')) {
    const k = replyId.slice(5);
    if (k === 'info') return handleIntent(d, conv, 'horarios', commandId);
    return handleIntent(d, conv, k as Intent, commandId);
  }
  if (replyId.startsWith('appt:')) {
    const id = replyId.slice(5);
    return f.intent === 'cancelar' ? startCancelFor(d, conv, id) : startChangeFor(d, conv, id);
  }
  if (replyId === 'pref') {
    const pref = sameTimeOtherDay(d, f.appointmentId!);
    return pref ? tryCandidate(d, conv, pref) : listFree(d, conv);
  }
  if (replyId === 'more') return f.intent === 'reservar' ? pickService(d, conv, f.serviceTypeId!) : listFree(d, conv);
  if (replyId.startsWith('slot:')) {
    const slot = f.candidates?.[Number(replyId.slice(5))];
    if (!slot) return showMenu(d, conv, 'Esa opción ya no está vigente.');
    return f.intent === 'reservar' ? reviewBook(d, conv, slot) : review(d, conv, slot);
  }
  if (replyId.startsWith('svc:')) return pickService(d, conv, replyId.slice(4));
  if (replyId === 'confirm') return f.step === 'review_book' ? confirmBook(d, conv) : confirmChange(d, conv);
  if (replyId === 'cancel_yes') return confirmCancel(d, conv);
  if (replyId === 'cancel_no') return showMenu(d, conv, 'Perfecto, mantengo tu turno sin cambios.');
  if (replyId === 'human_yes') return deriveHuman(d, conv, commandId);
  if (replyId === 'window_help') return requestWindowHelp(d, conv, commandId);
  if (replyId === 'wait_yes') {
    const r = runInner(d, { commandId: `wait:${conv.personId}:${f.serviceTypeId}`, type: 'waitlistAdd', personId: conv.personId!, serviceTypeId: f.serviceTypeId!, professionalId: null, locationId: null, period: 'cualquiera', validDays: 30 });
    return showMenu(d, conv, r.ok ? `${r.message} Si se libera un cupo compatible, recepción te lo ofrece.` : r.message);
  }
  return showMenu(d, conv);
}

function getConv(d: DemoState, id: string) {
  return d.conversations.find((c) => c.id === id) ?? fail('NO_EXISTE', 'Conversación inexistente.');
}

export function activeReplies(d: DemoState, conversationId: string): QuickReply[] {
  const msgs = d.messages.filter((m) => m.conversationId === conversationId);
  const last = msgs[msgs.length - 1];
  return last && last.from === 'asistente' && last.replies ? last.replies : [];
}

registerHandler('chatSend', (d, c) => {
  if (c.type !== 'chatSend') throw new Error('tipo');
  const conv = getConv(d, c.conversationId);
  const text = c.text.trim();
  if (!text) fail('VACIO', 'Escribí un mensaje: los espacios en blanco no se envían.');
  if (text.length > 500) fail('LARGO', 'Máximo 500 caracteres en la demo.');
  d.messages.push({ id: nextId(d, 'M'), conversationId: conv.id, from: 'paciente', text, at: d.clock, simulated: 'entregado_simulado' });
  if (conv.status === 'cerrada') conv.status = 'abierta';
  const f = conv.flow;
  if (f.step === 'pick_slot' && f.intent === 'reprogramar') {
    const when = parseDayTime(text, d.clock);
    if (when) { tryCandidate(d, conv, when); return okChat(); }
  }
  handleIntent(d, conv, detectIntent(text), c.commandId);
  return okChat();
});

registerHandler('chatChoose', (d, c) => {
  if (c.type !== 'chatChoose') throw new Error('tipo');
  const conv = getConv(d, c.conversationId);
  const reply = activeReplies(d, conv.id).find((r) => r.id === c.replyId);
  if (!reply) fail('OPCION_OBSOLETA', 'Esa opción pertenece a un mensaje anterior y ya no está vigente.');
  d.messages.push({ id: nextId(d, 'M'), conversationId: conv.id, from: 'paciente', text: reply!.label, at: d.clock, simulated: 'entregado_simulado' });
  if (conv.status === 'cerrada') conv.status = 'abierta';
  handleReply(d, conv, reply!.id, c.commandId);
  return okChat();
});

registerHandler('chatOpen', (d, c) => {
  if (c.type !== 'chatOpen') throw new Error('tipo');
  const conv = getConv(d, c.conversationId);
  const f = conv.flow;
  if (f.appointmentId) {
    const a = d.appointments.find((x) => x.id === f.appointmentId);
    if (a && (a.version !== f.appointmentVersion || !isActive(a))) {
      setFlow(conv, { step: 'menu' });
      d.messages.push({ id: nextId(d, 'M'), conversationId: conv.id, from: 'sistema', text: `Hubo un cambio reciente: ${a.id} está ${a.status} para ${fmtShort(a.start)} (versión ${a.version}). Los mensajes anteriores son historial y no confirman nada.`, at: d.clock, simulated: 'entregado_simulado' });
      say(d, conv, '¿Qué querés hacer ahora?', MENU);
      return { ok: true, message: 'Conversación actualizada con el estado actual.' };
    }
  }
  const msgs = d.messages.filter((m) => m.conversationId === conv.id);
  if (!msgs.length) say(d, conv, GREETING, MENU);
  else if (!activeReplies(d, conv.id).length && conv.flow.step === 'menu') say(d, conv, '¿En qué te ayudo hoy? Los mensajes anteriores son historial.', MENU);
  return { ok: true, message: 'Conversación abierta.' };
});

registerHandler('chatLinkRequest', (d, c) => {
  if (c.type !== 'chatLinkRequest') throw new Error('tipo');
  const conv = getConv(d, c.conversationId);
  if (c.requestId) {
    const r = d.requests.find((x) => x.id === c.requestId) ?? fail('NO_EXISTE', 'Gestión inexistente.');
    if (conv.personId && r.personId && r.personId !== conv.personId) fail('IDENTIDAD_DISTINTA', 'La gestión es de otra persona (distinto ID). No se fusiona por nombre.');
  }
  conv.requestId = c.requestId;
  d.audit.push({ id: nextId(d, 'EV'), at: d.clock, type: 'vinculo_canal', entity: 'Conversation', entityId: conv.id, detail: `Vinculada a ${c.requestId ?? 'ninguna gestión'}`, commandId: c.commandId });
  return { ok: true, message: 'Gestión vinculada.' };
});

function okChat(): CommandResultOk { return { ok: true, message: 'Mensaje procesado localmente.' }; }
