import { useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { dispatch, useApp } from '../store'
import { cartTotal } from '../domain/cmd-commerce'
import type { AppState, BusinessId, BusinessProfile, Cart } from '../domain/types'

export const isBiz = (v: string | undefined): v is BusinessId => v === 'mesa-clara' || v === 'ritual-cafe'

/** Perfil del cliente según la ruta (:biz). */
export function useBiz(): { state: AppState; biz: BusinessProfile; locationId: string } {
  const state = useApp()
  const { biz: b } = useParams()
  const id = (isBiz(b) ? b : state.session.businessId) as BusinessId
  const biz = state.businesses.find((x) => x.id === id)!
  const locationId = state.session.locationByBusiness[id]
  return { state, biz, locationId }
}

export function useCart(state: AppState, businessId: BusinessId, locationId: string): { cart: Cart | undefined; total: number; count: number } {
  const cart = state.carts.find((c) => c.businessId === businessId && c.locationId === locationId)
  return useMemo(
    () => ({ cart, total: cart ? cartTotal(state, cart) : 0, count: cart ? cart.lines.reduce((a, l) => a + l.qty, 0) : 0 }),
    [state, cart, businessId, locationId],
  )
}

/**
 * Identificador de operación de negocio para un formulario: se pide una vez por intento y se reutiliza
 * en doble clic/reintento. Cambia solo cuando cambia la "huella" del formulario.
 */
export function useOperation(fingerprint: string) {
  const ref = useRef<{ fp: string; op: string } | null>(null)
  return () => {
    if (ref.current && ref.current.fp === fingerprint) return ref.current.op
    const r = dispatch({ type: 'op/alloc' })
    const op = r.ok ? (r.data as { operationId: string }).operationId : `OP-local-${fingerprint}`
    ref.current = { fp: fingerprint, op }
    return op
  }
}
