import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBiz } from '../../ui/hooks'
import { PageHead } from '../../ui/Shell'
import { ErrorText } from '../../ui/kit'
import { SimPanel } from './Simulador'
import { normalize } from '../../domain/core'

export function Ayuda() {
  const { state, biz } = useBiz()
  const nav = useNavigate()
  const [folio, setFolio] = useState('')
  const [err, setErr] = useState('')
  const lookup = () => {
    const m = /^([ro])-?(\d{1,4})$/.exec(normalize(folio).replace(/\s/g, ''))
    if (!m) return setErr('Escribí un folio como O-013 (pedido) o R-019 (reserva).')
    const id = `${m[1].toUpperCase()}-${m[2].padStart(3, '0')}`
    const found = m[1] === 'o' ? state.orders.find((o) => o.id === id && o.businessId === biz.id) : state.reservations.find((r) => r.id === id && r.businessId === biz.id)
    if (!found) return setErr(`No encontramos ${id} en ${biz.name}.`)
    setErr('')
    nav(`/${biz.id}/${m[1] === 'o' ? 'pedido' : 'reservas'}/${id}`)
  }
  return (
    <main>
      <PageHead title="Ayuda" sub="Seguimiento por folio, preguntas frecuentes y simuladores" />
      <div className="grid cols-2">
        <section className="card" aria-labelledby="seg">
          <h2 id="seg">Seguir un pedido o reserva</h2>
          <form onSubmit={(e) => { e.preventDefault(); lookup() }} noValidate>
            <div className="field">
              <label htmlFor="folio">Folio</label>
              <input id="folio" type="text" value={folio} onChange={(e) => setFolio(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'folio-err' : undefined} placeholder="O-013 o R-019" />
              <ErrorText id="folio-err">{err}</ErrorText>
            </div>
            <button className="btn" type="submit">Buscar</button>
          </form>
        </section>
        <section className="card" aria-labelledby="faq">
          <h2 id="faq">Preguntas frecuentes</h2>
          <details><summary>¿Se envían mensajes o se cobra algo de verdad?</summary><p>No. Es una demo local: WhatsApp y llamada son simulaciones, los pagos son “DEMO” y los comprobantes no tienen validez fiscal.</p></details>
          <details><summary>¿Pueden garantizar que un plato no tiene alérgenos?</summary><p>No. Cada plato trae una anotación de muestra del negocio ficticio. Cualquier consulta alimentaria se deriva al equipo para revisión humana.</p></details>
          <details><summary>{biz.reservationsEnabled ? '¿Cómo funciona una reserva?' : '¿Puedo reservar?'}</summary><p>{biz.reservationsEnabled ? 'Enviás una solicitud y el equipo la confirma; ahí recién queda confirmada. La preferencia de sector no está garantizada.' : 'En este perfil atendemos por orden de llegada: no tomamos reservas.'}</p></details>
          <details><summary>¿Dónde veo mi pedido?</summary><p>En <Link to={`/${biz.id}/pedido`}>Mi pedido</Link> o con el folio en este formulario.</p></details>
        </section>
      </div>
      <h2 style={{ marginTop: 20 }}>Simuladores</h2>
      <SimPanel biz={biz.id} guided={false} />
      <p><Link to={`/${biz.id}/simulador`}>Abrir la vista guiada con guion</Link></p>
    </main>
  )
}
