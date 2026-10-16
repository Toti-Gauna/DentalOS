import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../store'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Empty, ReasonDialog } from '../../ui/kit'
import { dateKeyOf, fmtDateShort } from '../../domain/time'
import { fmtARS } from '../../domain/money'
import { buildReport } from '../../domain/reports'
import { openCashFor } from '../../domain/cmd-cash'

export function AdminResumen() {
  const state = useApp()
  const bizId = state.session.businessId
  const biz = state.businesses.find((b) => b.id === bizId)!
  const today = dateKeyOf(state.clock.nowMs)
  const rep = buildReport(state, { businessId: bizId, locationId: 'todas', from: today, to: today, channel: 'todos' })
  const tasks = state.tasks.filter((t) => t.businessId === bizId && t.status === 'pendiente')
  const [resolve, setResolve] = useState<string | null>(null)
  const failed = state.runs.filter((r) => r.businessId === bizId && ['fallida', 'pendiente'].includes(r.status))
  const loc = state.session.locationByBusiness[bizId]
  const cash = openCashFor(state, loc)
  const resToday = state.reservations.filter((r) => r.businessId === bizId && r.dateKey === today)
  return (
    <>
      <PageHead title="Resumen" sub={`${biz.name} · ${fmtDateShort(today)} (día simulado)`} />
      <div className="grid cols-4">
        <div className="card"><p className="muted small">Reservas de hoy</p><p className="kpi" data-testid="kpi-res">{resToday.length}</p><p className="small">{resToday.filter((r) => r.status === 'solicitada').length} solicitadas · {resToday.filter((r) => r.status === 'confirmada').length} confirmadas</p></div>
        <div className="card"><p className="muted small">Pedidos de hoy</p><p className="kpi" data-testid="kpi-orders">{rep.orders.count}</p><p className="small">{rep.orders.delivered} entregados</p></div>
        <div className="card"><p className="muted small">Ventas (pedidos entregados)</p><p className="kpi money">{fmtARS(rep.orders.salesCents)}</p><p className="small">Derivado de pedidos; no es caja ni beneficio.</p></div>
        <div className="card"><p className="muted small">Caja de la sede</p><p className="kpi">{cash ? 'Abierta' : 'Cerrada'}</p><p className="small"><Link to="/admin/caja">Ir a caja</Link></p></div>
      </div>
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <section className="card" aria-labelledby="tareas">
          <h2 id="tareas">Tareas de revisión humana ({tasks.length})</h2>
          {tasks.length === 0 ? <Empty title="Sin tareas pendientes">Las consultas alimentarias, grupos grandes y derivaciones aparecen acá.</Empty> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {tasks.map((t) => (
                <li key={t.id} className="line" data-testid="task">
                  <div>
                    <Badge tone="warn" icon="⚑" label={t.kind} /> <strong>{t.entityType} {t.entityId}</strong>
                    <div className="small">{t.note}</div>
                    <div className="small muted">{t.id} · hilo {t.correlationId}</div>
                  </div>
                  <button className="btn secondary small" type="button" onClick={() => setResolve(t.id)}>Resolver</button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="alertas">
          <h2 id="alertas">Alertas</h2>
          <ul>
            <li>Stock: {rep.stock.low} bajo(s), {rep.stock.out} agotado(s). <Link to="/admin/stock">Ver stock</Link></li>
            <li>Automatizaciones fallidas o pendientes: {failed.length}. <Link to="/admin/automatizaciones">Ver ejecuciones</Link></li>
            <li>Pedidos sin aceptar: {state.orders.filter((o) => o.businessId === bizId && o.status === 'enviado').length}. <Link to="/admin/pedidos">Ver pedidos</Link></li>
            <li>Reservas por revisar: {state.reservations.filter((r) => r.businessId === bizId && ['solicitada', 'revision_humana'].includes(r.status)).length}. <Link to="/admin/reservas">Ver reservas</Link></li>
          </ul>
        </section>
      </div>
      <ReasonDialog
        open={!!resolve}
        title="Resolver la tarea"
        confirmLabel="Marcar como resuelta"
        placeholder="¿Cómo se resolvió?"
        danger={false}
        onCancel={() => setResolve(null)}
        onConfirm={(r) => { act({ type: 'task/resolve', taskId: resolve, resolution: r }, 'Tarea resuelta'); setResolve(null) }}
      />
    </>
  )
}
