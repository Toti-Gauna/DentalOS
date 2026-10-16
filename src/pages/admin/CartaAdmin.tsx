import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../store'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Callout, ConfirmDialog, ErrorText } from '../../ui/kit'
import { categoriesOf, itemUnavailable, menuFor, UNAVAILABLE_TEXT } from '../../domain/menu'
import { fmtARS, parseARSInput } from '../../domain/money'
import { fmtDateTime } from '../../domain/time'
import type { MenuItem } from '../../domain/types'

const ALLERGENS = ['gluten', 'lácteos', 'huevo', 'frutos secos', 'pescado', 'sulfitos']

export function AdminCarta() {
  const state = useApp()
  const bizId = state.session.businessId
  const biz = state.businesses.find((b) => b.id === bizId)!
  const items = menuFor(state, bizId)
  const cats = [...biz.categoryOrder.filter((c) => categoriesOf(items).includes(c)), ...categoriesOf(items).filter((c) => !biz.categoryOrder.includes(c))]
  const [edit, setEdit] = useState<MenuItem | null>(null)
  const [f, setF] = useState({ name: '', description: '', price: '', maxQty: '6', noteStatus: 'completa', allergens: [] as string[], note: '', noDeclared: false })
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [hist, setHist] = useState<MenuItem | null>(null)

  const open = (m: MenuItem) => {
    setEdit(m)
    setErrs({})
    setF({ name: m.name, description: m.description, price: String(m.priceCents / 100).replace('.', ','), maxQty: String(m.maxQty), noteStatus: m.foodNote.status, allergens: m.foodNote.allergens, note: m.foodNote.note, noDeclared: m.foodNote.status === 'completa' && m.foodNote.allergens.length === 0 })
  }
  const save = () => {
    if (!edit) return
    const cents = parseARSInput(f.price)
    const e: Record<string, string> = {}
    if (cents === null) e.priceCents = 'El precio no es un importe válido.'
    else if (cents < 0) e.priceCents = 'El precio no puede ser menor a cero.'
    const declared = f.allergens.length > 0 || f.noDeclared
    const patch = {
      name: f.name,
      description: f.description,
      priceCents: cents ?? NaN,
      maxQty: Number(f.maxQty),
      foodNote: { status: declared ? ('completa' as const) : ('pendiente' as const), allergens: f.allergens, note: declared ? f.note || 'Anotación de muestra aportada por el negocio ficticio.' : '' },
    }
    const o = act({ type: 'menu/update', itemId: edit.id, patch, expectedVersion: edit.version }, `${edit.name} guardado`)
    if (!o.ok) {
      const de = ((o.data as { errors?: Record<string, string> } | undefined)?.errors ?? {}) as Record<string, string>
      setErrs({ ...e, ...de, ...(Object.keys(de).length || Object.keys(e).length ? {} : { _form: o.message }) })
      return
    }
    setEdit(null)
    setMsg({ tone: 'ok', text: `${edit.name} guardado: el cambio ya se ve en la carta del cliente y en el carrito, sin recargar.` })
  }
  return (
    <>
      <PageHead title="Carta" sub={`${biz.name} · los cambios aplican sin recargar y quedan en el historial`}>
        <Link className="btn secondary" to={`/${bizId}/carta`}>Vista previa del cliente</Link>
      </PageHead>
      {msg && <Callout tone={msg.tone === 'ok' ? 'ok' : 'err'} role="alert">{msg.text}</Callout>}
      <section className="card" style={{ marginBottom: 12 }} aria-labelledby="orden">
        <h2 id="orden">Orden de categorías</h2>
        <ol>
          {biz.categoryOrder.map((c, i) => (
            <li key={c}>{c}{' '}
              <button className="btn ghost small" type="button" disabled={i === 0} onClick={() => act({ type: 'menu/moveCategory', businessId: bizId, category: c, dir: 'up' })} aria-label={`Subir ${c}`}>↑</button>
              <button className="btn ghost small" type="button" disabled={i === biz.categoryOrder.length - 1} onClick={() => act({ type: 'menu/moveCategory', businessId: bizId, category: c, dir: 'down' })} aria-label={`Bajar ${c}`}>↓</button>
            </li>
          ))}
        </ol>
      </section>
      {cats.map((c) => (
        <section key={c} className="card" style={{ marginBottom: 12 }} aria-labelledby={`c-${c}`}>
          <h2 id={`c-${c}`}>{c}</h2>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">{c}</caption>
              <thead><tr><th>Plato</th><th>Precio</th><th>Disponibilidad</th><th>Alimentos</th><th>Versión</th><th /></tr></thead>
              <tbody>
                {items.filter((m) => m.category === c).map((m) => {
                  const un = itemUnavailable(state, m)
                  return (
                    <tr key={m.id} data-testid={`menu-row-${m.id}`}>
                      <td><strong>{m.name}</strong><div className="small muted">{m.id}</div></td>
                      <td className="money">{fmtARS(m.priceCents)}</td>
                      <td>{un ? <Badge tone="err" icon="✕" label={un === 'agotado' ? 'Agotado (manual)' : UNAVAILABLE_TEXT[un]} /> : <Badge tone="ok" icon="✓" label="Disponible" />}</td>
                      <td>{m.foodNote.status === 'completa' ? <span className="small">{m.foodNote.allergens.join(', ') || 'sin alérgenos declarados'}</span> : <Badge tone="warn" icon="⚑" label="Nota incompleta" />}</td>
                      <td className="num">v{m.version}</td>
                      <td className="row">
                        <button className="btn secondary small" type="button" onClick={() => open(m)} data-testid={`edit-${m.id}`}>Editar</button>
                        <button className="btn secondary small" type="button" onClick={() => act({ type: 'menu/update', itemId: m.id, patch: { soldOut: !m.soldOut } }, m.soldOut ? `${m.name} repuesto` : `${m.name} agotado`)} data-testid={`toggle-${m.id}`}>{m.soldOut ? 'Reponer' : 'Agotar'}</button>
                        <button className="btn ghost small" type="button" onClick={() => setHist(m)}>Historial</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <ConfirmDialog open={!!edit} title={`Editar ${edit?.name ?? ''}`} confirmLabel="Guardar cambios" onCancel={() => setEdit(null)} onConfirm={save}>
        <div className="field"><label htmlFor="e-name">Nombre</label><input id="e-name" type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-invalid={!!errs.name} /><ErrorText>{errs.name}</ErrorText></div>
        <div className="field"><label htmlFor="e-desc">Descripción</label><input id="e-desc" type="text" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="field"><label htmlFor="e-price">Precio (ARS)</label><input id="e-price" type="text" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} aria-invalid={!!errs.priceCents} aria-describedby="e-price-err" data-testid="edit-price" /><ErrorText id="e-price-err">{errs.priceCents}</ErrorText></div>
        <div className="field"><label htmlFor="e-max">Cantidad máxima por pedido</label><input id="e-max" type="number" min={1} value={f.maxQty} onChange={(e) => setF({ ...f, maxQty: e.target.value })} /><ErrorText>{errs.maxQty}</ErrorText></div>
        <fieldset className={errs.foodNote ? 'invalid' : ''}>
          <legend>Anotación alimentaria (muestra)</legend>
          {ALLERGENS.map((a) => (
            <label key={a} className="choice"><input type="checkbox" checked={f.allergens.includes(a)} onChange={(e) => setF({ ...f, noDeclared: false, allergens: e.target.checked ? [...f.allergens, a] : f.allergens.filter((x) => x !== a) })} /> Contiene {a}</label>
          ))}
          <label className="choice"><input type="checkbox" checked={f.noDeclared} onChange={(e) => setF({ ...f, noDeclared: e.target.checked, allergens: e.target.checked ? [] : f.allergens })} /> Sin alérgenos declarados</label>
          <ErrorText>{errs.foodNote}</ErrorText>
        </fieldset>
        <ErrorText>{errs._form}</ErrorText>
      </ConfirmDialog>
      <ConfirmDialog open={!!hist} title={`Historial de ${hist?.name ?? ''}`} confirmLabel="Cerrar" cancelLabel="Cerrar" onCancel={() => setHist(null)} onConfirm={() => setHist(null)}>
        {hist && hist.history.length === 0 ? <p className="muted">Sin cambios desde el seed.</p> : <ul>{hist?.history.map((h) => <li key={h.version}>v{h.version} · {fmtDateTime(h.at)} · {h.summary}</li>)}</ul>}
      </ConfirmDialog>
    </>
  )
}
