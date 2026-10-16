import { Link, NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../../store'
import { ADMIN_SECTIONS, isClientRole, ROLE_LABEL } from '../../ui/format'
import { Callout } from '../../ui/kit'

export function AdminLayout() {
  const state = useApp()
  const biz = state.businesses.find((b) => b.id === state.session.businessId)!
  const role = state.session.role
  const counts: Record<string, number> = {
    reservas: state.reservations.filter((r) => r.businessId === biz.id && ['solicitada', 'revision_humana'].includes(r.status)).length,
    pedidos: state.orders.filter((o) => o.businessId === biz.id && o.status === 'enviado').length,
    cocina: state.orders.filter((o) => o.businessId === biz.id && ['aceptado', 'en_preparacion'].includes(o.status)).length,
    resumen: state.tasks.filter((t) => t.businessId === biz.id && t.status === 'pendiente').length,
    automatizaciones: state.runs.filter((r) => r.businessId === biz.id && ['fallida', 'pendiente'].includes(r.status)).length,
    stock: state.ingredients.filter((i) => i.businessId === biz.id && i.alertState !== 'ok').length,
  }
  const mine = ADMIN_SECTIONS.filter((s) => s.roles.includes(role))
  const others = ADMIN_SECTIONS.filter((s) => !s.roles.includes(role))
  const link = (s: (typeof ADMIN_SECTIONS)[number]) => (
    <NavLink key={s.key} to={`/admin/${s.key}`} data-testid={`nav-${s.key}`}>
      <span>{s.label}</span>
      {counts[s.key] ? <span className="count" aria-label={`${counts[s.key]} pendientes`}>{counts[s.key]}</span> : null}
    </NavLink>
  )
  return (
    <div className="admin" data-biz={biz.id}>
      <div className="wrap">
        <p className="role-hint" style={{ margin: 0, padding: '8px 0' }}>
          Administración de <strong>{biz.name}</strong> · vista de <strong>{ROLE_LABEL[role]}</strong> (didáctica: no hay permisos ni seguridad real).{' '}
          {isClientRole(role) && <>Estás con un rol de cliente viendo pantallas de personal. <Link to={`/${biz.id}`}>Volver a la vista cliente</Link>.</>}
        </p>
        <div className="admin-layout">
          <nav className="admin-nav" aria-label="Administración">
            {mine.map(link)}
            {others.length > 0 && <span className="sr-only">Otras vistas</span>}
            {others.map(link)}
          </nav>
          <div className="admin-main">
            <Outlet />
          </div>
        </div>
        <Callout>Todo lo que ves acá se deriva del mismo estado local que la vista cliente: un cambio en un pedido o una reserva se refleja en ambas.</Callout>
      </div>
    </div>
  )
}
