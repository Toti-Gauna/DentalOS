// Presets aislados: cada uno parte de la seed para no contaminar precondiciones entre casos.
import { createSeedState } from './seed';
import { addDays, at } from './time';
import type { DemoState } from './types';

export interface Preset { id: string; name: string; description: string; route: string; cases: string; build: () => DemoState }

const withPreset = (id: string, mut?: (s: DemoState) => void) => () => {
  const s = createSeedState();
  s.preset = id;
  mut?.(s);
  return s;
};

export const PRESETS: Preset[] = [
  { id: 'inicial', name: 'Inicial', description: 'Seed dentalos-v1 completa, reloj lun 19/10 09:00.', route: '#/', cases: 'S01, S25, recorrido protagonista', build: withPreset('inicial') },
  { id: 'primera_visita', name: 'Primera visita sin turno de ese motivo', description: 'P-001 no tiene primera consulta: reservala desde Reservar.', route: '#/reservar', cases: 'S02–S07, S23', build: withPreset('primera_visita') },
  { id: 'profesional_ocupado', name: 'Profesional ocupado', description: 'Dra. Galván ocupada mar 20/10 10:00 (A-0008). Pedí ese horario.', route: '#/whatsapp', cases: 'S08, S13, S29', build: withPreset('profesional_ocupado') },
  { id: 'sillon_ocupado', name: 'Sillón ocupado', description: 'Sillón 1 ocupado mar 20/10 09:00–10:00 por la Dra. Ferreyra; el Dr. Lezcano está libre pero el sillón no.', route: '#/admin', cases: 'S09', build: withPreset('sillon_ocupado', (s) => {
    s.availabilityRules.push({ id: 'AR-02-C2M', professionalId: 'PR-02', locationId: 'L-CEN', weekday: 2, start: '09:00', end: '12:00' });
  }) },
  { id: 'duracion_insuficiente', name: 'Duración insuficiente', description: 'Miércoles 21/10 14:00–14:15 queda un hueco de 15 min: el control de 30 min no se ofrece.', route: '#/reservar', cases: 'S10', build: withPreset('duracion_insuficiente') },
  { id: 'fuera_jornada', name: 'Fuera de jornada', description: 'Sábados y domingos sin jornada; bloqueo de sede Norte el jueves 22/10.', route: '#/reservar', cases: 'S11', build: withPreset('fuera_jornada', (s) => {
    s.blocks.push({ id: 'B-004', scope: 'location', targetId: 'L-NOR', start: at('2026-10-22', '00:00'), end: at('2026-10-23', '00:00'), reason: 'Sede cerrada por jornada interna (muestra)' });
    s.seq.B = 4;
  }) },
  { id: 'agenda_llena', name: 'Agenda llena', description: 'Toda la odontología general bloqueada 30 días: limpieza sin cupos, aparece lista de espera.', route: '#/reservar', cases: 'S12', build: withPreset('agenda_llena', (s) => {
    let n = 3;
    for (const pro of ['PR-01', 'PR-02', 'PR-04']) {
      n += 1;
      s.blocks.push({ id: `B-${String(n).padStart(3, '0')}`, scope: 'professional', targetId: pro, start: at('2026-10-19', '11:30'), end: at(addDays('2026-10-19', 31), '00:00'), reason: 'Agenda completa (muestra)' });
    }
    s.seq.B = n;
  }) },
  { id: 'ventana_12h', name: 'Ventana < 12 h', description: 'P-011 tiene turno hoy 15:00: el cambio por autoservicio deriva a recepción.', route: '#/mis-turnos', cases: 'S15', build: withPreset('ventana_12h') },
  { id: 'fallo_commit', name: 'Fallo al guardar', description: 'El próximo commit falla (simulado). El turno original se conserva; reintentar funciona.', route: '#/whatsapp', cases: 'S14', build: withPreset('fallo_commit', (s) => { s.settings.failNextCommits = 1; }) },
  { id: 'vacio', name: 'Vacío', description: 'Sin personas, citas ni movimientos. KPIs con n=0.', route: '#/admin/informes', cases: 'S21', build: withPreset('vacio', (s) => {
    s.persons = []; s.responsibleLinks = []; s.appointments = []; s.requests = []; s.conversations = []; s.messages = []; s.outbox = []; s.tasks = [];
    s.waitlist = []; s.offers = []; s.careEpisodes = []; s.toothChart = []; s.estimates = []; s.estimateLines = []; s.ledger = [];
  }) },
  { id: 'dos_ofertas', name: 'Dos ofertas compitiendo', description: 'Se canceló el control del Dr. Acosta mié 21/10 09:00 y hay dos candidatos con oferta activa por el mismo cupo.', route: '#/admin/espera', cases: 'S45, A06', build: withPreset('dos_ofertas', (s) => {
    const a = s.appointments.find((x) => x.id === 'A-0018')!;
    a.status = 'cancelada'; a.cancelReason = 'Cancelación de muestra para liberar cupo';
    for (const o of s.outbox) if (o.appointmentId === a.id && o.status === 'programado') o.status = 'anulado';
    s.waitlist.find((w) => w.id === 'W-001')!.locationId = null;
    const slot = { start: a.start, end: a.end, professionalId: a.professionalId, chairId: a.chairId, locationId: a.locationId, serviceTypeId: a.serviceTypeId };
    s.offers.push(
      { id: 'OF-001', waitlistEntryId: 'W-001', personId: 'P-012', slot, holdUntil: '2026-10-19T09:10:00-03:00', status: 'activa', dedupeKey: `offer:W-001:${slot.professionalId}|${slot.chairId}|${slot.start}`, appointmentId: null, createdAt: s.clock },
      { id: 'OF-002', waitlistEntryId: 'W-002', personId: 'P-008', slot, holdUntil: '2026-10-19T09:10:00-03:00', status: 'activa', dedupeKey: `offer:W-002:${slot.professionalId}|${slot.chairId}|${slot.start}`, appointmentId: null, createdAt: s.clock },
    );
    s.seq.OF = 2;
  }) },
  { id: 'storage_invalido', name: 'Storage inválido', description: 'Escribe un JSON dañado en el namespace propio y recarga: la app avisa y ofrece restaurar.', route: '#/admin/config', cases: 'S26', build: withPreset('storage_invalido') },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id);
