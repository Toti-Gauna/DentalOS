import { describe, expect, it } from 'vitest'
import { validateState } from '../src/domain/validate'
import { T, MON } from './helpers'

const MC = { businessId: 'mesa-clara', locationId: 'L-MC-salon' }
const RC = { businessId: 'ritual-cafe', locationId: 'L-RC-centro' }

function openRestaurant(t: T) {
  t.at(MON, 12, 0) // servicio de almuerzo
}
function cartMesa(t: T, tableId = 'T-MC-02') {
  t.ok({ type: 'cart/setFulfillment', cartId: 'CART-L-MC-salon', fulfillment: { kind: 'mesa', tableId }, alias: 'Mesa' })
}
function begin(t: T, cartId: string) {
  return (t.ok({ type: 'cart/begin', cartId }) as any).data.operationId as string
}

describe('Carta, carrito y envío (M01, M02, M05)', () => {
  it('S03: milanesa con guarnición ×2 suma el total; falta guarnición bloquea', () => {
    const t = T.seed()
    const bad = t.fail({ type: 'cart/add', ...MC, itemId: 'MC-12', qty: 2, selections: {} }, 'seleccion-invalida')
    expect((bad as any).data.errors['MG-guarnicion']).toMatch(/guarnici/i)
    expect(t.s.carts).toHaveLength(0)
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-12', qty: 2, selections: { 'MG-guarnicion': ['gu-papas-horno'] } })
    const cart = t.get('carts', 'CART-L-MC-salon')
    expect(cart.lines).toHaveLength(1)
    expect(cart.lines[0].unitCentsSeen).toBe(1850000 + 150000)
  })
  it('S04: máximo 1 salsa extra y combinación incompatible', () => {
    const t = T.seed()
    const two = t.fail({ type: 'cart/add', ...MC, itemId: 'MC-12', qty: 1, selections: { 'MG-guarnicion': ['gu-papas-fritas'], 'MG-salsa-extra': ['se-chimichurri', 'se-mayo'] } }, 'seleccion-invalida')
    expect((two as any).data.errors['MG-salsa-extra']).toMatch(/hasta 1/)
    const inc = t.fail({ type: 'cart/add', ...MC, itemId: 'MC-12', qty: 1, selections: { 'MG-guarnicion': ['gu-pure'], 'MG-salsa-extra': ['se-criolla'] } }, 'seleccion-invalida')
    expect(JSON.stringify((inc as any).data.errors)).toMatch(/no combina/)
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-12', qty: 1, selections: { 'MG-guarnicion': ['gu-papas-fritas'], 'MG-salsa-extra': ['se-chimichurri'] } })
    expect(t.get('carts', 'CART-L-MC-salon').lines[0].unitCentsSeen).toBe(1850000 + 50000)
  })
  it('cantidades fuera de rango se rechazan', () => {
    const t = T.seed()
    t.fail({ type: 'cart/add', ...MC, itemId: 'MC-01', qty: 0, selections: {} }, 'seleccion-invalida')
    t.fail({ type: 'cart/add', ...MC, itemId: 'MC-01', qty: 99, selections: {} }, 'seleccion-invalida')
  })
  it('S05: carrito vacío no crea pedido ni folio', () => {
    const t = T.seed()
    openRestaurant(t)
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-01', qty: 1, selections: {} })
    t.ok({ type: 'cart/clear', cartId: 'CART-L-MC-salon' })
    cartMesa(t)
    const n = t.count('orders')
    t.fail({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: 'OP-x' }, 'vacio')
    expect(t.count('orders')).toBe(n)
    expect(t.s.counters.O).toBe(12)
  })
  it('S06: doble clic con el mismo operationId crea exactamente 1 orden y 1 comanda', () => {
    const t = T.seed()
    openRestaurant(t)
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-01', qty: 1, selections: {} })
    cartMesa(t)
    const op = begin(t, 'CART-L-MC-salon')
    const o0 = t.count('orders')
    const k0 = t.count('tickets')
    const a = t.ok({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op }) as any
    const b = t.ok({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op }) as any
    expect(b.duplicate).toBe(true)
    expect(b.data.orderId).toBe(a.data.orderId)
    expect(a.data.orderId).toBe('O-013')
    expect(t.count('orders')).toBe(o0 + 1)
    expect(t.count('tickets')).toBe(k0 + 1)
    expect(validateState(t.s)).toEqual([])
  })
  it('el operationId se reutiliza hasta que el carrito cambia', () => {
    const t = T.seed()
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-01', qty: 1, selections: {} })
    const a = begin(t, 'CART-L-MC-salon')
    expect(begin(t, 'CART-L-MC-salon')).toBe(a)
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-03', qty: 1, selections: {} })
    expect(begin(t, 'CART-L-MC-salon')).not.toBe(a)
  })
  it('local cerrado en reloj: mesa sin sesión se bloquea sin crear folio', () => {
    const t = T.seed() // 10:00, el salón abre a las 12
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-01', qty: 1, selections: {} })
    cartMesa(t)
    const op = begin(t, 'CART-L-MC-salon')
    t.fail({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op }, 'local-cerrado')
    expect(t.count('orders')).toBe(12)
  })
  it('S07: item agotado desde admin bloquea el envío y ofrece alternativas', () => {
    const t = T.seed()
    openRestaurant(t)
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-12', qty: 1, selections: { 'MG-guarnicion': ['gu-ensalada'] } })
    cartMesa(t)
    t.ok({ type: 'menu/update', itemId: 'MC-12', patch: { soldOut: true } })
    const op = begin(t, 'CART-L-MC-salon')
    const o = t.fail({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op }, 'agotado') as any
    expect(o.data.alternatives.length).toBeGreaterThan(0)
    expect(t.get('carts', 'CART-L-MC-salon').lines).toHaveLength(1) // queda pendiente de corrección
    expect(t.count('orders')).toBe(12)
    t.fail({ type: 'cart/add', ...MC, itemId: 'MC-12', qty: 1, selections: { 'MG-guarnicion': ['gu-ensalada'] } }, 'item-no-disponible')
  })
  it('S08: precio cambiado exige reconfirmación y no crea pedido al precio nuevo', () => {
    const t = T.seed()
    openRestaurant(t)
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-01', qty: 1, selections: {} })
    cartMesa(t)
    t.ok({ type: 'menu/update', itemId: 'MC-01', patch: { priceCents: 1400000 } })
    const op = begin(t, 'CART-L-MC-salon')
    const r = t.fail({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op }, 'precio-cambio') as any
    expect(r.data.changes[0]).toMatchObject({ oldCents: 1250000, newCents: 1400000 })
    expect(t.count('orders')).toBe(12)
    t.ok({ type: 'cart/ackPrices', cartId: 'CART-L-MC-salon' })
    const op2 = begin(t, 'CART-L-MC-salon')
    const ok = t.ok({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op2 }) as any
    expect(t.get('orders', ok.data.orderId).totalCents).toBe(1400000)
  })
  it('S09: filtro sin coincidencias no rompe la lista', async () => {
    const { searchItems, menuFor } = await import('../src/domain/menu')
    const t = T.seed()
    const items = menuFor(t.s, 'mesa-clara')
    expect(searchItems(t.s, items, 'zzz123')).toHaveLength(0)
    expect(searchItems(t.s, items, '').length).toBe(28)
    expect(searchItems(t.s, items, 'pasta').length).toBeGreaterThanOrEqual(5)
  })
  it('S10: retiro 03:00 fuera de horario ofrece solo franjas abiertas y no crea orden', () => {
    const t = T.seed()
    t.ok({ type: 'cart/add', ...RC, itemId: 'RC-04', qty: 1, selections: { 'MG-tamano': ['ta-chico'], 'MG-leche': ['le-entera'] } })
    t.ok({ type: 'cart/setFulfillment', cartId: 'CART-L-RC-centro', fulfillment: { kind: 'retiro', startMin: 180 }, alias: 'Prueba' })
    const op = begin(t, 'CART-L-RC-centro')
    const r = t.fail({ type: 'order/submit', cartId: 'CART-L-RC-centro', operationId: op }, 'fuera-de-horario') as any
    for (const m of r.data.alternatives as number[]) {
      expect(m).toBeGreaterThanOrEqual(8 * 60)
      expect(m).toBeLessThan(20 * 60)
    }
    expect(r.data.alternatives[0]).toBe(10 * 60 + 15)
    expect(t.count('orders')).toBe(12)
  })
  it('retiro lleno (6 por franja) ofrece otra franja', () => {
    const t = T.seed()
    t.ok({ type: 'config/set', businessId: 'ritual-cafe', patch: { pickupPerSlot: 2 } })
    // la franja 10:15 ya tiene 2 pedidos en el seed
    t.ok({ type: 'cart/add', ...RC, itemId: 'RC-01', qty: 1, selections: { 'MG-origen': ['or-huila'] } })
    t.ok({ type: 'cart/setFulfillment', cartId: 'CART-L-RC-centro', fulfillment: { kind: 'retiro', startMin: 615 }, alias: 'Nadia' })
    const op = begin(t, 'CART-L-RC-centro')
    const r = t.fail({ type: 'order/submit', cartId: 'CART-L-RC-centro', operationId: op }, 'retiro-lleno') as any
    expect(r.data.alternatives).not.toContain(615)
  })
  it('el flujo café: carta → retiro → folio O-013 enviado', () => {
    const t = T.seed()
    t.ok({ type: 'cart/add', ...RC, itemId: 'RC-04', qty: 1, selections: { 'MG-tamano': ['ta-mediano'], 'MG-leche': ['le-vegetal'] } })
    expect(t.get('carts', 'CART-L-RC-centro').lines[0].unitCentsSeen).toBe(580000 + 80000 + 70000)
    t.ok({ type: 'cart/setFulfillment', cartId: 'CART-L-RC-centro', fulfillment: { kind: 'retiro', startMin: 10 * 60 + 15 }, alias: 'Sofi' })
    const op = begin(t, 'CART-L-RC-centro')
    const r = t.ok({ type: 'order/submit', cartId: 'CART-L-RC-centro', operationId: op }) as any
    expect(r.data.orderId).toBe('O-013')
    expect(t.get('orders', 'O-013').status).toBe('enviado')
    expect(t.get('tickets', 'K-013').status).toBe('nuevo')
    expect(t.get('carts', 'CART-L-RC-centro').lines).toHaveLength(0)
  })
  it('negocio y sede no se mezclan', () => {
    const t = T.seed()
    t.fail({ type: 'cart/add', businessId: 'mesa-clara', locationId: 'L-MC-salon', itemId: 'RC-01', qty: 1, selections: {} }, 'item-inexistente')
    t.fail({ type: 'cart/add', businessId: 'ritual-cafe', locationId: 'L-RC-norte', itemId: 'RC-07', qty: 1, selections: { 'MG-origen': ['or-huila'] } }, 'item-no-disponible') // V60 solo en Centro
  })
})

describe('Operación de pedidos y stock (M05, M06, M09)', () => {
  function sendCafe(t: T, itemId = 'RC-04', sel: Record<string, string[]> = { 'MG-tamano': ['ta-chico'], 'MG-leche': ['le-entera'] }) {
    t.ok({ type: 'cart/add', ...RC, itemId, qty: 1, selections: sel })
    t.ok({ type: 'cart/setFulfillment', cartId: 'CART-L-RC-centro', fulfillment: { kind: 'retiro', startMin: 10 * 60 + 30 }, alias: 'Sofi' })
    const op = begin(t, 'CART-L-RC-centro')
    return (t.ok({ type: 'order/submit', cartId: 'CART-L-RC-centro', operationId: op }) as any).data.orderId as string
  }
  it('S19: aceptar → preparar → listo → retirado; no se salta estados', () => {
    const t = T.seed()
    const id = sendCafe(t)
    t.fail({ type: 'order/ready', orderId: id }, 'estado-invalido')
    t.fail({ type: 'order/deliver', orderId: id }, 'estado-invalido')
    t.fail({ type: 'order/prepare', orderId: id }, 'estado-invalido')
    t.ok({ type: 'order/accept', orderId: id })
    t.fail({ type: 'order/deliver', orderId: id }, 'estado-invalido')
    t.ok({ type: 'order/prepare', orderId: id })
    t.ok({ type: 'order/ready', orderId: id })
    expect(t.get('tickets', t.get('orders', id).ticketId).status).toBe('listo')
    t.fail({ type: 'order/prepare', orderId: id }, undefined)
    t.ok({ type: 'order/deliver', orderId: id })
    expect(t.get('orders', id).status).toBe('retirado')
    // aviso local de listo: un solo evento AU05
    expect(t.s.runs.filter((r) => r.ruleCode === 'AU05' && r.entityId === id)).toHaveLength(1)
  })
  it('S21: aceptar reserva, preparar consume, el evento repetido no descuenta dos veces', () => {
    const t = T.seed()
    const id = sendCafe(t) // flat white chico leche entera: café 18 g + leche 180 ml
    const cafe0 = t.get('ingredients', 'I-11')
    const onHand0 = cafe0.onHand
    t.ok({ type: 'order/accept', orderId: id })
    expect(t.get('ingredients', 'I-11')).toMatchObject({ onHand: onHand0, reserved: 18 })
    const again = t.ok({ type: 'order/accept', orderId: id }) as any
    expect(again.duplicate).toBe(true)
    expect(t.get('ingredients', 'I-11').reserved).toBe(18)
    t.ok({ type: 'order/prepare', orderId: id })
    expect(t.get('ingredients', 'I-11')).toMatchObject({ onHand: onHand0 - 18, reserved: 0 })
    const again2 = t.ok({ type: 'order/prepare', orderId: id }) as any
    expect(again2.duplicate).toBe(true)
    expect(t.get('ingredients', 'I-11').onHand).toBe(onHand0 - 18)
    // replay de un movimiento: clave existente ⇒ ignorado
    const mv = t.s.stockMovements.find((m) => m.orderId === id && m.kind === 'consumo')!
    const rep = t.ok({ type: 'stock/replay', movementId: mv.id }) as any
    expect(rep.duplicate).toBe(true)
    expect(t.get('ingredients', 'I-11').onHand).toBe(onHand0 - 18)
    expect(validateState(t.s)).toEqual([])
  })
  it('rechazar o cancelar antes de preparar libera la reserva una sola vez', () => {
    const t = T.seed()
    const id = sendCafe(t)
    t.ok({ type: 'order/accept', orderId: id })
    t.fail({ type: 'order/cancel', orderId: id, reason: '' }, 'motivo-requerido')
    t.ok({ type: 'order/cancel', orderId: id, reason: 'Se arrepintió' })
    expect(t.get('ingredients', 'I-11').reserved).toBe(0)
    const dupC = t.ok({ type: 'order/cancel', orderId: id, reason: 'Se arrepintió' }) as any
    expect(dupC.duplicate).toBe(true)
    expect(t.s.stockMovements.filter((m) => m.orderId === id && m.kind === 'liberacion')).toHaveLength(2) // café + leche, una vez
    t.fail({ type: 'order/reject', orderId: id, reason: 'x' })
  })
  it('stock insuficiente bloquea la aceptación (sin stock negativo oculto)', () => {
    const t = T.seed()
    const id = sendCafe(t)
    t.ok({ type: 'stock/adjust', ingredientId: 'I-11', delta: -(t.get('ingredients', 'I-11').onHand - 5) })
    const r = t.fail({ type: 'order/accept', orderId: id }, 'stock-insuficiente')
    expect(r.ok).toBe(false)
    expect(t.get('orders', id).status).toBe('enviado')
    t.fail({ type: 'stock/adjust', ingredientId: 'I-11', delta: -50 }, 'stock-negativo')
  })
  it('receta con unidad incompatible genera incidencia y no acepta', () => {
    const t = T.seed()
    openRestaurant(t)
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-22', qty: 1, selections: {} }) // flan: dulce de leche en ml vs g
    cartMesa(t)
    const op = begin(t, 'CART-L-MC-salon')
    const oid = (t.ok({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op }) as any).data.orderId
    t.run({ type: 'order/accept', orderId: oid })
    expect(t.get('orders', oid).status).toBe('enviado')
    expect(t.s.tasks.some((x) => x.kind === 'receta-unidad' && x.entityId === oid && x.status === 'pendiente')).toBe(true)
    expect(t.s.runs.some((r) => r.ruleCode === 'AU06' && r.entityId === oid && r.status === 'derivada')).toBe(true)
    // el encargado corrige la unidad y puede aceptar
    t.ok({ type: 'stock/recipeUnit', recipeId: 'RCP-MC-22', ingredientId: 'I-10', unit: 'g' })
    t.ok({ type: 'order/accept', orderId: oid })
    expect(t.get('orders', oid).status).toBe('aceptado')
  })
  it('S20: cancelar en preparación crea incidencia, conserva ticket y consumo; el encargado decide', () => {
    const t = T.seed()
    const id = sendCafe(t)
    t.ok({ type: 'order/accept', orderId: id })
    t.ok({ type: 'order/prepare', orderId: id })
    const cafe = t.get('ingredients', 'I-11').onHand
    const r = t.ok({ type: 'order/cancel', orderId: id, reason: 'Cambié de idea' }) as any
    expect(r.data.mode).toBe('incidencia')
    expect(t.get('orders', id).status).toBe('en_preparacion')
    expect(t.get('tickets', t.get('orders', id).ticketId).incident).toMatch(/Cancelación/)
    expect(t.get('ingredients', 'I-11').onHand).toBe(cafe) // no devuelve insumos
    const dupR = t.ok({ type: 'order/cancel', orderId: id, reason: 'otra vez' }) as any
    expect(dupR.duplicate).toBe(true)
    t.ok({ type: 'order/resolveCancel', orderId: id, decision: 'cancelar-con-merma' })
    expect(t.get('orders', id).status).toBe('cancelado')
    expect(t.s.stockMovements.some((m) => m.orderId === id && m.kind === 'merma')).toBe(true)
    expect(t.get('ingredients', 'I-11').onHand).toBe(cafe) // el consumo se conserva
    expect(t.get('tickets', t.get('orders', id).ticketId)).toBeTruthy()
    // pedido ya preparado (O-008 del seed, listo): también deriva a incidencia
    const r2 = t.ok({ type: 'order/cancel', orderId: 'O-008', reason: 'Ya no lo quiere' }) as any
    expect(r2.data.mode).toBe('incidencia')
    expect(t.get('orders', 'O-008').status).toBe('listo')
  })
  it('editar antes de preparar revalida y compensa el stock', () => {
    const t = T.seed()
    const id = sendCafe(t)
    t.ok({ type: 'order/accept', orderId: id })
    t.ok({ type: 'order/edit', orderId: id, changes: [{ lineId: t.get('orders', id).lines[0].id, qty: 3 }] })
    expect(t.get('ingredients', 'I-11').reserved).toBe(54)
    expect(t.get('orders', id).totalCents).toBe(3 * 580000)
    t.fail({ type: 'order/edit', orderId: id, changes: [{ lineId: t.get('orders', id).lines[0].id, qty: 2 }], expectedVersion: 1 }, 'formulario-vencido')
    t.ok({ type: 'order/prepare', orderId: id })
    t.fail({ type: 'order/edit', orderId: id, changes: [] }, 'estado-invalido')
  })
  it('S22: reponer stock de un insumo agotado vuelve a habilitar el plato; valor negativo se rechaza', async () => {
    const { itemUnavailable } = await import('../src/domain/menu')
    const t = T.seed()
    const roll = t.get('menuItems', 'RC-10')
    expect(itemUnavailable(t.s, roll, 'L-RC-centro')).not.toBeNull()
    t.fail({ type: 'cart/add', ...RC, itemId: 'RC-10', qty: 1, selections: {} }, 'item-no-disponible')
    t.fail({ type: 'stock/restock', ingredientId: 'I-14', qty: -3 }, 'valor-invalido')
    t.ok({ type: 'stock/restock', ingredientId: 'I-14', qty: 10 })
    expect(itemUnavailable(t.s, t.get('menuItems', 'RC-10'), 'L-RC-centro')).toBeNull()
    t.ok({ type: 'cart/add', ...RC, itemId: 'RC-10', qty: 1, selections: {} })
    expect(t.get('ingredients', 'I-14').alertState).toBe('ok')
  })
  it('agotar un insumo dispara AU06 una sola vez por cruce; reponer no duplica', () => {
    const t = T.seed()
    const have = t.get('ingredients', 'I-15').onHand
    t.ok({ type: 'stock/adjust', ingredientId: 'I-15', delta: -(have - 5) })
    const runs = () => t.s.runs.filter((r) => r.ruleCode === 'AU06' && r.entityId === 'I-15')
    expect(runs()).toHaveLength(1)
    t.ok({ type: 'stock/adjust', ingredientId: 'I-15', delta: -1 })
    expect(runs()).toHaveLength(1)
    t.ok({ type: 'stock/restock', ingredientId: 'I-15', qty: 100 })
    t.ok({ type: 'stock/restock', ingredientId: 'I-15', qty: 100, eventKey: 'REP-fijo' })
    expect(t.run({ type: 'stock/restock', ingredientId: 'I-15', qty: 100, eventKey: 'REP-fijo' }).ok && (t.run({ type: 'stock/restock', ingredientId: 'I-15', qty: 100, eventKey: 'REP-fijo' }) as any).duplicate).toBe(true)
  })
  it('admin de carta: precio negativo, nota alimentaria incompleta y formulario vencido', () => {
    const t = T.seed()
    const r = t.fail({ type: 'menu/update', itemId: 'MC-01', patch: { priceCents: -5 } }, 'validacion') as any
    expect(r.data.errors.priceCents).toBeTruthy()
    const f = t.fail({ type: 'menu/update', itemId: 'RC-12', patch: { priceCents: 560000 } }, 'validacion') as any
    expect(f.data.errors.foodNote).toMatch(/incompleta/)
    t.ok({ type: 'menu/update', itemId: 'RC-12', patch: { soldOut: true } }) // agotar no exige completar la nota
    t.ok({ type: 'menu/update', itemId: 'MC-01', patch: { priceCents: 1300000 }, expectedVersion: 1 })
    t.fail({ type: 'menu/update', itemId: 'MC-01', patch: { priceCents: 1350000 }, expectedVersion: 1 }, 'formulario-vencido')
    expect(t.get('menuItems', 'MC-01').history).toHaveLength(1)
  })
})
