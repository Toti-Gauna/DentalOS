import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../../store'
import { PageHead } from '../../ui/Shell'
import { act, Callout, ConfirmDialog, Empty, ReasonDialog, StatusBadge } from '../../ui/kit'
import { RES_LABEL } from '../../ui/format'
import { alternatives, businessDuration, holdsTable } from '../../domain/availability'
import { addDays, dateKeyOf, fmtDateShort, fmtDateTime, hhmm } from '../../domain/time'
import type { AppState, Reservation, ReservationStatus } from '../../domain/types'

export function AdminReservas() {
  const state = useApp()
  const { id } = useParams()
  const bizId = state.session.businessId
  const biz = state.businesses.find((b) => b.id === bizId)!
  const locationId = state.session.locationByBusiness[bizId]
  const today = dateKeyOf(state.clock.nowMs)
  const [date, setDate] = useState(today)
  const [status, setStatus] = useState<'todas' | ReservationStatus>('todas')
  const [cancel, setCancel] = useState<Reservation | null>(null)
  const [review, setReview] = useState<Reservation | null>(null)
  const [alt, setAlt] = useState<Reservation | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string; alts?: { id: string; min: number }[] } | null>(null)
  const list = state.reservations
    .filter((r) => r.businessId === bizId && (id ? r.id === id : r.dateKey === date) && (status === 'todas' || r.status === status))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.startMin - b.startMin)
  const waits = state.waitlist.filter((w) => w.businessId === bizId && ['esperando', 'ofrecida'].includes(w.status))
  const tables = state.tables.filter((t) => t.locationId === locationId)

  const accept = (r: Reservation) => {
    const o = act({ type: 'res/accept', id: r.id, expectedVersion: r.version }, `${r.id} confirmada`)
    if (!o.ok) setMsg({ tone: 'err', text: o.message, alts: (((o.data as { alternatives?: number[] } | undefined)?.alternatives) ?? []).map((m) => ({ id: r.id, min: m })) })
    else setMsg({ tone: 'ok', text: o.duplicate ? `${r.id} ya estaba confirmada.` : `${r.id} confirmada. Cliente y chat muestran el mismo estado.` })
  }
  const actions = (r: Reservation) => (
    <div className="row">
      {r.status === 'solicitada' && <button className="btn small" type="button" onClick={() => accept(r)} data-testid={`accept-${r.id}`}>Aceptar</button>}
      {r.status === 'revision_humana' && !r.reviewResolved && r.reviewReason === 'alimentaria' && <button className="btn small" type="button" onClick={() => setReview(r)} data-testid={`review-${r.id}`}>Resolver revisión</button>}
      {r.status === 'revision_humana' && r.reviewReason === 'grupo-grande' && <span className="small muted">Coordinar a mano (no se asigna mesa)</span>}
      {['solicitada', 'revision_humana'].includes(r.status) && <button className="btn secondary small" type="button" onClick={() => setAlt(r)}>Ofrecer alternativa</button>}
      {r.status === 'confirmada' && <button className="btn secondary small" type="button" onClick={() => act({ type: 'res/arrive', id: r.id }, `${r.id}: llegó`)}>Marcar llegada</button>}
      {['confirmada', 'llegada'].includes(r.status) && <Link className="btn secondary small" to="/admin/salon">Sentar</Link>}
      {r.status === 'confirmada' && <button className="btn secondary small" type="button" onClick={() => act({ type: 'res/noShow', id: r.id }, `${r.id}: no-show`)}>No-show</button>}
      {['solicitada', 'confirmada', 'alternativa_ofrecida', 'revision_humana', 'llegada'].includes(r.status) && <button className="btn danger small" type="button" onClick={() => setCancel(r)}>Cancelar</button>}
    </div>
  )
  const tableName = (r: Reservation) => state.tables.find((t) => t.id === r.tableId)?.label ?? '—'
  return (
    <>
      <PageHead title="Reservas" sub={`${biz.name}${biz.reservationsEnabled ? '' : ' · este perfil atiende por orden de llegada'}`} />
      {!biz.reservationsEnabled && <Callout tone="warn">La toma de reservas está desactivada en este perfil (se puede cambiar en Configuración). Las reservas existentes se muestran igual.</Callout>}
      {msg && (
        <Callout tone={msg.tone === 'ok' ? 'ok' : 'err'} role="alert">
          {msg.text}
          {msg.alts && msg.alts.length > 0 && (
            <div className="row" style={{ marginTop: 6 }}>
              {msg.alts.map((a) => (
                <button key={a.min} className="btn secondary small" type="button" onClick={() => { const o = act({ type: 'res/offerAlternative', id: a.id, startMin: a.min }, 'Alternativa ofrecida'); setMsg(o.ok ? { tone: 'ok', text: `Se ofreció ${hhmm(a.min)} a ${a.id}.` } : { tone: 'err', text: o.message }) }}>
                  Ofrecer {hhmm(a.min)}
                </button>
              ))}
            </div>
          )}
        </Callout>
      )}
      {id ? (
        <p><Link to="/admin/reservas">← Todas las reservas</Link></p>
      ) : (
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="fdate">Día</label>
            <input id="fdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="fstatus">Estado</label>
            <select id="fstatus" value={status} onChange={(e) => setStatus(e.target.value as 'todas')}>
              <option value="todas">Todos</option>
              {(Object.keys(RES_LABEL) as ReservationStatus[]).map((s) => <option key={s} value={s}>{RES_LABEL[s].label}</option>)}
            </select>
          </div>
          <button className="btn ghost small" type="button" onClick={() => setDate(addDays(date, -1))}>Día anterior</button>
          <button className="btn ghost small" type="button" onClick={() => setDate(addDays(date, 1))}>Día siguiente</button>
          <button className="btn ghost small" type="button" onClick={() => setDate(today)}>Hoy</button>
        </div>
      )}
      {list.length === 0 ? (
        <Empty title={id ? `No existe la reserva ${id}` : `Sin reservas para ${fmtDateShort(date)}`} action={id ? <Link className="btn" to="/admin/reservas">Volver al listado</Link> : undefined}>
          {id ? 'Puede ser de otro perfil.' : 'Probá con otro día o cambiá el filtro de estado.'}
        </Empty>
      ) : (
        <>
          <div className="table-wrap responsive">
            <table>
              <caption className="sr-only">Reservas</caption>
              <thead><tr><th>Folio</th><th>Hora</th><th>Personas</th><th>A nombre de</th><th>Canal</th><th>Mesa</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} data-testid={`res-row-${r.id}`}>
                    <td><Link to={`/admin/reservas/${r.id}`}>{r.id}</Link></td>
                    <td className="num">{id ? fmtDateShort(r.dateKey) + ' ' : ''}{hhmm(r.startMin)}</td>
                    <td className="num">{r.party}</td>
                    <td>{r.alias}{r.dietaryNote ? <div className="small">⚑ {r.dietaryNote}</div> : null}</td>
                    <td>{r.channel}</td>
                    <td>{tableName(r)}</td>
                    <td><StatusBadge s={RES_LABEL[r.status]} /></td>
                    <td>{actions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cards-m">
            {list.map((r) => (
              <div className="card" key={r.id}>
                <div className="row between"><strong>{r.id} · {hhmm(r.startMin)}</strong><StatusBadge s={RES_LABEL[r.status]} /></div>
                <p>{r.party} pers. · {r.alias} · mesa {tableName(r)}</p>
                {actions(r)}
              </div>
            ))}
          </div>
        </>
      )}

      {!id && (
        <div className="grid cols-2" style={{ marginTop: 18 }}>
          <section className="card" aria-labelledby="cupos">
            <h2 id="cupos">Cupos por mesa · {fmtDateShort(date)}</h2>
            <p className="small muted">Duración {biz.serviceMinutes} min + margen {biz.bufferMinutes}. Cada bloque retiene la mesa hasta el fin del margen.</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Mesa</th><th>Lugares</th><th>Reservas</th></tr></thead>
                <tbody>
                  {tables.map((t) => {
                    const rs = state.reservations.filter((r) => r.tableId === t.id && r.dateKey === date && holdsTable(r.status)).sort((a, b) => a.startMin - b.startMin)
                    const { service, buffer } = businessDuration(state, bizId)
                    return (
                      <tr key={t.id}>
                        <td>{t.label}</td><td className="num">{t.seats}</td>
                        <td>{rs.length ? rs.map((r) => <span key={r.id} className="badge neutral" style={{ marginRight: 4 }}>{hhmm(r.startMin)}–{hhmm(r.startMin + service + buffer)} {r.alias}</span>) : <span className="muted">libre</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card" aria-labelledby="espera">
            <h2 id="espera">Lista de espera</h2>
            {waits.length === 0 ? <p className="muted">Nadie en espera.</p> : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {waits.map((w) => (
                  <li key={w.id} className="line" data-testid={`wait-${w.id}`}>
                    <div>
                      <strong>{w.alias}</strong> · {w.party} pers. · {fmtDateShort(w.dateKey)} {hhmm(w.startMin)}
                      <div className="small">{w.status === 'ofrecida' ? `Oferta ${hhmm(w.offerStartMin ?? 0)} · vence (reloj simulado) ${w.offerExpiresAt ? fmtDateTime(w.offerExpiresAt) : ''}` : 'Esperando cupo'}</div>
                    </div>
                    <div className="row">
                      {w.status === 'ofrecida' && <button className="btn small" type="button" onClick={() => { const o = act({ type: 'wait/confirm', id: w.id }, 'Oferta validada: reserva confirmada'); if (!o.ok) setMsg({ tone: 'err', text: o.message }) }} data-testid={`wait-confirm-${w.id}`}>Validar y confirmar</button>}
                      <button className="btn ghost small" type="button" onClick={() => act({ type: 'wait/cancel', id: w.id }, 'Quitado de la lista de espera')}>Quitar</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      <ReasonDialog open={!!cancel} title={`Cancelar ${cancel?.id}`} confirmLabel="Cancelar reserva" body={<p>La mesa se libera una sola vez.</p>} onCancel={() => setCancel(null)} onConfirm={(reason) => { const o = act({ type: 'res/cancel', id: cancel!.id, reason }); setMsg({ tone: o.ok ? 'ok' : 'err', text: o.ok ? `${cancel!.id} cancelada.` : o.message }); setCancel(null) }} />
      <ReasonDialog open={!!review} danger={false} title={`Resolver la revisión de ${review?.id}`} confirmLabel="Resolver y habilitar aceptación" placeholder="¿Qué se confirmó con el cliente?" body={<p>Consulta: “{review?.dietaryNote}”. Esta demo no garantiza ausencia de alérgenos; la revisión es de muestra.</p>} onCancel={() => setReview(null)} onConfirm={(note) => { const o = act({ type: 'res/resolveReview', id: review!.id, note }, 'Revisión resuelta'); setMsg({ tone: o.ok ? 'ok' : 'err', text: o.ok ? `${review!.id} vuelve a “solicitada”: ya se puede aceptar.` : o.message }); setReview(null) }} />
      <AltDialog state={state} r={alt} onClose={() => setAlt(null)} onDone={(t) => setMsg(t)} />
    </>
  )
}

function AltDialog({ state, r, onClose, onDone }: { state: AppState; r: Reservation | null; onClose: () => void; onDone: (m: { tone: 'ok' | 'err'; text: string }) => void }) {
  const alts = r ? alternatives(state, { businessId: r.businessId, locationId: r.locationId, dateKey: r.dateKey, startMin: r.startMin, party: Math.min(r.party, 8), excludeId: r.id }, 5) : []
  const [pick, setPick] = useState<number | null>(null)
  return (
    <ConfirmDialog open={!!r} title={`Ofrecer alternativa a ${r?.id}`} confirmLabel="Ofrecer" confirmDisabled={pick === null} onCancel={onClose} onConfirm={() => { const o = act({ type: 'res/offerAlternative', id: r!.id, startMin: pick }, 'Alternativa ofrecida'); onDone({ tone: o.ok ? 'ok' : 'err', text: o.ok ? `Se ofreció ${hhmm(pick!)} a ${r!.id}.` : o.message }); onClose() }}>
      {alts.length === 0 ? <p className="muted">No hay otro horario con cupo ese día.</p> : (
        <div className="slot-grid">{alts.map((m) => <button key={m} type="button" aria-pressed={pick === m} onClick={() => setPick(m)}>{hhmm(m)}</button>)}</div>
      )}
    </ConfirmDialog>
  )
}
