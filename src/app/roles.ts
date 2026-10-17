// Vistas de muestra de la demo. Son puntos de partida y recortes de navegación, no permisos ni inicios de sesión:
// cambiar de vista conserva los mismos registros y preferencias.
import type { ViewRole } from '../domain';

export interface RoleInfo { id: ViewRole; label: string; home: string; icon: string; description: string }

export const ROLES: RoleInfo[] = [
  { id: 'visitante', label: 'Visitante', home: '/', icon: 'home', description: 'Conocé la clínica, pedí una primera consulta y probá WhatsApp o la llamada simulados.' },
  { id: 'paciente', label: 'Paciente / responsable', home: '/mis-turnos', icon: 'user', description: 'Martina Sosa (P-001) y su familia: próximos turnos, cambios y recordatorios.' },
  { id: 'recepcion', label: 'Recepción', home: '/admin', icon: 'calendar', description: 'Agenda por profesional y sillón, bandeja de mensajes, confirmaciones y espera.' },
  { id: 'profesional', label: 'Profesional', home: '/admin/ortodoncia', icon: 'tooth', description: 'Odontograma y seguimiento de ortodoncia; los controles los indica la profesional.' },
  { id: 'direccion', label: 'Dirección', home: '/admin/informes', icon: 'chart', description: 'Informes de capacidad, seguimiento y caja ficticia, siempre con su n.' },
];

export const roleById = (id: ViewRole) => ROLES.find((r) => r.id === id) ?? ROLES[0];
