import { SCHEMA_VERSION, type AppState } from './types'

const ENTITY_COLLECTIONS = [
  'businesses', 'locations', 'serviceWindows', 'tables', 'reservations', 'waitlist', 'menuItems', 'orders', 'tickets',
  'tableSessions', 'payments', 'cashSessions', 'ingredients', 'recipes', 'stockMovements', 'customers', 'conversations',
  'messages', 'callSessions', 'tasks', 'rules', 'runs', 'tastingEvents', 'eventBookings', 'passports', 'visits', 'redemptions', 'audit',
] as const
const PLAIN_COLLECTIONS = ['modifierGroups', 'carts', 'campaignPreviews'] as const

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v)

/** Valida esquema, IDs, businessId y referencias. Devuelve la lista de errores (vacía = válido). */
export function validateState(input: unknown): string[] {
  const errors: string[] = []
  const err = (m: string) => {
    if (errors.length < 60) errors.push(m)
  }
  if (!isObj(input)) return ['El estado guardado no es un objeto.']
  const s = input as Record<string, any>
  if (s.schemaVersion !== SCHEMA_VERSION) err(`schemaVersion inesperada: ${String(s.schemaVersion)}`)
  if (s.fixtureId !== 'servicio' && s.fixtureId !== 'vacio') err('fixtureId inválido.')
  if (!isObj(s.clock) || !Number.isFinite(s.clock.nowMs)) err('El reloj simulado es inválido.')
  if (!isObj(s.counters) || Object.values(s.counters).some((v) => !isInt(v))) err('Los contadores de IDs son inválidos.')
  if (!isObj(s.session) || !isObj(s.session.locationByBusiness) || !isObj(s.session.customerByBusiness)) err('La sesión de vista es inválida.')
  for (const k of [...ENTITY_COLLECTIONS, ...PLAIN_COLLECTIONS]) if (!Array.isArray(s[k])) err(`Falta la colección ${k}.`)
  if (errors.length) return errors

  const st = s as AppState
  const bizIds = new Set(st.businesses.map((b) => b.id))
  const index: Record<string, Map<string, any>> = {}
  for (const k of ENTITY_COLLECTIONS) {
    const m = new Map<string, any>()
    for (const e of st[k] as any[]) {
      if (!isObj(e) || typeof e.id !== 'string' || !e.id) {
        err(`${k}: registro sin id.`)
        continue
      }
      if (m.has(e.id)) err(`${k}: id duplicado ${e.id}.`)
      m.set(e.id, e)
      if (!bizIds.has(e.businessId)) err(`${k}/${e.id}: businessId inexistente (${String(e.businessId)}).`)
      if (!isInt(e.version) || e.version < 1) err(`${k}/${e.id}: versión inválida.`)
      if (!Number.isFinite(e.createdAt)) err(`${k}/${e.id}: createdAt inválido.`)
    }
    index[k] = m
  }
  for (const g of st.modifierGroups) if (!g.id) err('modifierGroups: grupo sin id.')
  const groupIds = new Set(st.modifierGroups.map((g) => g.id))

  const same = (coll: string, id: string | null | undefined, businessId: string, from: string) => {
    if (id === null || id === undefined) return
    const t = index[coll]?.get(id)
    if (!t) return err(`${from}: referencia rota a ${coll}/${id}.`)
    if (t.businessId !== businessId) err(`${from}: mezcla negocios (${businessId} ↔ ${t.businessId}).`)
  }
  for (const l of st.locations) void l
  for (const w of st.serviceWindows) same('locations', w.locationId, w.businessId, `serviceWindows/${w.id}`)
  for (const t of st.tables) same('locations', t.locationId, t.businessId, `tables/${t.id}`)
  for (const r of st.reservations) {
    same('locations', r.locationId, r.businessId, `reservations/${r.id}`)
    same('tables', r.tableId, r.businessId, `reservations/${r.id}`)
    same('customers', r.customerId, r.businessId, `reservations/${r.id}`)
    same('conversations', r.conversationId, r.businessId, `reservations/${r.id}`)
    same('tableSessions', r.sessionId, r.businessId, `reservations/${r.id}`)
    if (!isInt(r.party) || r.party < 1) err(`reservations/${r.id}: personas inválidas.`)
  }
  for (const m of st.menuItems) {
    if (!isInt(m.priceCents) || m.priceCents < 0) err(`menuItems/${m.id}: precio inválido.`)
    for (const g of m.modifierGroupIds) if (!groupIds.has(g)) err(`menuItems/${m.id}: grupo ${g} inexistente.`)
  }
  for (const o of st.orders) {
    same('locations', o.locationId, o.businessId, `orders/${o.id}`)
    same('tableSessions', o.sessionId, o.businessId, `orders/${o.id}`)
    same('tickets', o.ticketId, o.businessId, `orders/${o.id}`)
    same('customers', o.customerId, o.businessId, `orders/${o.id}`)
    if (!isInt(o.totalCents)) err(`orders/${o.id}: total inválido.`)
    let sum = 0
    for (const l of o.lines) {
      if (!isInt(l.unitCents) || !isInt(l.lineCents) || !isInt(l.qty) || l.qty < 1) err(`orders/${o.id}: línea con importe/cantidad inválidos.`)
      sum += l.lineCents
      const item = index.menuItems.get(l.itemId)
      if (!item) err(`orders/${o.id}: ítem ${l.itemId} inexistente.`)
      else if (item.businessId !== o.businessId) err(`orders/${o.id}: ítem de otro negocio.`)
    }
    if (sum !== o.totalCents) err(`orders/${o.id}: el total no coincide con las líneas.`)
  }
  for (const t of st.tickets) same('orders', t.orderId, t.businessId, `tickets/${t.id}`)
  for (const ts of st.tableSessions) {
    same('locations', ts.locationId, ts.businessId, `tableSessions/${ts.id}`)
    for (const tid of ts.tableIds) same('tables', tid, ts.businessId, `tableSessions/${ts.id}`)
  }
  const active = new Map<string, string>()
  for (const ts of st.tableSessions) {
    if (ts.status !== 'activa') continue
    for (const tid of ts.tableIds) {
      if (active.has(tid)) err(`Dos sesiones activas en la misma mesa ${tid}: ${active.get(tid)} y ${ts.id}.`)
      active.set(tid, ts.id)
    }
  }
  for (const p of st.payments) {
    same('tableSessions', p.sessionId, p.businessId, `payments/${p.id}`)
    same('cashSessions', p.cashSessionId, p.businessId, `payments/${p.id}`)
    if (!isInt(p.amountCents) || p.amountCents <= 0) err(`payments/${p.id}: importe inválido.`)
  }
  const ops = new Set<string>()
  for (const p of st.payments) {
    if (ops.has(p.operationId)) err(`payments: operationId duplicado ${p.operationId}.`)
    ops.add(p.operationId)
  }
  const orderOps = new Set<string>()
  for (const o of st.orders) {
    if (orderOps.has(o.operationId)) err(`orders: operationId duplicado ${o.operationId}.`)
    orderOps.add(o.operationId)
  }
  for (const rcp of st.recipes) same('menuItems', rcp.itemId, rcp.businessId, `recipes/${rcp.id}`)
  for (const rcp of st.recipes) for (const l of rcp.lines) same('ingredients', l.ingredientId, rcp.businessId, `recipes/${rcp.id}`)
  const keys = new Set<string>()
  for (const mv of st.stockMovements) {
    same('ingredients', mv.ingredientId, mv.businessId, `stockMovements/${mv.id}`)
    if (keys.has(mv.eventKey)) err(`stockMovements: eventKey duplicado ${mv.eventKey}.`)
    keys.add(mv.eventKey)
  }
  for (const i of st.ingredients) {
    if (!isInt(i.onHand) || !isInt(i.reserved)) err(`ingredients/${i.id}: stock no entero.`)
    else if (i.onHand < 0 || i.reserved < 0 || i.reserved > i.onHand) err(`ingredients/${i.id}: stock negativo o reserva mayor al stock.`)
  }
  for (const m of st.messages) same('conversations', m.conversationId, m.businessId, `messages/${m.id}`)
  for (const c of st.conversations) same('customers', c.customerId, c.businessId, `conversations/${c.id}`)
  for (const r of st.runs) same('rules', r.ruleId, r.businessId, `runs/${r.id}`)
  const runKeys = new Set<string>()
  for (const r of st.runs) {
    if (runKeys.has(r.key)) err(`runs: clave duplicada ${r.key}.`)
    runKeys.add(r.key)
  }
  for (const b of st.eventBookings) {
    same('tastingEvents', b.eventId, b.businessId, `eventBookings/${b.id}`)
    same('customers', b.customerId, b.businessId, `eventBookings/${b.id}`)
  }
  for (const v of st.visits) same('customers', v.customerId, v.businessId, `visits/${v.id}`)
  for (const c of st.carts) {
    if (!bizIds.has(c.businessId)) err(`carts/${c.id}: negocio inexistente.`)
    const loc = index.locations.get(c.locationId)
    if (!loc) err(`carts/${c.id}: sede inexistente.`)
    else if (loc.businessId !== c.businessId) err(`carts/${c.id}: mezcla negocio y sede.`)
    for (const l of c.lines) {
      if (!isInt(l.qty) || l.qty < 1 || !isInt(l.unitCentsSeen)) err(`carts/${c.id}: línea inválida.`)
      const item = index.menuItems.get(l.itemId)
      if (!item) err(`carts/${c.id}: ítem ${l.itemId} inexistente.`)
      else if (item.businessId !== c.businessId) err(`carts/${c.id}: ítem de otro negocio.`)
    }
  }
  return errors
}
