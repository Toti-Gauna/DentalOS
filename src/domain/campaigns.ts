// Campañas administrativas simuladas (lote 6 · R-GRW-01…07). Segmentos desde el store, audiencia con baja, exclusión,
// límite de frecuencia y deduplicación; economía por atención con ND; ciclo borrador → lista → aprobada → activa ↔ pausada.
// Nada se envía, publica ni cobra: las "entregas" son registros locales con estado simulado.
import { DomainError, nextId, registerAutomation, registerHandler, type Command } from './commands';
import { findSlots } from './scheduling';
import { addDays, addMinutes, at, fmtShort, parts, toMs, type Iso } from './time';
import type {
  Campaign, CampaignDelivery, CampaignEconomics, CampaignInput, CommandResultOk, ContactChannel, DemoState, Person, SegmentId,
} from './types';

const fail = (code: string, message: string): never => { throw new DomainError({ ok: false, code, message }); };
const ok = (message: string, ids?: Record<string, string>, info?: Record<string, unknown>): CommandResultOk => ({ ok: true, message, ids, info });
const audit = (d: DemoState, commandId: string, type: string, entityId: string, detail: string) =>
  d.audit.push({ id: nextId(d, 'EV'), at: d.clock, type, entity: 'Campaign', entityId, detail, commandId });

// ---------- Segmentos ----------
export interface SegmentInfo { id: SegmentId; label: string; description: string; templateId: string; serviceTypeId: string | null }
export const SEGMENTS: SegmentInfo[] = [
  { id: 'controles_pendientes', label: 'Controles ya indicados pendientes', description: 'La profesional indicó un control y todavía no tiene turno. El software no decide cuándo corresponde.', templateId: 'control_indicado', serviceTypeId: 'ST-ORTO-CTRL' },
  { id: 'presupuestos_sin_respuesta', label: 'Presupuestos sin respuesta', description: 'Presupuestos emitidos y vigentes que nadie aceptó ni rechazó.', templateId: 'presupuesto_pendiente', serviceTypeId: null },
  { id: 'consultas_sin_turno', label: 'Consultas sin turno', description: 'Consultas o pedidos de primera visita abiertos sin turno asociado.', templateId: 'consulta_sin_turno', serviceTypeId: null },
  { id: 'reprogramaciones', label: 'Turnos cancelados para volver a coordinar', description: 'Turnos cancelados sin otro turno futuro del mismo motivo.', templateId: 'reprogramar', serviceTypeId: null },
];
export const segmentById = (id: SegmentId) => SEGMENTS.find((s) => s.id === id)!;

/** Una persona del segmento: `personId` es a quién se refiere; el contacto se resuelve después (un menor → su responsable). */
export interface SegmentMember { personId: string | null; reason: string; sourceId: string }

const isFutureActive = (d: DemoState, personId: string, serviceTypeId?: string) => d.appointments.some((a) =>
  a.personId === personId && (a.status === 'confirmada' || a.status === 'solicitada') && toMs(a.start) > toMs(d.clock) && (!serviceTypeId || a.serviceTypeId === serviceTypeId));

export function segmentMembers(d: DemoState, seg: SegmentId): SegmentMember[] {
  switch (seg) {
    case 'controles_pendientes':
      return d.careEpisodes.filter((e) => e.status === 'activo').flatMap((e) => e.controls.filter((c) => c.status === 'indicado')
        .map((c) => ({ personId: e.personId, reason: `Control ${c.id} indicado el ${fmtShort(c.indicatedAt)}`, sourceId: c.id })));
    case 'presupuestos_sin_respuesta':
      return d.estimates.filter((e) => e.status === 'emitido' && (!e.validUntil || toMs(e.validUntil) > toMs(d.clock)))
        .map((e) => ({ personId: e.personId, reason: `Presupuesto ${e.id} emitido, sin respuesta`, sourceId: e.id }));
    case 'consultas_sin_turno':
      return d.requests.filter((r) => (r.kind === 'consulta' || r.kind === 'primera_visita') && (r.status === 'pendiente' || r.status === 'asignada') && !r.appointmentId)
        .map((r) => ({ personId: r.personId, reason: `Consulta ${r.id} sin turno`, sourceId: r.id }));
    case 'reprogramaciones':
      return d.appointments.filter((a) => a.status === 'cancelada' && !isFutureActive(d, a.personId, a.serviceTypeId))
        .map((a) => ({ personId: a.personId, reason: `Turno ${a.id} cancelado sin otro del mismo motivo`, sourceId: a.id }));
  }
}

/** A quién se le escribe: la persona adulta, o el primer responsable registrado si es menor. */
export function contactFor(d: DemoState, personId: string): string | null {
  const p = d.persons.find((x) => x.id === personId);
  if (!p) return null;
  if (p.kind === 'adulto') return p.id;
  return d.responsibleLinks.find((l) => l.dependentId === p.id)?.responsibleId ?? null;
}
export const channelFor = (p: Person): ContactChannel => p.preferredChannel ?? 'portal';

// ---------- Audiencia ----------
export type ExclusionReason = 'sin_identificar' | 'menor_sin_responsable' | 'baja' | 'exclusion' | 'frecuencia';
export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  sin_identificar: 'Contacto sin identificar por ID',
  menor_sin_responsable: 'Menor sin adulto responsable registrado',
  baja: 'Pidió la baja de campañas',
  exclusion: 'Exclusión administrativa',
  frecuencia: 'Límite de frecuencia alcanzado',
};
export interface AudienceEntry { contactId: string; forPersonIds: string[]; channel: ContactChannel; reasons: string[] }
export interface AudienceExcluded { personId: string | null; contactId: string | null; reason: ExclusionReason; detail: string }
export interface Audience { eligible: AudienceEntry[]; excluded: AudienceExcluded[]; merged: number; members: number }

const COUNTS_FOR_FREQUENCY = new Set(['entregado_simulado', 'programado', 'pausado']);
/** Mensajes de campaña que la persona recibió o tiene programados en los últimos 30 días (sin contar esta campaña). */
export function recentDeliveries(d: DemoState, contactId: string, exceptCampaignId?: string): number {
  const from = toMs(addMinutes(d.clock, -30 * 1440));
  return d.campaignDeliveries.filter((x) => x.contactId === contactId && x.campaignId !== exceptCampaignId && COUNTS_FOR_FREQUENCY.has(x.status) && toMs(x.dueAt) >= from).length;
}

export function campaignMembers(d: DemoState, c: Pick<Campaign, 'kind' | 'segmentIds' | 'personId'>): SegmentMember[] {
  if (c.kind === 'individual') return c.personId ? [{ personId: c.personId, reason: 'Elegida individualmente', sourceId: c.personId }] : [];
  if (c.kind === 'masiva') return d.persons.map((p) => ({ personId: p.id, reason: 'Paciente de la clínica', sourceId: p.id }));
  return c.segmentIds.flatMap((s) => segmentMembers(d, s));
}

/** Arma la audiencia elegible. Orden por ID de contacto: nunca por rentabilidad ni por ningún puntaje. */
export function buildAudience(d: DemoState, c: Pick<Campaign, 'id' | 'kind' | 'segmentIds' | 'personId'>): Audience {
  const members = campaignMembers(d, c);
  const excluded: AudienceExcluded[] = [];
  const byContact = new Map<string, AudienceEntry>();
  let merged = 0;
  for (const m of members) {
    if (!m.personId) { excluded.push({ personId: null, contactId: null, reason: 'sin_identificar', detail: m.reason }); continue; }
    const contactId = contactFor(d, m.personId);
    if (!contactId) { excluded.push({ personId: m.personId, contactId: null, reason: 'menor_sin_responsable', detail: m.reason }); continue; }
    const prev = byContact.get(contactId);
    if (prev) {
      merged += 1;
      if (!prev.forPersonIds.includes(m.personId)) prev.forPersonIds.push(m.personId);
      prev.reasons.push(m.reason);
      continue;
    }
    const contact = d.persons.find((p) => p.id === contactId)!;
    byContact.set(contactId, { contactId, forPersonIds: [m.personId], channel: channelFor(contact), reasons: [m.reason] });
  }
  const eligible: AudienceEntry[] = [];
  for (const e of [...byContact.values()].sort((a, b) => a.contactId.localeCompare(b.contactId))) {
    const p = d.persons.find((x) => x.id === e.contactId)!;
    const detail = e.reasons.join(' · ');
    if (p.campaignOptOut) excluded.push({ personId: e.forPersonIds[0], contactId: p.id, reason: 'baja', detail });
    else if (p.campaignExclusion) excluded.push({ personId: e.forPersonIds[0], contactId: p.id, reason: 'exclusion', detail: p.campaignExclusion });
    else if (recentDeliveries(d, p.id, c.id) >= d.campaignConfig.maxPer30d) excluded.push({ personId: e.forPersonIds[0], contactId: p.id, reason: 'frecuencia', detail: `${recentDeliveries(d, p.id, c.id)} mensajes en 30 días (máximo ${d.campaignConfig.maxPer30d})` });
    else eligible.push(e);
  }
  return { eligible, excluded, merged, members: members.length };
}

// ---------- Plantillas discretas (R-GRW-07) ----------
export interface TemplateInfo { id: string; label: string; forSegment: SegmentId | null }
export const TEMPLATES: TemplateInfo[] = [
  { id: 'control_indicado', label: 'Control ya indicado para coordinar', forSegment: 'controles_pendientes' },
  { id: 'presupuesto_pendiente', label: 'Presupuesto pendiente de respuesta', forSegment: 'presupuestos_sin_respuesta' },
  { id: 'consulta_sin_turno', label: 'Consulta pendiente', forSegment: 'consultas_sin_turno' },
  { id: 'reprogramar', label: 'Volver a coordinar un turno cancelado', forSegment: 'reprogramaciones' },
  { id: 'horarios', label: 'Horarios de atención (informativa)', forSegment: null },
  { id: 'datos_contacto', label: 'Actualizar datos de contacto (informativa)', forSegment: null },
];
const SIMULATED = ' (Mensaje simulado de la demo)';

export function renderMessage(d: DemoState, templateId: string, contactId: string, forPersonIds: string[], extraNote = ''): string {
  const contact = d.persons.find((p) => p.id === contactId);
  const hi = `Hola ${contact?.firstName ?? ''}:`;
  const others = forPersonIds.filter((id) => id !== contactId).map((id) => d.persons.find((p) => p.id === id)?.firstName ?? id);
  const forWho = others.length ? ` para ${others.join(' y ')}` : '';
  const own = forPersonIds.includes(contactId);
  const body = (() => {
    switch (templateId) {
      case 'control_indicado': return `${own && !others.length ? 'tenés un control ya indicado por tu profesional' : `hay un control ya indicado por la profesional${forWho}`} para coordinar. Podés elegir horario en el portal o responder este mensaje.`;
      case 'presupuesto_pendiente': return `${own && !others.length ? 'tenés' : 'hay'} un presupuesto administrativo pendiente de respuesta${forWho}. Si querés, recepción te lo explica. No es una cobranza.`;
      case 'consulta_sin_turno': return 'quedó pendiente tu consulta con la clínica. Si todavía querés un turno, respondé este mensaje y te ayudamos.';
      case 'reprogramar': return `si querés volver a coordinar el turno que quedó cancelado${forWho}, podés elegir un horario cuando te quede cómodo.`;
      case 'horarios': return 'te compartimos los horarios de atención de la clínica para las próximas semanas. Están en el portal.';
      case 'datos_contacto': return 'si cambiaste de teléfono o de correo, podés actualizarlo en el portal.';
      default: return 'tenés un mensaje administrativo de la clínica.';
    }
  })();
  const note = extraNote.trim() ? ` ${extraNote.trim()}` : '';
  return `${hi} ${body}${note}${SIMULATED}`;
}

/** Palabras que no van en un mensaje administrativo: miedo, urgencia inventada, presión de compra o detalle clínico. */
const NOT_DISCREET: { re: RegExp; why: string }[] = [
  { re: /\burgen\w*|\bya mismo\b|\bantes de que sea tarde\b|\bno te lo pierdas\b|\búltim[oa]s? (lugares|turnos|días|dias|oportunidad)/i, why: 'urgencia inventada' },
  { re: /\bmiedo\b|\bpeligr\w*|\briesg\w*|\bempeor\w*|\bperder (la|tus|el)\b/i, why: 'mensaje de miedo' },
  { re: /\bdescuento\w*|\boferta\w*|\bpromo\w*|\bgratis\b|\b2x1\b|\bbonificad\w*/i, why: 'estímulo comercial a un tratamiento' },
  { re: /\bdolor\w*|\bcaries\b|\binfecc\w*|\bdiagn[oó]stic\w*|\bconducto\b|\bimplante\w*|\bortodoncia\b|\bbrackets?\b|\bextracci\w*|\benfermedad\w*/i, why: 'detalle clínico o sensible' },
  { re: /!{2,}|¡{2,}/, why: 'tono alarmista' },
];
export function checkMessage(text: string): string[] {
  return NOT_DISCREET.filter((r) => r.re.test(text)).map((r) => r.why);
}

// ---------- Economía (R-GRW-03) ----------
export interface UnitEconomics { netRevenue: number; contribution: number; contributionPct: number | null }
/** Contribución = ingreso neto − costo de servicio cargado − otros variables. El % es contribución / ingreso neto (no es ganancia neta). */
export function unitEconomics(listPrice: number, discount: number, serviceCost: number, otherVariable: number): UnitEconomics {
  const netRevenue = listPrice - discount;
  const contribution = netRevenue - serviceCost - otherVariable;
  return { netRevenue, contribution, contributionPct: netRevenue > 0 ? contribution / netRevenue : null };
}
/** Atenciones para cubrir el costo de la campaña: ceil(costo / contribución), solo con contribución positiva. */
export function breakeven(campaignCost: number, contribution: number): number | null {
  if (contribution <= 0) return null;
  return Math.ceil(campaignCost / contribution);
}

export interface CampaignEconomicsView {
  /** Si la campaña invita a un motivo de turno: tiene ingreso por atención. Si es informativa, solo costo. */
  perAttention: boolean;
  missing: string[];
  unit: UnitEconomics | null;
  commCostMinor: number | null;
  commByChannel: { channel: ContactChannel; count: number; unitMinor: number | null }[];
  campaignCostMinor: number | null;
  breakevenAttentions: number | null;
  noBreakeven: boolean;
  projectedAttentions: number | null;
  projectedResultMinor: number | null;
}

export function campaignEconomics(d: DemoState, c: Pick<Campaign, 'serviceTypeId' | 'economics'>, audience: Audience): CampaignEconomicsView {
  const e: CampaignEconomics = c.economics;
  const perAttention = !!c.serviceTypeId;
  const missing: string[] = [];
  if (e.fixedCostMinor == null) missing.push('Costo fijo de la campaña');
  if (perAttention) {
    if (e.listPriceMinor == null) missing.push('Precio de lista por atención');
    if (e.serviceCostMinor == null) missing.push('Costo de servicio cargado por atención');
    if (e.otherVariableMinor == null) missing.push('Otros costos variables por atención');
    if (e.responseRatePct == null) missing.push('Respuesta supuesta (%)');
  }
  const counts = new Map<ContactChannel, number>();
  for (const a of audience.eligible) counts.set(a.channel, (counts.get(a.channel) ?? 0) + 1);
  const commByChannel = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([channel, count]) => ({ channel, count, unitMinor: d.campaignConfig.commCostMinor[channel] }));
  for (const ch of commByChannel) if (ch.unitMinor == null) missing.push(`Costo por contacto de ${CHANNEL_LABEL[ch.channel]}`);
  const commCostMinor = commByChannel.some((x) => x.unitMinor == null) ? null : commByChannel.reduce((s, x) => s + x.count * (x.unitMinor ?? 0), 0);
  const campaignCostMinor = commCostMinor == null || e.fixedCostMinor == null ? null : commCostMinor + e.fixedCostMinor;
  const unit = perAttention && e.listPriceMinor != null && e.serviceCostMinor != null && e.otherVariableMinor != null
    ? unitEconomics(e.listPriceMinor, e.discountMinor, e.serviceCostMinor, e.otherVariableMinor) : null;
  const be = unit && campaignCostMinor != null ? breakeven(campaignCostMinor, unit.contribution) : null;
  const projectedAttentions = perAttention && e.responseRatePct != null ? Math.ceil((audience.eligible.length * e.responseRatePct) / 100) : null;
  const projectedResultMinor = unit && projectedAttentions != null && campaignCostMinor != null ? unit.contribution * projectedAttentions - campaignCostMinor : null;
  return { perAttention, missing, unit, commCostMinor, commByChannel, campaignCostMinor, breakevenAttentions: be, noBreakeven: !!unit && unit.contribution <= 0, projectedAttentions, projectedResultMinor };
}
export const CHANNEL_LABEL: Record<ContactChannel, string> = { whatsapp: 'WhatsApp (simulado)', portal: 'aviso en el portal', llamada: 'llamada de recepción' };

// ---------- Capacidad de agenda ----------
export interface Capacity { serviceTypeId: string; days: number; slots: number; byProfessional: { professionalId: string; slots: number }[] }
/** Turnos libres sin superponer, por profesional, en los próximos días: la oferta real que la campaña podría usar. */
export function capacityFor(d: DemoState, serviceTypeId: string, days = d.campaignConfig.capacityDays): Capacity {
  const slots = findSlots(d, { serviceTypeId, days, limit: 2000 });
  const lastEnd = new Map<string, number>();
  const count = new Map<string, number>();
  for (const s of slots) {
    const key = s.professionalId;
    if ((lastEnd.get(key) ?? 0) > toMs(s.start)) continue;
    lastEnd.set(key, toMs(s.end));
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  const byProfessional = [...count.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([professionalId, n]) => ({ professionalId, slots: n }));
  return { serviceTypeId, days, slots: byProfessional.reduce((s, x) => s + x.slots, 0), byProfessional };
}

// ---------- Revisión antes de avanzar ----------
export interface Blocker { code: 'DATOS_FALTANTES' | 'AUDIENCIA_VACIA' | 'CAPACIDAD_INSUFICIENTE' | 'MENSAJE_NO_DISCRETO' | 'FECHA_PASADA'; message: string }
export interface CampaignReview { audience: Audience; economics: CampaignEconomicsView; capacity: Capacity | null; blockers: Blocker[]; sample: string | null }

export function reviewCampaign(d: DemoState, c: Campaign): CampaignReview {
  const audience = buildAudience(d, c);
  const economics = campaignEconomics(d, c, audience);
  const capacity = c.serviceTypeId ? capacityFor(d, c.serviceTypeId) : null;
  const blockers: Blocker[] = [];
  const shape: string[] = [];
  if (c.kind === 'individual' && !c.personId) shape.push('Persona de la campaña individual');
  if (c.kind === 'segmentada' && !c.segmentIds.length) shape.push('Al menos un segmento');
  if (c.trigger === 'programada' && !c.scheduledFor) shape.push('Fecha programada');
  const missing = [...shape, ...economics.missing];
  if (missing.length) blockers.push({ code: 'DATOS_FALTANTES', message: `Faltan datos (ND): ${missing.join(', ')}.` });
  if (c.trigger === 'programada' && c.scheduledFor && toMs(c.scheduledFor) <= toMs(d.clock)) blockers.push({ code: 'FECHA_PASADA', message: 'La fecha programada ya pasó en el reloj de la demo.' });
  if (audience.eligible.length === 0) blockers.push({ code: 'AUDIENCIA_VACIA', message: audience.members ? `Nadie queda en la audiencia: ${audience.excluded.length} excluido(s).` : 'El segmento no tiene personas hoy.' });
  if (capacity && economics.projectedAttentions != null && economics.projectedAttentions > capacity.slots) {
    blockers.push({ code: 'CAPACIDAD_INSUFICIENTE', message: `Se proyectan ${economics.projectedAttentions} atenciones y hay ${capacity.slots} turnos libres en ${capacity.days} días.` });
  }
  const issues = checkMessage(c.extraNote);
  if (issues.length) blockers.push({ code: 'MENSAJE_NO_DISCRETO', message: `La nota agregada no es discreta: ${issues.join(', ')}.` });
  const first = audience.eligible[0];
  return { audience, economics, capacity, blockers, sample: first ? renderMessage(d, c.templateId, first.contactId, first.forPersonIds, c.extraNote) : null };
}

// ---------- Resultados separados (R-GRW-04) ----------
export interface CampaignResults {
  simulated: { delivered: number; scheduled: number; paused: number; blocked: number; commCostMinor: number | null };
  observed: { booked: number; attended: number; paidMinor: number };
}
/** Observado: lo que pasó en el store después del mensaje. No se suma con lo proyectado ni prueba que la campaña lo causó. */
export function campaignResults(d: DemoState, c: Campaign): CampaignResults {
  const ds = d.campaignDeliveries.filter((x) => x.campaignId === c.id);
  const delivered = ds.filter((x) => x.status === 'entregado_simulado');
  let commCostMinor: number | null = 0;
  for (const x of delivered) { const u = d.campaignConfig.commCostMinor[x.channel]; commCostMinor = u == null || commCostMinor == null ? null : commCostMinor + u; }
  const booked = new Set<string>(); const attended = new Set<string>(); let paidMinor = 0;
  for (const x of delivered) {
    for (const pid of x.forPersonIds) {
      for (const a of d.appointments) {
        if (a.personId !== pid || toMs(a.createdAt) < toMs(x.dueAt) || (c.serviceTypeId && a.serviceTypeId !== c.serviceTypeId)) continue;
        booked.add(a.id);
        if (a.status === 'finalizada') attended.add(a.id);
      }
      for (const l of d.ledger) if (l.personId === pid && toMs(l.at) >= toMs(x.dueAt)) paidMinor += l.amountMinor;
    }
  }
  return {
    simulated: { delivered: delivered.length, scheduled: ds.filter((x) => x.status === 'programado').length, paused: ds.filter((x) => x.status === 'pausado').length, blocked: ds.filter((x) => x.status === 'bloqueado').length, commCostMinor },
    observed: { booked: booked.size, attended: attended.size, paidMinor },
  };
}

// ---------- Calendario ----------
const addMonths = (date: string, n: number) => {
  const [y, m, dd] = date.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12); const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(dd, last)).padStart(2, '0')}`;
};
export const CADENCE_LABEL: Record<Campaign['cadence'], string> = { unica: 'Única', semanal: 'Semanal', mensual: 'Mensual', bimestral: 'Bimestral', estacional: 'Estacional (cada 3 meses)' };
/** Fechas previstas (simuladas) de una campaña dentro de [from, to]. Las repeticiones no se envían solas: se revisan cada vez. */
export function occurrences(c: Campaign, from: string, to: string): string[] {
  if (c.status === 'finalizada' && c.cadence !== 'unica') return [];
  const base = parts(c.scheduledFor ?? c.activatedAt ?? c.createdAt).date;
  const out: string[] = [];
  for (let i = 0, date = base; i < 400 && date <= to; i++) {
    if (date >= from) out.push(date);
    if (c.cadence === 'unica') break;
    date = c.cadence === 'semanal' ? addDays(base, 7 * (i + 1)) : addMonths(base, (i + 1) * (c.cadence === 'mensual' ? 1 : c.cadence === 'bimestral' ? 2 : 3));
  }
  return out;
}

// ---------- Comandos ----------
const NAME_MAX = 80;
function validateInput(d: DemoState, i: CampaignInput) {
  const name = i.name.trim();
  if (name.length < 3 || name.length > NAME_MAX) fail('DATOS_INVALIDOS', `El nombre va de 3 a ${NAME_MAX} caracteres.`);
  if (!TEMPLATES.some((t) => t.id === i.templateId)) fail('DATOS_INVALIDOS', 'Plantilla desconocida.');
  if (i.serviceTypeId && !d.serviceTypes.some((s) => s.id === i.serviceTypeId)) fail('DATOS_INVALIDOS', 'Motivo de turno desconocido.');
  if (i.personId && !d.persons.some((p) => p.id === i.personId)) fail('DATOS_INVALIDOS', 'Persona inexistente.');
  if (i.segmentIds.some((s) => !SEGMENTS.some((x) => x.id === s))) fail('DATOS_INVALIDOS', 'Segmento desconocido.');
  if (i.extraNote.length > 200) fail('DATOS_INVALIDOS', 'La nota agregada tiene un máximo de 200 caracteres.');
  const e = i.economics;
  for (const [k, v] of Object.entries(e)) if (v != null && (!Number.isInteger(v) || v < 0)) fail('DATOS_INVALIDOS', `Valor inválido en ${k}: enteros en centavos, sin negativos.`);
  if (e.responseRatePct != null && e.responseRatePct > 100) fail('DATOS_INVALIDOS', 'La respuesta supuesta va de 0 a 100 %.');
  if (e.listPriceMinor != null && e.discountMinor > e.listPriceMinor) fail('DATOS_INVALIDOS', 'El descuento no puede superar el precio de lista.');
  return { ...i, name };
}
const getCampaign = (d: DemoState, id: string) => d.campaigns.find((c) => c.id === id) ?? fail('NO_EXISTE', 'Campaña inexistente.');
const expect = <T extends string>(c: Campaign, allowed: T[], what: string) => {
  if (!(allowed as string[]).includes(c.status)) fail('ESTADO_INVALIDO', `No se puede ${what} una campaña en estado “${c.status}”.`);
};
const failBlockers = (r: CampaignReview) => { if (r.blockers.length) throw new DomainError({ ok: false, code: r.blockers[0].code, message: r.blockers.map((b) => b.message).join(' ') }); };

registerHandler('campaignCreate', (d, c) => {
  if (c.type !== 'campaignCreate') throw new Error('tipo');
  const input = validateInput(d, c.input);
  const id = nextId(d, 'CMP');
  d.campaigns.push({ ...input, id, status: 'borrador', createdAt: d.clock, updatedAt: d.clock, approvedAt: null, activatedAt: null, pausedAt: null, version: 1 });
  audit(d, c.commandId, 'campana_borrador', id, `Borrador “${input.name}” (${input.kind}, ${input.trigger}).`);
  return ok(`Borrador ${id} creado. No se activa solo: falta vista previa y aprobación.`, { campaignId: id });
});

registerHandler('campaignUpdate', (d, c) => {
  if (c.type !== 'campaignUpdate') throw new Error('tipo');
  const cmp = getCampaign(d, c.campaignId);
  expect(cmp, ['borrador', 'lista', 'aprobada'], 'editar');
  const { id: _i, status: _s, ...current } = cmp; void _i; void _s;
  const merged = validateInput(d, { ...current, ...c.patch, economics: { ...cmp.economics, ...(c.patch.economics ?? {}) } });
  const back = cmp.status !== 'borrador';
  Object.assign(cmp, merged, { status: 'borrador', approvedAt: null, updatedAt: d.clock, version: cmp.version + 1 });
  audit(d, c.commandId, 'campana_editada', cmp.id, `Versión ${cmp.version}${back ? ' · vuelve a borrador' : ''}.`);
  return ok(back ? 'Cambios guardados. La campaña volvió a borrador: hay que revisar y aprobar de nuevo.' : 'Borrador guardado.');
});

registerHandler('campaignPreview', (d, c) => {
  if (c.type !== 'campaignPreview') throw new Error('tipo');
  const cmp = getCampaign(d, c.campaignId);
  expect(cmp, ['borrador'], 'revisar');
  const r = reviewCampaign(d, cmp);
  failBlockers(r);
  cmp.status = 'lista'; cmp.updatedAt = d.clock;
  audit(d, c.commandId, 'campana_revisada', cmp.id, `Audiencia ${r.audience.eligible.length} · excluidos ${r.audience.excluded.length} · unificados ${r.audience.merged}.`);
  return ok(`Vista previa revisada: ${r.audience.eligible.length} contacto(s). Falta la aprobación de dirección.`, undefined, { eligible: r.audience.eligible.length });
});

registerHandler('campaignApprove', (d, c) => {
  if (c.type !== 'campaignApprove') throw new Error('tipo');
  const cmp = getCampaign(d, c.campaignId);
  expect(cmp, ['lista'], 'aprobar');
  failBlockers(reviewCampaign(d, cmp));
  cmp.status = 'aprobada'; cmp.approvedAt = d.clock; cmp.updatedAt = d.clock;
  audit(d, c.commandId, 'campana_aprobada', cmp.id, 'Aprobada por dirección (vista de la demo, no es un permiso real).');
  return ok('Campaña aprobada. La activación sigue siendo un paso aparte y simulado.');
});

function deliveryFor(d: DemoState, cmp: Campaign, a: AudienceEntry, status: CampaignDelivery['status'], dueAt: Iso, note = ''): CampaignDelivery {
  return { id: nextId(d, 'CD'), campaignId: cmp.id, contactId: a.contactId, forPersonIds: [...a.forPersonIds], channel: a.channel, status, dueAt, createdAt: d.clock,
    text: renderMessage(d, cmp.templateId, a.contactId, a.forPersonIds, cmp.extraNote), dedupeKey: `camp:${cmp.id}:${a.contactId}`, note };
}
/** Crea las entregas que falten (una por contacto y campaña, sin importar el canal). Devuelve cuántas creó y cuántas ya existían. */
function deliverTo(d: DemoState, cmp: Campaign, entries: AudienceEntry[], status: CampaignDelivery['status'], dueAt: Iso, commandId: string) {
  let created = 0; let existing = 0;
  for (const a of entries) {
    if (d.campaignDeliveries.some((x) => x.dedupeKey === `camp:${cmp.id}:${a.contactId}`)) { existing += 1; continue; }
    const call = a.channel === 'llamada';
    d.campaignDeliveries.push(deliveryFor(d, cmp, a, status, dueAt, call ? 'Llamada de recepción: queda como tarea (simulada).' : ''));
    if (call && status === 'entregado_simulado') {
      d.tasks.push({ id: nextId(d, 'T'), kind: 'contacto_manual', title: `Llamar a ${a.contactId} por la campaña ${cmp.id}`, detail: 'Leer el mensaje administrativo de la campaña. Sin detalles clínicos.', status: 'abierta', assigneeId: null, dueAt: addMinutes(d.clock, 1440), personId: a.contactId, requestId: null, appointmentId: null, estimateId: null, dedupeKey: `camp:${cmp.id}:${a.contactId}:llamada`, note: '', createdAt: d.clock, ruleId: 'A11' });
    }
    created += 1;
  }
  if (created) audit(d, commandId, 'campana_entregas', cmp.id, `${created} entrega(s) ${status === 'programado' ? 'programada(s)' : 'simulada(s)'}; ${existing} ya existían.`);
  return { created, existing };
}

registerHandler('campaignActivate', (d, c) => {
  if (c.type !== 'campaignActivate') throw new Error('tipo');
  const cmp = getCampaign(d, c.campaignId);
  expect(cmp, ['aprobada'], 'activar');
  const r = reviewCampaign(d, cmp);
  failBlockers(r);
  cmp.status = 'activa'; cmp.activatedAt = d.clock; cmp.updatedAt = d.clock;
  const scheduled = cmp.trigger === 'programada';
  const res = deliverTo(d, cmp, r.audience.eligible, scheduled ? 'programado' : 'entregado_simulado', scheduled ? cmp.scheduledFor! : d.clock, c.commandId);
  return ok(scheduled
    ? `Campaña activa (simulada): ${res.created} mensaje(s) programado(s) para ${fmtShort(cmp.scheduledFor!)}. No se envía nada real.`
    : `Campaña activa (simulada): ${res.created} mensaje(s) registrados como entregados. No se envió nada real.`, undefined, res);
});

registerHandler('campaignPause', (d, c) => {
  if (c.type !== 'campaignPause') throw new Error('tipo');
  const cmp = getCampaign(d, c.campaignId);
  expect(cmp, ['activa'], 'pausar');
  cmp.status = 'pausada'; cmp.pausedAt = d.clock; cmp.updatedAt = d.clock;
  let n = 0;
  for (const x of d.campaignDeliveries) if (x.campaignId === cmp.id && x.status === 'programado') { x.status = 'pausado'; n += 1; }
  audit(d, c.commandId, 'campana_pausada', cmp.id, `${n} entrega(s) programada(s) en pausa.`);
  return ok(`Campaña en pausa. ${n} mensaje(s) programado(s) quedan retenidos; lo ya simulado no se deshace.`);
});

registerHandler('campaignResume', (d, c) => {
  if (c.type !== 'campaignResume') throw new Error('tipo');
  const cmp = getCampaign(d, c.campaignId);
  expect(cmp, ['pausada'], 'reanudar');
  cmp.status = 'activa'; cmp.pausedAt = null; cmp.updatedAt = d.clock;
  let n = 0;
  for (const x of d.campaignDeliveries) if (x.campaignId === cmp.id && x.status === 'pausado') { x.status = 'programado'; n += 1; }
  audit(d, c.commandId, 'campana_reanudada', cmp.id, `${n} entrega(s) vuelven a programado.`);
  return ok(`Campaña reanudada. ${n} mensaje(s) vuelven a quedar programados.`);
});

registerHandler('campaignClose', (d, c) => {
  if (c.type !== 'campaignClose') throw new Error('tipo');
  const cmp = getCampaign(d, c.campaignId);
  expect(cmp, ['activa', 'pausada'], 'finalizar');
  cmp.status = 'finalizada'; cmp.updatedAt = d.clock;
  for (const x of d.campaignDeliveries) if (x.campaignId === cmp.id && (x.status === 'programado' || x.status === 'pausado')) { x.status = 'bloqueado'; x.note = 'Campaña finalizada antes del envío.'; }
  audit(d, c.commandId, 'campana_finalizada', cmp.id, 'Finalizada.');
  return ok('Campaña finalizada. Lo que quedaba programado no se envía.');
});

registerHandler('contactPrefSet', (d, c) => {
  if (c.type !== 'contactPrefSet') throw new Error('tipo');
  const p = d.persons.find((x) => x.id === c.personId) ?? fail('NO_EXISTE', 'Persona inexistente.');
  if (c.exclusion != null && (c.exclusion.trim().length < 3 || c.exclusion.length > 120)) fail('DATOS_INVALIDOS', 'El motivo de exclusión va de 3 a 120 caracteres.');
  if (c.exclusion != null && checkMessage(c.exclusion).includes('detalle clínico o sensible')) fail('DATOS_INVALIDOS', 'El motivo es administrativo: sin datos clínicos.');
  if (c.optOut !== undefined) p.campaignOptOut = c.optOut;
  if (c.exclusion !== undefined) p.campaignExclusion = c.exclusion?.trim() || null;
  p.version += 1;
  d.audit.push({ id: nextId(d, 'EV'), at: d.clock, type: 'preferencia_contacto', entity: 'Person', entityId: p.id, detail: `Baja ${p.campaignOptOut ? 'sí' : 'no'} · exclusión ${p.campaignExclusion ? 'sí' : 'no'}`, commandId: c.commandId });
  return ok('Preferencias de contacto guardadas. Se respetan en todas las campañas, también en las programadas.');
});

registerHandler('campaignConfigSet', (d, c) => {
  if (c.type !== 'campaignConfigSet') throw new Error('tipo');
  for (const [ch, v] of Object.entries(c.commCostMinor ?? {})) {
    if (!(ch in d.campaignConfig.commCostMinor)) fail('DATOS_INVALIDOS', 'Canal desconocido.');
    if (v != null && (!Number.isInteger(v) || v < 0)) fail('DATOS_INVALIDOS', 'Costo en centavos enteros, sin negativos.');
    d.campaignConfig.commCostMinor[ch as ContactChannel] = v ?? null;
  }
  if (c.maxPer30d !== undefined) {
    if (!Number.isInteger(c.maxPer30d) || c.maxPer30d < 1 || c.maxPer30d > 10) fail('DATOS_INVALIDOS', 'Límite de 1 a 10 mensajes en 30 días.');
    d.campaignConfig.maxPer30d = c.maxPer30d;
  }
  d.audit.push({ id: nextId(d, 'EV'), at: d.clock, type: 'config_campanas', entity: 'Settings', entityId: 'campaigns', detail: JSON.stringify(d.campaignConfig), commandId: c.commandId });
  return ok('Costos y límites de comunicación guardados (ficticios).');
});

// ---------- A11: envío programado y campañas por evento ----------
registerAutomation((d, commandId) => {
  const log: string[] = [];
  const rule = d.automationRules.find((r) => r.id === 'A11');
  if (!rule?.enabled) return log;
  for (const cmp of d.campaigns) {
    if (cmp.status !== 'activa') continue;
    for (const x of d.campaignDeliveries) {
      if (x.campaignId !== cmp.id || x.status !== 'programado' || toMs(x.dueAt) > toMs(d.clock)) continue;
      const p = d.persons.find((pp) => pp.id === x.contactId);
      if (!p || p.campaignOptOut || p.campaignExclusion) { x.status = 'bloqueado'; x.note = p?.campaignOptOut ? 'Baja pedida antes del envío.' : 'Exclusión vigente al enviar.'; log.push(`Campaña ${cmp.id}: mensaje a ${x.contactId} no enviado (${x.note}).`); continue; }
      x.status = 'entregado_simulado';
      log.push(`Campaña ${cmp.id}: mensaje a ${x.contactId} entregado (simulado).`);
    }
    if (cmp.trigger === 'evento') {
      const fresh = buildAudience(d, cmp).eligible.filter((a) => !d.campaignDeliveries.some((x) => x.dedupeKey === `camp:${cmp.id}:${a.contactId}`));
      const res = deliverTo(d, cmp, fresh, 'entregado_simulado', d.clock, commandId);
      if (res.created) log.push(`Campaña ${cmp.id} (por evento): ${res.created} contacto(s) nuevo(s) en el segmento.`);
    }
  }
  if (log.length) audit(d, commandId, 'A11', 'campañas', log.join(' '));
  return log;
});

export type CampaignCommand = Extract<Command, { type: `campaign${string}` | 'contactPrefSet' }>;
export const emptyEconomics = (): CampaignEconomics => ({ listPriceMinor: null, discountMinor: 0, serviceCostMinor: null, otherVariableMinor: null, fixedCostMinor: null, responseRatePct: null });
export const todayPlus = (d: DemoState, days: number, hhmm = '10:00') => at(addDays(parts(d.clock).date, days), hhmm);
