import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBiz, useCart } from '../../ui/hooks'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Callout, Empty, ErrorText } from '../../ui/kit'
import { ORDER_LABEL } from '../../ui/format'
import { StatusBadge } from '../../ui/kit'
import { checkLine } from '../../domain/menu'
import { pickupSlots } from '../../domain/pickup'
import { activeSessionAt } from '../../domain/sessions'
import { fmtARS } from '../../domain/money'
import { hhmm, minutesOfDay, parseHHMM } from '../../domain/time'
import { dispatch } from '../../store'
import type { Outcome } from '../../domain/core'

interface PriceChange { lineId: string; name: string; oldCents: number; newCents: number }

export function MiPedido() {
  const { state, biz, locationId } = useBiz()
  const nav = useNavigate()
  const { cart, total } = useCart(state, biz.id, locationId)
  const loc = state.locations.find((l) => l.id === locationId)!
  const [err, setErr] = useState<Outcome | null>(null)
  const [timeInput, setTimeInput] = useState('')
  const opRef = useRef<{ version: number; op: string } | null>(null)
  const f = cart?.fulfillment ?? (loc.hasTables ? { kind: 'mesa' as const, tableId: null } : { kind: 'retiro' as const, startMin: null })
  const tables = state.tables.filter((t) => t.locationId === locationId)
  const slots = pickupSlots(state, biz.id, locationId, 6)
  const canMesa = loc.hasTables
  const canRetiro = loc.pickupEnabled

  const setFulfillment = (patch: Record<string, unknown>) => {
    if (!cart) return
    dispatch({ type: 'cart/setFulfillment', cartId: cart.id, ...patch })
    setErr(null)
  }
  const setKind = (kind: 'mesa' | 'retiro') => setFulfillment({ fulfillment: kind === 'mesa' ? { kind, tableId: null } : { kind, startMin: null } })

  const send = () => {
    setErr(null)
    if (!cart) {
      // intento de envío sin pedido: estado vacío y nunca un folio
      setErr({ ok: false, code: 'vacio', message: 'Tu pedido está vacío. Agregá un plato desde la carta.' })
      return
    }
    // operationId del intento: se fija una vez por contenido de carrito y se reutiliza ante doble clic
    let op = opRef.current && opRef.current.version === cart.version ? opRef.current.op : null
    if (!op) {
      const b = dispatch({ type: 'cart/begin', cartId: cart.id })
      op = b.ok ? (b.data as { operationId: string }).operationId : null
      if (op) opRef.current = { version: cart.version, op }
    }
    if (!op) return
    const o = act({ type: 'order/submit', cartId: cart.id, operationId: op })
    if (o.ok) {
      const id = (o.data as { orderId: string }).orderId
      nav(`/${biz.id}/pedido/${id}`)
      return
    }
    setErr(o)
  }

  const errData = (err && !err.ok ? (err.data as Record<string, unknown> | undefined) : undefined) ?? {}
  const changes = (errData.changes ?? []) as PriceChange[]
  const soldOut = (errData.soldOut ?? []) as { lineId: string; name: string; reason: string }[]
  const alts = (errData.alternatives ?? []) as (number | { id: string; name: string })[]
  const code = err && !err.ok ? err.code : ''

  const myOrders = state.orders
    .filter((o) => o.businessId === biz.id)
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
    .slice(0, 6)

  return (
    <main>
      <PageHead title="Mi pedido" sub={`${loc.name} · no se cobra nada en la demo`} />
      {!cart || cart.lines.length === 0 ? (
        <Empty
          title="Tu pedido está vacío"
          action={
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link className="btn" to={`/${biz.id}/carta`} data-testid="go-carta">Ir a la carta</Link>
              <button className="btn secondary" type="button" onClick={send} data-testid="send-empty">Enviar pedido</button>
            </div>
          }
        >
          Agregá al menos un plato para poder enviarlo. Mientras no haya pedido, no se genera ningún folio.
        </Empty>
      ) : (
        <div className="grid cols-2">
          <section className="card" aria-labelledby="lineas">
            <h2 id="lineas">Platos</h2>
            {cart.lines.map((l) => {
              const it = state.menuItems.find((m) => m.id === l.itemId)!
              const chk = checkLine(state, it, l.selections, l.qty)
              const out = soldOut.find((x) => x.lineId === l.id)
              return (
                <div className="line" key={l.id}>
                  <div>
                    <strong>{it.name}</strong>
                    <div className="opts">{chk.picked.map((p) => p.optionName).join(' · ') || 'Sin opciones'}</div>
                    {l.note && <div className="opts">Nota: {l.note}</div>}
                    {out && <ErrorText>{out.reason}. Quitalo o elegí otra opción.</ErrorText>}
                    <div className="qty" role="group" aria-label={`Cantidad de ${it.name}`}>
                      <button type="button" aria-label={`Menos ${it.name}`} onClick={() => dispatch({ type: 'cart/setQty', cartId: cart.id, lineId: l.id, qty: l.qty - 1 })}>−</button>
                      <output>{l.qty}</output>
                      <button type="button" aria-label={`Más ${it.name}`} onClick={() => { const o = dispatch({ type: 'cart/setQty', cartId: cart.id, lineId: l.id, qty: l.qty + 1 }); if (!o.ok) setErr(o) }}>+</button>
                      <button type="button" className="btn ghost small" onClick={() => act({ type: 'cart/remove', cartId: cart.id, lineId: l.id }, `${it.name} quitado`)}>Quitar</button>
                    </div>
                  </div>
                  <span className="money">{fmtARS(chk.unitCents * l.qty)}</span>
                </div>
              )
            })}
            <div className="total-row"><span>Total</span><span className="money" data-testid="cart-total">{fmtARS(total)}</span></div>
            <p className="small muted">El resumen es el mismo que verá la cocina en la comanda.</p>
          </section>

          <section className="card" aria-labelledby="entrega">
            <h2 id="entrega">¿Cómo lo recibís?</h2>
            {canMesa && canRetiro && (
              <div className="row" role="radiogroup" aria-label="Modo de entrega">
                <label className="choice"><input type="radio" name="kind" checked={f.kind === 'mesa'} onChange={() => setKind('mesa')} /> En mi mesa</label>
                <label className="choice"><input type="radio" name="kind" checked={f.kind === 'retiro'} onChange={() => setKind('retiro')} /> Retiro en barra</label>
              </div>
            )}
            {f.kind === 'mesa' ? (
              <div className="field">
                <label htmlFor="mesa">Mi mesa</label>
                <select id="mesa" value={f.tableId ?? ''} onChange={(e) => setFulfillment({ fulfillment: { kind: 'mesa', tableId: e.target.value || null } })} data-testid="mesa-select" aria-invalid={code === 'mesa-requerida'} aria-describedby={code === 'mesa-requerida' ? 'mesa-err' : undefined}>
                  <option value="">Elegí tu mesa…</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} · {t.seats} lugares · {t.sector}{activeSessionAt(state, t.id) ? ' · con cuenta abierta' : ''}
                    </option>
                  ))}
                </select>
                <ErrorText id="mesa-err">{code === 'mesa-requerida' ? err!.ok ? '' : err!.message : ''}</ErrorText>
              </div>
            ) : (
              <div className="stack">
                <div className="field">
                  <label htmlFor="hora">Hora de retiro</label>
                  <input
                    id="hora"
                    type="time"
                    step={900}
                    value={f.startMin === null ? timeInput : hhmm(f.startMin)}
                    onChange={(e) => {
                      setTimeInput(e.target.value)
                      const m = parseHHMM(e.target.value)
                      setFulfillment({ fulfillment: { kind: 'retiro', startMin: m } })
                    }}
                    data-testid="pickup-time"
                    aria-invalid={['fuera-de-horario', 'franja-pasada', 'retiro-lleno', 'franja-invalida', 'franja-requerida'].includes(code)}
                    aria-describedby="hora-hint"
                  />
                  <span className="hint" id="hora-hint">Franjas de 15 minutos. Hora actual simulada: {hhmm(minutesOfDay(state.clock.nowMs))}.</span>
                </div>
                <div>
                  <p className="label small muted" style={{ margin: 0 }}>Próximas franjas con lugar</p>
                  {slots.length ? (
                    <div className="slot-grid">
                      {slots.map((m) => (
                        <button type="button" key={m} aria-pressed={f.kind === 'retiro' && f.startMin === m} onClick={() => { setTimeInput(hhmm(m)); setFulfillment({ fulfillment: { kind: 'retiro', startMin: m } }) }}>
                          {hhmm(m)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No quedan franjas de retiro hoy en el día simulado.</p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="alias">Nombre para el retiro (alias de muestra)</label>
                  <input id="alias" type="text" value={cart.alias} onChange={(e) => setFulfillment({ alias: e.target.value })} aria-invalid={code === 'alias-requerido'} aria-describedby={code === 'alias-requerido' ? 'alias-err' : undefined} />
                  <ErrorText id="alias-err">{code === 'alias-requerido' && !err!.ok ? err!.message : ''}</ErrorText>
                </div>
              </div>
            )}
            <button className="btn accent" style={{ width: '100%', marginTop: 8 }} type="button" onClick={send} data-testid="send-order">
              Enviar pedido
            </button>
            <p className="small muted">Se envía a recepción y cocina: “Solicitud recibida; el equipo todavía debe aceptarla”. Pago simulado: no se realiza ningún cargo.</p>
          </section>
        </div>
      )}

      {err && !err.ok && (
        <div style={{ marginTop: 14 }} data-testid="order-error">
          {code === 'precio-cambio' ? (
            <Callout tone="warn" role="alert">
              <strong>El precio cambió desde que agregaste estos platos.</strong>
              <table style={{ marginTop: 8 }}>
                <thead><tr><th>Plato</th><th>Antes</th><th>Ahora</th></tr></thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.lineId}><td>{c.name}</td><td className="money">{fmtARS(c.oldCents)}</td><td className="money"><strong>{fmtARS(c.newCents)}</strong></td></tr>
                  ))}
                </tbody>
              </table>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn" type="button" data-testid="ack-prices" onClick={() => { act({ type: 'cart/ackPrices', cartId: cart!.id }, 'Precios actualizados. Revisá el total y volvé a enviar.'); setErr(null) }}>Aceptar precios nuevos</button>
                <span className="small">Mientras no los aceptes, no se envía nada. También podés quitar el plato.</span>
              </div>
            </Callout>
          ) : code === 'agotado' ? (
            <Callout tone="err" role="alert">
              <strong>{err.message}</strong>
              <div className="row" style={{ marginTop: 8 }}>
                {soldOut.map((x) => (
                  <button key={x.lineId} className="btn danger small" type="button" onClick={() => { act({ type: 'cart/remove', cartId: cart!.id, lineId: x.lineId }, `${x.name} quitado`); setErr(null) }}>
                    Quitar {x.name}
                  </button>
                ))}
              </div>
              {alts.length > 0 && (
                <p style={{ marginTop: 8 }}>
                  Alternativas disponibles: {(alts as { id: string; name: string }[]).map((a) => (<Link key={a.id} to={`/${biz.id}/carta/${a.id}`} style={{ marginRight: 10 }}>{a.name}</Link>))}
                </p>
              )}
            </Callout>
          ) : code === 'local-cerrado' ? (
            <Callout tone="warn" role="alert">
              {err.message}{' '}
              <button className="btn small" type="button" onClick={() => { act({ type: 'clock/jump', minutes: 12 * 60 }, 'Reloj en 12:00'); setErr(null) }}>Ir a las 12:00 en la demo</button>
            </Callout>
          ) : code === 'vacio' ? (
            <Callout tone="warn" role="alert">{err.message} <Link to={`/${biz.id}/carta`}>Ir a la carta</Link></Callout>
          ) : (
            <Callout tone="err" role="alert">
              {err.message}
              {alts.length > 0 && typeof alts[0] === 'number' && (
                <div className="slot-grid" style={{ marginTop: 8 }}>
                  {(alts as number[]).map((m) => (
                    <button key={m} type="button" onClick={() => { setTimeInput(hhmm(m)); setFulfillment({ fulfillment: { kind: 'retiro', startMin: m } }) }}>{hhmm(m)}</button>
                  ))}
                </div>
              )}
            </Callout>
          )}
        </div>
      )}

      <section className="card" style={{ marginTop: 18 }} aria-labelledby="recientes">
        <h2 id="recientes">Pedidos recientes de este perfil (demo)</h2>
        {myOrders.length === 0 ? (
          <p className="muted">Todavía no hay pedidos.</p>
        ) : (
          <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
            {myOrders.map((o) => (
              <li key={o.id} className="line">
                <span><Link to={`/${biz.id}/pedido/${o.id}`}>{o.id}</Link> · {o.alias} · <span className="money">{fmtARS(o.totalCents)}</span></span>
                <StatusBadge s={ORDER_LABEL[o.status]} />
              </li>
            ))}
          </ul>
        )}
        <Badge tone="info" label="Podés seguir cualquier folio desde Ayuda → Seguimiento" />
      </section>
    </main>
  )
}
