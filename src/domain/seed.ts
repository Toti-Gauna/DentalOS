// Fixture determinista "dentalos-v1". Todo es sintético: nombres, horarios y relaciones son
// propuesta de implementación de la demo, nunca datos de prospectos ni hechos comerciales.
import { addMinutes, at, toMs } from './time';
import {
  INITIAL_CLOCK, SCHEMA_VERSION, SEED,
  type Appointment, type AppointmentStatus, type Channel, type DemoState, type OutboxItem, type ServiceType,
} from './types';

export const LEARNING_CARD_IDS = ['ayuda', 'cambio', 'datos'] as const;

const serviceTypes: ServiceType[] = [
  { id: 'ST-PRIMERA', name: 'Primera consulta', durationMin: 45, specialty: 'general', selfService: true, needsReceptionConfirmation: true, requiresIndicatedControl: false,
    summary: 'Conocernos, revisar tus datos administrativos y coordinar los próximos pasos con la profesional.', forWhom: 'Personas que vienen por primera vez a la clínica.' },
  { id: 'ST-CONTROL', name: 'Control general', durationMin: 30, specialty: 'general', selfService: true, needsReceptionConfirmation: false, requiresIndicatedControl: false,
    summary: 'Visita de control con tu odontóloga u odontólogo de cabecera.', forWhom: 'Pacientes que ya se atienden en la clínica.' },
  { id: 'ST-LIMPIEZA', name: 'Limpieza e higiene', durationMin: 45, specialty: 'general', selfService: true, needsReceptionConfirmation: false, requiresIndicatedControl: false,
    summary: 'Turno de higiene con duración fija de muestra.', forWhom: 'Pacientes de la clínica.' },
  { id: 'ST-TRAT', name: 'Tratamiento indicado', durationMin: 60, specialty: 'general', selfService: false, needsReceptionConfirmation: false, requiresIndicatedControl: false,
    summary: 'Solo lo coordina recepción cuando la profesional lo indicó.', forWhom: 'Pacientes con indicación profesional previa.' },
  { id: 'ST-ORTO-CONS', name: 'Consulta de ortodoncia', durationMin: 45, specialty: 'ortodoncia', selfService: true, needsReceptionConfirmation: true, requiresIndicatedControl: false,
    summary: 'Primera conversación sobre ortodoncia: recorrido, tiempos administrativos y documentación.', forWhom: 'Adultos, adolescentes y familias.' },
  { id: 'ST-ORTO-CTRL', name: 'Control de ortodoncia', durationMin: 30, specialty: 'ortodoncia', selfService: true, needsReceptionConfirmation: false, requiresIndicatedControl: true,
    summary: 'Control ya indicado por tu profesional dentro de tu seguimiento.', forWhom: 'Pacientes con un control indicado.' },
];

interface ApptSeed { id: string; p: string; st: string; pr: string; ch: string; loc: string; date: string; t: string; status: AppointmentStatus; origin: Channel; req?: string; ep?: string; ctl?: string }

const D = { vie16: '2026-10-16', lun19: '2026-10-19', mar20: '2026-10-20', mie21: '2026-10-21', jue22: '2026-10-22', vie23: '2026-10-23', lun26: '2026-10-26' };

// 18 citas. Martes 20 10:00 (Dra. Galván) ocupado a propósito; martes 11:00 y miércoles 15:00 libres y compatibles.
const apptSeeds: ApptSeed[] = [
  { id: 'A-0001', p: 'P-006', st: 'ST-CONTROL', pr: 'PR-01', ch: 'CH-1', loc: 'L-CEN', date: D.vie16, t: '09:00', status: 'finalizada', origin: 'recepcion' },
  { id: 'A-0002', p: 'P-008', st: 'ST-LIMPIEZA', pr: 'PR-01', ch: 'CH-1', loc: 'L-CEN', date: D.vie16, t: '10:00', status: 'confirmada', origin: 'web' },
  { id: 'A-0003', p: 'P-002', st: 'ST-CONTROL', pr: 'PR-01', ch: 'CH-1', loc: 'L-CEN', date: D.lun19, t: '09:00', status: 'confirmada', origin: 'whatsapp' },
  { id: 'A-0004', p: 'P-010', st: 'ST-PRIMERA', pr: 'PR-01', ch: 'CH-1', loc: 'L-CEN', date: D.lun19, t: '10:00', status: 'solicitada', origin: 'web', req: 'R-001' },
  { id: 'A-0005', p: 'P-004', st: 'ST-CONTROL', pr: 'PR-01', ch: 'CH-1', loc: 'L-CEN', date: D.lun19, t: '11:00', status: 'confirmada', origin: 'web' },
  { id: 'A-0006', p: 'P-012', st: 'ST-LIMPIEZA', pr: 'PR-04', ch: 'CH-3', loc: 'L-NOR', date: D.lun19, t: '09:30', status: 'confirmada', origin: 'recepcion' },
  { id: 'A-0007', p: 'P-011', st: 'ST-CONTROL', pr: 'PR-02', ch: 'CH-3', loc: 'L-NOR', date: D.lun19, t: '15:00', status: 'confirmada', origin: 'llamada' },
  { id: 'A-0008', p: 'P-009', st: 'ST-ORTO-CTRL', pr: 'PR-03', ch: 'CH-2', loc: 'L-CEN', date: D.mar20, t: '10:00', status: 'confirmada', origin: 'whatsapp', ep: 'E-002', ctl: 'IC-002' },
  { id: 'A-0009', p: 'P-006', st: 'ST-ORTO-CONS', pr: 'PR-03', ch: 'CH-2', loc: 'L-CEN', date: D.mar20, t: '09:15', status: 'confirmada', origin: 'web' },
  { id: 'A-0010', p: 'P-008', st: 'ST-TRAT', pr: 'PR-01', ch: 'CH-1', loc: 'L-CEN', date: D.mar20, t: '09:00', status: 'confirmada', origin: 'recepcion' },
  { id: 'A-0011', p: 'P-007', st: 'ST-ORTO-CONS', pr: 'PR-03', ch: 'CH-2', loc: 'L-CEN', date: D.mie21, t: '14:15', status: 'confirmada', origin: 'whatsapp' },
  { id: 'A-0012', p: 'P-001', st: 'ST-ORTO-CTRL', pr: 'PR-03', ch: 'CH-2', loc: 'L-CEN', date: D.jue22, t: '10:00', status: 'confirmada', origin: 'web', ep: 'E-001', ctl: 'IC-001' },
  { id: 'A-0013', p: 'P-003', st: 'ST-LIMPIEZA', pr: 'PR-01', ch: 'CH-1', loc: 'L-CEN', date: D.jue22, t: '09:00', status: 'confirmada', origin: 'web' },
  { id: 'A-0014', p: 'P-001', st: 'ST-LIMPIEZA', pr: 'PR-04', ch: 'CH-3', loc: 'L-NOR', date: D.lun26, t: '10:00', status: 'confirmada', origin: 'whatsapp' },
  { id: 'A-0015', p: 'P-005', st: 'ST-PRIMERA', pr: 'PR-02', ch: 'CH-1', loc: 'L-CEN', date: D.mar20, t: '14:00', status: 'confirmada', origin: 'web', req: 'R-004' },
  { id: 'A-0016', p: 'P-012', st: 'ST-CONTROL', pr: 'PR-02', ch: 'CH-3', loc: 'L-NOR', date: D.mie21, t: '16:00', status: 'cancelada', origin: 'whatsapp', req: 'R-005' },
  { id: 'A-0017', p: 'P-002', st: 'ST-CONTROL', pr: 'PR-02', ch: 'CH-3', loc: 'L-NOR', date: D.vie23, t: '15:00', status: 'confirmada', origin: 'web' },
  { id: 'A-0018', p: 'P-006', st: 'ST-CONTROL', pr: 'PR-04', ch: 'CH-3', loc: 'L-NOR', date: D.mie21, t: '09:00', status: 'confirmada', origin: 'recepcion' },
];

function buildAppointments(): Appointment[] {
  return apptSeeds.map((s) => {
    const st = serviceTypes.find((x) => x.id === s.st)!;
    const start = at(s.date, s.t);
    const created = s.date <= D.lun19 ? '2026-10-12T11:00:00-03:00' : '2026-10-15T12:30:00-03:00';
    return {
      id: s.id, personId: s.p, serviceTypeId: s.st, professionalId: s.pr, chairId: s.ch, locationId: s.loc,
      start, end: addMinutes(start, st.durationMin), status: s.status, version: 1, origin: s.origin,
      requestId: s.req ?? null, episodeId: s.ep ?? null, controlId: s.ctl ?? null, createdAt: created, updatedAt: created,
      ...(s.status === 'cancelada' ? { cancelReason: 'Motivo administrativo de muestra' } : {}),
    };
  });
}

const OPT_OUT = new Set(['P-011']);

export function reminderText(a: Appointment): string {
  return `Recordatorio simulado de tu turno (${a.id}, versión ${a.version}). No se envía ningún mensaje real.`;
}

function buildOutbox(appointments: Appointment[]): OutboxItem[] {
  const items: OutboxItem[] = [];
  let n = 0;
  for (const a of appointments) {
    if (a.status !== 'confirmada' && a.status !== 'solicitada') continue;
    if (toMs(a.start) <= toMs(INITIAL_CLOCK)) continue;
    n += 1;
    const dueAt = addMinutes(a.start, -24 * 60);
    const already = toMs(dueAt) <= toMs(INITIAL_CLOCK);
    items.push({
      id: `O-${String(n).padStart(4, '0')}`, kind: 'recordatorio_24h', appointmentId: a.id, appointmentVersion: a.version,
      personId: a.personId, channel: 'whatsapp', dedupeKey: `rem:${a.id}:v${a.version}:24h`,
      status: OPT_OUT.has(a.personId) ? 'bloqueado_optout' : already ? 'entregado_simulado' : 'programado',
      dueAt, createdAt: a.createdAt, text: reminderText(a), ruleId: 'A05',
    });
  }
  return items;
}

export function createSeedState(): DemoState {
  const appointments = buildAppointments();
  const outbox = buildOutbox(appointments);
  const seedAt = '2026-10-12T08:00:00-03:00';
  return {
    schemaVersion: SCHEMA_VERSION,
    seed: SEED,
    preset: 'inicial',
    clock: INITIAL_CLOCK,
    revision: 0,
    seq: { P: 12, A: 18, R: 5, C: 3, M: 7, CS: 0, O: outbox.length, T: 3, W: 2, OF: 0, IC: 3, TC: 5, EST: 3, EL: 5, L: 10, EV: 1, B: 3, RL: 2 },
    settings: { failNextCommits: 0, reminderQuota: 20, changeWindowHours: 12, minLeadHours: 2, horizonDays: 30, holdMinutes: 10, reminderLeadHours: 24 },
    clinic: { id: 'CL-1', name: 'Clínica Brisa', tagline: 'Cada consulta tiene un próximo paso.' },
    locations: [
      { id: 'L-CEN', name: 'Sede Centro', address: 'Calle de Muestra 1450, Ciudad Ficticia', hoursText: 'Lunes a viernes, 9 a 13 y 14 a 18 h', access: 'Planta baja con rampa. Dirección ficticia de la demo.' },
      { id: 'L-NOR', name: 'Sede Norte', address: 'Pasaje Ejemplo 230, Ciudad Ficticia', hoursText: 'Lunes a viernes, 9 a 13 y 14 a 19 h', access: 'Primer piso con ascensor. Dirección ficticia de la demo.' },
    ],
    professionals: [
      { id: 'PR-01', name: 'Dra. Paula Ferreyra', specialty: 'Odontología general', serviceTypeIds: ['ST-PRIMERA', 'ST-CONTROL', 'ST-LIMPIEZA', 'ST-TRAT'], preferredChairIds: ['CH-1', 'CH-2'], bio: 'Profesional ficticia de la demo. Atiende en Sede Centro por la mañana.' },
      { id: 'PR-02', name: 'Dr. Tomás Lezcano', specialty: 'Odontología general', serviceTypeIds: ['ST-PRIMERA', 'ST-CONTROL', 'ST-LIMPIEZA', 'ST-TRAT'], preferredChairIds: ['CH-1', 'CH-2', 'CH-3'], bio: 'Profesional ficticio. Tardes en ambas sedes.' },
      { id: 'PR-03', name: 'Dra. Inés Galván', specialty: 'Ortodoncia', serviceTypeIds: ['ST-ORTO-CONS', 'ST-ORTO-CTRL'], preferredChairIds: ['CH-2', 'CH-1'], bio: 'Profesional ficticia de ortodoncia. Martes, miércoles y jueves en Sede Centro.' },
      { id: 'PR-04', name: 'Dr. Bruno Acosta', specialty: 'Odontología general', serviceTypeIds: ['ST-PRIMERA', 'ST-CONTROL', 'ST-LIMPIEZA'], preferredChairIds: ['CH-3'], bio: 'Profesional ficticio. Mañanas en Sede Norte.' },
    ],
    chairs: [
      { id: 'CH-1', name: 'Sillón 1', locationId: 'L-CEN' },
      { id: 'CH-2', name: 'Sillón 2', locationId: 'L-CEN' },
      { id: 'CH-3', name: 'Sillón 3', locationId: 'L-NOR' },
    ],
    serviceTypes,
    availabilityRules: [
      ...[1, 2, 3, 4, 5].map((wd) => ({ id: `AR-01-${wd}`, professionalId: 'PR-01', locationId: 'L-CEN', weekday: wd, start: '09:00', end: '13:00' })),
      ...[1, 3, 5].map((wd) => ({ id: `AR-02-N${wd}`, professionalId: 'PR-02', locationId: 'L-NOR', weekday: wd, start: '14:00', end: '19:00' })),
      ...[2, 4].map((wd) => ({ id: `AR-02-C${wd}`, professionalId: 'PR-02', locationId: 'L-CEN', weekday: wd, start: '14:00', end: '18:00' })),
      { id: 'AR-03-2', professionalId: 'PR-03', locationId: 'L-CEN', weekday: 2, start: '09:00', end: '13:00' },
      { id: 'AR-03-3', professionalId: 'PR-03', locationId: 'L-CEN', weekday: 3, start: '14:00', end: '18:00' },
      { id: 'AR-03-4', professionalId: 'PR-03', locationId: 'L-CEN', weekday: 4, start: '09:00', end: '13:00' },
      ...[1, 2, 3, 4].map((wd) => ({ id: `AR-04-${wd}`, professionalId: 'PR-04', locationId: 'L-NOR', weekday: wd, start: '09:00', end: '13:00' })),
    ],
    blocks: [
      { id: 'B-001', scope: 'professional', targetId: 'PR-03', start: at(D.mar20, '10:30'), end: at(D.mar20, '11:00'), reason: 'Tiempo administrativo (muestra)' },
      { id: 'B-002', scope: 'professional', targetId: 'PR-03', start: at(D.mar20, '11:30'), end: at(D.mar20, '13:00'), reason: 'Reunión de equipo (muestra)' },
      { id: 'B-003', scope: 'chair', targetId: 'CH-2', start: at(D.vie23, '09:00'), end: at(D.vie23, '13:00'), reason: 'Mantenimiento de sillón (muestra)' },
    ],
    staff: [
      { id: 'U-REC1', name: 'Lucía Paz', area: 'recepción' },
      { id: 'U-REC2', name: 'Marcos Díaz', area: 'recepción' },
      { id: 'U-DIR', name: 'Dirección de muestra', area: 'dirección' },
    ],
    persons: [
      { id: 'P-001', firstName: 'Martina', lastName: 'Sosa', birthYear: 1994, kind: 'adulto', preferredChannel: 'whatsapp', reminderOptIn: true, adminNote: 'Prefiere turnos por la mañana.', version: 1 },
      { id: 'P-002', firstName: 'Julián', lastName: 'Herrera', birthYear: 1987, kind: 'adulto', preferredChannel: 'whatsapp', reminderOptIn: true, adminNote: '', version: 1 },
      { id: 'P-003', firstName: 'Carla', lastName: 'Benítez', birthYear: 1985, kind: 'adulto', preferredChannel: 'portal', reminderOptIn: true, adminNote: 'Responsable de dos dependientes de muestra.', version: 1 },
      { id: 'P-004', firstName: 'Tomás', lastName: 'Benítez', birthYear: 2015, kind: 'menor', preferredChannel: null, reminderOptIn: true, adminNote: '', version: 1 },
      { id: 'P-005', firstName: 'Lola', lastName: 'Benítez', birthYear: 2018, kind: 'menor', preferredChannel: null, reminderOptIn: true, adminNote: '', version: 1 },
      { id: 'P-006', firstName: 'Ramiro', lastName: 'Quiroga', birthYear: 1979, kind: 'adulto', preferredChannel: 'llamada', reminderOptIn: true, adminNote: '', version: 1 },
      { id: 'P-007', firstName: 'Martina', lastName: 'Sosa', birthYear: 2001, kind: 'adulto', preferredChannel: 'whatsapp', reminderOptIn: true, adminNote: 'Homónima de P-001: distinguir siempre por ID.', version: 1 },
      { id: 'P-008', firstName: 'Ana', lastName: 'Paredes', birthYear: 1968, kind: 'adulto', preferredChannel: 'llamada', reminderOptIn: true, adminNote: '', version: 1 },
      { id: 'P-009', firstName: 'Diego', lastName: 'Funes', birthYear: 2009, kind: 'menor', preferredChannel: 'whatsapp', reminderOptIn: true, adminNote: '', version: 1 },
      { id: 'P-010', firstName: 'Sofía', lastName: 'Ledesma', birthYear: 1999, kind: 'adulto', preferredChannel: 'portal', reminderOptIn: true, adminNote: 'Primera visita pedida por web.', version: 1 },
      { id: 'P-011', firstName: 'Hernán', lastName: 'Ibarra', birthYear: 1972, kind: 'adulto', preferredChannel: 'llamada', reminderOptIn: false, adminNote: 'No quiere recordatorios automáticos (opt-out ficticio).', version: 1 },
      { id: 'P-012', firstName: 'Valeria', lastName: 'Ortiz', birthYear: 1990, kind: 'adulto', preferredChannel: 'whatsapp', reminderOptIn: true, adminNote: '', version: 1 },
    ],
    responsibleLinks: [
      { id: 'RL-001', responsibleId: 'P-003', dependentId: 'P-004', relation: 'Madre (muestra)' },
      { id: 'RL-002', responsibleId: 'P-003', dependentId: 'P-005', relation: 'Madre (muestra)' },
    ],
    appointments,
    requests: [
      { id: 'R-001', kind: 'primera_visita', personId: 'P-010', status: 'pendiente', channel: 'web', appointmentId: 'A-0004', summary: 'Primera consulta pedida por web. Cupo reservado, falta confirmación de recepción.', assigneeId: null, note: '', nextStep: 'Revisar datos y confirmar o proponer otro horario.', createdAt: '2026-10-16T18:20:00-03:00', updatedAt: '2026-10-16T18:20:00-03:00' },
      { id: 'R-002', kind: 'consulta', personId: null, status: 'pendiente', channel: 'whatsapp', appointmentId: null, summary: 'Contacto sin identificar pregunta si atienden sábados.', assigneeId: null, note: '', nextStep: 'Responder horario e identificar a la persona si quiere turno.', createdAt: '2026-10-18T20:05:00-03:00', updatedAt: '2026-10-18T20:05:00-03:00' },
      { id: 'R-003', kind: 'derivacion', personId: 'P-006', status: 'asignada', channel: 'llamada', appointmentId: null, summary: 'Pide hablar con alguien sobre su presupuesto emitido.', assigneeId: 'U-REC1', note: 'Llamar después de las 11 (muestra).', nextStep: 'Explicar estado administrativo del presupuesto.', createdAt: '2026-10-15T16:00:00-03:00', updatedAt: '2026-10-16T09:10:00-03:00' },
      { id: 'R-004', kind: 'reserva', personId: 'P-005', status: 'resuelta', channel: 'web', appointmentId: 'A-0015', summary: 'Responsable P-003 reservó primera consulta para Lola (P-005).', assigneeId: 'U-REC2', note: '', nextStep: '', createdAt: '2026-10-14T10:00:00-03:00', updatedAt: '2026-10-14T12:00:00-03:00' },
      { id: 'R-005', kind: 'cancelacion', personId: 'P-012', status: 'resuelta', channel: 'whatsapp', appointmentId: 'A-0016', summary: 'Canceló control del miércoles; quedó en lista de espera.', assigneeId: 'U-REC1', note: '', nextStep: '', createdAt: '2026-10-15T09:00:00-03:00', updatedAt: '2026-10-15T09:05:00-03:00' },
    ],
    conversations: [
      { id: 'C-001', channel: 'whatsapp', personId: 'P-001', contactLabel: 'Martina Sosa · P-001', requestId: null, status: 'cerrada', assigneeId: null, flow: { step: 'menu' }, updatedAt: '2026-10-09T17:41:00-03:00' },
      { id: 'C-002', channel: 'whatsapp', personId: null, contactLabel: 'Contacto sin identificar (muestra)', requestId: 'R-002', status: 'abierta', assigneeId: null, flow: { step: 'menu' }, updatedAt: '2026-10-18T20:05:00-03:00' },
      { id: 'C-003', channel: 'whatsapp', personId: 'P-007', contactLabel: 'Martina Sosa · P-007', requestId: null, status: 'cerrada', assigneeId: null, flow: { step: 'menu' }, updatedAt: '2026-10-13T10:02:00-03:00' },
    ],
    messages: [
      { id: 'M-0001', conversationId: 'C-001', from: 'paciente', text: 'Hola', at: '2026-10-09T17:40:00-03:00', simulated: 'leido_simulado' },
      { id: 'M-0002', conversationId: 'C-001', from: 'asistente', text: 'Hola, soy el asistente administrativo de esta demo de Clínica Brisa. Podés pedir un turno, cambiarlo o hablar con recepción. No evalúo problemas clínicos.', at: '2026-10-09T17:40:00-03:00', simulated: 'leido_simulado' },
      { id: 'M-0003', conversationId: 'C-001', from: 'paciente', text: 'Listo, ya tengo el control del jueves 22. Gracias', at: '2026-10-09T17:41:00-03:00', simulated: 'leido_simulado' },
      { id: 'M-0004', conversationId: 'C-002', from: 'paciente', text: '¿Atienden los sábados?', at: '2026-10-18T20:04:00-03:00', simulated: 'leido_simulado' },
      { id: 'M-0005', conversationId: 'C-002', from: 'asistente', text: 'En esta demo, Clínica Brisa atiende de lunes a viernes. Si querés, recepción puede ayudarte a buscar un horario.', at: '2026-10-18T20:05:00-03:00', simulated: 'leido_simulado' },
      { id: 'M-0006', conversationId: 'C-003', from: 'paciente', text: 'Buen día', at: '2026-10-13T10:01:00-03:00', simulated: 'leido_simulado' },
      { id: 'M-0007', conversationId: 'C-003', from: 'asistente', text: 'Hola, soy el asistente administrativo de esta demo de Clínica Brisa. Podés pedir un turno, cambiarlo o hablar con recepción. No evalúo problemas clínicos.', at: '2026-10-13T10:02:00-03:00', simulated: 'leido_simulado' },
    ],
    callSessions: [],
    automationRules: [
      { id: 'A01', name: 'Solicitud web', trigger: 'Paciente envía solicitud', condition: 'Motivo/sede válidos y recurso disponible', enabled: true },
      { id: 'A02', name: 'Primera consulta por WhatsApp', trigger: 'Pide turno en el chat local', condition: 'Persona seleccionada por ID y cupo válido', enabled: true },
      { id: 'A03', name: 'Mover control por WhatsApp', trigger: 'Pide reprogramar', condition: 'Cita activa y fuera de la ventana de 12 h', enabled: true },
      { id: 'A04', name: 'Llamada simulada', trigger: 'Inicio voluntario', condition: 'Gestión identificada y confirmación explícita', enabled: true },
      { id: 'A05', name: 'Recordatorio 24 h', trigger: 'Reloj alcanza 24 h antes', condition: 'Cita activa, opt-in y clave cita+versión+tipo inexistente', enabled: true },
      { id: 'A06', name: 'Oferta de lista de espera', trigger: 'Se libera un intervalo', condition: 'Candidato vigente y compatible', enabled: true },
      { id: 'A07', name: 'Confirmación/cancelación', trigger: 'Paciente confirma o cancela', condition: 'Misma cita y commandId no aplicado', enabled: true },
      { id: 'A08', name: 'Derivación humana', trigger: 'Texto clínico, desconocido o pedido de persona', condition: 'Nunca diagnosticar ni clasificar', enabled: true },
      { id: 'A09', name: 'Seguimiento de presupuesto', trigger: 'Presupuesto emitido vence', condition: 'Sin tarea previa; nunca marca cobro', enabled: true },
      { id: 'A10', name: 'Continuidad entre canales', trigger: 'Se continúa una gestión en otro canal', condition: 'Selección explícita de gestión y persona por ID', enabled: true },
    ],
    outbox,
    tasks: [
      { id: 'T-001', kind: 'confirmar_solicitud', title: 'Confirmar primera consulta de P-010', detail: 'Solicitud web R-001 con cupo reservado hoy 10:00.', status: 'abierta', assigneeId: null, dueAt: '2026-10-19T09:45:00-03:00', personId: 'P-010', requestId: 'R-001', appointmentId: 'A-0004', estimateId: null, dedupeKey: 'confirm:R-001', note: '', createdAt: '2026-10-16T18:20:00-03:00', ruleId: 'A01' },
      { id: 'T-002', kind: 'derivacion', title: 'Devolver llamado a P-006 sobre presupuesto', detail: 'Explicar estado administrativo de EST-001. No es cobro.', status: 'en_curso', assigneeId: 'U-REC1', dueAt: '2026-10-19T12:00:00-03:00', personId: 'P-006', requestId: 'R-003', appointmentId: null, estimateId: 'EST-001', dedupeKey: 'deriv:R-003', note: '', createdAt: '2026-10-15T16:00:00-03:00', ruleId: 'A08' },
      { id: 'T-003', kind: 'control_indicado', title: 'Coordinar control indicado de P-009', detail: 'La profesional indicó un nuevo control (IC-003). Ofrecer turno; no calcular frecuencia.', status: 'abierta', assigneeId: null, dueAt: '2026-10-23T18:00:00-03:00', personId: 'P-009', requestId: null, appointmentId: null, estimateId: null, dedupeKey: 'control:IC-003', note: '', createdAt: '2026-10-15T11:00:00-03:00', ruleId: null },
    ],
    waitlist: [
      { id: 'W-001', personId: 'P-012', serviceTypeId: 'ST-CONTROL', professionalId: null, locationId: 'L-NOR', period: 'tarde', validUntil: '2026-11-15T18:00:00-03:00', status: 'activa', rejectedSlotKeys: [], createdAt: '2026-10-15T09:05:00-03:00' },
      { id: 'W-002', personId: 'P-008', serviceTypeId: 'ST-CONTROL', professionalId: null, locationId: null, period: 'cualquiera', validUntil: '2026-11-05T18:00:00-03:00', status: 'activa', rejectedSlotKeys: [], createdAt: '2026-10-16T12:00:00-03:00' },
    ],
    offers: [],
    careEpisodes: [
      { id: 'E-001', personId: 'P-001', kind: 'ortodoncia', title: 'Seguimiento de ortodoncia (muestra)', professionalId: 'PR-03', status: 'activo', startedAt: '2026-03-10T10:00:00-03:00',
        timeline: [
          { at: '2026-03-10T10:00:00-03:00', kind: 'inicio', text: 'Inicio administrativo del seguimiento.' },
          { at: '2026-09-17T10:30:00-03:00', kind: 'control', text: 'Control registrado por la profesional.' },
          { at: '2026-09-17T10:35:00-03:00', kind: 'indicacion', text: 'La profesional indicó el próximo control (IC-001).' },
          { at: '2026-10-09T17:41:00-03:00', kind: 'reserva', text: 'Control IC-001 reservado: A-0012.' },
        ],
        controls: [{ id: 'IC-001', note: 'Próximo control indicado por la profesional.', indicatedBy: 'PR-03', indicatedAt: '2026-09-17T10:35:00-03:00', status: 'reservado', appointmentId: 'A-0012' }] },
      { id: 'E-002', personId: 'P-009', kind: 'ortodoncia', title: 'Seguimiento de ortodoncia (muestra)', professionalId: 'PR-03', status: 'activo', startedAt: '2026-05-04T09:00:00-03:00',
        timeline: [
          { at: '2026-05-04T09:00:00-03:00', kind: 'inicio', text: 'Inicio administrativo del seguimiento.' },
          { at: '2026-09-22T09:30:00-03:00', kind: 'indicacion', text: 'La profesional indicó control (IC-002).' },
          { at: '2026-10-15T11:00:00-03:00', kind: 'indicacion', text: 'La profesional indicó un control adicional (IC-003).' },
        ],
        controls: [
          { id: 'IC-002', note: 'Control indicado.', indicatedBy: 'PR-03', indicatedAt: '2026-09-22T09:30:00-03:00', status: 'reservado', appointmentId: 'A-0008' },
          { id: 'IC-003', note: 'Control adicional indicado.', indicatedBy: 'PR-03', indicatedAt: '2026-10-15T11:00:00-03:00', status: 'indicado', appointmentId: null },
        ] },
    ],
    toothChart: [
      { id: 'TC-001', personId: 'P-008', dentition: 'permanente', tooth: 46, surface: 'pieza', procedure: 'Tratamiento de conducto', state: 'realizado', status: 'vigente', createdAt: '2026-10-07T10:00:00-03:00', by: 'PR-01' },
      { id: 'TC-002', personId: 'P-008', dentition: 'permanente', tooth: 46, surface: 'pieza', procedure: 'Corona provisoria', state: 'planificado', status: 'vigente', createdAt: '2026-10-07T10:05:00-03:00', by: 'PR-01' },
      { id: 'TC-003', personId: 'P-006', dentition: 'permanente', tooth: 36, surface: 'O', procedure: 'Restauración', state: 'planificado', status: 'vigente', createdAt: '2026-10-12T09:20:00-03:00', by: 'PR-01' },
      { id: 'TC-004', personId: 'P-001', dentition: 'permanente', tooth: 16, surface: 'O', procedure: 'Sellador', state: 'realizado', status: 'vigente', createdAt: '2026-04-02T10:00:00-03:00', by: 'PR-01' },
      { id: 'TC-005', personId: 'P-004', dentition: 'temporal', tooth: 75, surface: 'O', procedure: 'Restauración', state: 'planificado', status: 'vigente', createdAt: '2026-10-01T11:00:00-03:00', by: 'PR-01' },
    ],
    estimates: [
      { id: 'EST-001', personId: 'P-006', professionalId: 'PR-01', status: 'emitido', validUntil: '2026-10-26T18:00:00-03:00', issuedAt: '2026-10-12T09:30:00-03:00', decidedAt: null, createdAt: '2026-10-12T09:25:00-03:00', coverageNote: 'Cobertura a verificar por recepción (muestra).' },
      { id: 'EST-002', personId: 'P-008', professionalId: 'PR-01', status: 'aceptado', validUntil: '2026-10-31T18:00:00-03:00', issuedAt: '2026-10-01T11:00:00-03:00', decidedAt: '2026-10-03T10:00:00-03:00', createdAt: '2026-10-01T10:50:00-03:00', coverageNote: 'Sin cobertura declarada (muestra).' },
      { id: 'EST-003', personId: 'P-009', professionalId: 'PR-03', status: 'borrador', validUntil: null, issuedAt: null, decidedAt: null, createdAt: '2026-10-15T11:10:00-03:00', coverageNote: 'Cobertura a verificar.' },
    ],
    estimateLines: [
      { id: 'EL-001', estimateId: 'EST-001', description: 'Restauración pieza 36', tooth: 36, qty: 1, unitMinor: 3_800_000 },
      { id: 'EL-002', estimateId: 'EST-001', description: 'Consulta de evaluación', tooth: null, qty: 1, unitMinor: 1_500_000 },
      { id: 'EL-003', estimateId: 'EST-002', description: 'Tratamiento de conducto pieza 46', tooth: 46, qty: 1, unitMinor: 9_500_000 },
      { id: 'EL-004', estimateId: 'EST-002', description: 'Corona provisoria pieza 46', tooth: 46, qty: 1, unitMinor: 2_500_000 },
      { id: 'EL-005', estimateId: 'EST-003', description: 'Aparatología de contención (muestra)', tooth: null, qty: 1, unitMinor: 6_000_000 },
    ],
    ledger: [
      { id: 'L-001', personId: 'P-008', estimateId: 'EST-002', kind: 'pago_simulado', amountMinor: 4_500_000, reversesId: null, reversedById: null, commandId: 'seed:L-001', at: '2026-10-07T10:30:00-03:00', note: 'Movimiento ficticio' },
      { id: 'L-002', personId: 'P-008', estimateId: 'EST-002', kind: 'pago_simulado', amountMinor: 2_000_000, reversesId: null, reversedById: null, commandId: 'seed:L-002', at: '2026-10-14T10:30:00-03:00', note: 'Movimiento ficticio' },
      { id: 'L-003', personId: 'P-006', estimateId: null, kind: 'pago_simulado', amountMinor: 1_500_000, reversesId: null, reversedById: null, commandId: 'seed:L-003', at: '2026-10-05T09:40:00-03:00', note: 'Consulta (ficticio)' },
      { id: 'L-004', personId: 'P-002', estimateId: null, kind: 'pago_simulado', amountMinor: 1_200_000, reversesId: null, reversedById: 'L-005', commandId: 'seed:L-004', at: '2026-10-06T09:40:00-03:00', note: 'Carga duplicada (ficticio)' },
      { id: 'L-005', personId: 'P-002', estimateId: null, kind: 'contrapartida', amountMinor: -1_200_000, reversesId: 'L-004', reversedById: null, commandId: 'seed:L-005', at: '2026-10-06T09:45:00-03:00', note: 'Reversión de L-004' },
      { id: 'L-006', personId: 'P-002', estimateId: null, kind: 'pago_simulado', amountMinor: 1_200_000, reversesId: null, reversedById: null, commandId: 'seed:L-006', at: '2026-10-06T09:46:00-03:00', note: 'Control (ficticio)' },
      { id: 'L-007', personId: 'P-003', estimateId: null, kind: 'pago_simulado', amountMinor: 1_800_000, reversesId: null, reversedById: null, commandId: 'seed:L-007', at: '2026-10-08T11:00:00-03:00', note: 'Limpieza (ficticio)' },
      { id: 'L-008', personId: 'P-012', estimateId: null, kind: 'pago_simulado', amountMinor: 1_500_000, reversesId: null, reversedById: null, commandId: 'seed:L-008', at: '2026-10-09T10:20:00-03:00', note: 'Limpieza (ficticio)' },
      { id: 'L-009', personId: 'P-010', estimateId: null, kind: 'pago_simulado', amountMinor: 900_000, reversesId: null, reversedById: null, commandId: 'seed:L-009', at: '2026-10-12T15:00:00-03:00', note: 'Seña administrativa (ficticio)' },
      { id: 'L-010', personId: 'P-009', estimateId: null, kind: 'pago_simulado', amountMinor: 3_000_000, reversesId: null, reversedById: null, commandId: 'seed:L-010', at: '2026-10-15T11:30:00-03:00', note: 'Control (ficticio)' },
    ],
    learning: LEARNING_CARD_IDS.map((cardId) => ({ cardId, state: 'nuevo', attempts: 0, lastChoiceId: null, opens: 0, rereads: 0, completedAt: null })),
    audit: [{ id: 'EV-0001', at: seedAt, type: 'seed', entity: 'demo', entityId: SEED, detail: 'Fixture inicial dentalos-v1 cargado.', commandId: 'seed' }],
    processed: {},
  };
}
