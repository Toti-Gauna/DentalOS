import { itemStockStatus, optionStockOk } from './stock'
import { locationOpenNow } from './availability'
import { minutesOfDay } from './time'
import type { AppState, MenuItem, ModifierGroup, ModifierOption } from './types'
import { normalize } from './core'

export type Unavailable = 'agotado' | 'sin-insumos' | 'otra-sede' | 'fuera-de-franja'

export function itemUnavailable(s: AppState, item: MenuItem, locationId?: string): Unavailable | null {
  if (item.soldOut) return 'agotado'
  if (locationId && item.locationIds && !item.locationIds.includes(locationId)) return 'otra-sede'
  if (item.hours) {
    const m = minutesOfDay(s.clock.nowMs)
    if (m < item.hours.fromMin || m >= item.hours.toMin) return 'fuera-de-franja'
  }
  if (itemStockStatus(s, item) === 'sin-insumos') return 'sin-insumos'
  return null
}

export const UNAVAILABLE_TEXT: Record<Unavailable, string> = {
  agotado: 'Este plato se agotó. Quitalo o elegí otra opción',
  'sin-insumos': 'Este plato se agotó. Quitalo o elegí otra opción',
  'otra-sede': 'No se sirve en esta sede',
  'fuera-de-franja': 'Fuera de su franja horaria',
}

export function groupsOf(s: AppState, item: MenuItem): ModifierGroup[] {
  return item.modifierGroupIds.map((id) => s.modifierGroups.find((g) => g.id === id)).filter(Boolean) as ModifierGroup[]
}

export interface LineCheck {
  ok: boolean
  unitCents: number
  errors: Record<string, string> // groupId | '_qty' | '_item'
  picked: { groupId: string; groupName: string; optionId: string; optionName: string; deltaCents: number }[]
}

/** Valida selecciones y calcula precio unitario en centavos. Función pura. */
export function checkLine(s: AppState, item: MenuItem, selections: Record<string, string[]>, qty: number): LineCheck {
  const errors: Record<string, string> = {}
  const picked: LineCheck['picked'] = []
  let unit = item.priceCents
  const groups = groupsOf(s, item)
  if (!Number.isInteger(qty) || qty < 1) errors._qty = 'La cantidad debe ser al menos 1.'
  else if (qty > item.maxQty) errors._qty = `Máximo ${item.maxQty} por pedido.`

  for (const sel of Object.keys(selections)) {
    if (!groups.some((g) => g.id === sel) && selections[sel].length) errors._item = 'Selección de un grupo que este plato no tiene.'
  }
  const allPicked = new Set<string>()
  for (const g of groups) {
    const ids = selections[g.id] ?? []
    if (new Set(ids).size !== ids.length) errors[g.id] = 'Opción repetida.'
    const opts: ModifierOption[] = []
    for (const id of ids) {
      const o = g.options.find((x) => x.id === id)
      if (!o) errors[g.id] = 'Opción inexistente.'
      else opts.push(o)
    }
    if (g.required && ids.length < Math.max(1, g.min)) errors[g.id] = `Elegí ${g.name.toLowerCase()} para continuar.`
    else if (ids.length > g.max) {
      errors[g.id] = g.max === 1 ? `Podés elegir hasta 1 opción en “${g.name}”.` : `Máximo ${g.max} opciones en “${g.name}”.`
    }
    for (const o of opts) {
      if (!optionStockOk(s, o)) errors[g.id] = `“${o.name}” está sin stock. Elegí otra opción.`
      unit += o.deltaCents
      picked.push({ groupId: g.id, groupName: g.name, optionId: o.id, optionName: o.name, deltaCents: o.deltaCents })
      allPicked.add(o.id)
    }
  }
  // incompatibilidades (en cualquier dirección)
  for (const g of groups) {
    for (const o of g.options) {
      if (!allPicked.has(o.id)) continue
      const bad = (o.incompatibleWith ?? []).find((x) => allPicked.has(x))
      if (bad) {
        const other = groups.flatMap((x) => x.options).find((x) => x.id === bad)
        errors[g.id] = errors[g.id] ?? `“${o.name}” no combina con “${other?.name ?? bad}”. Elegí otra opción.`
      }
    }
  }
  return { ok: Object.keys(errors).length === 0, unitCents: unit, errors, picked }
}

export function searchItems(s: AppState, items: MenuItem[], q: string): MenuItem[] {
  const n = normalize(q)
  if (!n) return items
  const terms = n.split(' ')
  return items.filter((i) => {
    const hay = normalize(`${i.name} ${i.description} ${i.category} ${i.tags.join(' ')}`)
    return terms.every((t) => hay.includes(t))
  })
}

export function menuFor(s: AppState, businessId: string, locationId?: string): MenuItem[] {
  return s.menuItems.filter((m) => m.businessId === businessId && (!locationId || !m.locationIds || m.locationIds.includes(locationId)))
}
export function categoriesOf(items: MenuItem[]): string[] {
  const out: string[] = []
  for (const i of items) if (!out.includes(i.category)) out.push(i.category)
  return out
}
export { locationOpenNow }
