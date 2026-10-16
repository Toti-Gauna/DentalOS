import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useBiz, useCart } from '../../ui/hooks'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Callout, Dialog, Empty, ErrorText } from '../../ui/kit'
import { categoriesOf, checkLine, groupsOf, itemUnavailable, menuFor, searchItems, UNAVAILABLE_TEXT } from '../../domain/menu'
import { optionStockOk } from '../../domain/stock'
import { fmtARS } from '../../domain/money'
import { setPrefs, useSnapshot } from '../../store'
import type { AppState, MenuItem } from '../../domain/types'

export function MiniCart({ biz, locationId, state }: { biz: string; locationId: string; state: AppState }) {
  const { cart, total } = useCart(state, biz as never, locationId)
  if (!cart || !cart.lines.length) {
    return <p className="muted">Tu pedido está vacío. Elegí un plato de la carta.</p>
  }
  return (
    <div>
      {cart.lines.map((l) => {
        const it = state.menuItems.find((m) => m.id === l.itemId)!
        const chk = checkLine(state, it, l.selections, l.qty)
        return (
          <div className="line" key={l.id}>
            <div>
              <strong>{l.qty}× {it.name}</strong>
              <div className="opts">{chk.picked.map((p) => p.optionName).join(' · ')}</div>
            </div>
            <span className="money">{fmtARS(chk.unitCents * l.qty)}</span>
          </div>
        )
      })}
      <div className="total-row"><span>Total</span><span className="money">{fmtARS(total)}</span></div>
      <Link className="btn" style={{ marginTop: 10, width: '100%' }} to={`/${biz}/pedido`}>Revisar y enviar</Link>
    </div>
  )
}

export function Carta() {
  const { state, biz, locationId } = useBiz()
  const { prefs } = useSnapshot()
  const { itemId } = useParams()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [onlyAvail, setOnlyAvail] = useState(false)
  const [veg, setVeg] = useState(false)
  const [favOnly, setFavOnly] = useState(false)
  const loc = state.locations.find((l) => l.id === locationId)!
  const all = menuFor(state, biz.id, locationId)
  const items = useMemo(() => {
    let r = searchItems(state, all, q)
    if (onlyAvail) r = r.filter((i) => !itemUnavailable(state, i, locationId))
    if (veg) r = r.filter((i) => i.tags.includes('vegetariano'))
    if (favOnly) r = r.filter((i) => prefs.favorites.includes(i.id))
    return r
  }, [state, all, q, onlyAvail, veg, favOnly, prefs.favorites, locationId])
  const cats = [...biz.categoryOrder.filter((c) => categoriesOf(all).includes(c)), ...categoriesOf(all).filter((c) => !biz.categoryOrder.includes(c))]
  const [cat, setCat] = useState<string | null>(null)
  const filtered = cats.map((c) => ({ c, list: items.filter((i) => i.category === c) })).filter((g) => g.list.length && (!cat || g.c === cat))
  const hiddenElsewhere = menuFor(state, biz.id).length - all.length
  const selected = itemId ? state.menuItems.find((m) => m.id === itemId && m.businessId === biz.id) : undefined
  const saved = state.passports.find((p) => p.businessId === biz.id && p.customerId === (state.session.customerByBusiness[biz.id] ?? null))?.savedPreference

  const clear = () => {
    setQ('')
    setOnlyAvail(false)
    setVeg(false)
    setFavOnly(false)
    setCat(null)
  }
  const toggleFav = (id: string) => setPrefs({ favorites: prefs.favorites.includes(id) ? prefs.favorites.filter((x) => x !== id) : [...prefs.favorites, id] })

  return (
    <main>
      <PageHead title="Carta" sub={`${loc.name} · precios en ARS ficticios`} />
      {hiddenElsewhere > 0 && <Callout>En esta sede no se sirven {hiddenElsewhere} plato(s) que sí están en otra. Cambiá la sede en la barra de la demo para verlos.</Callout>}
      <div className="menu-layout" style={{ marginTop: 12 }}>
        <nav aria-label="Categorías" className="cat-nav">
          <button type="button" aria-current={cat === null} onClick={() => setCat(null)}>Todas</button>
          {cats.map((c) => (
            <button key={c} type="button" aria-current={cat === c} onClick={() => setCat(c)}>{c}</button>
          ))}
        </nav>
        <div>
          <form role="search" aria-label="Buscar en la carta" onSubmit={(e) => e.preventDefault()} className="stack">
            <div className="field">
              <label htmlFor="q">Buscar un plato</label>
              <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej.: pasta, milanesa, flat white" data-testid="menu-search" />
            </div>
            <div className="row">
              <label className="choice"><input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} /> Solo disponibles</label>
              <label className="choice"><input type="checkbox" checked={veg} onChange={(e) => setVeg(e.target.checked)} /> Vegetarianos</label>
              <label className="choice"><input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} /> Mis favoritas</label>
              <button type="button" className="btn ghost small" onClick={clear}>Limpiar filtros</button>
            </div>
          </form>
          <p className="sr-only" role="status" aria-live="polite">{items.length} resultado(s)</p>
          {items.length === 0 ? (
            <Empty title="No encontramos platos con esos filtros" action={<button className="btn" type="button" onClick={clear} data-testid="clear-filters">Limpiar filtros</button>}>
              Probá con otra palabra o quitá algún filtro. La carta completa sigue intacta.
            </Empty>
          ) : (
            filtered.map(({ c, list }) => (
              <section key={c} className="menu-cat" aria-labelledby={`cat-${c}`}>
                <h2 id={`cat-${c}`}>{c}</h2>
                {list.map((i) => (
                  <Dish key={i.id} item={i} state={state} locationId={locationId} fav={prefs.favorites.includes(i.id)} onFav={() => toggleFav(i.id)} saved={saved === i.id} biz={biz.id} />
                ))}
              </section>
            ))
          )}
        </div>
        <aside className="side-cart side-cart-desktop" aria-label="Tu pedido">
          <div className="card">
            <h2>Tu pedido</h2>
            <MiniCart biz={biz.id} locationId={locationId} state={state} />
          </div>
        </aside>
      </div>
      <ItemDialog item={selected} biz={biz.id} locationId={locationId} state={state} onClose={() => nav(`/${biz.id}/carta`)} />
    </main>
  )
}

function Dish({ item, state, locationId, fav, onFav, saved, biz }: { item: MenuItem; state: AppState; locationId: string; fav: boolean; onFav: () => void; saved: boolean; biz: string }) {
  const un = itemUnavailable(state, item, locationId)
  const note = item.foodNote
  return (
    <article className={`dish ${un ? 'is-off' : ''}`} data-testid={`dish-${item.id}`}>
      <div className="thumb" role="img" aria-label={`Sin foto de muestra de ${item.name}`}>
        {item.name.slice(0, 1)}
      </div>
      <div>
        <h3>{item.name}</h3>
        <p className="muted" style={{ margin: 0 }}>{item.description}</p>
        <div className="tags">
          {un ? <Badge tone="err" icon="✕" label={un === 'fuera-de-franja' ? 'Fuera de su franja' : 'Agotado'} /> : null}
          {saved && <Badge tone="info" icon="★" label="Tu selección del pasaporte" />}
          {item.tags.includes('vegetariano') && <Badge tone="ok" label="Vegetariano" />}
          {item.hours && <Badge tone="neutral" label="Solo al mediodía" />}
          {note.status === 'completa' ? (
            <Badge tone="neutral" label={note.allergens.length ? `Contiene (muestra): ${note.allergens.join(', ')}` : 'Sin alérgenos declarados (muestra)'} />
          ) : (
            <Badge tone="warn" icon="⚑" label="Consultar al equipo por alérgenos" />
          )}
        </div>
        {un && <p className="small muted">{UNAVAILABLE_TEXT[un]}. {alternativesText(state, item, locationId)}</p>}
      </div>
      <div className="stack tight" style={{ alignItems: 'flex-end' }}>
        <span className="price money">{fmtARS(item.priceCents)}</span>
        <Link className={`btn ${un ? 'secondary' : ''} small`} to={`/${biz}/carta/${item.id}`} data-testid={`open-${item.id}`}>
          {un ? 'Ver detalle' : 'Elegir'}
        </Link>
        <button type="button" className="btn ghost small" aria-pressed={fav} onClick={onFav} aria-label={`${fav ? 'Quitar de favoritas' : 'Marcar favorita'}: ${item.name}`}>
          {fav ? '♥ Favorita' : '♡ Favorita'}
        </button>
      </div>
    </article>
  )
}

function alternativesText(state: AppState, item: MenuItem, locationId: string) {
  const alts = state.menuItems.filter((m) => m.businessId === item.businessId && m.category === item.category && m.id !== item.id && !itemUnavailable(state, m, locationId)).slice(0, 3)
  return alts.length ? `Alternativas de la misma categoría: ${alts.map((a) => a.name).join(', ')}.` : ''
}

function ItemDialog({ item, biz, locationId, state, onClose }: { item?: MenuItem; biz: string; locationId: string; state: AppState; onClose: () => void }) {
  const [sel, setSel] = useState<Record<string, string[]>>({})
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [key, setKey] = useState<string | undefined>(undefined)
  if (item?.id !== key) {
    // reinicia el formulario al abrir otro plato
    setKey(item?.id)
    setSel({})
    setQty(1)
    setNote('')
    setErrors({})
  }
  const nav = useNavigate()
  if (!item) return <Dialog open={false} onClose={onClose} title="Plato"><span /></Dialog>
  const un = itemUnavailable(state, item, locationId)
  const groups = groupsOf(state, item)
  const chk = checkLine(state, item, sel, qty)
  const toggle = (gid: string, oid: string, max: number) => {
    setErrors((e) => ({ ...e, [gid]: '' }))
    setSel((s) => {
      const cur = s[gid] ?? []
      if (max === 1) return { ...s, [gid]: [oid] }
      return { ...s, [gid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] }
    })
  }
  const add = () => {
    const o = act({ type: 'cart/add', businessId: biz, locationId, itemId: item.id, qty, selections: sel, note }, `${item.name} agregado al pedido`)
    if (!o.ok) {
      const errs = ((o.data as { errors?: Record<string, string> } | undefined)?.errors ?? {}) as Record<string, string>
      setErrors(Object.keys(errs).length ? errs : { _item: o.message })
      const first = Object.keys(errs)[0]
      if (first) document.getElementById(`grp-${first}`)?.focus()
      return
    }
    onClose()
  }
  return (
    <Dialog open onClose={onClose} title={item.name} testId="item-dialog">
      <p className="muted">{item.description}</p>
      {un ? (
        <Callout tone="warn" role="alert">
          {UNAVAILABLE_TEXT[un]}. {alternativesText(state, item, locationId)}
        </Callout>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          noValidate
        >
          {groups.map((g) => {
            const err = errors[g.id] || (chk.errors[g.id] && Object.keys(errors).length ? chk.errors[g.id] : '')
            return (
              <fieldset key={g.id} className={err ? 'invalid' : ''} id={`grp-${g.id}`} tabIndex={-1} aria-describedby={err ? `err-${g.id}` : undefined}>
                <legend>
                  {g.name} {g.required ? <span className="muted">(obligatorio)</span> : <span className="muted">(opcional)</span>}
                </legend>
                {g.options.map((o) => {
                  const stockOk = optionStockOk(state, o)
                  const checked = (sel[g.id] ?? []).includes(o.id)
                  return (
                    <label key={o.id} className="choice">
                      <input
                        type={g.max === 1 ? 'radio' : 'checkbox'}
                        name={g.id}
                        checked={checked}
                        disabled={!stockOk}
                        onChange={() => toggle(g.id, o.id, g.max)}
                      />
                      <span className="grow">{o.name}{!stockOk && ' · sin stock'}</span>
                      {o.deltaCents > 0 && <span className="money">+ {fmtARS(o.deltaCents)}</span>}
                    </label>
                  )
                })}
                {g.max > 1 && <p className="hint muted small">Podés elegir hasta {g.max}.</p>}
                {g.max === 1 && !g.required && <p className="hint muted small">Hasta 1 opción.</p>}
                <ErrorText id={`err-${g.id}`}>{err}</ErrorText>
              </fieldset>
            )
          })}
          <div className="field">
            <label htmlFor="note">Nota para la cocina (opcional)</label>
            <input id="note" type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
            <span className="hint">Una alergia no se resuelve con una nota: consultá al equipo. La demo no garantiza ausencia de alérgenos.</span>
          </div>
          <div className="row between">
            <div className="qty" role="group" aria-label="Cantidad">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">−</button>
              <output aria-live="polite" data-testid="qty">{qty}</output>
              <button type="button" onClick={() => setQty((q) => Math.min(item.maxQty, q + 1))} aria-label="Más">+</button>
            </div>
            <strong className="money" data-testid="subtotal">{fmtARS(chk.unitCents * qty)}</strong>
          </div>
          <ErrorText>{errors._item || errors._qty}</ErrorText>
          <div className="dialog-actions">
            <button type="button" className="btn secondary" onClick={onClose}>Cerrar</button>
            <button type="submit" className="btn" data-testid="add-to-cart">Agregar al pedido</button>
          </div>
        </form>
      )}
      {un && (
        <div className="dialog-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cerrar</button>
          <button type="button" className="btn" onClick={() => nav(`/${biz}/carta`)}>Volver a la carta</button>
        </div>
      )}
    </Dialog>
  )
}
