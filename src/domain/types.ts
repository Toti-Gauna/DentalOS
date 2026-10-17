import type { Iso } from './time';

export const SCHEMA_VERSION = 1 as const;
export const SEED = 'dentalos-v1' as const;
export const INITIAL_CLOCK: Iso = '2026-10-19T09:00:00-03:00';

export type ViewRole = 'visitante' | 'paciente' | 'recepcion' | 'profesional' | 'direccion';
export type Channel = 'web' | 'whatsapp' | 'llamada' | 'recepcion' | 'espera';

export interface Clinic { id: string; name: string; tagline: string }
export interface Location { id: string; name: string; address: string; hoursText: string; access: string }
export interface Professional {
  id: string; name: string; specialty: 'Odontología general' | 'Ortodoncia';
  serviceTypeIds: string[]; preferredChairIds: string[]; bio: string;
}
export interface Chair { id: string; name: string; locationId: string }
export interface ServiceType {
  id: string; name: string; durationMin: number; summary: string; forWhom: string;
  specialty: 'general' | 'ortodoncia';
  selfService: boolean; // se puede pedir desde portal/canales
  needsReceptionConfirmation: boolean; // queda "solicitada" hasta que recepción confirma
  requiresIndicatedControl: boolean; // solo si hay control indicado en un episodio
}
export interface AvailabilityRule { id: string; professionalId: string; locationId: string; weekday: number; start: string; end: string }
export interface Block { id: string; scope: 'professional' | 'chair' | 'location'; targetId: string; start: Iso; end: Iso; reason: string }
export interface Staff { id: string; name: string; area: 'recepción' | 'dirección' }

export interface Person {
  id: string; firstName: string; lastName: string; birthYear: number; kind: 'adulto' | 'menor';
  preferredChannel: 'whatsapp' | 'llamada' | 'portal' | null;
  reminderOptIn: boolean; adminNote: string; version: number;
}
export interface ResponsibleLink { id: string; responsibleId: string; dependentId: string; relation: string }

export type AppointmentStatus =
  | 'solicitada' | 'confirmada' | 'en_sala' | 'en_atencion' | 'finalizada' | 'ausente' | 'cancelada';
export interface Appointment {
  id: string; personId: string; serviceTypeId: string; professionalId: string; chairId: string; locationId: string;
  start: Iso; end: Iso; status: AppointmentStatus; version: number; origin: Channel;
  requestId: string | null; episodeId: string | null; controlId: string | null;
  createdAt: Iso; updatedAt: Iso; cancelReason?: string;
  patientConfirmedVersion?: number | null; // la persona confirmó asistencia para esta versión
}

export type RequestKind = 'primera_visita' | 'reserva' | 'reprogramacion' | 'cancelacion' | 'consulta' | 'derivacion';
export type RequestStatus = 'pendiente' | 'asignada' | 'resuelta' | 'descartada';
export interface Request {
  id: string; kind: RequestKind; personId: string | null; status: RequestStatus; channel: Channel;
  appointmentId: string | null; summary: string; assigneeId: string | null; note: string; nextStep: string;
  createdAt: Iso; updatedAt: Iso;
}

export type ConversationStatus = 'abierta' | 'esperando_paciente' | 'derivada' | 'cerrada';
export interface ChatFlow {
  step: 'menu' | 'pick_appt' | 'pick_slot' | 'review_change' | 'confirm_cancel' | 'pick_service' | 'pick_new_slot' | 'review_book' | 'offer_human' | 'offer_waitlist' | 'window_help';
  intent?: 'reprogramar' | 'cancelar' | 'reservar' | 'humano' | 'clinico';
  appointmentId?: string; appointmentVersion?: number; serviceTypeId?: string;
  candidates?: SlotRef[]; chosen?: SlotRef; fallbackCount?: number; requestId?: string;
}
export interface Conversation {
  id: string; channel: 'whatsapp'; personId: string | null; contactLabel: string; requestId: string | null;
  status: ConversationStatus; assigneeId: string | null; flow: ChatFlow; updatedAt: Iso;
}
export interface QuickReply { id: string; label: string }
export interface Message {
  id: string; conversationId: string; from: 'paciente' | 'asistente' | 'recepcion' | 'sistema';
  text: string; at: Iso; replies?: QuickReply[]; simulated: 'entregado_simulado' | 'leido_simulado';
}
export interface CallLine { from: 'asistente' | 'paciente' | 'sistema'; text: string }
export interface CallSession {
  id: string; personId: string | null; requestId: string | null; branch: string;
  status: 'finalizada' | 'detenida' | 'derivada'; transcript: CallLine[]; startedAt: Iso; endedAt: Iso; appointmentId: string | null;
}
export interface AutomationRule { id: string; name: string; trigger: string; condition: string; enabled: boolean }

export type OutboxKind = 'recordatorio_24h' | 'confirmacion' | 'cambio' | 'cancelacion' | 'oferta';
export type OutboxStatus = 'programado' | 'entregado_simulado' | 'anulado' | 'bloqueado_optout' | 'sin_cupo';
export interface OutboxItem {
  id: string; kind: OutboxKind; appointmentId: string | null; appointmentVersion: number | null; personId: string;
  channel: 'whatsapp' | 'portal'; dedupeKey: string; status: OutboxStatus; dueAt: Iso; createdAt: Iso; text: string; ruleId: string;
}

export type TaskKind = 'derivacion' | 'excepcion_cambio' | 'contacto_manual' | 'seguimiento_presupuesto' | 'control_indicado' | 'confirmar_solicitud' | 'general';
export interface Task {
  id: string; kind: TaskKind; title: string; detail: string; status: 'abierta' | 'en_curso' | 'resuelta';
  assigneeId: string | null; dueAt: Iso | null; personId: string | null; requestId: string | null;
  appointmentId: string | null; estimateId: string | null; dedupeKey: string; note: string; createdAt: Iso; ruleId: string | null;
}

export interface WaitlistEntry {
  id: string; personId: string; serviceTypeId: string; professionalId: string | null; locationId: string | null;
  period: 'mañana' | 'tarde' | 'cualquiera'; validUntil: Iso; status: 'activa' | 'asignada' | 'vencida' | 'retirada';
  rejectedSlotKeys: string[]; createdAt: Iso;
}
export interface SlotRef { start: Iso; end: Iso; professionalId: string; chairId: string; locationId: string; serviceTypeId: string }
export interface Offer {
  id: string; waitlistEntryId: string; personId: string; slot: SlotRef; holdUntil: Iso;
  status: 'activa' | 'aceptada' | 'rechazada' | 'vencida' | 'tomada_por_otro'; dedupeKey: string; appointmentId: string | null; createdAt: Iso;
}

export interface IndicatedControl {
  id: string; note: string; indicatedBy: string; indicatedAt: Iso; status: 'indicado' | 'reservado' | 'realizado'; appointmentId: string | null;
}
export interface TimelineItem { at: Iso; kind: string; text: string }
export interface CareEpisode {
  id: string; personId: string; kind: 'ortodoncia'; title: string; professionalId: string; status: 'activo' | 'cerrado';
  startedAt: Iso; timeline: TimelineItem[]; controls: IndicatedControl[];
  /** Opcional: fichas guardadas antes de la fase 2 no lo tienen (sin migración de esquema). */
  appliance?: 'brackets_metalicos' | 'brackets_esteticos' | 'alineadores' | 'retenedor_fijo' | 'retenedor_removible';
}

export type Surface = 'V' | 'L' | 'M' | 'D' | 'O' | 'I' | 'pieza';
export interface ToothChartEntry {
  id: string; personId: string; dentition: 'permanente' | 'temporal'; tooth: number; surface: Surface;
  procedure: string; state: 'planificado' | 'realizado'; status: 'vigente' | 'deshecho'; createdAt: Iso; by: string;
}

export type EstimateStatus = 'borrador' | 'emitido' | 'aceptado' | 'rechazado' | 'vencido';
export interface Estimate {
  id: string; personId: string; professionalId: string; status: EstimateStatus; validUntil: Iso | null;
  issuedAt: Iso | null; decidedAt: Iso | null; createdAt: Iso; coverageNote: string;
  /** Quién decidió (aceptó o rechazó): la persona adulta o su responsable si es menor. Ausente en datos viejos. */
  decidedBy?: string | null;
}
export interface EstimateLine { id: string; estimateId: string; description: string; tooth: number | null; qty: number; unitMinor: number }
export interface LedgerEntry {
  id: string; personId: string; estimateId: string | null; kind: 'pago_simulado' | 'contrapartida';
  amountMinor: number; reversesId: string | null; reversedById: string | null; commandId: string; at: Iso; note: string;
}

export type LearningState = 'nuevo' | 'en_curso' | 'comprendido' | 'completo';
export interface LearningProgress { cardId: string; state: LearningState; attempts: number; lastChoiceId: string | null; opens: number; rereads: number; completedAt: Iso | null }

export interface AuditEvent { id: string; at: Iso; type: string; entity: string; entityId: string; detail: string; commandId: string }

export interface DemoSettings {
  failNextCommits: number; reminderQuota: number; changeWindowHours: number; minLeadHours: number;
  horizonDays: number; holdMinutes: number; reminderLeadHours: number;
}

export interface CommandResultOk { ok: true; message: string; ids?: Record<string, string>; info?: Record<string, unknown> }
export interface CommandResultErr { ok: false; code: string; message: string; conflicts?: Conflict[]; existingId?: string }
export type CommandResult = CommandResultOk | CommandResultErr;

export interface Conflict { code: string; message: string; refId?: string }

export interface DemoState {
  schemaVersion: typeof SCHEMA_VERSION;
  seed: typeof SEED;
  preset: string;
  clock: Iso;
  revision: number;
  seq: Record<string, number>;
  settings: DemoSettings;
  clinic: Clinic;
  locations: Location[];
  professionals: Professional[];
  chairs: Chair[];
  serviceTypes: ServiceType[];
  availabilityRules: AvailabilityRule[];
  blocks: Block[];
  staff: Staff[];
  persons: Person[];
  responsibleLinks: ResponsibleLink[];
  appointments: Appointment[];
  requests: Request[];
  conversations: Conversation[];
  messages: Message[];
  callSessions: CallSession[];
  automationRules: AutomationRule[];
  outbox: OutboxItem[];
  tasks: Task[];
  waitlist: WaitlistEntry[];
  offers: Offer[];
  careEpisodes: CareEpisode[];
  toothChart: ToothChartEntry[];
  estimates: Estimate[];
  estimateLines: EstimateLine[];
  ledger: LedgerEntry[];
  learning: LearningProgress[];
  audit: AuditEvent[];
  processed: Record<string, CommandResult>;
}
