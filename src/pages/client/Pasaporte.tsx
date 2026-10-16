import { Link } from 'react-router-dom'
import { useBiz } from '../../ui/hooks'
import { PageHead } from '../../ui/Shell'
import { Badge, Callout } from '../../ui/kit'
import { getPassport, stampsOf } from '../../domain/cmd-engage'
import { STAMPS_FOR_BADGE } from '../../domain/content'
import { fmtDateShort } from '../../domain/time'

export function Pasaporte() {
  const { state, biz } = useBiz()
  const customerId = state.session.customerByBusiness[biz.id] ?? null
  const customer = state.customers.find((c) => c.id === customerId)
  const pass = getPassport(state, biz.id, customerId)
  const visits = customer ? state.visits.filter((v) => v.customerId === customer.id) : []
  const stamps = customer ? stampsOf(state, customer.id) : 0
  const saved = pass?.savedPreference ? state.menuItems.find((m) => m.id === pass.savedPreference) : undefined
  return (
    <main>
      <PageHead title="Mi pasaporte" sub="Exploración + sellos de visita (de muestra)" />
      <div className="grid cols-2">
        <section className="card" aria-labelledby="expl">
          <h2 id="expl">Exploración de sabores</h2>
          <p>Estado: <Badge tone="info" label={pass ? pass.badge.replace('-', ' ') : 'sin empezar'} /></p>
          <p>Tarjetas: {pass ? Object.values(pass.cards).filter((c) => c.done).length : 0} de 3.</p>
          {saved ? <p>Tu selección guardada: <Link to={`/${biz.id}/carta/${saved.id}`}>{saved.name}</Link></p> : <p className="muted">Todavía no guardaste una selección.</p>}
          <Link className="btn" to={`/${biz.id}/explorar`}>Seguir explorando</Link>
          {pass && <p className="small muted" style={{ marginTop: 10 }}>Métricas locales: inicio {pass.metrics.started} · completado {pass.metrics.completed} · guardado {pass.metrics.saved} · usado en el carrito {pass.metrics.usedInCart}. No se cuentan como ventas.</p>}
        </section>
        <section className="card" aria-labelledby="sellos">
          <h2 id="sellos">Sellos de visita</h2>
          {customer ? (
            <>
              <p><strong data-testid="stamps">{stamps}</strong> de {STAMPS_FOR_BADGE} sellos {stamps >= STAMPS_FOR_BADGE && <Badge tone="ok" icon="★" label="Insignia de fidelidad" />}</p>
              <div className="row" aria-label={`${stamps} sellos obtenidos`}>
                {Array.from({ length: STAMPS_FOR_BADGE }, (_, i) => <span key={i} className={`stamp ${i < stamps ? 'on' : ''}`}>{i < stamps ? '✓' : i + 1}</span>)}
              </div>
              <ul>
                {visits.map((v) => <li key={v.id}>{fmtDateShort(v.dateKey)} · {v.status === 'acreditada' ? 'acreditada por el personal' : `revertida (${v.reversalReason})`}</li>)}
              </ul>
            </>
          ) : (
            <Callout>Los sellos se asocian a una persona. Elegí “Cliente recurrente (Ana)” en la barra de la demo para ver un pasaporte con visitas.</Callout>
          )}
          <h3>Reglas visibles</h3>
          <ul className="small">
            <li>Un sello por persona y fecha, acreditado por el personal (no por consumo ni por gasto).</li>
            <li>La insignia llega a la quinta visita. No hay premios reales: la configuración de premios está deshabilitada hasta que el negocio la apruebe.</li>
            <li>La demo no es antifraude: alguien podría editar su navegador.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
