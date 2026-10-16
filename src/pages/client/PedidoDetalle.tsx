import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useBiz } from '../../ui/hooks'
import { PageHead } from '../../ui/Shell'
import { act, Callout, Empty, ReasonDialog, StatusBadge } from '../../ui/kit'
import { ORDER_LABEL } from '../../ui/format'
import { fmtARS } from '../../domain/money'
import { hhmm, minutesOfDay, HOUR } from '../../domain/time'
import type { Order, OrderStatus } from '../../domain/types'

const FLOW: OrderStatus[] = ['enviado', 'aceptado', 'en_preparacion', 'listo', 'servido', 'cerrado']

export function OrderTimeline({ o }: { o: Order }) {
  const flow = o.kind === 'retiro' ? (['enviado', 'aceptado', 'en_preparacion', 'listo', 'retirado', 'cerrado'] as OrderStatus[]) : FLOW
  if (o.status === 'rechazado' || o.status === 'cancelado') {
    return (
      <ol className="timeline" aria-label="Estado del pedido">
        <li data-state="done">Enviado</li>
        <li data-state="off">{ORDER_LABEL[o.status].label}{o.reason ? `: ${o.reason}` : ''}</li>
      </ol>
    )
  }
  const idx = flow.indexOf(o.status)
  return (
    <ol className="timeline" aria-label="Estado del pedido">
      {flow.map((st, i) => (
        <li key={st} data-state={i < idx ? 'done' : i === idx ? 'now' : 'todo'} aria-current={i === idx ? 'step' : undefined}>
          {i < idx ? '✓ ' : i === idx ? '● ' : '○ '}
          {ORDER_LABEL[st].label}
        </li>
      ))}
    </ol>
  )
}

export function PedidoDetalle() {
  const { id } = useParams()
  const { state, biz } = useBiz()
  const nav = useNavigate()
  const [cancel, setCancel] = useState(false)
  const [msg, setMsg] = useState('')
  const o = state.orders.find((x) => x.id === id && x.businessId === biz.id)
  if (!o) {
    return (
      <main>
        <PageHead title="No encontramos ese pedido" />
        <Empty title={`El folio ${id ?? ''} no existe en ${biz.name}`} action={<Link className="btn" to={`/${biz.id}/pedido`}>Volver a mis pedidos</Link>}>
          Puede ser de otro perfil o de un seed anterior. No se creó ni modificó nada.
        </Empty>
      </main>
    )
  }
  const sess = state.tableSessions.find((s) => s.id === o.sessionId)
  const table = sess?.tableIds.map((t) => state.tables.find((x) => x.id === t)?.label).join('+')
  const notice = o.noticeRunId ? state.runs.find((r) => r.id === o.noticeRunId) : undefined
  const noticeMsg = notice?.messageId ? state.messages.find((m) => m.id === notice.messageId) : undefined
  const loc = state.locations.find((l) => l.id === o.locationId)
  const cancellable = ['enviado', 'aceptado', 'en_preparacion', 'listo'].includes(o.status)
  void HOUR
  void minutesOfDay
  return (
    <main>
      <PageHead title={`Pedido ${o.id}`} sub={`${loc?.name} · ${o.kind === 'mesa' ? `mesa ${table ?? ''}` : `retiro ${o.pickup ? hhmm(o.pickup.startMin) : ''} a nombre de ${o.alias}`}`}>
        <StatusBadge s={ORDER_LABEL[o.status]} />
      </PageHead>
      <OrderTimeline o={o} />
      {o.status === 'enviado' && <Callout>Solicitud recibida; el equipo todavía debe aceptarla.</Callout>}
      {o.status === 'listo' && (
        <Callout tone="ok" role="status">
          <strong>¡Listo!</strong> {o.kind === 'retiro' ? `Retiralo en barra con el código ${o.pickupCode}.` : 'Tu mozo lo lleva a la mesa.'}{' '}
          {notice ? (
            notice.status === 'fallida' ? <span>El aviso local falló y puede reintentarse desde administración; el pedido sigue listo.</span> : <span>{notice.detail}</span>
          ) : null}
        </Callout>
      )}
      {(o.status === 'rechazado' || o.status === 'cancelado') && <Callout tone="err" role="alert">{ORDER_LABEL[o.status].label}: {o.reason ?? 'sin motivo registrado'}.</Callout>}
      {o.cancelRequested && <Callout tone="warn">Pediste cancelar con el pedido ya en marcha. El encargado debe decidir; la comanda no se borra.</Callout>}
      {noticeMsg && <p className="small muted">Aviso local ({noticeMsg.status}): “{noticeMsg.text}”</p>}
      <section className="card" style={{ marginTop: 14 }} aria-labelledby="det">
        <h2 id="det">Detalle</h2>
        {o.lines.map((l) => (
          <div className="line" key={l.id}>
            <div>
              <strong>{l.qty}× {l.name}</strong> <span className="badge neutral">{l.station}</span>
              <div className="opts">{l.selections.map((s) => s.optionName).join(' · ')}</div>
              {l.note && <div className="opts">Nota: {l.note}</div>}
            </div>
            <span className="money">{fmtARS(l.lineCents)}</span>
          </div>
        ))}
        <div className="total-row"><span>Total</span><span className="money">{fmtARS(o.totalCents)}</span></div>
        <p className="small muted">Canal: {o.channel} · operación {o.operationId} · hilo {o.correlationId}. Importe informativo: no se cobró nada.</p>
      </section>
      <div className="row" style={{ marginTop: 14 }}>
        {cancellable && !o.cancelRequested && <button className="btn danger" type="button" onClick={() => setCancel(true)} data-testid="cancel-order">Cancelar pedido</button>}
        <button className="btn secondary" type="button" onClick={() => { const r = act({ type: 'order/duplicate', orderId: o.id }, 'Copiado al carrito para revisar'); if (r.ok) nav(`/${biz.id}/pedido`) }}>Volver a pedir (copia al carrito)</button>
        <Link className="btn ghost" to={`/${biz.id}/simulador`}>Seguir por WhatsApp (simulado)</Link>
      </div>
      {msg && <Callout tone="info" role="status">{msg}</Callout>}
      <ReasonDialog
        open={cancel}
        title="Cancelar el pedido"
        confirmLabel="Cancelar pedido"
        body={<p>{['en_preparacion', 'listo'].includes(o.status) ? 'El pedido ya está en marcha: se abre una incidencia para el encargado y no se borra la comanda ni se devuelven insumos.' : 'Todavía no se preparó: se cancela y se libera lo reservado.'}</p>}
        onCancel={() => setCancel(false)}
        onConfirm={(reason) => {
          const r = act({ type: 'order/cancel', orderId: o.id, reason })
          setCancel(false)
          setMsg(r.ok ? (r.message ?? 'Pedido cancelado.') : r.message)
        }}
      />
    </main>
  )
}
