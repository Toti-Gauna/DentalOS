import { useState } from 'react'
import { useApp } from '../../store'
import { PageHead } from '../../ui/Shell'
import { Callout, Empty } from '../../ui/kit'
import { buildReport } from '../../domain/reports'
import { dateKeyOf, fmtDateShort } from '../../domain/time'
import { fmtARS } from '../../domain/money'
import { ORDER_LABEL, RES_LABEL } from '../../ui/format'
import type { Channel } from '../../domain/types'

export function AdminReportes() {
  const state = useApp()
  const bizId = state.session.businessId
  const today = dateKeyOf(state.clock.nowMs)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [loc, setLoc] = useState<string>('todas')
  const [channel, setChannel] = useState<Channel | 'todos'>('todos')
  const locs = state.locations.filter((l) => l.businessId === bizId)
  const rep = buildReport(state, { businessId: bizId, locationId: loc, from, to, channel })
  const reset = () => { setFrom(today); setTo(today); setLoc('todas'); setChannel('todos') }
  const maxOrders = Math.max(1, ...Object.values(rep.orders.byStatus).map((n) => n ?? 0))
  return (
    <>
      <PageHead title="Reportes" sub="Indicadores derivados de pedidos, caja, stock y eventos. Sin datos inventados." />
      <form className="row" aria-label="Filtros del tablero" onSubmit={(e) => e.preventDefault()}>
        <div className="field" style={{ margin: 0 }}><label htmlFor="from">Desde</label><input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="rep-from" /></div>
        <div className="field" style={{ margin: 0 }}><label htmlFor="to">Hasta</label><input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="rep-to" /></div>
        <div className="field" style={{ margin: 0 }}><label htmlFor="rloc">Sede</label><select id="rloc" value={loc} onChange={(e) => setLoc(e.target.value)}><option value="todas">Todas</option>{locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        <div className="field" style={{ margin: 0 }}><label htmlFor="rch">Canal</label><select id="rch" value={channel} onChange={(e) => setChannel(e.target.value as 'todos')}><option value="todos">Todos</option><option value="web">Web</option><option value="whatsapp">WhatsApp</option><option value="voz">Llamada</option><option value="recepcion">Recepción</option></select></div>
        <button className="btn secondary" type="button" onClick={reset} data-testid="rep-reset">Limpiar filtros</button>
      </form>
      <p className="muted small" aria-live="polite">Período: {fmtDateShort(from)} → {fmtDateShort(to)}.</p>
      {rep.empty ? (
        <Empty title="Sin actividad para estos filtros" action={<button className="btn" type="button" onClick={reset}>Restablecer filtros</button>}>
          No hay pedidos, reservas, pagos ni eventos en este período. No se muestran gráficos ni importes inventados.
        </Empty>
      ) : (
        <div className="grid cols-2" data-testid="report">
          <section className="card" aria-labelledby="ped"><h2 id="ped">Pedidos</h2>
            <p className="kpi" data-testid="rep-orders">{rep.orders.count}</p>
            <p>Ventas (pedidos entregados): <strong className="money" data-testid="rep-sales">{fmtARS(rep.orders.salesCents)}</strong> en {rep.orders.delivered} pedido(s).</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {(Object.entries(rep.orders.byStatus) as [keyof typeof ORDER_LABEL, number][]).map(([st, n]) => (
                <li key={st}><div className="row between"><span>{ORDER_LABEL[st].label}</span><span className="num">{n}</span></div><div className="bar" aria-hidden="true"><span style={{ width: `${(n / maxOrders) * 100}%` }} /></div></li>
              ))}
            </ul>
            <p className="small muted">Por canal: {Object.entries(rep.orders.byChannel).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}</p>
          </section>
          <section className="card" aria-labelledby="res"><h2 id="res">Reservas</h2>
            <p className="kpi">{rep.reservations.count}</p>
            <ul>{(Object.entries(rep.reservations.byStatus) as [keyof typeof RES_LABEL, number][]).map(([st, n]) => <li key={st}>{RES_LABEL[st].label}: {n}</li>)}</ul>
          </section>
          <section className="card" aria-labelledby="cj"><h2 id="cj">Caja (efectivo ≠ ventas)</h2>
            <p>Cobros DEMO: <strong className="money">{fmtARS(rep.cash.collectedCents)}</strong> {Object.entries(rep.cash.byMethod).map(([k, v]) => `· ${k} ${fmtARS(v)}`).join(' ')}</p>
            {rep.cash.sessions.length === 0 ? <p className="muted">Sin turnos en el período.</p> : (
              <ul>{rep.cash.sessions.map((c) => <li key={c.id}>{c.id} ({c.status}): esperado <span className="money">{fmtARS(c.expectedCents)}</span>{c.countedCents !== null ? <> · contado <span className="money">{fmtARS(c.countedCents)}</span> · <strong>diferencia <span className="money">{fmtARS(c.differenceCents ?? 0)}</span></strong>{c.reason ? ` (${c.reason})` : ''}</> : ' · turno abierto'}</li>)}</ul>
            )}
            <p className="small muted">Beneficio y MRR: no se calculan en la demo (requerirían costos reales).</p>
          </section>
          <section className="card" aria-labelledby="stk"><h2 id="stk">Stock, catas y automatizaciones</h2>
            <ul>
              <li>Insumos: {rep.stock.low} bajo(s), {rep.stock.out} agotado(s) de {rep.stock.total}.</li>
              {rep.events.map((e) => <li key={e.id}>{e.title}: {e.held}/{e.capacity} lugares, {e.waiting} en espera.</li>)}
              <li>Ejecuciones de automatizaciones: {rep.automations.count} ({Object.entries(rep.automations.byStatus).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}). Previews de campaña (no son ventas): {rep.automations.campaignPreviews}.</li>
              <li>Pasaporte: inicio {rep.passport.started} · completado {rep.passport.completed} · guardado {rep.passport.saved} · usado en carrito {rep.passport.usedInCart} · con insignia de visitas {rep.passport.badgesFromVisits}.</li>
            </ul>
          </section>
        </div>
      )}
      <Callout>Cambiá un pedido en Pedidos o Cocina y volvé: estos indicadores se recalculan desde el mismo estado.</Callout>
    </>
  )
}
