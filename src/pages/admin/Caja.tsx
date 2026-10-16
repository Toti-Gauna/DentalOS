import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../store'
import { useOperation } from '../../ui/hooks'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Callout, ConfirmDialog, DemoTag, Empty, ErrorText, ReasonDialog } from '../../ui/kit'
import { billableLines, sessionBalance, sessionPaid, sessionTotal } from '../../domain/sessions'
import { expectedCash, openCashFor } from '../../domain/cmd-cash'
import { fmtARS, parseARSInput } from '../../domain/money'
import { fmtDateTime } from '../../domain/time'
import type { PaymentSimulation } from '../../domain/types'
import type { Command } from '../../domain/reducer'

export function AdminCaja() {
  const state = useApp()
  const bizId = state.session.businessId
  const locationId = state.session.locationByBusiness[bizId]
  const role = state.session.role
  const loc = state.locations.find((l) => l.id === locationId)!
  const cash = openCashFor(state, locationId)
  const sessions = state.tableSessions.filter((s) => s.locationId === locationId && s.status === 'activa')
  const [selId, setSelId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [floatIn, setFloatIn] = useState('20000')
  const [mov, setMov] = useState({ kind: 'egreso', amount: '', reason: '' })
  const [closeOpen, setCloseOpen] = useState(false)
  const [counted, setCounted] = useState('')
  const [closeReason, setCloseReason] = useState('')
  const [closeErr, setCloseErr] = useState('')
  const [n, setN] = useState(3)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentSimulation['method']>('efectivo')
  const [lines, setLines] = useState<string[]>([])
  const [lastCmd, setLastCmd] = useState<Command | null>(null)
  const [exc, setExc] = useState(false)
  const sel = sessions.find((s) => s.id === selId)
  const getOp = useOperation(`${selId}|${amount}|${method}|${lines.join(',')}`)
  const history = state.cashSessions.filter((c) => c.locationId === locationId && c.status === 'cerrada').sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
  const say = (o: ReturnType<typeof act>, ok: string) => setMsg(o.ok ? { tone: 'ok', text: o.message ?? ok } : { tone: 'err', text: o.message })

  const pay = (cmd: Command) => {
    setLastCmd(cmd)
    say(act(cmd, 'Pago DEMO registrado. No se realizó ningún cargo.'), 'Pago DEMO registrado')
  }
  const payments = sel ? state.payments.filter((p) => p.sessionId === sel.id) : []
  const delivered = state.orders.filter((o) => o.businessId === bizId && o.locationId === locationId && cash && o.createdAt >= cash.openedAt && ['servido', 'retirado', 'cerrado'].includes(o.status)).reduce((a, o) => a + o.totalCents, 0)
  const cashPay = (cash ? state.payments.filter((p) => p.cashSessionId === cash.id && p.status === 'registrado') : [])
  const exp = cash ? expectedCash(state, cash) : 0
  const countedCents = parseARSInput(counted)
  const diff = countedCents === null ? null : countedCents - exp

  return (
    <>
      <PageHead title="Caja" sub={`${loc.name} · pagos DEMO: no se realiza ningún cargo ni hay validez fiscal`} />
      {msg && <Callout tone={msg.tone === 'ok' ? 'ok' : 'err'} role="alert" >{msg.text}</Callout>}
      <div className="grid cols-2">
        <section className="card" aria-labelledby="turno">
          <h2 id="turno">Turno de caja</h2>
          {!cash ? (
            <form onSubmit={(e) => { e.preventDefault(); const c = parseARSInput(floatIn); if (c === null || c < 0) return setMsg({ tone: 'err', text: 'El fondo inicial debe ser un importe válido (ej.: 20000 o 20.000,50).' }); say(act({ type: 'cash/open', businessId: bizId, locationId, openingFloatCents: c }, 'Caja abierta'), 'Caja abierta') }}>
              <p className="muted">No hay una caja abierta en esta sede. Abrila para registrar pagos.</p>
              <div className="field"><label htmlFor="float">Fondo inicial (ARS)</label><input id="float" type="text" inputMode="decimal" value={floatIn} onChange={(e) => setFloatIn(e.target.value)} data-testid="float" /></div>
              <button className="btn" type="submit" data-testid="open-cash">Abrir caja</button>
            </form>
          ) : (
            <div className="stack">
              <p><Badge tone="ok" icon="●" label="Caja abierta" /> {cash.id} desde {fmtDateTime(cash.openedAt)} · fondo <span className="money">{fmtARS(cash.openingFloatCents)}</span></p>
              <dl className="small">
                <dt>Ventas (pedidos entregados en el turno)</dt><dd className="money" data-testid="sales">{fmtARS(delivered)}</dd>
                <dt>Cobros DEMO registrados</dt><dd className="money">{fmtARS(cashPay.reduce((a, p) => a + p.amountCents, 0))}</dd>
                <dt>Efectivo esperado en caja</dt><dd className="money" data-testid="expected">{fmtARS(exp)}</dd>
              </dl>
              <p className="small muted">Ventas, efectivo y diferencia no se confunden: las ventas vienen de los pedidos, el efectivo esperado de fondo + cobros en efectivo + movimientos.</p>
              <ul className="small">{cash.movements.map((m) => <li key={m.id}>{m.kind} · {fmtARS(m.amountCents)} · {m.reason}</li>)}</ul>
              <form className="stack tight" onSubmit={(e) => { e.preventDefault(); const c = parseARSInput(mov.amount); say(act({ type: 'cash/movement', cashSessionId: cash.id, kind: mov.kind, amountCents: c ?? 0, reason: mov.reason }, 'Movimiento registrado'), 'Movimiento registrado'); setMov({ ...mov, amount: '', reason: '' }) }}>
                <h3>Movimiento simulado</h3>
                <div className="row">
                  <select aria-label="Tipo de movimiento" value={mov.kind} onChange={(e) => setMov({ ...mov, kind: e.target.value })}><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select>
                  <input aria-label="Importe" type="text" inputMode="decimal" placeholder="Importe" value={mov.amount} onChange={(e) => setMov({ ...mov, amount: e.target.value })} />
                  <input aria-label="Motivo" type="text" placeholder="Motivo" value={mov.reason} onChange={(e) => setMov({ ...mov, reason: e.target.value })} />
                  <button className="btn secondary small" type="submit">Registrar</button>
                </div>
              </form>
              <button className="btn" type="button" onClick={() => { setCloseOpen(true); setCounted(''); setCloseReason(''); setCloseErr('') }} data-testid="close-cash-open">Cerrar turno (arqueo)</button>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="cuentas">
          <h2 id="cuentas">Cuentas abiertas ({sessions.length})</h2>
          {sessions.length === 0 ? <Empty title="Sin cuentas abiertas">Se abren al sentar una reserva, abrir una mesa o enviar un pedido de retiro.</Empty> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {sessions.map((s) => (
                <li key={s.id} className="line">
                  <span><strong>{s.label}</strong><br /><span className="small">Total <span className="money">{fmtARS(sessionTotal(state, s.id))}</span> · pagado <span className="money">{fmtARS(sessionPaid(state, s.id))}</span> · saldo <strong className="money">{fmtARS(sessionBalance(state, s.id))}</strong></span></span>
                  <button className="btn secondary small" type="button" aria-pressed={selId === s.id} onClick={() => { setSelId(s.id); setMsg(null); setLines([]); setAmount('') }} data-testid={`acct-${s.id}`}>Abrir</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {sel && (
        <section className="card" style={{ marginTop: 14 }} aria-labelledby="cuenta-h" data-testid="account">
          <h2 id="cuenta-h">Cuenta · {sel.label}</h2>
          <div className="grid cols-2">
            <div>
              <h3>Ítems</h3>
              {billableLines(state, sel.id).map(({ order, line, paid }) => (
                <label key={line.id} className="choice">
                  <input type="checkbox" disabled={paid} checked={lines.includes(line.id)} onChange={(e) => setLines((l) => (e.target.checked ? [...l, line.id] : l.filter((x) => x !== line.id)))} />
                  <span className="grow">{line.qty}× {line.name} <span className="muted small">({order.id}{paid ? ' · pagado' : ''})</span></span>
                  <span className="money">{fmtARS(line.lineCents)}</span>
                </label>
              ))}
              <div className="total-row"><span>Total</span><span className="money">{fmtARS(sessionTotal(state, sel.id))}</span></div>
              <div className="total-row"><span>Saldo</span><span className="money" data-testid="balance">{fmtARS(sessionBalance(state, sel.id))}</span></div>
              <Link to="/admin/pedidos" className="small">Ver pedidos</Link>
            </div>
            <div className="stack">
              <div className="field">
                <label htmlFor="method">Medio de pago (simulado)</label>
                <select id="method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option></select>
              </div>
              <div className="stack tight">
                <h3>Dividir en partes iguales</h3>
                {sel.splitPlan ? (
                  <ol data-testid="shares">
                    {sel.splitPlan.shares.map((sh, i) => {
                      const paid = payments.some((p) => p.shareIndex === i && p.status === 'registrado')
                      return (
                        <li key={i}>
                          <span className="money">{fmtARS(sh)}</span> {i === sel.splitPlan!.n - 1 && sh !== sel.splitPlan!.shares[0] ? <Badge tone="info" label="incluye ajuste de centavo" /> : null}
                          {paid ? <Badge tone="ok" icon="✓" label="pagada" /> : <button className="btn small" type="button" data-testid={`pay-share-${i}`} onClick={() => pay({ type: 'pay/register', sessionId: sel.id, operationId: `${getOp()}-s${i}`, amountCents: sh, method, shareIndex: i })}>Cobrar parte {i + 1}</button>}
                        </li>
                      )
                    })}
                  </ol>
                ) : (
                  <div className="row">
                    <input aria-label="Cantidad de partes" type="number" min={2} max={20} value={n} onChange={(e) => setN(Number(e.target.value))} data-testid="split-n" style={{ width: 90 }} />
                    <button className="btn secondary small" type="button" onClick={() => say(act({ type: 'cash/split', sessionId: sel.id, n }, `Cuenta dividida en ${n}`), 'Cuenta dividida')} data-testid="split-btn">Dividir</button>
                  </div>
                )}
              </div>
              <div className="stack tight">
                <h3>Cobrar ítems elegidos o un monto parcial</h3>
                <button className="btn secondary small" type="button" disabled={!lines.length} onClick={() => {
                  const total = billableLines(state, sel.id).filter((x) => lines.includes(x.line.id)).reduce((a, x) => a + x.line.lineCents, 0)
                  pay({ type: 'pay/register', sessionId: sel.id, operationId: getOp(), amountCents: total, method, lineIds: lines })
                  setLines([])
                }} data-testid="pay-items">Cobrar ítems seleccionados</button>
                <div className="row">
                  <input aria-label="Monto parcial (ARS)" type="text" inputMode="decimal" placeholder="Monto parcial" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="pay-amount" />
                  <button className="btn small" type="button" data-testid="pay-btn" onClick={() => { const c = parseARSInput(amount); pay({ type: 'pay/register', sessionId: sel.id, operationId: getOp(), amountCents: c ?? 0, method }); setAmount('') }}>Registrar pago DEMO</button>
                </div>
                {lastCmd && <button className="btn ghost small" type="button" onClick={() => say(act(lastCmd), 'Reintento')} data-testid="pay-retry">Reintentar el último pago (mismo comprobante)</button>}
              </div>
            </div>
          </div>
          <h3 style={{ marginTop: 12 }}>Comprobantes DEMO</h3>
          {payments.length === 0 ? <p className="muted">Sin pagos registrados.</p> : (
            <ul className="small">
              {payments.map((p) => (
                <li key={p.id} data-testid="receipt"><DemoTag>RECIBO DEMO</DemoTag> {p.receiptNo} · {p.method} · <strong className="money">{fmtARS(p.amountCents)}</strong>{p.adjustmentCents ? ` · ajuste de centavo +${fmtARS(p.adjustmentCents)}` : ''} · sin validez fiscal</li>
              ))}
            </ul>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" type="button" onClick={() => say(act({ type: 'session/close', sessionId: sel.id }, 'Cuenta cerrada (simulado)'), 'Cuenta cerrada')} data-testid="close-account">Cerrar cuenta</button>
            {role === 'encargado' && sessionBalance(state, sel.id) > 0 && <button className="btn danger" type="button" onClick={() => setExc(true)} data-testid="close-exception">Cerrar con excepción DEMO</button>}
          </div>
          {role !== 'encargado' && <p className="small muted">Con saldo pendiente solo el encargado puede registrar una excepción autorizada (regla didáctica). No se simula ningún cobro.</p>}
        </section>
      )}

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="hist">
        <h2 id="hist">Turnos cerrados</h2>
        {history.length === 0 ? <p className="muted">Todavía no hay turnos cerrados.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Turno</th><th>Cierre</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Motivo</th></tr></thead>
            <tbody>{history.map((c) => <tr key={c.id}><td>{c.id}</td><td>{c.closedAt ? fmtDateTime(c.closedAt) : ''}</td><td className="money">{fmtARS(c.expectedCashCents ?? 0)}</td><td className="money">{fmtARS(c.countedCashCents ?? 0)}</td><td className="money"><strong>{fmtARS(c.differenceCents ?? 0)}</strong></td><td>{c.closeReason ?? '—'}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>

      <ConfirmDialog open={closeOpen} title="Cerrar turno de caja" confirmLabel="Cerrar turno" onCancel={() => setCloseOpen(false)}
        onConfirm={() => {
          if (countedCents === null) return setCloseErr('Ingresá el efectivo contado (ARS).')
          const o = act({ type: 'cash/close', cashSessionId: cash!.id, countedCashCents: countedCents, reason: closeReason }, 'Turno cerrado')
          if (!o.ok) return setCloseErr(o.message)
          setCloseOpen(false)
          setMsg({ tone: 'ok', text: `Turno cerrado. Diferencia: ${fmtARS((o.data as { diff: number }).diff)}.` })
        }}
        body={<p>Efectivo esperado: <strong className="money">{fmtARS(exp)}</strong> (fondo + cobros en efectivo + movimientos). La tarjeta y la transferencia no cuentan como efectivo.</p>}>
        <div className="field"><label htmlFor="counted">Efectivo contado (ARS)</label><input id="counted" type="text" inputMode="decimal" value={counted} onChange={(e) => { setCounted(e.target.value); setCloseErr('') }} data-testid="counted" /></div>
        {diff !== null && <p className={diff === 0 ? 'ok-text' : 'error-text'} data-testid="diff">Diferencia: {fmtARS(diff)}</p>}
        <div className="field"><label htmlFor="creason">Motivo de la diferencia {diff ? '(obligatorio)' : '(opcional)'}</label><input id="creason" type="text" value={closeReason} onChange={(e) => { setCloseReason(e.target.value); setCloseErr('') }} data-testid="close-reason" /></div>
        <ErrorText>{closeErr}</ErrorText>
      </ConfirmDialog>
      <ReasonDialog open={exc} title="Cerrar con saldo pendiente (excepción DEMO)" confirmLabel="Registrar excepción y cerrar" body={<p>Saldo pendiente: <strong className="money">{sel ? fmtARS(sessionBalance(state, sel.id)) : ''}</strong>. Queda auditado; <strong>no se simula ningún cobro</strong>.</p>} onCancel={() => setExc(false)} onConfirm={(reason) => { say(act({ type: 'session/close', sessionId: sel!.id, exception: { reason } }, 'Cuenta cerrada con excepción DEMO'), 'Cuenta cerrada con excepción'); setExc(false) }} />
    </>
  )
}
