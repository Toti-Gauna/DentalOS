import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../store'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Callout, Empty, ErrorText } from '../../ui/kit'
import { activeSessionAt, billableOrders, sessionBalance, sessionTotal } from '../../domain/sessions'
import { dateKeyOf, hhmm, minutesOfDay } from '../../domain/time'
import { fmtARS } from '../../domain/money'
import type { AppState, Table } from '../../domain/types'

function tableState(state: AppState, t: Table): 'ocupada' | 'reservada' | 'libre' {
  if (activeSessionAt(state, t.id)) return 'ocupada'
  const today = dateKeyOf(state.clock.nowMs)
  const nowMin = minutesOfDay(state.clock.nowMs)
  const res = state.reservations.some((r) => r.tableId === t.id && r.dateKey === today && ['confirmada', 'llegada'].includes(r.status) && r.startMin >= nowMin - 15 && r.startMin <= nowMin + 120)
  return res ? 'reservada' : 'libre'
}

export function AdminSalon() {
  const state = useApp()
  const bizId = state.session.businessId
  const biz = state.businesses.find((b) => b.id === bizId)!
  const locationId = state.session.locationByBusiness[bizId]
  const tables = state.tables.filter((t) => t.locationId === locationId)
  const [view, setView] = useState<'plano' | 'lista'>('plano')
  const [sel, setSel] = useState<string | null>(null)
  const [party, setParty] = useState(2)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [pairWith, setPairWith] = useState('')
  const [moveTo, setMoveTo] = useState('')
  const today = dateKeyOf(state.clock.nowMs)
  const table = tables.find((t) => t.id === sel)
  const ses = table ? activeSessionAt(state, table.id) : undefined
  const arrivals = state.reservations.filter((r) => r.businessId === bizId && r.locationId === locationId && r.dateKey === today && ['confirmada', 'llegada'].includes(r.status))
  const rule = table ? biz.combineRules.find((r) => r.tableIds.includes(table.id)) : undefined
  const free = (excl?: string) => tables.filter((t) => !activeSessionAt(state, t.id) && t.id !== excl)

  const report = (o: ReturnType<typeof act>, okText: string) => setMsg(o.ok ? { tone: 'ok', text: o.message ?? okText } : { tone: 'err', text: o.message })

  const chip = (t: Table) => {
    const st = tableState(state, t)
    const s = activeSessionAt(state, t.id)
    return (
      <button key={t.id} type="button" className="table-chip" data-state={st} aria-pressed={sel === t.id} onClick={() => { setSel(t.id); setMoveTo(''); setPairWith(''); setMsg(null) }} data-testid={`table-${t.id}`} aria-label={`Mesa ${t.label}, ${t.seats} lugares, ${st}`}>
        <strong>{t.label}</strong>
        <span className="small">{t.seats} lugares · {t.sector}</span>
        <span className="badge neutral" style={{ alignSelf: 'flex-start' }}>{st === 'ocupada' ? '● Ocupada' : st === 'reservada' ? '◔ Reservada' : '○ Libre'}</span>
        {s && <span className="small">{s.label}</span>}
      </button>
    )
  }
  return (
    <>
      <PageHead title="Salón" sub={`${biz.name} · ${state.locations.find((l) => l.id === locationId)?.name}`}>
        <div className="row" role="group" aria-label="Vista del salón">
          <button className={`btn small ${view === 'plano' ? '' : 'secondary'}`} type="button" aria-pressed={view === 'plano'} onClick={() => setView('plano')}>Plano</button>
          <button className={`btn small ${view === 'lista' ? '' : 'secondary'}`} type="button" aria-pressed={view === 'lista'} onClick={() => setView('lista')}>Lista</button>
        </div>
      </PageHead>
      {tables.length === 0 ? (
        <Empty title="Esta sede no tiene salón con mesas">Elegí otra sede en la barra de la demo (por ejemplo Ritual Café · Centro).</Empty>
      ) : (
        <div className="grid cols-2" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
          <section aria-label="Mesas">
            {view === 'plano' ? (
              <div className="floor" role="group" aria-label="Plano del salón">{tables.map(chip)}</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <caption className="sr-only">Mesas del salón</caption>
                  <thead><tr><th>Mesa</th><th>Lugares</th><th>Sector</th><th>Estado</th><th>Cuenta</th><th /></tr></thead>
                  <tbody>
                    {tables.map((t) => {
                      const s = activeSessionAt(state, t.id)
                      return (
                        <tr key={t.id}>
                          <td>{t.label}</td><td className="num">{t.seats}</td><td>{t.sector}</td>
                          <td>{tableState(state, t)}</td>
                          <td>{s ? `${s.label} · ${fmtARS(sessionTotal(state, s.id))}` : '—'}</td>
                          <td><button className="btn secondary small" type="button" onClick={() => { setSel(t.id); setMsg(null) }}>Elegir</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <h2 style={{ marginTop: 16 }}>Llegadas y reservas de hoy</h2>
            {arrivals.length === 0 ? <p className="muted">No hay reservas confirmadas para hoy.</p> : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {arrivals.map((r) => (
                  <li key={r.id} className="line" data-testid={`arrival-${r.id}`}>
                    <span><strong>{hhmm(r.startMin)}</strong> {r.alias} · {r.party} pers. · mesa {state.tables.find((t) => t.id === r.tableId)?.label ?? '—'} <Badge tone={r.status === 'llegada' ? 'info' : 'ok'} label={r.status === 'llegada' ? 'Llegó' : 'Confirmada'} /></span>
                    <span className="row">
                      {r.status === 'confirmada' && <button className="btn secondary small" type="button" onClick={() => report(act({ type: 'res/arrive', id: r.id }), 'Llegada registrada')}>Llegó</button>}
                      <button className="btn small" type="button" data-testid={`seat-${r.id}`} onClick={() => report(act({ type: 'salon/seat', reservationId: r.id, tableId: table && !ses && table.seats >= r.party ? table.id : undefined }, `${r.id} sentada`), `${r.id} sentada`)}>
                        Sentar{table && !ses && table.seats >= r.party ? ` en ${table.label}` : ''}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card" aria-labelledby="mesa-h" aria-live="polite">
            <h2 id="mesa-h">{table ? `Mesa ${table.label}` : 'Elegí una mesa'}</h2>
            {msg && <Callout tone={msg.tone === 'ok' ? 'ok' : 'err'} role="alert">{msg.text}</Callout>}
            {!table ? <p className="muted">Tocá una mesa del plano o de la lista para operar.</p> : ses ? (
              <div className="stack">
                <p><Badge tone="err" icon="●" label="Ocupada" /> {ses.label} · {ses.party} pers. · sesión {ses.id}</p>
                <ul>
                  {billableOrders(state, ses.id).map((o) => <li key={o.id}><Link to={`/admin/pedidos/${o.id}`}>{o.id}</Link> · {o.status} · {fmtARS(o.totalCents)}</li>)}
                  {billableOrders(state, ses.id).length === 0 && <li className="muted">Sin pedidos todavía.</li>}
                </ul>
                <p>Total <strong className="money">{fmtARS(sessionTotal(state, ses.id))}</strong> · saldo <strong className="money">{fmtARS(sessionBalance(state, ses.id))}</strong> <Link to="/admin/caja">Ir a caja</Link></p>
                <div className="field">
                  <label htmlFor="moveto">Mover a otra mesa (la cuenta y los ítems se conservan)</label>
                  <select id="moveto" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} data-testid="move-select">
                    <option value="">Elegí destino…</option>
                    {tables.filter((t) => t.id !== table.id).map((t) => <option key={t.id} value={t.id}>{t.label} · {t.seats} lugares · {activeSessionAt(state, t.id) ? 'OCUPADA' : 'libre'}</option>)}
                  </select>
                </div>
                <button className="btn" type="button" disabled={!moveTo} onClick={() => report(act({ type: 'salon/move', sessionId: ses.id, tableId: moveTo }, 'Mesa movida; cuenta conservada'), 'Mesa movida')} data-testid="move-btn">Mover</button>
                <ErrorText>{moveTo && activeSessionAt(state, moveTo) ? 'Esa mesa está ocupada: el movimiento se va a bloquear y la sesión queda intacta.' : ''}</ErrorText>
              </div>
            ) : (
              <div className="stack">
                <p><Badge tone="ok" icon="○" label="Libre" /> {table.seats} lugares · {table.sector}</p>
                <div className="field">
                  <label htmlFor="party">Personas (por orden de llegada)</label>
                  <input id="party" type="number" min={1} max={20} value={party} onChange={(e) => setParty(Number(e.target.value))} data-testid="open-party" />
                </div>
                {rule && (
                  <div className="field">
                    <label htmlFor="pair">Combinar (regla de muestra: {rule.label}, {rule.seats} lugares)</label>
                    <select id="pair" value={pairWith} onChange={(e) => setPairWith(e.target.value)}>
                      <option value="">No combinar</option>
                      {rule.tableIds.filter((x) => x !== table.id).map((x) => <option key={x} value={x}>{tables.find((t) => t.id === x)?.label}</option>)}
                    </select>
                  </div>
                )}
                <button className="btn" type="button" onClick={() => report(act({ type: 'salon/open', businessId: bizId, locationId, tableIds: pairWith ? [table.id, pairWith] : [table.id], party }, 'Mesa abierta'), 'Mesa abierta')} data-testid="open-table">Abrir mesa</button>
                <p className="small muted">Mesas libres compatibles ahora: {free().filter((t) => t.seats >= party).map((t) => t.label).join(', ') || 'ninguna'}.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
