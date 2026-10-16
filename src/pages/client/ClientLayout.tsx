import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { dispatch, useApp } from '../../store'
import { useCart } from '../../ui/hooks'
import { fmtARS } from '../../domain/money'
import type { BusinessId } from '../../domain/types'

export function ClientLayout({ biz }: { biz: BusinessId }) {
  const state = useApp()
  const loc = useLocation()
  const b = state.businesses.find((x) => x.id === biz)!
  const locationId = state.session.locationByBusiness[biz]
  const { count, total } = useCart(state, biz, locationId)

  useEffect(() => {
    if (state.session.businessId !== biz) dispatch({ type: 'session/setBusiness', businessId: biz })
  }, [biz, state.session.businessId])

  const links: [string, string, boolean?][] = [
    ['', 'Inicio', true],
    ['carta', 'Carta'],
    ['pedido', count ? `Mi pedido (${count})` : 'Mi pedido'],
    ...(b.reservationsEnabled ? ([['reservar', 'Reservar']] as [string, string][]) : []),
    ['explorar', 'Explorar sabores'],
    ['pasaporte', 'Mi pasaporte'],
    ['catas', 'Catas'],
    ['ayuda', 'Ayuda'],
  ]
  const hideBar = /\/(pedido|simulador)(\/|$)/.test(loc.pathname)
  return (
    <div className={`client biz-${b.kind}`} data-biz={biz}>
      <header className="client-head">
        <div className="wrap">
          <div className="brand">
            <Link to={`/${biz}`} className="brand-name">{b.name}</Link>
            <span className="muted">{b.tagline}</span>
          </div>
          <nav className="nav" aria-label={`Navegación de ${b.name}`}>
            {links.map(([to, label, end]) => (
              <NavLink key={to} to={`/${biz}${to ? `/${to}` : ''}`} end={end}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <div className="wrap">
        <Outlet />
      </div>
      {count > 0 && !hideBar && (
        <div className="cart-bar" role="region" aria-label="Resumen del pedido">
          <span>
            <strong>{count}</strong> {count === 1 ? 'plato' : 'platos'} · <span className="money">{fmtARS(total)}</span>
          </span>
          <Link className="btn" to={`/${biz}/pedido`}>Revisar y enviar</Link>
        </div>
      )}
    </div>
  )
}
