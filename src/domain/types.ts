import type { BaseUnit, Unit } from './units'

export const SCHEMA_VERSION = 1 as const
export const STORAGE_NS = 'tableflow.demo.v1'

export type BusinessId = 'mesa-clara' | 'ritual-cafe'
export type Role =
  | 'cliente-invitado'
  | 'cliente-recurrente'
  | 'recepcion'
  | 'mozo'
  | 'cocina'
  | 'caja'
  | 'encargado'
export type FixtureId = 'servicio' | 'vacio'
export type Channel = 'web' | 'whatsapp' | 'voz' | 'recepcion'

/** Todo registro: ID estable, businessId, createdAt del reloj simulado y versión. */
export interface Entity {
  id: string
  businessId: BusinessId
  createdAt: number
  version: number
}

export interface BusinessProfile extends Entity {
  id: BusinessId
  name: string
  kind: 'bodegon' | 'cafe'
  tagline: string
  story: string
  reservationsEnabled: boolean
  autoConfirmReservations: boolean
  serviceMinutes: number
  bufferMinutes: number
  /** Cantidad máxima que el motor asigna sin revisión humana (la mesa más grande). */
  maxPartyAuto: number
  /** Regla de muestra para unir mesas (solo salón; el motor online nunca combina). */
  combineRules: { id: string; tableIds: string[]; seats: number; label: string }[]
  passportPaused: boolean
  /** Premio real: deshabilitado hasta aprobación del negocio y cotización de campaña. */
  rewardsEnabled: false
  pickupPerSlot: number
  categoryOrder: string[]
}

export interface Location extends Entity {
  name: string
  hasTables: boolean
  pickupEnabled: boolean
  /** Si es una lista, el ítem de carta con locationIds solo aparece en estas sedes. */
}

export interface ServiceWindow extends Entity {
  locationId: string
  label: string
  days: number[] // 0=domingo
  startMin: number
  endMin: number
}

export interface Table extends Entity {
  locationId: string
  label: string
  seats: number
  sector: 'salon' | 'terraza'
  col: number
  row: number
}

export type ReservationStatus =
  | 'borrador'
  | 'solicitada'
  | 'confirmada'
  | 'alternativa_ofrecida'
  | 'revision_humana'
  | 'llegada'
  | 'sentada'
  | 'completada'
  | 'cancelada'
  | 'no_show'

export interface Reservation extends Entity {
  locationId: string
  dateKey: string
  startMin: number
  party: number
  status: ReservationStatus
  tableId: string | null
  sectorPref: 'cualquiera' | 'salon' | 'terraza'
  alias: string
  customerId: string | null
  channel: Channel
  conversationId: string | null
  operationId: string
  correlationId: string
  dietaryNote: string | null
  reviewReason: 'alimentaria' | 'grupo-grande' | null
  reviewResolved: boolean
  alternativeStartMin: number | null
  cancelReason: string | null
  attendanceConfirmed: boolean
  sessionId: string | null
  notes: string
}

export interface WaitlistEntry extends Entity {
  locationId: string
  dateKey: string
  startMin: number
  party: number
  alias: string
  customerId: string | null
  status: 'esperando' | 'ofrecida' | 'aceptada' | 'vencida' | 'retirada' | 'cancelada'
  offerStartMin: number | null
  offerExpiresAt: number | null
  offerReservationVersionKey: string | null
  operationId: string
}

export interface ModifierOption {
  id: string
  name: string
  deltaCents: number
  incompatibleWith?: string[]
  /** Consumo de stock de la opción (ej: leche vegetal). */
  consumes?: { ingredientId: string; qty: number; unit: Unit }
}
export interface ModifierGroup {
  id: string
  businessId: BusinessId
  name: string
  required: boolean
  min: number
  max: number
  options: ModifierOption[]
}

export interface FoodNote {
  status: 'completa' | 'pendiente'
  allergens: string[]
  note: string
}

export interface MenuItemHistory {
  version: number
  at: number
  summary: string
}

export interface MenuItem extends Entity {
  name: string
  description: string
  category: string
  priceCents: number
  imageUrl: string | null
  modifierGroupIds: string[]
  /** Apagado manual desde admin ("agotar"). */
  soldOut: boolean
  locationIds: string[] | null
  hours: { fromMin: number; toMin: number } | null
  station: 'cocina' | 'barra'
  maxQty: number
  foodNote: FoodNote
  tags: string[]
  history: MenuItemHistory[]
}

export interface CartLine {
  id: string
  itemId: string
  itemVersion: number
  selections: Record<string, string[]>
  qty: number
  note: string
  /** Precio unitario (con modificadores) visto por el cliente al armar la línea. */
  unitCentsSeen: number
}
export interface Cart {
  id: string
  businessId: BusinessId
  locationId: string
  customerId: string | null
  lines: CartLine[]
  fulfillment: { kind: 'mesa'; tableId: string | null } | { kind: 'retiro'; startMin: number | null }
  alias: string
  version: number
  /** operationId del intento de envío; se reutiliza mientras el carrito no cambie. */
  pendingOperationId: string | null
  updatedAt: number
}

export type OrderStatus =
  | 'enviado'
  | 'aceptado'
  | 'en_preparacion'
  | 'listo'
  | 'servido'
  | 'retirado'
  | 'cerrado'
  | 'rechazado'
  | 'cancelado'

export interface OrderLine {
  id: string
  itemId: string
  name: string
  qty: number
  unitCents: number
  lineCents: number
  station: 'cocina' | 'barra'
  selections: { groupId: string; groupName: string; optionId: string; optionName: string; deltaCents: number }[]
  note: string
}
export interface Order extends Entity {
  locationId: string
  sessionId: string
  kind: 'mesa' | 'retiro'
  pickup: { dateKey: string; startMin: number } | null
  customerId: string | null
  alias: string
  channel: Channel
  conversationId: string | null
  lines: OrderLine[]
  totalCents: number
  status: OrderStatus
  reason: string | null
  operationId: string
  correlationId: string
  ticketId: string
  reviewed: boolean
  cancelRequested: boolean
  noticeRunId: string | null
  pickupCode: string
  duplicatedFrom: string | null
}

export interface KitchenTicket extends Entity {
  orderId: string
  status: 'nuevo' | 'aceptado' | 'preparando' | 'listo' | 'entregado' | 'cerrado' | 'cancelado' | 'rechazado'
  startedAt: number | null
  incident: string | null
}

export interface TableSession extends Entity {
  locationId: string
  kind: 'mesa' | 'retiro'
  tableIds: string[]
  party: number
  reservationId: string | null
  status: 'activa' | 'cerrada'
  openedAt: number
  closedAt: number | null
  splitPlan: { n: number; shares: number[] } | null
  closeException: { reason: string; authorizedBy: Role; pendingCents: number; at: number } | null
  label: string
}

export interface PaymentSimulation extends Entity {
  sessionId: string
  cashSessionId: string
  operationId: string
  amountCents: number
  method: 'efectivo' | 'tarjeta' | 'transferencia'
  lineIds: string[]
  shareIndex: number | null
  status: 'registrado' | 'anulado'
  receiptNo: string
  adjustmentCents: number
}

export interface CashMovement {
  id: string
  kind: 'ingreso' | 'egreso'
  amountCents: number
  reason: string
  at: number
}
export interface CashSession extends Entity {
  locationId: string
  status: 'abierta' | 'cerrada'
  openingFloatCents: number
  movements: CashMovement[]
  openedAt: number
  closedAt: number | null
  countedCashCents: number | null
  expectedCashCents: number | null
  differenceCents: number | null
  closeReason: string | null
}

export interface Ingredient extends Entity {
  name: string
  unit: BaseUnit
  onHand: number
  reserved: number
  lowThreshold: number
  /** Cuenta cuántas veces cruzó a bajo/agotado y se repuso (claves de alerta). */
  epoch: number
  alertState: 'ok' | 'bajo' | 'agotado'
}
export interface RecipeLine {
  ingredientId: string
  qty: number
  unit: Unit
}
export interface Recipe extends Entity {
  itemId: string
  lines: RecipeLine[]
}
export interface StockMovement extends Entity {
  ingredientId: string
  kind: 'reserva' | 'consumo' | 'liberacion' | 'reposicion' | 'ajuste' | 'merma'
  /** Cambio en onHand (consumo/reposición/ajuste); 0 si solo mueve reserva o clasifica. */
  deltaOnHand: number
  deltaReserved: number
  orderId: string | null
  eventKey: string
  note: string
}

export interface CustomerDemo extends Entity {
  alias: string
  displayName: string
  channels: { whatsapp: boolean; voz: boolean }
  consent: { service: boolean; promo: boolean; updatedAt: number }
  prefs: string
  mergedInto: string | null
  possibleDuplicateOf: string | null
}

export interface ChatAction {
  id: string
  label: string
  payload?: string
}
export interface Message extends Entity {
  conversationId: string
  from: 'cliente' | 'asistente' | 'sistema'
  text: string
  channel: Channel
  status: 'pendiente' | 'enviado' | 'entregado' | 'fallido'
  actions: ChatAction[]
  link: { label: string; to: string } | null
  messageKey: string | null
  sentAt: number | null
}

export interface ConvFlow {
  type: 'reserva' | 'cancelar' | 'reprogramar' | 'pedido' | 'seguimiento' | 'fecha'
  step: string
  data: Record<string, unknown>
}
export interface Conversation extends Entity {
  customerId: string | null
  channel: Channel
  title: string
  flow: ConvFlow | null
  failures: number
  reservationIds: string[]
  orderIds: string[]
  correlationId: string
  handoff: boolean
}

export interface CallTurn {
  who: 'cliente' | 'asistente' | 'sistema'
  text: string
}
export interface CallSession extends Entity {
  conversationId: string
  status:
    | 'inactiva'
    | 'iniciando'
    | 'turno_cliente'
    | 'procesando'
    | 'respuesta'
    | 'resumen'
    | 'solicitud_creada'
    | 'derivada'
    | 'finalizada'
  branch: 'A' | 'B' | 'C' | null
  silences: number
  transcript: CallTurn[]
  draft: Record<string, unknown>
  reservationId: string | null
  endReason: string | null
  token: number
  pendingResponse: string | null
  waitedSec: number
  operationId: string
}

export interface HumanReviewTask extends Entity {
  kind:
    | 'alimentaria'
    | 'grupo-grande'
    | 'fuera-de-alcance'
    | 'canal-desconocido'
    | 'sin-consentimiento'
    | 'receta-unidad'
    | 'stock'
    | 'cancelacion-preparacion'
    | 'incidencia-cocina'
    | 'otro'
  status: 'pendiente' | 'resuelta'
  entityType: string
  entityId: string
  conversationId: string | null
  note: string
  resolution: string | null
  draft: Record<string, unknown> | null
  correlationId: string
}

export interface AutomationRule extends Entity {
  code: string // AU01…AU10
  name: string
  channel: string
  trigger: string
  action: string
  enabled: boolean
  config: Record<string, unknown>
  failNext: boolean
}
export interface AutomationRun extends Entity {
  ruleId: string
  ruleCode: string
  ruleVersion: number
  key: string
  entityType: string
  entityId: string
  entityVersion: number
  status: 'pendiente' | 'ejecutada' | 'fallida' | 'recuperada' | 'omitida' | 'derivada' | 'suprimida'
  attempts: number
  messageId: string | null
  detail: string
  log: { at: number; text: string }[]
  correlationId: string
}

export interface TastingEvent extends Entity {
  locationId: string
  title: string
  description: string
  dateKey: string
  startMin: number
  capacity: number
  status: 'abierta' | 'cancelada'
  priceNote: string
}
export interface EventBooking extends Entity {
  eventId: string
  customerId: string
  alias: string
  status: 'inscripto' | 'espera' | 'oferta' | 'cancelado' | 'vencida'
  operationId: string
  offerExpiresAt: number | null
}

export interface PassportCardProgress {
  done: boolean
  attempts: number
  correct: boolean
}
export interface Passport extends Entity {
  customerId: string | null
  cards: Record<string, PassportCardProgress>
  badge: 'sin-empezar' | 'en-curso' | 'disponible' | 'guardada' | 'reiniciada'
  savedPreference: string | null
  metrics: { started: number; completed: number; saved: number; usedInCart: number }
}
export interface Visit extends Entity {
  locationId: string
  customerId: string
  dateKey: string
  status: 'acreditada' | 'revertida'
  creditedBy: Role
  reversalReason: string | null
}
export interface Redemption extends Entity {
  customerId: string
  note: string
}

export interface AuditEvent extends Entity {
  at: number
  actor: Role | 'sistema'
  type: string
  entityType: string
  entityId: string
  correlationId: string
  operationId: string | null
  summary: string
}

export interface Session {
  role: Role
  businessId: BusinessId
  locationByBusiness: Record<BusinessId, string>
  customerByBusiness: Record<BusinessId, string | null>
}

export interface AppState {
  schemaVersion: typeof SCHEMA_VERSION
  fixtureId: FixtureId
  clock: { nowMs: number }
  counters: Record<string, number>
  session: Session
  businesses: BusinessProfile[]
  locations: Location[]
  serviceWindows: ServiceWindow[]
  tables: Table[]
  reservations: Reservation[]
  waitlist: WaitlistEntry[]
  menuItems: MenuItem[]
  modifierGroups: ModifierGroup[]
  carts: Cart[]
  orders: Order[]
  tickets: KitchenTicket[]
  tableSessions: TableSession[]
  payments: PaymentSimulation[]
  cashSessions: CashSession[]
  ingredients: Ingredient[]
  recipes: Recipe[]
  stockMovements: StockMovement[]
  customers: CustomerDemo[]
  conversations: Conversation[]
  messages: Message[]
  callSessions: CallSession[]
  tasks: HumanReviewTask[]
  rules: AutomationRule[]
  runs: AutomationRun[]
  tastingEvents: TastingEvent[]
  eventBookings: EventBooking[]
  passports: Passport[]
  visits: Visit[]
  redemptions: Redemption[]
  audit: AuditEvent[]
  campaignPreviews: { id: string; businessId: BusinessId; at: number; included: number; excluded: number }[]
}

export type CollectionKey = {
  [K in keyof AppState]: AppState[K] extends Array<infer _> ? K : never
}[keyof AppState]
