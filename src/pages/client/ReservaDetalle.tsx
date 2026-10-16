import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useBiz } from '../../ui/hooks'
import { PageHead } from '../../ui/Shell'
import { act, Callout, ConfirmDialog, Empty, ErrorText, ReasonDialog, StatusBadge } from '../../ui/kit'
import { RES_LABEL } from '../../ui/format'
import { alternatives, slotStarts, slotAvailable } from '../../domain/availability'
import { addDays, dateKeyOf, fmtDateShort, fmtDateTime, hhmm } from '../../domain/time'
import { dispatch } from '../../store'

export function ReservaDetalle() {
  const { id } = useParams()
  const { state, biz } = useBiz()
  const nav = useNavigate()
  const [cancel, setCancel] = useState(false)
  const [resched, setResched] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const r = state.reservations.find((x) => x.id === id && x.businessId === biz.id)
  const [rDate, setRDate] = useState(r?.dateKey ?? '')
  const [rMin, setRMin] = useState<number | null>(null)
  if (!r) {
    return (
      <main>
        <PageHead title="No encontramos esa reserva" />
        <Empty title={`El folio ${id ?? ''} no existe en ${biz.name}`} action={<Link className="btn" to={`/${biz.id}/reservar`}>Volver a reservas</Link>}>No se creó ni modificó nada.</Empty>
      </main>
    )
  }
  const table = state.tables.find((t) => t.id === r.tableId)
  const loc = state.locations.find((l) => l.id === r.locationId)
  const history = state.audit.filter((a) => a.entityType === 'Reservation' && a.entityId === r.id)
  const active = ['solicitada', 'confirmada', 'alternativa_ofrecida', 'revision_humana', 'llegada'].includes(r.status)
  const editable = ['solicitada', 'confirmada', 'alternativa_ofrecida'].includes(r.status)
  const today = dateKeyOf(state.clock.nowMs)
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i))
  const dayStarts = rDate ? slotStarts(state, biz.id, r.locationId, rDate) : []

  const continueIn = (channel: 'whatsapp' | 'voz') => {
    const o = act({ type: 'chat/continue', reservationId: r.id, channel })
    if (o.ok) nav(`/${biz.id}/simulador?c=${(o.data as { conversationId: string }).conversationId}&canal=${channel}`)
  }
  return (
    <main>
      <PageHead title={`Reserva ${r.id}`} sub={`${loc?.name} · ${r.party} ${r.party === 1 ? 'persona' : 'personas'} · ${fmtDateShort(r.dateKey)} a las ${hhmm(r.startMin)}`}>
        <StatusBadge s={RES_LABEL[r.status]} />
      </PageHead>
      {r.status === 'solicitada' && <Callout>Solicitud recibida; el equipo todavía debe confirmarla.</Callout>}
      {r.status === 'confirmada' && <Callout tone="ok">Confirmada{table ? ` en mesa ${table.label} (${table.sector === 'terraza' ? 'terraza' : 'salón'})` : ''}. La preferencia de sector no está garantizada.</Callout>}
      {r.status === 'revision_humana' && <Callout tone="warn">Consulta alimentaria enviada al equipo de muestra. {r.reviewReason === 'grupo-grande' ? 'Los grupos grandes se revisan caso por caso.' : 'Esta demo no puede garantizar ausencia de alérgenos.'} No se acepta automáticamente.</Callout>}
      {r.status === 'alternativa_ofrecida' && r.alternativeStartMin !== null && (
        <Callout tone="warn">
          <p>El equipo ofrece <strong>{hhmm(r.alternativeStartMin)}</strong> en lugar de {hhmm(r.startMin)}.</p>
          <div className="row">
            <button className="btn" type="button" onClick={() => { const o = act({ type: 'res/acceptAlternative', id: r.id }); setMsg({ tone: o.ok ? 'ok' : 'err', text: o.ok ? 'Alternativa aceptada: reserva confirmada.' : o.message }) }}>Aceptar la alternativa</button>
            <button className="btn danger" type="button" onClick={() => setCancel(true)}>Rechazar y cancelar</button>
          </div>
        </Callout>
      )}
      {r.status === 'cancelada' && <Callout tone="err">Cancelada: {r.cancelReason}.</Callout>}
      {msg && <Callout tone={msg.tone === 'ok' ? 'ok' : 'err'} role="status">{msg.text}</Callout>}
      <section className="card" style={{ marginTop: 12 }} aria-labelledby="d">
        <h2 id="d">Detalle</h2>
        <dl>
          <dt>A nombre de</dt><dd>{r.alias}</dd>
          <dt>Canal de origen</dt><dd>{r.channel} · hilo {r.conversationId ?? '—'} · operación {r.operationId}</dd>
          <dt>Sector pedido</dt><dd>{r.sectorPref === 'cualquiera' ? 'sin preferencia' : `${r.sectorPref} (preferencia sujeta a confirmación)`}</dd>
          {r.dietaryNote && (<><dt>Consulta alimentaria</dt><dd>{r.dietaryNote}</dd></>)}
          <dt>Versión</dt><dd>{r.version}</dd>
        </dl>
      </section>
      {active && (
        <div className="row" style={{ marginTop: 12 }}>
          {editable && <button className="btn secondary" type="button" onClick={() => { setResched(true); setRDate(r.dateKey); setRMin(null) }} data-testid="open-resched">Reprogramar</button>}
          <button className="btn danger" type="button" onClick={() => setCancel(true)} data-testid="open-cancel">Cancelar reserva</button>
          <button className="btn secondary" type="button" onClick={() => continueIn('whatsapp')} data-testid="continue-wa">Continuar por WhatsApp (simulado)</button>
          <button className="btn secondary" type="button" onClick={() => continueIn('voz')} data-testid="continue-voice">Continuar por llamada (simulada)</button>
        </div>
      )}
      <section className="card" style={{ marginTop: 14 }} aria-labelledby="h">
        <h2 id="h">Historial</h2>
        {history.length === 0 ? <p className="muted">Sin eventos.</p> : (
          <ul>{history.map((a) => <li key={a.id}><time>{fmtDateTime(a.at)}</time> · {a.summary} <span className="muted small">({a.correlationId})</span></li>)}</ul>
        )}
      </section>

      <ReasonDialog
        open={cancel}
        title="Cancelar la reserva"
        confirmLabel="Cancelar reserva"
        body={<p>Se libera la mesa una sola vez y la cancelación queda en el historial.</p>}
        onCancel={() => setCancel(false)}
        onConfirm={(reason) => {
          const o = act({ type: 'res/cancel', id: r.id, reason })
          setCancel(false)
          setMsg({ tone: o.ok ? 'ok' : 'err', text: o.ok ? (o.duplicate ? 'La reserva ya estaba cancelada: el cupo se liberó una sola vez.' : 'Reserva cancelada.') : o.message })
        }}
      />
      <ConfirmDialog
        open={resched}
        title="Reprogramar"
        confirmLabel="Confirmar cambio"
        onCancel={() => setResched(false)}
        confirmDisabled={rMin === null}
        onConfirm={() => {
          const o = dispatch({ type: 'res/reschedule', id: r.id, dateKey: rDate, startMin: rMin, expectedVersion: r.version })
          if (o.ok) {
            setResched(false)
            setMsg({ tone: 'ok', text: o.duplicate ? 'No hubo cambios.' : 'Reserva reprogramada: mismo folio, nueva versión.' })
          } else {
            setMsg({ tone: 'err', text: o.message })
            setResched(false)
          }
        }}
        body={<p className="muted">Si el nuevo horario no tiene disponibilidad, tu reserva queda como estaba.</p>}
      >
        <div className="field">
          <label htmlFor="rdate">Día</label>
          <select id="rdate" value={rDate} onChange={(e) => { setRDate(e.target.value); setRMin(null) }}>
            {days.map((d) => <option key={d} value={d}>{fmtDateShort(d)}</option>)}
          </select>
        </div>
        <fieldset>
          <legend>Franja</legend>
          <div className="slot-grid">
            {dayStarts.map((m) => {
              const ok = slotAvailable(state, { businessId: biz.id, locationId: r.locationId, dateKey: rDate, startMin: m, party: r.party, sectorPref: r.sectorPref, excludeId: r.id })
              return <button key={m} type="button" disabled={!ok} aria-pressed={rMin === m} onClick={() => setRMin(m)}>{hhmm(m)}</button>
            })}
          </div>
        </fieldset>
        <ErrorText>{rMin !== null && !slotAvailable(state, { businessId: biz.id, locationId: r.locationId, dateKey: rDate, startMin: rMin, party: r.party, excludeId: r.id }) ? `Sin disponibilidad. Probá: ${alternatives(state, { businessId: biz.id, locationId: r.locationId, dateKey: rDate, startMin: rMin, party: r.party, excludeId: r.id }, 3).map(hhmm).join(', ')}` : ''}</ErrorText>
      </ConfirmDialog>
    </main>
  )
}
