import { Link } from 'react-router-dom'
import { PageHead } from '../ui/Shell'
import { act, DemoTag } from '../ui/kit'
import { useApp } from '../store'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_ADMIN } from '../ui/format'
import type { Role } from '../domain/types'

export function Landing() {
  const state = useApp()
  const nav = useNavigate()
  const goStaff = (role: Role) => {
    act({ type: 'session/setRole', role })
    nav(`/admin/${DEFAULT_ADMIN[role]}`)
  }
  return (
    <main className="wrap">
      <PageHead title="TableFlow · demo de gestión gastronómica" sub="Dos negocios ficticios, todos los módulos, datos locales." />
      <p className="lead" style={{ maxWidth: '68ch' }}>
        Recorré la experiencia del comensal y la operación de recepción, salón, cocina/barra, caja y encargado con acciones reales sobre un estado local. Nada sale de este navegador: no hay backend, pagos, mensajes ni llamadas reales. <DemoTag />
      </p>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        {state.businesses.map((b) => (
          <section key={b.id} className="card" aria-labelledby={`b-${b.id}`}>
            <h2 id={`b-${b.id}`}>{b.name}</h2>
            <p>{b.tagline}</p>
            <p className="muted small">{b.story}</p>
            <div className="row">
              <Link className="btn" to={`/${b.id}`} onClick={() => act({ type: 'session/setBusiness', businessId: b.id })}>Entrar como cliente</Link>
              <Link className="btn secondary" to={`/${b.id}/carta`} onClick={() => act({ type: 'session/setBusiness', businessId: b.id })}>Ver la carta</Link>
            </div>
          </section>
        ))}
      </div>
      <section className="card" style={{ marginTop: 16 }} aria-labelledby="staff">
        <h2 id="staff">Vistas de personal (didácticas, sin permisos reales)</h2>
        <div className="row">
          {(['recepcion', 'mozo', 'cocina', 'caja', 'encargado'] as Role[]).map((r) => (
            <button key={r} className="btn secondary" type="button" onClick={() => goStaff(r)}>
              {{ recepcion: 'Recepción', mozo: 'Mozo', cocina: 'Cocina / barra', caja: 'Caja', encargado: 'Encargado' }[r as 'recepcion']}
            </button>
          ))}
        </div>
      </section>
      <p style={{ marginTop: 16 }}>
        <Link to="/comercial">Qué muestra esta demo y cómo se contrata (alcance comercial)</Link> · <Link to="/simulador">Simulador de WhatsApp y llamada</Link>
      </p>
    </main>
  )
}
