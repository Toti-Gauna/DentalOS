import { useState } from 'react'
import { useApp } from '../../store'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Callout, ConfirmDialog, ErrorText } from '../../ui/kit'
import { available, itemNeeds } from '../../domain/stock'
import { fmtDateTime } from '../../domain/time'
import type { Ingredient } from '../../domain/types'
import type { Unit } from '../../domain/units'

const UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'u']

export function AdminStock() {
  const state = useApp()
  const bizId = state.session.businessId
  const ings = state.ingredients.filter((i) => i.businessId === bizId)
  const recipes = state.recipes.filter((r) => r.businessId === bizId)
  const [dlg, setDlg] = useState<{ ing: Ingredient; mode: 'restock' | 'adjust' } | null>(null)
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const mvs = state.stockMovements.filter((m) => m.businessId === bizId).slice(-14).reverse()
  const tasks = state.tasks.filter((t) => t.businessId === bizId && t.status === 'pendiente' && (t.kind === 'stock' || t.kind === 'receta-unidad'))

  const submit = () => {
    if (!dlg) return
    const n = Number(val.replace(',', '.'))
    if (!Number.isFinite(n) || !Number.isInteger(n)) return setErr('Ingresá un número entero en unidades base.')
    const o = dlg.mode === 'restock' ? act({ type: 'stock/restock', ingredientId: dlg.ing.id, qty: n }, `Reposición de ${dlg.ing.name} registrada`) : act({ type: 'stock/adjust', ingredientId: dlg.ing.id, delta: n, note: 'Ajuste manual' }, 'Ajuste registrado')
    if (!o.ok) return setErr(o.message)
    setDlg(null)
    setMsg({ tone: 'ok', text: dlg.mode === 'restock' ? `${dlg.ing.name}: stock repuesto. La carta y los carritos se revalidan con el stock actual.` : 'Ajuste registrado.' })
  }
  return (
    <>
      <PageHead title="Stock" sub="Insumos, reservas por pedidos aceptados y recetas simples" />
      {msg && <Callout tone={msg.tone === 'ok' ? 'ok' : 'err'} role="alert">{msg.text}</Callout>}
      {tasks.length > 0 && <Callout tone="warn">Hay {tasks.length} tarea(s) de stock/recetas pendientes en el Resumen.</Callout>}
      <section className="card" aria-labelledby="ins">
        <h2 id="ins">Insumos</h2>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Insumos</caption>
            <thead><tr><th>Insumo</th><th>En mano</th><th>Reservado</th><th>Disponible</th><th>Umbral</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {ings.map((i) => (
                <tr key={i.id} data-testid={`ing-${i.id}`}>
                  <td>{i.name}<div className="small muted">{i.id}</div></td>
                  <td className="num">{i.onHand} {i.unit}</td><td className="num">{i.reserved}</td><td className="num"><strong>{available(i)}</strong></td><td className="num">{i.lowThreshold}</td>
                  <td>{i.alertState === 'ok' ? <Badge tone="ok" icon="✓" label="OK" /> : i.alertState === 'bajo' ? <Badge tone="warn" icon="▼" label="Bajo" /> : <Badge tone="err" icon="✕" label="Agotado" />}</td>
                  <td className="row">
                    <button className="btn small" type="button" onClick={() => { setDlg({ ing: i, mode: 'restock' }); setVal(''); setErr('') }} data-testid={`restock-${i.id}`}>Reponer</button>
                    <button className="btn secondary small" type="button" onClick={() => { setDlg({ ing: i, mode: 'adjust' }); setVal(''); setErr('') }}>Ajustar / merma</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <section className="card" aria-labelledby="rec">
          <h2 id="rec">Recetas</h2>
          <p className="small muted">Los platos sin receta no controlan stock (alcance de muestra).</p>
          {recipes.map((r) => {
            const item = state.menuItems.find((m) => m.id === r.itemId)!
            const { invalid } = itemNeeds(state, item)
            return (
              <div key={r.id} className="stack tight" style={{ marginBottom: 8 }}>
                <strong>{item.name}</strong> {invalid.length > 0 && <Badge tone="err" icon="⚠" label="Unidad incompatible" />}
                {r.lines.map((l) => {
                  const ing = state.ingredients.find((i) => i.id === l.ingredientId)!
                  const bad = invalid.some((x) => x.ingredientId === ing.id)
                  return (
                    <div className="row" key={l.ingredientId}>
                      <span>{ing.name} ({ing.unit}): {l.qty}</span>
                      <label className="sr-only" htmlFor={`u-${r.id}-${ing.id}`}>Unidad de {ing.name} en {item.name}</label>
                      <select id={`u-${r.id}-${ing.id}`} value={l.unit} aria-invalid={bad} onChange={(e) => act({ type: 'stock/recipeUnit', recipeId: r.id, ingredientId: ing.id, unit: e.target.value }, 'Unidad de receta actualizada')}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      {bad && <ErrorText>Esa unidad no es compatible con {ing.unit}.</ErrorText>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </section>
        <section className="card" aria-labelledby="movs">
          <h2 id="movs">Últimos movimientos</h2>
          <ul className="small" style={{ paddingLeft: 16 }}>
            {mvs.map((m) => (
              <li key={m.id}>
                {fmtDateTime(m.createdAt)} · <strong>{m.kind}</strong> · {state.ingredients.find((i) => i.id === m.ingredientId)?.name} · {m.deltaOnHand ? `stock ${m.deltaOnHand > 0 ? '+' : ''}${m.deltaOnHand}` : ''} {m.deltaReserved ? `reserva ${m.deltaReserved > 0 ? '+' : ''}${m.deltaReserved}` : ''}
                <div className="muted">clave {m.eventKey}</div>
                <button className="btn ghost small" type="button" onClick={() => { const o = act({ type: 'stock/replay', movementId: m.id }); setMsg({ tone: o.ok ? 'ok' : 'err', text: o.message ?? 'Evento repetido ignorado.' }) }}>Reintentar este evento</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <ConfirmDialog open={!!dlg} title={dlg ? `${dlg.mode === 'restock' ? 'Reponer' : 'Ajustar'} ${dlg.ing.name}` : ''} confirmLabel={dlg?.mode === 'restock' ? 'Registrar reposición' : 'Registrar ajuste'} onCancel={() => setDlg(null)} onConfirm={submit}
        body={<p className="muted">Cantidad en {dlg?.ing.unit}. {dlg?.mode === 'adjust' ? 'Usá un número negativo para merma o descuento.' : 'Reposición ficticia: no genera compra ni pedido a proveedores.'}</p>}>
        <div className="field"><label htmlFor="stock-val">{dlg?.mode === 'restock' ? 'Cantidad a reponer' : 'Cantidad (±)'}</label><input id="stock-val" type="text" inputMode="numeric" value={val} onChange={(e) => { setVal(e.target.value); setErr('') }} data-testid="stock-val" aria-invalid={!!err} aria-describedby="stock-err" /><ErrorText id="stock-err">{err}</ErrorText></div>
      </ConfirmDialog>
    </>
  )
}
