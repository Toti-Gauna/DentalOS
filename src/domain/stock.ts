import { audit, emit, fail, nextId, ok, type Ctx, type Outcome } from './core'
import { toBase } from './units'
import type { AppState, BusinessId, Ingredient, MenuItem, ModifierOption, Order, OrderLine, StockMovement } from './types'

export interface Need {
  ingredientId: string
  qty: number // en unidad base del insumo
}
export interface NeedsResult {
  needs: Need[]
  invalid: { itemId: string; ingredientId: string; reason: string }[]
}

function addNeed(map: Map<string, number>, id: string, qty: number) {
  map.set(id, (map.get(id) ?? 0) + qty)
}

/** Consumo de UNA porción de un ítem (receta) en unidades base; null en `invalid` si hay unidad incompatible. */
export function itemNeeds(s: AppState, item: MenuItem, out = new Map<string, number>(), qty = 1, invalid: NeedsResult['invalid'] = []) {
  const rec = s.recipes.find((r) => r.itemId === item.id)
  if (!rec) return { out, invalid }
  for (const l of rec.lines) {
    const ing = s.ingredients.find((i) => i.id === l.ingredientId)
    if (!ing) {
      invalid.push({ itemId: item.id, ingredientId: l.ingredientId, reason: 'insumo inexistente' })
      continue
    }
    const base = toBase(l.qty, l.unit, ing.unit)
    if (base === null) {
      invalid.push({ itemId: item.id, ingredientId: ing.id, reason: `unidad ${l.unit} incompatible con ${ing.unit} (${ing.name})` })
      continue
    }
    addNeed(out, ing.id, base * qty)
  }
  return { out, invalid }
}

export function optionNeeds(s: AppState, opt: ModifierOption, out = new Map<string, number>(), qty = 1, invalid: NeedsResult['invalid'] = []) {
  if (!opt.consumes) return { out, invalid }
  const ing = s.ingredients.find((i) => i.id === opt.consumes!.ingredientId)
  if (!ing) return { out, invalid }
  const base = toBase(opt.consumes.qty, opt.consumes.unit, ing.unit)
  if (base === null) {
    invalid.push({ itemId: opt.id, ingredientId: ing.id, reason: `unidad incompatible en opción ${opt.name}` })
    return { out, invalid }
  }
  addNeed(out, ing.id, base * qty)
  return { out, invalid }
}

export function orderNeeds(s: AppState, lines: OrderLine[]): NeedsResult {
  const map = new Map<string, number>()
  const invalid: NeedsResult['invalid'] = []
  for (const l of lines) {
    const item = s.menuItems.find((m) => m.id === l.itemId)
    if (item) itemNeeds(s, item, map, l.qty, invalid)
    for (const sel of l.selections) {
      const g = s.modifierGroups.find((x) => x.id === sel.groupId)
      const opt = g?.options.find((o) => o.id === sel.optionId)
      if (opt) optionNeeds(s, opt, map, l.qty, invalid)
    }
  }
  return { needs: [...map].map(([ingredientId, qty]) => ({ ingredientId, qty })), invalid }
}

export const available = (i: Ingredient) => i.onHand - i.reserved

export function movementExists(s: AppState, eventKey: string): boolean {
  return s.stockMovements.some((m) => m.eventKey === eventKey)
}

/** Movimiento idempotente: una clave de evento solo se aplica una vez. */
export function applyMovement(
  s: AppState,
  ctx: Ctx,
  p: {
    ingredientId: string
    businessId: BusinessId
    kind: StockMovement['kind']
    dOnHand: number
    dReserved: number
    orderId: string | null
    eventKey: string
    note: string
  },
): StockMovement | null {
  if (movementExists(s, p.eventKey)) return null
  const ing = s.ingredients.find((i) => i.id === p.ingredientId)
  if (!ing) return null
  ing.onHand += p.dOnHand
  ing.reserved += p.dReserved
  ing.version++
  const mv: StockMovement = {
    id: nextId(s, 'MOV', 4),
    businessId: p.businessId,
    createdAt: ctx.now,
    version: 1,
    ingredientId: p.ingredientId,
    kind: p.kind,
    deltaOnHand: p.dOnHand,
    deltaReserved: p.dReserved,
    orderId: p.orderId,
    eventKey: p.eventKey,
    note: p.note,
  }
  s.stockMovements.push(mv)
  recomputeAlert(s, ctx, ing)
  return mv
}

/** Dispara alerta una sola vez por cruce (bajo / agotado) y reinicia al reponer. */
export function recomputeAlert(s: AppState, ctx: Ctx, ing: Ingredient) {
  const av = available(ing)
  const next: Ingredient['alertState'] = av <= 0 ? 'agotado' : av <= ing.lowThreshold ? 'bajo' : 'ok'
  if (next === ing.alertState) return
  const prev = ing.alertState
  ing.alertState = next
  if (next === 'ok') {
    ing.epoch++
    return
  }
  if (prev === 'ok' || (prev === 'bajo' && next === 'agotado')) {
    emit(ctx, {
      type: next === 'agotado' ? 'stock.out' : 'stock.low',
      businessId: ing.businessId,
      entityType: 'Ingredient',
      entityId: ing.id,
      payload: { epoch: ing.epoch },
    })
  }
}

/** Reserva pendiente (reservado − liberado − consumido) de una orden para un insumo. */
export function outstandingReserved(s: AppState, orderId: string, ingredientId: string): number {
  return s.stockMovements
    .filter((m) => m.orderId === orderId && m.ingredientId === ingredientId)
    .reduce((acc, m) => acc + m.deltaReserved, 0)
}

export function movementsCount(s: AppState, orderId: string, ingredientId: string, kind: StockMovement['kind']): number {
  return s.stockMovements.filter((m) => m.orderId === orderId && m.ingredientId === ingredientId && m.kind === kind).length
}

/** Aceptar → reservar. Falla sin tocar nada si falta stock o hay unidades incompatibles. */
export function reserveForOrder(s: AppState, ctx: Ctx, order: Order, tag = 'accept'): Outcome {
  const { needs, invalid } = orderNeeds(s, order.lines)
  if (invalid.length) {
    return fail('receta-invalida', `Receta con unidades incompatibles: ${invalid.map((i) => i.reason).join('; ')}. Revisá la receta en Stock.`, { invalid })
  }
  const short = needs.filter((n) => {
    const ing = s.ingredients.find((i) => i.id === n.ingredientId)!
    return available(ing) < n.qty
  })
  if (short.length) {
    const names = short.map((n) => s.ingredients.find((i) => i.id === n.ingredientId)!.name).join(', ')
    return fail('stock-insuficiente', `Stock insuficiente de: ${names}. No se acepta hasta reponer o quitar el ítem.`, { short })
  }
  for (const n of needs) {
    applyMovement(s, ctx, {
      ingredientId: n.ingredientId,
      businessId: order.businessId,
      kind: 'reserva',
      dOnHand: 0,
      dReserved: n.qty,
      orderId: order.id,
      eventKey: `${order.id}:${tag}:reserva:${n.ingredientId}`,
      note: `Reserva por aceptación de ${order.id}`,
    })
  }
  return ok()
}

/** Libera la reserva que quede pendiente (compensación). Idempotente por clave con contador. */
export function releaseForOrder(s: AppState, ctx: Ctx, order: Order, tag: string) {
  const ids = new Set(s.stockMovements.filter((m) => m.orderId === order.id).map((m) => m.ingredientId))
  for (const ingredientId of ids) {
    const pending = outstandingReserved(s, order.id, ingredientId)
    if (pending <= 0) continue
    const n = movementsCount(s, order.id, ingredientId, 'liberacion') + 1
    applyMovement(s, ctx, {
      ingredientId,
      businessId: order.businessId,
      kind: 'liberacion',
      dOnHand: 0,
      dReserved: -pending,
      orderId: order.id,
      eventKey: `${order.id}:${tag}:liberacion:${ingredientId}:${n}`,
      note: `Compensación (${tag}) de ${order.id}`,
    })
  }
}

/** Preparar → consumir lo reservado (una vez por insumo). */
export function consumeForOrder(s: AppState, ctx: Ctx, order: Order) {
  const ids = new Set(s.stockMovements.filter((m) => m.orderId === order.id).map((m) => m.ingredientId))
  for (const ingredientId of ids) {
    const pending = outstandingReserved(s, order.id, ingredientId)
    if (pending <= 0) continue
    applyMovement(s, ctx, {
      ingredientId,
      businessId: order.businessId,
      kind: 'consumo',
      dOnHand: -pending,
      dReserved: -pending,
      orderId: order.id,
      eventKey: `${order.id}:prepare:consumo:${ingredientId}`,
      note: `Consumo al iniciar preparación de ${order.id}`,
    })
  }
}

/** Disponibilidad de una porción de ítem a nivel stock (sin considerar otras banderas). */
export function itemStockStatus(s: AppState, item: MenuItem): 'ok' | 'sin-insumos' | 'receta-invalida' {
  const { out, invalid } = itemNeeds(s, item)
  for (const [id, qty] of out) {
    const ing = s.ingredients.find((i) => i.id === id)
    if (ing && available(ing) < qty) return 'sin-insumos'
  }
  return invalid.length ? 'receta-invalida' : 'ok'
}

export function optionStockOk(s: AppState, opt: ModifierOption): boolean {
  const { out } = optionNeeds(s, opt)
  for (const [id, qty] of out) {
    const ing = s.ingredients.find((i) => i.id === id)
    if (ing && available(ing) < qty) return false
  }
  return true
}

export function logStock(s: AppState, ctx: Ctx, businessId: BusinessId, summary: string, entityId: string) {
  audit(s, ctx, businessId, 'stock', 'Ingredient', entityId, summary)
}
