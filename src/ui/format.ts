import type { OrderStatus, ReservationStatus, Role } from '../domain/types'

export type Tone = 'ok' | 'warn' | 'err' | 'info' | 'neutral'
export interface Label {
  label: string
  tone: Tone
  icon: string
}

export const RES_LABEL: Record<ReservationStatus, Label> = {
  borrador: { label: 'Borrador', tone: 'neutral', icon: '✎' },
  solicitada: { label: 'Solicitada', tone: 'warn', icon: '◔' },
  confirmada: { label: 'Confirmada', tone: 'ok', icon: '✓' },
  alternativa_ofrecida: { label: 'Alternativa ofrecida', tone: 'info', icon: '⇄' },
  revision_humana: { label: 'Revisión humana', tone: 'warn', icon: '⚑' },
  llegada: { label: 'Llegó', tone: 'info', icon: '➜' },
  sentada: { label: 'Sentada', tone: 'ok', icon: '◉' },
  completada: { label: 'Completada', tone: 'neutral', icon: '✔' },
  cancelada: { label: 'Cancelada', tone: 'err', icon: '✕' },
  no_show: { label: 'No-show', tone: 'err', icon: '∅' },
}
export const ORDER_LABEL: Record<OrderStatus, Label> = {
  enviado: { label: 'Enviado', tone: 'warn', icon: '◔' },
  aceptado: { label: 'Aceptado', tone: 'info', icon: '✓' },
  en_preparacion: { label: 'En preparación', tone: 'info', icon: '♨' },
  listo: { label: 'Listo', tone: 'ok', icon: '★' },
  servido: { label: 'Servido', tone: 'ok', icon: '✔' },
  retirado: { label: 'Retirado', tone: 'ok', icon: '✔' },
  cerrado: { label: 'Cerrado', tone: 'neutral', icon: '■' },
  rechazado: { label: 'Rechazado', tone: 'err', icon: '✕' },
  cancelado: { label: 'Cancelado', tone: 'err', icon: '✕' },
}

export const ROLE_LABEL: Record<Role, string> = {
  'cliente-invitado': 'Cliente invitado',
  'cliente-recurrente': 'Cliente recurrente (Ana)',
  recepcion: 'Recepción / anfitrión',
  mozo: 'Mozo',
  cocina: 'Cocina / barra',
  caja: 'Caja',
  encargado: 'Encargado',
}
export const isClientRole = (r: Role) => r === 'cliente-invitado' || r === 'cliente-recurrente'

export interface AdminSection {
  key: string
  label: string
  roles: Role[]
}
export const ADMIN_SECTIONS: AdminSection[] = [
  { key: 'resumen', label: 'Resumen', roles: ['encargado', 'recepcion'] },
  { key: 'reservas', label: 'Reservas', roles: ['recepcion', 'encargado'] },
  { key: 'salon', label: 'Salón', roles: ['recepcion', 'mozo', 'encargado'] },
  { key: 'pedidos', label: 'Pedidos', roles: ['recepcion', 'mozo', 'caja', 'encargado'] },
  { key: 'cocina', label: 'Cocina / barra', roles: ['cocina', 'encargado'] },
  { key: 'caja', label: 'Caja', roles: ['caja', 'encargado'] },
  { key: 'carta', label: 'Carta', roles: ['encargado'] },
  { key: 'stock', label: 'Stock', roles: ['cocina', 'encargado'] },
  { key: 'clientes', label: 'Clientes', roles: ['recepcion', 'encargado'] },
  { key: 'automatizaciones', label: 'Automatizaciones', roles: ['encargado'] },
  { key: 'reportes', label: 'Reportes', roles: ['encargado'] },
  { key: 'configuracion', label: 'Configuración', roles: ['encargado'] },
]
export const DEFAULT_ADMIN: Record<Role, string> = {
  'cliente-invitado': 'resumen',
  'cliente-recurrente': 'resumen',
  recepcion: 'reservas',
  mozo: 'salon',
  cocina: 'cocina',
  caja: 'caja',
  encargado: 'resumen',
}

export const CHANNEL_LABEL: Record<string, string> = { web: 'Web', whatsapp: 'WhatsApp (simulado)', voz: 'Llamada (simulada)', recepcion: 'Recepción' }
export const BIZ_PATH = { 'mesa-clara': 'mesa-clara', 'ritual-cafe': 'ritual-cafe' } as const
