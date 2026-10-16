import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../../store'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Callout, ConfirmDialog, Empty, ReasonDialog } from '../../ui/kit'
import { activeCustomers } from '../../domain/customers'
import { stampsOf } from '../../domain/cmd-engage'
import { fmtDateShort, fmtDateTime, hhmm } from '../../domain/time'
import { fmtARS } from '../../domain/money'

export function AdminClientes() {
  const state = useApp()
  const { id } = useParams()
  const bizId = state.session.businessId
  const list = activeCustomers(state, bizId)
  const c = id ? state.customers.find((x) => x.id === id && x.businessId === bizId) : undefined
  const [merge, setMerge] = useState(false)
  const [revert, setRevert] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  if (id && !c) {
    return (<><PageHead title="Clientes" /><Empty title={`No existe el cliente ${id} en este perfil`} action={<Link className="btn" to="/admin/clientes">Volver al listado</Link>}>Puede haberse unido a otro registro.</Empty></>)
  }
  if (c) {
    const res = state.reservations.filter((r) => r.customerId === c.id)
    const ord = state.orders.filter((o) => o.customerId === c.id)
    const conv = state.conversations.filter((x) => x.customerId === c.id)
    const visits = state.visits.filter((v) => v.customerId === c.id)
    const dupOf = c.possibleDuplicateOf ? state.customers.find((x) => x.id === c.possibleDuplicateOf && !x.mergedInto) : state.customers.find((x) => x.possibleDuplicateOf === c.id && !x.mergedInto)
    const events = state.eventBookings.filter((b) => b.customerId === c.id)
    const pass = state.passports.find((p) => p.customerId === c.id)
    return (
      <>
        <PageHead title={`${c.displayName}`} sub={`${c.id} · ficha de cliente ficticio`} />
        <p><Link to="/admin/clientes">← Todos los clientes</Link></p>
        {msg && <Callout tone={msg.tone === 'ok' ? 'ok' : 'err'} role="alert">{msg.text}</Callout>}
        {dupOf && (
          <Callout tone="warn">
            Posible duplicado: <strong>{dupOf.alias}</strong> ({dupOf.id}). La identidad es ambigua: unir exige confirmación local.
            <div className="row" style={{ marginTop: 6 }}><button className="btn small" type="button" onClick={() => setMerge(true)} data-testid="merge-open">Unir con {dupOf.alias}…</button></div>
          </Callout>
        )}
        <div className="grid cols-2">
          <section className="card" aria-labelledby="cons">
            <h2 id="cons">Consentimientos (por separado)</h2>
            <label className="choice"><input type="checkbox" checked={c.consent.service} onChange={(e) => act({ type: 'cust/consent', customerId: c.id, service: e.target.checked }, 'Consentimiento de servicio actualizado')} data-testid="consent-service" /> Mensajes de servicio (confirmaciones, recordatorios, avisos de pedido)</label>
            <label className="choice"><input type="checkbox" checked={c.consent.promo} onChange={(e) => act({ type: 'cust/consent', customerId: c.id, promo: e.target.checked }, 'Consentimiento promocional actualizado')} data-testid="consent-promo" /> Promociones (solo vista previa en la demo)</label>
            <p className="small muted">Última actualización {fmtDateTime(c.consent.updatedAt)}. Una baja de promoción no afecta los avisos de servicio, y viceversa.</p>
            <p>Canales de muestra: WhatsApp {c.channels.whatsapp ? 'autorizado' : 'sin autorizar'} · voz {c.channels.voz ? 'sí' : 'no'}. Alias interno, sin teléfono ni correo operables.</p>
            <p>Preferencias administrativas: {c.prefs || '—'}</p>
          </section>
          <section className="card" aria-labelledby="vis">
            <h2 id="vis">Visitas y sellos</h2>
            <p>{stampsOf(state, c.id)} sello(s) {pass ? `· pasaporte: ${pass.badge}` : ''}</p>
            <ul>
              {visits.map((v) => (
                <li key={v.id}>{fmtDateShort(v.dateKey)} · {v.status}{v.reversalReason ? ` (${v.reversalReason})` : ''} {v.status === 'acreditada' && <button className="btn ghost small" type="button" onClick={() => setRevert(v.id)}>Revertir</button>}</li>
              ))}
            </ul>
            <button className="btn secondary small" type="button" onClick={() => { const loc = state.session.locationByBusiness[bizId]; const o = act({ type: 'visit/credit', businessId: bizId, locationId: loc, customerId: c.id }, 'Sello acreditado (de muestra)'); setMsg({ tone: o.ok ? 'ok' : 'err', text: o.message ?? (o.ok ? 'Sello acreditado. Sin premio real.' : '') }) }} data-testid="credit-visit">Acreditar visita de hoy</button>
          </section>
          <section className="card"><h2>Reservas</h2>{res.length ? <ul>{res.map((r) => <li key={r.id}><Link to={`/admin/reservas/${r.id}`}>{r.id}</Link> · {fmtDateShort(r.dateKey)} {hhmm(r.startMin)} · {r.status}</li>)}</ul> : <p className="muted">Sin reservas.</p>}</section>
          <section className="card"><h2>Pedidos</h2>{ord.length ? <ul>{ord.map((o) => <li key={o.id}><Link to={`/admin/pedidos/${o.id}`}>{o.id}</Link> · {o.status} · {fmtARS(o.totalCents)}</li>)}</ul> : <p className="muted">Sin pedidos.</p>}</section>
          <section className="card"><h2>Conversaciones</h2>{conv.length ? <ul>{conv.map((x) => <li key={x.id}>{x.id} · {state.messages.filter((m) => m.conversationId === x.id).length} mensajes</li>)}</ul> : <p className="muted">Sin conversaciones.</p>}</section>
          <section className="card"><h2>Catas</h2>{events.length ? <ul>{events.map((b) => <li key={b.id}>{state.tastingEvents.find((e) => e.id === b.eventId)?.title} · {b.status}</li>)}</ul> : <p className="muted">Sin inscripciones.</p>}</section>
        </div>
        <ConfirmDialog open={merge} title="Unir clientes" confirmLabel="Confirmar unión local" onCancel={() => setMerge(false)} onConfirm={() => { const keep = c.possibleDuplicateOf ? dupOf!.id : c.id; const drop = keep === c.id ? dupOf!.id : c.id; const o = act({ type: 'cust/merge', keepId: keep, dropId: drop, confirm: true }, 'Clientes unidos'); setMsg({ tone: o.ok ? 'ok' : 'err', text: o.ok ? 'Clientes unidos: reservas, pedidos y visitas ahora cuelgan de un solo registro. La baja de promoción de cualquiera de los dos prevalece.' : o.message }); setMerge(false) }}
          body={<p>Se unen <strong>{c.alias}</strong> y <strong>{dupOf?.alias}</strong> en un solo cliente. Es una acción local de la demo; la baja de promoción de cualquiera prevalece.</p>} />
        <ReasonDialog open={!!revert} title="Revertir el sello" confirmLabel="Revertir" body={<p>El historial se conserva y el contador se recalcula.</p>} onCancel={() => setRevert(null)} onConfirm={(reason) => { const o = act({ type: 'visit/revert', visitId: revert, reason }, 'Sello revertido'); setMsg({ tone: o.ok ? 'ok' : 'err', text: o.ok ? 'Sello revertido con motivo.' : o.message }); setRevert(null) }} />
      </>
    )
  }
  return (
    <>
      <PageHead title="Clientes" sub="Datos ficticios · sin teléfonos ni correos operables" />
      {list.length === 0 ? <Empty title="Todavía no hay clientes">Aparecen cuando alguien reserva, pide o conversa con un alias.</Empty> : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Clientes</caption>
            <thead><tr><th>Cliente</th><th>Servicio</th><th>Promoción</th><th>Sellos</th><th>Reservas</th><th>Pedidos</th><th /></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/admin/clientes/${c.id}`}>{c.displayName}</Link> <span className="muted small">{c.id}</span> {c.possibleDuplicateOf && <Badge tone="warn" icon="⚑" label="Posible duplicado" />}</td>
                  <td>{c.consent.service ? 'sí' : 'no'}</td><td>{c.consent.promo ? 'sí' : 'no'}</td>
                  <td className="num">{stampsOf(state, c.id)}</td>
                  <td className="num">{state.reservations.filter((r) => r.customerId === c.id).length}</td>
                  <td className="num">{state.orders.filter((o) => o.customerId === c.id).length}</td>
                  <td><Link className="btn secondary small" to={`/admin/clientes/${c.id}`}>Ficha</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
