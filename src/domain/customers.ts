import { base, nextId, normalize, type Ctx } from './core'
import type { AppState, BusinessId, CustomerDemo } from './types'

export function findCustomerByAlias(s: AppState, businessId: BusinessId, alias: string): CustomerDemo | undefined {
  const n = normalize(alias)
  return s.customers.find((c) => c.businessId === businessId && !c.mergedInto && (normalize(c.alias) === n || normalize(c.displayName) === n))
}

/** Un mismo alias en el mismo negocio no duplica cliente al cambiar de canal. */
export function ensureCustomer(
  s: AppState,
  ctx: Ctx,
  businessId: BusinessId,
  alias: string,
  opts: { whatsapp?: boolean; voz?: boolean } = {},
): CustomerDemo {
  const existing = findCustomerByAlias(s, businessId, alias)
  if (existing) return existing
  const c: CustomerDemo = {
    id: nextId(s, 'CL'),
    ...base(s, businessId),
    alias: alias.trim(),
    displayName: alias.trim(),
    channels: { whatsapp: !!opts.whatsapp, voz: !!opts.voz },
    consent: { service: true, promo: false, updatedAt: ctx.now },
    prefs: '',
    mergedInto: null,
    possibleDuplicateOf: null,
  }
  s.customers.push(c)
  return c
}

export function activeCustomers(s: AppState, businessId: BusinessId) {
  return s.customers.filter((c) => c.businessId === businessId && !c.mergedInto)
}
