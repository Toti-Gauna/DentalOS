// Recorridos guiados entre vistas (lote 5 · R-FLW-01): cada paso fija la vista y, si hace falta, la persona del portal.
// Solo navegación de la demo: no inicia sesión, no cambia datos ni salta confirmaciones.
import type { ViewRole } from '../domain';

export interface JourneyStep { role: ViewRole; to: string; label: string; actingPersonId?: string }
export interface Journey { id: string; title: string; summary: string; steps: JourneyStep[] }

export const JOURNEYS: Journey[] = [
  {
    id: 'turno', title: 'Un turno de punta a punta', summary: 'Se pide en el portal, recepción lo ve en la agenda y la persona lo confirma.',
    steps: [
      { role: 'visitante', to: '/reservar', label: 'Pedir un turno' },
      { role: 'recepcion', to: '/admin', label: 'Verlo en la agenda del día' },
      { role: 'paciente', to: '/mis-turnos', label: 'Confirmarlo o cambiarlo', actingPersonId: 'P-001' },
    ],
  },
  {
    id: 'presupuesto', title: 'Presupuesto de un menor', summary: 'Tomás (P-004) no decide: lo acepta Carla, su responsable. Aceptar no es pagar.',
    steps: [
      { role: 'recepcion', to: '/admin/presupuestos', label: 'Ver el presupuesto emitido' },
      { role: 'paciente', to: '/mis-turnos', label: 'Carla lo revisa y decide', actingPersonId: 'P-003' },
      { role: 'recepcion', to: '/admin/presupuestos', label: 'Ver quién decidió y el saldo simulado' },
    ],
  },
  {
    id: 'mensaje', title: 'Un mensaje que llega a recepción', summary: 'WhatsApp simulado del lado de la persona y la bandeja del lado de la clínica.',
    steps: [
      { role: 'visitante', to: '/whatsapp', label: 'Escribir por WhatsApp (simulado)' },
      { role: 'recepcion', to: '/admin/bandeja', label: 'Responder desde la bandeja' },
    ],
  },
  {
    id: 'campana', title: 'Campaña administrativa', summary: 'Segmento → borrador → vista previa → aprobación → activación simulada. Nada se envía.',
    steps: [
      { role: 'direccion', to: '/admin/campanas', label: 'Segmentos, economía y asistente' },
      { role: 'recepcion', to: '/admin/tareas', label: 'Llamadas que quedan como tareas' },
      { role: 'paciente', to: '/whatsapp', label: 'Consultar turno, presupuesto o seguimiento' },
    ],
  },
  {
    id: 'familia', title: 'Brisa Chicos en familia', summary: 'Turnos de los chicos desde el portal y los juegos, que maneja la persona adulta.',
    steps: [
      { role: 'paciente', to: '/mis-turnos', label: 'Turnos de Tomás y Lola', actingPersonId: 'P-003' },
      { role: 'paciente', to: '/chicos', label: 'Jugar a la memoria o cazar bichitos', actingPersonId: 'P-003' },
    ],
  },
];
