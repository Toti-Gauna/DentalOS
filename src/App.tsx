import { useEffect, useRef } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { LiveRegion } from './ui/kit'
import { DemoBanner, DemoBar, Footer, StatusStrips } from './ui/Shell'
import { isBiz } from './ui/hooks'
import { dispatch, setPrefs, useSnapshot } from './store'
import { ClientLayout } from './pages/client/ClientLayout'
import { Home } from './pages/client/Home'
import { Carta } from './pages/client/Carta'
import { MiPedido } from './pages/client/MiPedido'
import { PedidoDetalle } from './pages/client/PedidoDetalle'
import { Reservar } from './pages/client/Reservar'
import { ReservaDetalle } from './pages/client/ReservaDetalle'
import { Explorar } from './pages/client/Explorar'
import { Pasaporte } from './pages/client/Pasaporte'
import { Catas } from './pages/client/Catas'
import { Ayuda } from './pages/client/Ayuda'
import { Simulador } from './pages/client/Simulador'
import { Landing } from './pages/Landing'
import { Comercial } from './pages/Comercial'
import { Recovery } from './pages/Recovery'
import { NotFound } from './pages/NotFound'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminResumen } from './pages/admin/Resumen'
import { AdminReservas } from './pages/admin/Reservas'
import { AdminSalon } from './pages/admin/Salon'
import { AdminPedidos } from './pages/admin/Pedidos'
import { AdminCocina } from './pages/admin/Cocina'
import { AdminCaja } from './pages/admin/Caja'
import { AdminCarta } from './pages/admin/CartaAdmin'
import { AdminStock } from './pages/admin/Stock'
import { AdminClientes } from './pages/admin/Clientes'
import { AdminAutomatizaciones } from './pages/admin/Automatizaciones'
import { AdminReportes } from './pages/admin/Reportes'
import { AdminConfig } from './pages/admin/Configuracion'

function BizGuard() {
  const { biz } = useParams()
  if (!isBiz(biz)) return <NotFound what="perfil" />
  return <ClientLayout biz={biz} />
}

function SimRedirect() {
  const { state } = useSnapshot()
  return <Navigate to={`/${state.session.businessId}/simulador`} replace />
}

/** Mueve el foco al título al navegar (lectores de pantalla y teclado). */
function FocusOnNav() {
  const first = useRef(true)
  const { pathname: raw } = useLocation()
  // abrir/cerrar el detalle de un plato (diálogo) no es una navegación de página: el foco lo maneja el diálogo
  const pathname = raw.replace(/^(\/[^/]+\/carta)\/[^/]+$/, '$1')
  useEffect(() => {
    if (first.current) {
      first.current = false // la carga inicial no roba el foco
      return
    }
    const t = setTimeout(() => {
      const h = document.getElementById('page-h1')
      if (h) h.focus({ preventScroll: false })
    }, 30)
    return () => clearTimeout(t)
  }, [pathname])
  return null
}

function Chrome() {
  const { phase, prefs } = useSnapshot()
  useEffect(() => {
    const root = document.documentElement
    if (prefs.reducedMotion === 'on') root.setAttribute('data-motion', 'reduced')
    else root.removeAttribute('data-motion')
  }, [prefs.reducedMotion])
  return (
    <>
      <a className="skip" href="#contenido" onClick={(e) => { e.preventDefault(); document.getElementById('page-h1')?.focus() }}>
        Saltar al contenido
      </a>
      <DemoBanner />
      <StatusStrips />
      {phase === 'recovery' ? (
        <Recovery />
      ) : (
        <>
          <DemoBar />
          <FocusOnNav />
          <div id="contenido">
            <Outlet />
          </div>
          <Footer />
        </>
      )}
      <LiveRegion />
    </>
  )
}

export function App() {
  void dispatch
  void setPrefs
  return (
    <HashRouter>
      <Routes>
        <Route element={<Chrome />}>
          <Route path="/" element={<Landing />} />
          <Route path="/simulador" element={<SimRedirect />} />
          <Route path="/comercial" element={<Comercial />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="resumen" replace />} />
            <Route path="resumen" element={<AdminResumen />} />
            <Route path="reservas" element={<AdminReservas />} />
            <Route path="reservas/:id" element={<AdminReservas />} />
            <Route path="salon" element={<AdminSalon />} />
            <Route path="pedidos" element={<AdminPedidos />} />
            <Route path="pedidos/:id" element={<AdminPedidos />} />
            <Route path="cocina" element={<AdminCocina />} />
            <Route path="caja" element={<AdminCaja />} />
            <Route path="carta" element={<AdminCarta />} />
            <Route path="stock" element={<AdminStock />} />
            <Route path="clientes" element={<AdminClientes />} />
            <Route path="clientes/:id" element={<AdminClientes />} />
            <Route path="automatizaciones" element={<AdminAutomatizaciones />} />
            <Route path="reportes" element={<AdminReportes />} />
            <Route path="configuracion" element={<AdminConfig />} />
            <Route path="*" element={<NotFound what="sección de administración" back="/admin/resumen" backLabel="Volver al resumen" />} />
          </Route>
          <Route path="/:biz" element={<BizGuard />}>
            <Route index element={<Home />} />
            <Route path="carta" element={<Carta />} />
            <Route path="carta/:itemId" element={<Carta />} />
            <Route path="pedido" element={<MiPedido />} />
            <Route path="pedido/:id" element={<PedidoDetalle />} />
            <Route path="reservar" element={<Reservar />} />
            <Route path="reservas/:id" element={<ReservaDetalle />} />
            <Route path="explorar" element={<Explorar />} />
            <Route path="pasaporte" element={<Pasaporte />} />
            <Route path="catas" element={<Catas />} />
            <Route path="ayuda" element={<Ayuda />} />
            <Route path="simulador" element={<Simulador />} />
            <Route path="*" element={<NotFound what="página" />} />
          </Route>
          <Route path="*" element={<NotFound what="página" />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
