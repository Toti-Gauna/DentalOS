import { audit, base, byId, dup, emit, fail, nextId, nextNum, ok, type Ctx, type Outcome } from './core'
import { ensureCustomer } from './customers'
import { alternativesPickup, validatePickup } from './pickup'
import { checkLine, groupsOf, itemUnavailable, UNAVAILABLE_TEXT } from './menu'
import { activeSessionAt, openSession } from './sessions'
import { locationOpenNow } from './availability'
import { consumeForOrder, applyMovement, releaseForOrder, reserveForOrder } from './stock'
import { dateKeyOf } from './time'
import type {
  AppState,
  Cart,
  CartLine,
  Channel,
  KitchenTicket,
  Order,
  OrderLine,
  TableSession,
} from './types'

export type Handler = (s: AppState, c: any, ctx: Ctx) => Outcome

// ---------------------------------------------------------------- carrito
export function getOrCreateCart(s: AppState, businessId: string, locationId: string): Cart {
  let cart = s.carts.find((c) => c.businessId === businessId && c.locationId === locationId)
  if (!cart) {
    cart = {
      id: `CART-${locationId}`,
      businessId: businessId as Cart['businessId'],
      locationId,
      customerId: s.session.customerByBusiness[businessId as Cart['businessId']] ?? null,
      lines: [],
      fulfillment: (() => { const l = s.locations.find((x) => x.id === locationId); return l?.hasTables && !(l.pickupEnabled && s.businesses.find((b) => b.id === businessId)?.kind === 'cafe') ? { kind: 'mesa' as const, tableId: null } : { kind: 'retiro' as const, startMin: null } })(),
      alias: '',
      version: 1,
      pendingOperationId: null,
      updatedAt: s.clock.nowMs,
    }
    s.carts.push(cart)
  }
  return cart
}
const touchCart = (cart: Cart, ctx: Ctx) => {
  cart.version++
  cart.pendingOperationId = null // un cambio de contenido es otra intención de negocio
  cart.updatedAt = ctx.now
}

const cartAdd: Handler = (s, c, ctx) => {
  const item = byId(s.menuItems, c.itemId)
  if (!item || item.businessId !== c.businessId) return fail('item-inexistente', 'Ese plato no existe en este negocio.')
  const un = itemUnavailable(s, item, c.locationId)
  if (un) return fail('item-no-disponible', UNAVAILABLE_TEXT[un], { reason: un })
  const qty = c.qty ?? 1
  const selections: Record<string, string[]> = c.selections ?? {}
  const chk = checkLine(s, item, selections, qty)
  if (!chk.ok) return fail('seleccion-invalida', 'Revisá las opciones marcadas antes de agregar.', { errors: chk.errors })
  const cart = getOrCreateCart(s, c.businessId, c.locationId)
  const note = (c.note ?? '').trim()
  const same = cart.lines.find((l) => l.itemId === item.id && l.note === note && JSON.stringify(sortSel(l.selections)) === JSON.stringify(sortSel(selections)))
  if (same) {
    const total = same.qty + qty
    if (total > item.maxQty) return fail('cantidad-maxima', `Máximo ${item.maxQty} por pedido de este plato.`)
    same.qty = total
    same.unitCentsSeen = chk.unitCents
  } else {
    const line: CartLine = {
      id: nextId(s, 'CLN', 4),
      itemId: item.id,
      itemVersion: item.version,
      selections,
      qty,
      note,
      unitCentsSeen: chk.unitCents,
    }
    cart.lines.push(line)
  }
  touchCart(cart, ctx)
  // métrica local del pasaporte: uso de la selección guardada en el carrito
  const pass = s.passports.find((p) => p.businessId === c.businessId && p.customerId === (s.session.customerByBusiness[c.businessId as Cart['businessId']] ?? null))
  if (pass && pass.savedPreference === item.id) pass.metrics.usedInCart++
  return ok({ cartId: cart.id, total: cartTotal(s, cart) })
}
const sortSel = (sel: Record<string, string[]>) => Object.keys(sel).sort().map((k) => [k, [...sel[k]].sort()])

export function cartTotal(s: AppState, cart: Cart): number {
  return cart.lines.reduce((a, l) => {
    const item = byId(s.menuItems, l.itemId)
    if (!item) return a
    const chk = checkLine(s, item, l.selections, l.qty)
    return a + chk.unitCents * l.qty
  }, 0)
}

const cartSetQty: Handler = (s, c, ctx) => {
  const cart = byId(s.carts, c.cartId)
  const line = cart?.lines.find((l) => l.id === c.lineId)
  if (!cart || !line) return fail('linea-inexistente', 'Esa línea ya no está en el pedido.')
  const item = byId(s.menuItems, line.itemId)!
  if (c.qty <= 0) {
    cart.lines = cart.lines.filter((l) => l.id !== line.id)
  } else {
    if (!Number.isInteger(c.qty) || c.qty > item.maxQty) return fail('cantidad-maxima', `La cantidad debe estar entre 1 y ${item.maxQty}.`)
    line.qty = c.qty
  }
  touchCart(cart, ctx)
  return ok()
}
const cartRemove: Handler = (s, c, ctx) => cartSetQty(s, { cartId: c.cartId, lineId: c.lineId, qty: 0 }, ctx)
const cartClear: Handler = (s, c, ctx) => {
  const cart = byId(s.carts, c.cartId)
  if (!cart) return fail('carrito-inexistente', 'Carrito inexistente.')
  cart.lines = []
  touchCart(cart, ctx)
  return ok()
}
const cartSetFulfillment: Handler = (s, c, ctx) => {
  const cart = byId(s.carts, c.cartId)
  if (!cart) return fail('carrito-inexistente', 'Carrito inexistente.')
  if (c.fulfillment) cart.fulfillment = c.fulfillment
  if (typeof c.alias === 'string') cart.alias = c.alias
  cart.version++
  cart.pendingOperationId = null
  cart.updatedAt = ctx.now
  return ok()
}
/** Fija (una sola vez) el operationId del intento de envío. */
const cartBegin: Handler = (s, c, ctx) => {
  const cart = byId(s.carts, c.cartId)
  if (!cart) return fail('carrito-inexistente', 'Carrito inexistente.')
  if (!cart.pendingOperationId) cart.pendingOperationId = nextId(s, 'OP', 4)
  cart.updatedAt = ctx.now
  return ok({ operationId: cart.pendingOperationId })
}
const cartAckPrices: Handler = (s, c, ctx) => {
  const cart = byId(s.carts, c.cartId)
  if (!cart) return fail('carrito-inexistente', 'Carrito inexistente.')
  for (const l of cart.lines) {
    const item = byId(s.menuItems, l.itemId)
    if (!item) continue
    l.unitCentsSeen = checkLine(s, item, l.selections, l.qty).unitCents
    l.itemVersion = item.version
  }
  touchCart(cart, ctx)
  return ok()
}

// ---------------------------------------------------------------- envío de pedido
export interface PriceChange {
  lineId: string
  name: string
  oldCents: number
  newCents: number
}

/** Valida un carrito y arma líneas de pedido (sin mutar). */
export function buildOrderLines(s: AppState, cart: Cart): Outcome<{ lines: OrderLine[]; total: number; changes: PriceChange[] }> {
  const lines: OrderLine[] = []
  const changes: PriceChange[] = []
  const soldOut: { lineId: string; name: string; reason: string }[] = []
  const bad: Record<string, Record<string, string>> = {}
  for (const l of cart.lines) {
    const item = byId(s.menuItems, l.itemId)
    if (!item || item.businessId !== cart.businessId) {
      return fail('item-inexistente', 'Un plato del pedido ya no existe en la carta.')
    }
    const un = itemUnavailable(s, item, cart.locationId)
    if (un) {
      soldOut.push({ lineId: l.id, name: item.name, reason: UNAVAILABLE_TEXT[un] })
      continue
    }
    const chk = checkLine(s, item, l.selections, l.qty)
    if (!chk.ok) {
      bad[l.id] = chk.errors
      continue
    }
    if (chk.unitCents !== l.unitCentsSeen) changes.push({ lineId: l.id, name: item.name, oldCents: l.unitCentsSeen, newCents: chk.unitCents })
    lines.push({
      id: nextId(s, 'OL', 4),
      itemId: item.id,
      name: item.name,
      qty: l.qty,
      unitCents: chk.unitCents,
      lineCents: chk.unitCents * l.qty,
      station: item.station,
      selections: chk.picked,
      note: l.note,
    })
  }
  if (soldOut.length) {
    const alt = s.menuItems
      .filter((m) => m.businessId === cart.businessId && !itemUnavailable(s, m, cart.locationId))
      .filter((m) => soldOut.some((x) => byId(s.menuItems, cart.lines.find((l) => l.id === x.lineId)?.itemId)?.category === m.category))
      .slice(0, 4)
      .map((m) => ({ id: m.id, name: m.name }))
    return fail('agotado', `${soldOut.map((x) => x.name).join(', ')}: ${soldOut[0].reason}.`, { soldOut, alternatives: alt })
  }
  if (Object.keys(bad).length) return fail('seleccion-invalida', 'Hay líneas con opciones inválidas. Corregilas antes de enviar.', { bad })
  if (changes.length) {
    return fail('precio-cambio', 'El precio de algún plato cambió desde que lo agregaste. Revisá la comparación y reconfirmá.', { changes })
  }
  return ok({ lines, total: lines.reduce((a, l) => a + l.lineCents, 0), changes })
}

const orderSubmit: Handler = (s, c, ctx) => {
  const opId: string | undefined = c.operationId
  if (!opId) return fail('sin-operacion', 'Falta el identificador de la operación.')
  const existing = s.orders.find((o) => o.operationId === opId)
  if (existing) return dup({ orderId: existing.id }, `Ese envío ya generó el pedido ${existing.id}.`)
  const cart = byId(s.carts, c.cartId)
  if (!cart) return fail('carrito-inexistente', 'Carrito inexistente.')
  if (cart.version !== (c.cartVersion ?? cart.version)) return fail('formulario-vencido', 'El pedido cambió en otra pantalla. Revisalo y volvé a enviar.')
  if (!cart.lines.length) return fail('vacio', 'Tu pedido está vacío. Agregá un plato desde la carta.')
  const loc = byId(s.locations, cart.locationId)
  if (!loc || loc.businessId !== cart.businessId) return fail('sede-invalida', 'La sede no corresponde al negocio.')

  const f = cart.fulfillment
  let pickup: Order['pickup'] = null
  if (f.kind === 'retiro') {
    const v = validatePickup(s, cart.businessId, cart.locationId, f.startMin)
    if (!v.ok) return v
    pickup = { dateKey: dateKeyOf(s.clock.nowMs), startMin: f.startMin! }
    if (!cart.alias.trim()) return fail('alias-requerido', 'Poné un nombre para el retiro (alias de muestra).')
  } else {
    if (!f.tableId) return fail('mesa-requerida', 'Elegí en qué mesa estás.')
    const table = byId(s.tables, f.tableId)
    if (!table || table.locationId !== cart.locationId) return fail('mesa-invalida', 'La mesa no pertenece a esta sede.')
    const sess = activeSessionAt(s, table.id)
    if (!sess && !locationOpenNow(s, cart.locationId)) {
      return fail('local-cerrado', 'El local está cerrado en el horario simulado y la mesa no tiene una sesión abierta. Esperá al servicio o pedí a recepción que abra la mesa.')
    }
  }
  const built = buildOrderLines(s, cart)
  if (!built.ok) return built
  const { lines, total } = built.data!

  // cliente
  let customerId: string | null = c.customerId ?? s.session.customerByBusiness[cart.businessId] ?? null
  const alias = (cart.alias || '').trim() || (f.kind === 'mesa' ? 'Mesa' : 'Invitado')
  if (!customerId && f.kind === 'retiro' && cart.alias.trim()) {
    customerId = ensureCustomer(s, ctx, cart.businessId, cart.alias).id
    s.session.customerByBusiness[cart.businessId] = customerId
  }

  // sesión / cuenta
  let session: TableSession
  if (f.kind === 'mesa') {
    const existingSession = activeSessionAt(s, f.tableId!)
    if (existingSession) session = existingSession
    else {
      const t = byId(s.tables, f.tableId)!
      const r = openSession(s, ctx, { businessId: cart.businessId, locationId: cart.locationId, kind: 'mesa', tableIds: [t.id], party: 1, label: `Mesa ${t.label} (abierta por pedido)` })
      if (!r.ok) return r
      session = r.data!
    }
  } else {
    const r = openSession(s, ctx, { businessId: cart.businessId, locationId: cart.locationId, kind: 'retiro', tableIds: [], party: 1, label: `Retiro de ${alias}` })
    if (!r.ok) return r
    session = r.data!
  }

  const n = nextNum(s, 'O')
  const orderId = `O-${String(n).padStart(3, '0')}`
  const ticketId = `K-${String(n).padStart(3, '0')}`
  s.counters.K = n
  const channel: Channel = c.channel ?? 'web'
  const order: Order = {
    id: orderId,
    ...base(s, cart.businessId),
    locationId: cart.locationId,
    sessionId: session.id,
    kind: f.kind,
    pickup,
    customerId: customerId ?? null,
    alias,
    channel,
    conversationId: c.conversationId ?? null,
    lines,
    totalCents: total,
    status: 'enviado',
    reason: null,
    operationId: opId,
    correlationId: ctx.correlationId,
    ticketId,
    reviewed: false,
    cancelRequested: false,
    noticeRunId: null,
    pickupCode: String(n).padStart(3, '0'),
    duplicatedFrom: c.duplicatedFrom ?? null,
  }
  const ticket: KitchenTicket = { id: ticketId, ...base(s, cart.businessId), orderId, status: 'nuevo', startedAt: null, incident: null }
  s.orders.push(order)
  s.tickets.push(ticket)
  cart.lines = []
  cart.pendingOperationId = null
  cart.version++
  audit(s, ctx, cart.businessId, 'order.submitted', 'Order', orderId, `Pedido ${orderId} enviado (${f.kind}) · ${lines.length} línea(s)`, opId)
  emit(ctx, { type: 'order.submitted', businessId: cart.businessId, entityType: 'Order', entityId: orderId })
  return ok({ orderId, ticketId, sessionId: session.id }, `Pedido ${orderId} enviado. El equipo todavía debe aceptarlo.`)
}

// ---------------------------------------------------------------- estados de pedido
function setTicket(s: AppState, o: Order, st: KitchenTicket['status'], ctx?: Ctx) {
  const t = byId(s.tickets, o.ticketId)
  if (!t) return
  t.status = st
  t.version++
  if (st === 'preparando' && ctx) t.startedAt = ctx.now
}
const STATE_ERR = (o: Order, want: string) =>
  fail('estado-invalido', `El pedido ${o.id} está “${o.status}”: no puede pasar a “${want}” sin seguir el orden enviado → aceptado → en preparación → listo → servido/retirado.`)

function getOrder(s: AppState, id: string): Order | undefined {
  return byId(s.orders, id)
}
function requireVersion(o: { version: number }, expected?: number): Outcome | null {
  if (expected !== undefined && expected !== o.version) return fail('formulario-vencido', 'Este pedido cambió mientras lo mirabas. Actualizá la pantalla.')
  return null
}

const orderAccept: Handler = (s, c, ctx) => {
  const o = getOrder(s, c.orderId)
  if (!o) return fail('pedido-inexistente', 'Pedido inexistente.')
  if (o.status === 'aceptado') return dup({ orderId: o.id }, `${o.id} ya estaba aceptado.`)
  if (o.status !== 'enviado') return STATE_ERR(o, 'aceptado')
  const stale = requireVersion(o, c.expectedVersion)
  if (stale) return stale
  const r = reserveForOrder(s, ctx, o)
  if (!r.ok) {
    // incidencia de receta: queda registrada aunque no se acepte
    if (r.code === 'receta-invalida') {
      const exists = s.tasks.find((t) => t.kind === 'receta-unidad' && t.entityId === o.id && t.status === 'pendiente')
      if (!exists) {
        s.tasks.push({
          id: nextId(s, 'TASK'),
          ...base(s, o.businessId),
          kind: 'receta-unidad',
          status: 'pendiente',
          entityType: 'Order',
          entityId: o.id,
          conversationId: null,
          note: r.message,
          resolution: null,
          draft: null,
          correlationId: ctx.correlationId,
        })
        audit(s, ctx, o.businessId, 'task.created', 'Order', o.id, 'Incidencia de receta con unidades incompatibles')
        emit(ctx, { type: 'stock.recipeInvalid', businessId: o.businessId, entityType: 'Order', entityId: o.id })
      }
      return { ...r, commit: true }
    }
    return r
  }
  o.status = 'aceptado'
  o.version++
  setTicket(s, o, 'aceptado')
  audit(s, ctx, o.businessId, 'order.accepted', 'Order', o.id, `Pedido ${o.id} aceptado; insumos reservados`)
  emit(ctx, { type: 'order.accepted', businessId: o.businessId, entityType: 'Order', entityId: o.id })
  return ok({ orderId: o.id })
}

const orderReject: Handler = (s, c, ctx) => {
  const o = getOrder(s, c.orderId)
  if (!o) return fail('pedido-inexistente', 'Pedido inexistente.')
  if (o.status === 'rechazado') return dup()
  if (!['enviado', 'aceptado'].includes(o.status)) return fail('estado-invalido', `No se puede rechazar un pedido “${o.status}”.`)
  const reason = (c.reason ?? '').trim()
  if (!reason) return fail('motivo-requerido', 'Indicá el motivo del rechazo.')
  releaseForOrder(s, ctx, o, 'reject')
  o.status = 'rechazado'
  o.reason = reason
  o.version++
  setTicket(s, o, 'rechazado')
  audit(s, ctx, o.businessId, 'order.rejected', 'Order', o.id, `Pedido ${o.id} rechazado: ${reason}`)
  return ok()
}

const orderPrepare: Handler = (s, c, ctx) => {
  const o = getOrder(s, c.orderId)
  if (!o) return fail('pedido-inexistente', 'Pedido inexistente.')
  if (o.status === 'en_preparacion') return dup()
  if (o.status !== 'aceptado') return STATE_ERR(o, 'en preparación')
  consumeForOrder(s, ctx, o)
  o.status = 'en_preparacion'
  o.version++
  setTicket(s, o, 'preparando', ctx)
  audit(s, ctx, o.businessId, 'order.preparing', 'Order', o.id, `Pedido ${o.id} en preparación; insumos consumidos`)
  return ok()
}

const orderReady: Handler = (s, c, ctx) => {
  const o = getOrder(s, c.orderId)
  if (!o) return fail('pedido-inexistente', 'Pedido inexistente.')
  if (o.status === 'listo') return dup()
  if (o.status !== 'en_preparacion') return STATE_ERR(o, 'listo')
  o.status = 'listo'
  o.version++
  setTicket(s, o, 'listo')
  audit(s, ctx, o.businessId, 'order.ready', 'Order', o.id, `Pedido ${o.id} listo`)
  emit(ctx, { type: 'order.listo', businessId: o.businessId, entityType: 'Order', entityId: o.id })
  return ok()
}

const orderDeliver: Handler = (s, c, ctx) => {
  const o = getOrder(s, c.orderId)
  if (!o) return fail('pedido-inexistente', 'Pedido inexistente.')
  const to = o.kind === 'mesa' ? 'servido' : 'retirado'
  if (o.status === to) return dup()
  if (o.status !== 'listo') return STATE_ERR(o, to)
  o.status = to
  o.version++
  setTicket(s, o, 'entregado')
  audit(s, ctx, o.businessId, `order.${to}`, 'Order', o.id, `Pedido ${o.id} ${to}`)
  return ok()
}

/** Cancelación pedida por cliente/recepción. Antes de preparar: compensa; durante/listo: incidencia al encargado. */
const orderCancel: Handler = (s, c, ctx) => {
  const o = getOrder(s, c.orderId)
  if (!o) return fail('pedido-inexistente', 'Pedido inexistente.')
  if (o.status === 'cancelado') return dup({}, 'El pedido ya estaba cancelado.')
  const reason = (c.reason ?? '').trim()
  if (!reason) return fail('motivo-requerido', 'Indicá el motivo de la cancelación.')
  if (['enviado', 'aceptado'].includes(o.status)) {
    releaseForOrder(s, ctx, o, 'cancel')
    o.status = 'cancelado'
    o.reason = reason
    o.reviewed = true
    o.version++
    setTicket(s, o, 'cancelado')
    audit(s, ctx, o.businessId, 'order.cancelled', 'Order', o.id, `Pedido ${o.id} cancelado antes de preparar: ${reason}`)
    return ok({ mode: 'directa' })
  }
  if (['en_preparacion', 'listo'].includes(o.status)) {
    if (o.cancelRequested) return dup({ mode: 'incidencia' }, 'Ya hay una incidencia de cancelación pendiente.')
    o.cancelRequested = true
    o.version++
    const t = byId(s.tickets, o.ticketId)
    if (t) t.incident = `Cancelación solicitada: ${reason}`
    s.tasks.push({
      id: nextId(s, 'TASK'),
      ...base(s, o.businessId),
      kind: 'cancelacion-preparacion',
      status: 'pendiente',
      entityType: 'Order',
      entityId: o.id,
      conversationId: o.conversationId,
      note: `Cancelación solicitada con el pedido ${o.status === 'listo' ? 'ya preparado' : 'en preparación'}: ${reason}`,
      resolution: null,
      draft: null,
      correlationId: ctx.correlationId,
    })
    audit(s, ctx, o.businessId, 'order.cancelRequested', 'Order', o.id, `Incidencia: cancelación pedida en estado ${o.status}`)
    return ok({ mode: 'incidencia' }, 'Se registró una incidencia para el encargado. No se borra la comanda ni se devuelven insumos.')
  }
  return fail('estado-invalido', `Un pedido “${o.status}” ya no se puede cancelar desde acá.`)
}

/** Decisión del encargado sobre una cancelación en preparación. */
const orderResolveCancel: Handler = (s, c, ctx) => {
  const o = getOrder(s, c.orderId)
  if (!o) return fail('pedido-inexistente', 'Pedido inexistente.')
  const task = s.tasks.find((t) => t.kind === 'cancelacion-preparacion' && t.entityId === o.id && t.status === 'pendiente')
  if (!task) return fail('sin-incidencia', 'No hay una incidencia pendiente para este pedido.')
  const decision: 'cancelar-con-merma' | 'cancelar-sin-merma' | 'mantener' = c.decision
  if (!['cancelar-con-merma', 'cancelar-sin-merma', 'mantener'].includes(decision)) return fail('decision-invalida', 'Decisión inválida.')
  if (decision === 'mantener') {
    o.cancelRequested = false
    task.resolution = 'El encargado mantuvo el pedido'
  } else {
    o.status = 'cancelado'
    o.reason = o.reason ?? 'Cancelado con pedido en preparación (decisión del encargado)'
    o.cancelRequested = false
    setTicket(s, o, 'cancelado')
    task.resolution = decision === 'cancelar-con-merma' ? 'Cancelado; consumo conservado como merma' : 'Cancelado; consumo conservado, sin merma'
    if (decision === 'cancelar-con-merma') {
      const ids = new Set(s.stockMovements.filter((m) => m.orderId === o.id && m.kind === 'consumo').map((m) => m.ingredientId))
      for (const ingredientId of ids) {
        const used = s.stockMovements.filter((m) => m.orderId === o.id && m.ingredientId === ingredientId && m.kind === 'consumo').reduce((a, m) => a + -m.deltaOnHand, 0)
        applyMovement(s, ctx, {
          ingredientId,
          businessId: o.businessId,
          kind: 'merma',
          dOnHand: 0,
          dReserved: 0,
          orderId: o.id,
          eventKey: `${o.id}:merma:${ingredientId}`,
          note: `Merma registrada (${used} u. base ya consumidas; no se descuenta de nuevo)`,
        })
      }
    }
  }
  const t = byId(s.tickets, o.ticketId)
  if (t) t.incident = null
  o.version++
  task.status = 'resuelta'
  task.version++
  audit(s, ctx, o.businessId, 'order.cancelResolved', 'Order', o.id, `Incidencia resuelta: ${task.resolution}`)
  return ok()
}

/** Incidencia de cocina (sin insumo, cambio tardío): deriva al encargado sin borrar trabajo. */
const orderIncident: Handler = (s, c, ctx) => {
  const o = getOrder(s, c.orderId)
  if (!o) return fail('pedido-inexistente', 'Pedido inexistente.')
  const note = (c.note ?? '').trim()
  if (!note) return fail('motivo-requerido', 'Describí la incidencia.')
  const t = byId(s.tickets, o.ticketId)
  if (t) t.incident = note
  s.tasks.push({
    id: nextId(s, 'TASK'),
    ...base(s, o.businessId),
    kind: 'incidencia-cocina',
    status: 'pendiente',
    entityType: 'Order',
    entityId: o.id,
    conversationId: null,
    note,
    resolution: null,
    draft: null,
    correlationId: ctx.correlationId,
  })
  audit(s, ctx, o.businessId, 'order.incident', 'Order', o.id, `Incidencia de cocina: ${note}`)
  return ok()
}

/** Editar líneas (solo cantidades) antes de preparar: revalida y compensa stock. */
const orderEdit: Handler = (s, c, ctx) => {
  const o = getOrder(s, c.orderId)
  if (!o) return fail('pedido-inexistente', 'Pedido inexistente.')
  const stale = requireVersion(o, c.expectedVersion)
  if (stale) return stale
  if (!['enviado', 'aceptado'].includes(o.status)) return fail('estado-invalido', 'Solo se edita antes de preparar. Después usá una cancelación con incidencia.')
  const changes: { lineId: string; qty: number }[] = c.changes ?? []
  const next: OrderLine[] = []
  for (const l of o.lines) {
    const ch = changes.find((x) => x.lineId === l.id)
    const qty = ch ? ch.qty : l.qty
    if (qty <= 0) continue
    const item = byId(s.menuItems, l.itemId)
    if (!Number.isInteger(qty) || (item && qty > item.maxQty)) return fail('cantidad-maxima', 'Cantidad inválida para el plato.')
    if (item && qty > l.qty) {
      const un = itemUnavailable(s, item, o.locationId)
      if (un) return fail('agotado', `${item.name}: ${UNAVAILABLE_TEXT[un]}.`)
    }
    next.push({ ...l, qty, lineCents: l.unitCents * qty })
  }
  if (!next.length) return fail('pedido-vacio', 'El pedido quedaría sin platos: cancelalo con un motivo.')
  const wasAccepted = o.status === 'aceptado'
  const prevLines = o.lines
  if (wasAccepted) releaseForOrder(s, ctx, o, `edit${o.version}`)
  o.lines = next
  o.totalCents = next.reduce((a, l) => a + l.lineCents, 0)
  if (wasAccepted) {
    const r = reserveForOrder(s, ctx, o, `edit${o.version}`)
    if (!r.ok) {
      o.lines = prevLines // la transacción completa se descarta igual, pero dejamos el mensaje claro
      return r
    }
  }
  o.reviewed = true
  o.version++
  audit(s, ctx, o.businessId, 'order.edited', 'Order', o.id, `Pedido ${o.id} editado con revisión; stock revalidado`)
  return ok()
}

const orderDuplicate: Handler = (s, c, ctx) => {
  const o = getOrder(s, c.orderId)
  if (!o) return fail('pedido-inexistente', 'Pedido inexistente.')
  const cart = getOrCreateCart(s, o.businessId, o.locationId)
  for (const l of o.lines) {
    const item = byId(s.menuItems, l.itemId)
    if (!item) continue
    const selections: Record<string, string[]> = {}
    for (const sel of l.selections) (selections[sel.groupId] ??= []).push(sel.optionId)
    const chk = checkLine(s, item, selections, l.qty)
    cart.lines.push({ id: nextId(s, 'CLN', 4), itemId: item.id, itemVersion: item.version, selections, qty: l.qty, note: l.note, unitCentsSeen: chk.unitCents })
  }
  touchCart(cart, ctx)
  audit(s, ctx, o.businessId, 'order.duplicated', 'Cart', cart.id, `Pedido ${o.id} copiado al carrito para revisión (no se crea otro pedido hasta enviar)`)
  return ok({ cartId: cart.id })
}

// ---------------------------------------------------------------- admin de carta
const menuUpdate: Handler = (s, c, ctx) => {
  const item = byId(s.menuItems, c.itemId)
  if (!item) return fail('item-inexistente', 'Plato inexistente.')
  if (c.expectedVersion !== undefined && c.expectedVersion !== item.version) {
    return fail('formulario-vencido', 'Este plato cambió mientras lo editabas. Recargá el formulario para ver la versión actual.', { currentVersion: item.version })
  }
  const p = c.patch ?? {}
  const keys = Object.keys(p)
  const onlySoldOut = keys.length === 1 && keys[0] === 'soldOut'
  const errors: Record<string, string> = {}
  if ('priceCents' in p && (!Number.isInteger(p.priceCents) || p.priceCents < 0)) errors.priceCents = 'El precio no puede ser negativo ni tener decimales de centavo.'
  if ('name' in p && !String(p.name).trim()) errors.name = 'El nombre es obligatorio.'
  if ('maxQty' in p && (!Number.isInteger(p.maxQty) || p.maxQty < 1)) errors.maxQty = 'La cantidad máxima debe ser al menos 1.'
  if ('hours' in p && p.hours && !(p.hours.fromMin < p.hours.toMin)) errors.hours = 'La franja horaria es inválida.'
  const next = { ...item, ...p }
  if (!onlySoldOut && (next.foodNote.status !== 'completa' || !next.foodNote.note.trim())) {
    errors.foodNote = 'La anotación alimentaria está incompleta: declarala (o marcá “sin alérgenos declarados”) antes de guardar. La demo no garantiza ausencia de alérgenos.'
  }
  if (Object.keys(errors).length) return fail('validacion', 'Hay campos para corregir antes de guardar.', { errors })
  const changed: string[] = []
  for (const k of keys) {
    if (JSON.stringify((item as any)[k]) !== JSON.stringify(p[k])) {
      changed.push(k === 'priceCents' ? `precio ${item.priceCents / 100} → ${p.priceCents / 100}` : k === 'soldOut' ? (p.soldOut ? 'agotado' : 'repuesto') : k)
      ;(item as any)[k] = p[k]
    }
  }
  if (!changed.length) return dup({ itemId: item.id }, 'No hubo cambios para guardar.')
  item.version++
  item.history.push({ version: item.version, at: ctx.now, summary: changed.join(', ') })
  audit(s, ctx, item.businessId, 'menu.updated', 'MenuItem', item.id, `Carta: ${item.name} (${changed.join(', ')})`)
  if ('soldOut' in p) emit(ctx, { type: 'menu.availability', businessId: item.businessId, entityType: 'MenuItem', entityId: item.id })
  return ok({ itemId: item.id, version: item.version })
}

const menuMoveCategory: Handler = (s, c, ctx) => {
  const b = byId(s.businesses, c.businessId)
  if (!b) return fail('negocio-inexistente', 'Negocio inexistente.')
  const i = b.categoryOrder.indexOf(c.category)
  const j = i + (c.dir === 'up' ? -1 : 1)
  if (i < 0 || j < 0 || j >= b.categoryOrder.length) return fail('sin-cambio', 'La categoría ya está en ese extremo.')
  ;[b.categoryOrder[i], b.categoryOrder[j]] = [b.categoryOrder[j], b.categoryOrder[i]]
  b.version++
  audit(s, ctx, b.id, 'menu.categoryMoved', 'BusinessProfile', b.id, `Categoría “${c.category}” movida`)
  return ok()
}

// ---------------------------------------------------------------- admin de stock
const stockRestock: Handler = (s, c, ctx) => {
  const ing = byId(s.ingredients, c.ingredientId)
  if (!ing) return fail('insumo-inexistente', 'Insumo inexistente.')
  if (!Number.isInteger(c.qty) || c.qty <= 0) return fail('valor-invalido', 'La reposición debe ser un entero positivo en unidades base.')
  const key = c.eventKey ?? `REP-${ing.id}-${nextNum(s, 'REP')}`
  const mv = applyMovement(s, ctx, {
    ingredientId: ing.id,
    businessId: ing.businessId,
    kind: 'reposicion',
    dOnHand: c.qty,
    dReserved: 0,
    orderId: null,
    eventKey: key,
    note: c.note ?? 'Reposición ficticia',
  })
  if (!mv) return dup({}, 'Ese evento de reposición ya estaba registrado.')
  audit(s, ctx, ing.businessId, 'stock.restocked', 'Ingredient', ing.id, `Reposición de ${c.qty} ${ing.unit} de ${ing.name}`)
  return ok({ movementId: mv.id })
}
const stockAdjust: Handler = (s, c, ctx) => {
  const ing = byId(s.ingredients, c.ingredientId)
  if (!ing) return fail('insumo-inexistente', 'Insumo inexistente.')
  if (!Number.isInteger(c.delta) || c.delta === 0) return fail('valor-invalido', 'El ajuste debe ser un entero distinto de cero.')
  if (ing.onHand + c.delta < ing.reserved) return fail('stock-negativo', 'El ajuste dejaría el stock por debajo de lo ya reservado. No se permite stock negativo oculto.')
  const mv = applyMovement(s, ctx, {
    ingredientId: ing.id,
    businessId: ing.businessId,
    kind: c.kind === 'merma' ? 'merma' : 'ajuste',
    dOnHand: c.delta,
    dReserved: 0,
    orderId: null,
    eventKey: c.eventKey ?? `ADJ-${ing.id}-${nextNum(s, 'ADJ')}`,
    note: c.note ?? 'Ajuste manual',
  })
  if (!mv) return dup()
  audit(s, ctx, ing.businessId, 'stock.adjusted', 'Ingredient', ing.id, `Ajuste ${c.delta} ${ing.unit} de ${ing.name}`)
  return ok()
}
const stockRecipeUnit: Handler = (s, c, ctx) => {
  const rec = byId(s.recipes, c.recipeId)
  const line = rec?.lines.find((l) => l.ingredientId === c.ingredientId)
  if (!rec || !line) return fail('receta-inexistente', 'Receta o línea inexistente.')
  line.unit = c.unit
  if (typeof c.qty === 'number' && c.qty > 0) line.qty = c.qty
  rec.version++
  audit(s, ctx, rec.businessId, 'recipe.updated', 'Recipe', rec.id, `Receta ${rec.itemId}: unidad de ${c.ingredientId} → ${c.unit}`)
  // si estaba pendiente una incidencia de receta para pedidos de este ítem, queda para que el encargado la resuelva
  return ok()
}
const stockReplay: Handler = (s, c, ctx) => {
  const mv = byId(s.stockMovements, c.movementId)
  if (!mv) return fail('movimiento-inexistente', 'Movimiento inexistente.')
  // reintento del mismo evento: la clave ya existe → se ignora (sin segundo descuento)
  const again = applyMovement(s, ctx, {
    ingredientId: mv.ingredientId,
    businessId: mv.businessId,
    kind: mv.kind,
    dOnHand: mv.deltaOnHand,
    dReserved: mv.deltaReserved,
    orderId: mv.orderId,
    eventKey: mv.eventKey,
    note: 'reintento',
  })
  return again ? fail('inesperado', 'El reintento no debería aplicar un movimiento.') : dup({}, `Evento ${mv.eventKey} ya registrado: duplicado ignorado.`)
}

const taskResolve: Handler = (s, c, ctx) => {
  const t = byId(s.tasks, c.taskId)
  if (!t) return fail('tarea-inexistente', 'Tarea inexistente.')
  if (t.status === 'resuelta') return dup()
  const resolution = (c.resolution ?? '').trim()
  if (!resolution) return fail('motivo-requerido', 'Escribí cómo se resolvió.')
  t.status = 'resuelta'
  t.resolution = resolution
  t.version++
  audit(s, ctx, t.businessId, 'task.resolved', 'HumanReviewTask', t.id, `Tarea ${t.id} resuelta: ${resolution}`)
  return ok()
}

export const commerceHandlers: Record<string, Handler> = {
  'cart/add': cartAdd,
  'cart/setQty': cartSetQty,
  'cart/remove': cartRemove,
  'cart/clear': cartClear,
  'cart/setFulfillment': cartSetFulfillment,
  'cart/begin': cartBegin,
  'cart/ackPrices': cartAckPrices,
  'order/submit': orderSubmit,
  'order/accept': orderAccept,
  'order/reject': orderReject,
  'order/prepare': orderPrepare,
  'order/ready': orderReady,
  'order/deliver': orderDeliver,
  'order/cancel': orderCancel,
  'order/resolveCancel': orderResolveCancel,
  'order/incident': orderIncident,
  'order/edit': orderEdit,
  'order/duplicate': orderDuplicate,
  'menu/update': menuUpdate,
  'menu/moveCategory': menuMoveCategory,
  'stock/restock': stockRestock,
  'stock/adjust': stockAdjust,
  'stock/recipeUnit': stockRecipeUnit,
  'stock/replay': stockReplay,
  'task/resolve': taskResolve,
}

export { alternativesPickup, groupsOf }
