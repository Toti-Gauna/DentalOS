import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../store'
import { PageHead } from '../../ui/Shell'
import { act, Callout, Empty, ReasonDialog } from '../../ui/kit'
import { ORDER_LABEL } from '../../ui/format'
import { hhmm } from '../../domain/time'
import type { Order } from '../../domain/types'

type Station = 'todas' | 'cocina' | 'barra'
const COLS: { status: Order['status']; title: string }[] = [
  { status: 'enviado', title: 'Nuevos' },
  { status: 'aceptado', title: 'Aceptados' },
  { status: 'en_preparacion', title: 'Preparando' },
  { status: 'listo', title: 'Listos' },
]

export function AdminCocina() {
  const state = useApp()
  const bizId = state.session.businessId
  const [station, setStation] = useState<Station>('todas')
  const [inc, setInc] = useState<Order | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const orders = state.orders.filter((o) => o.businessId === bizId && COLS.some((c) => c.status === o.status))
  const say = (r: ReturnType<typeof act>) => setMsg(r.ok ? null : { tone: 'err', text: r.message })
  const mins = (o: Order) => {
    const t = state.tickets.find((k) => k.id === o.ticketId)
    return t?.startedAt ? Math.max(0, Math.round((state.clock.nowMs - t.startedAt) / 60000)) : null
  }
  return (
    <>
      <PageHead title="Cocina / barra" sub="Cola por estación · temporizador simulado con el reloj de la demo" />
      <div className="row" role="group" aria-label="Estación" style={{ marginBottom: 10 }}>
        {(['todas', 'cocina', 'barra'] as Station[]).map((s) => (
          <button key={s} type="button" className={`btn small ${station === s ? '' : 'secondary'}`} aria-pressed={station === s} onClick={() => setStation(s)} data-testid={`station-${s}`}>
            {s === 'todas' ? 'Todas' : s === 'cocina' ? 'Cocina' : 'Barra'}
          </button>
        ))}
      </div>
      {msg && <Callout tone="err" role="alert">{msg.text}</Callout>}
      {orders.length === 0 && <Empty title="No hay comandas activas">Los pedidos enviados por los clientes aparecen acá.</Empty>}
      <div className="kds">
        {COLS.map((c) => {
          const list = orders.filter((o) => o.status === c.status && (station === 'todas' || o.lines.some((l) => l.station === station)))
          return (
            <section key={c.status} className="kds-col" aria-labelledby={`col-${c.status}`}>
              <h3 id={`col-${c.status}`}>{c.title} ({list.length})</h3>
              {list.map((o) => {
                const m = mins(o)
                const t = state.tickets.find((k) => k.id === o.ticketId)
                const lines = o.lines.filter((l) => station === 'todas' || l.station === station)
                return (
                  <article key={o.id} className={`ticket ${m !== null && m > 10 ? 'late' : ''}`} data-testid={`ticket-${o.id}`}>
                    <div className="t-head">
                      <span><Link to={`/admin/pedidos/${o.id}`}>{t?.id ?? o.id}</Link> · {o.kind === 'mesa' ? `Mesa ${state.tableSessions.find((s) => s.id === o.sessionId)?.tableIds.map((x) => state.tables.find((y) => y.id === x)?.label).join('+')}` : `Retiro ${o.pickup ? hhmm(o.pickup.startMin) : ''}`}</span>
                      {m !== null && <span className="timer" aria-label={`${m} minutos en preparación`}>{m} min</span>}
                    </div>
                    <ul>
                      {lines.map((l) => (
                        <li key={l.id}>
                          <strong>{l.qty}× {l.name}</strong> <span className="badge neutral">{l.station}</span>
                          <div className="small">{l.selections.map((s) => s.optionName).join(' · ')}{l.note ? ` · ${l.note}` : ''}</div>
                        </li>
                      ))}
                    </ul>
                    {t?.incident && <p className="error-text">{t.incident}</p>}
                    <p className="small muted">{o.alias} · {ORDER_LABEL[o.status].label}</p>
                    <div className="row">
                      {o.status === 'enviado' && <button className="btn small" type="button" data-testid={`k-accept-${o.id}`} onClick={() => say(act({ type: 'order/accept', orderId: o.id }, `${o.id} aceptado`))}>Aceptar</button>}
                      {o.status === 'aceptado' && <button className="btn small" type="button" data-testid={`k-prepare-${o.id}`} onClick={() => say(act({ type: 'order/prepare', orderId: o.id }, `${o.id} en preparación`))}>Preparar</button>}
                      {o.status === 'en_preparacion' && <button className="btn small" type="button" data-testid={`k-ready-${o.id}`} onClick={() => say(act({ type: 'order/ready', orderId: o.id }, `${o.id} listo`))}>Marcar listo</button>}
                      {o.status === 'listo' && <button className="btn small" type="button" data-testid={`k-deliver-${o.id}`} onClick={() => say(act({ type: 'order/deliver', orderId: o.id }, o.kind === 'mesa' ? `${o.id} servido` : `${o.id} retirado`))}>{o.kind === 'mesa' ? 'Servido' : 'Retirado'}</button>}
                      <button className="btn secondary small" type="button" onClick={() => setInc(o)}>Incidencia</button>
                    </div>
                  </article>
                )
              })}
              {list.length === 0 && <p className="muted small">Sin comandas.</p>}
            </section>
          )
        })}
      </div>
      <ReasonDialog open={!!inc} danger={false} title={`Incidencia en ${inc?.id}`} placeholder="¿Qué pasó? (sin insumo, cambio tardío…)" confirmLabel="Derivar al encargado" body={<p>Se avisa al encargado y la comanda queda intacta: no se borra trabajo.</p>} onCancel={() => setInc(null)} onConfirm={(note) => { say(act({ type: 'order/incident', orderId: inc!.id, note }, 'Incidencia derivada al encargado')); setInc(null) }} />
    </>
  )
}
