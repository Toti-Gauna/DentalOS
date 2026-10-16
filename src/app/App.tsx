import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { fmtShort } from '../domain/time';
import type { ViewRole } from '../domain';
import { navigate, useRoute } from './router';
import { store, useStore } from './store';
import { resetUi, setRole, useUi } from './ui-state';
import { Button, ConfirmDialog, Icon, LiveRegion, Notice } from '../ui/kit';
import { Home, LocationPage, ServicePage } from '../pages/public/Home';
import { Booking } from '../pages/public/Booking';
import { MyAppointments } from '../pages/public/MyAppointments';
import { WhatsApp } from '../pages/public/WhatsApp';
import { CallSim } from '../pages/public/CallSim';
import { Learn } from '../pages/public/Learn';

// El panel de la clínica se carga aparte: el portal de pacientes no descarga su código.
const Today = lazy(() => import('../pages/admin/Today').then((m) => ({ default: m.Today })));
const Inbox = lazy(() => import('../pages/admin/Inbox').then((m) => ({ default: m.Inbox })));
const People = lazy(() => import('../pages/admin/People').then((m) => ({ default: m.People })));
const PersonDetail = lazy(() => import('../pages/admin/People').then((m) => ({ default: m.PersonDetail })));
const Odontogram = lazy(() => import('../pages/admin/Odontogram').then((m) => ({ default: m.Odontogram })));
const OdontogramPicker = lazy(() => import('../pages/admin/Odontogram').then((m) => ({ default: m.OdontogramPicker })));
const Ortho = lazy(() => import('../pages/admin/Ortho').then((m) => ({ default: m.Ortho })));
const Estimates = lazy(() => import('../pages/admin/Estimates').then((m) => ({ default: m.Estimates })));
const Waitlist = lazy(() => import('../pages/admin/Waitlist').then((m) => ({ default: m.Waitlist })));
const Tasks = lazy(() => import('../pages/admin/Tasks').then((m) => ({ default: m.Tasks })));
const Reports = lazy(() => import('../pages/admin/Reports').then((m) => ({ default: m.Reports })));
const Settings = lazy(() => import('../pages/admin/Settings').then((m) => ({ default: m.Settings })));

export const BANNER = 'Demo · Clínica Brisa ficticia · Datos de muestra · Sin envíos reales';

const ROLES: { id: ViewRole; label: string; home: string }[] = [
  { id: 'visitante', label: 'Visitante', home: '/' },
  { id: 'paciente', label: 'Paciente / responsable', home: '/mis-turnos' },
  { id: 'recepcion', label: 'Recepción', home: '/admin' },
  { id: 'profesional', label: 'Profesional', home: '/admin/ortodoncia' },
  { id: 'direccion', label: 'Dirección', home: '/admin/informes' },
];

const PUBLIC_NAV = [
  { to: '/', label: 'Inicio', icon: 'home', m: 'M01' },
  { to: '/reservar', label: 'Reservar', icon: 'calendar', m: 'M02' },
  { to: '/mis-turnos', label: 'Mis turnos', icon: 'list', m: 'M03' },
  { to: '/whatsapp', label: 'WhatsApp', icon: 'chat', m: 'M06' },
  { to: '/llamada', label: 'Llamada', icon: 'phone', m: 'M07' },
  { to: '/aprender', label: 'Tu primera visita', icon: 'book', m: 'M15' },
];
const ADMIN_NAV = [
  { to: '/admin', label: 'Hoy y agenda', icon: 'calendar', m: 'M04' },
  { to: '/admin/bandeja', label: 'Bandeja', icon: 'inbox', m: 'M05' },
  { to: '/admin/personas', label: 'Personas y familias', icon: 'family', m: 'M08' },
  { to: '/admin/odontograma', label: 'Odontograma', icon: 'tooth', m: 'M09' },
  { to: '/admin/ortodoncia', label: 'Ortodoncia', icon: 'refresh', m: 'M10' },
  { to: '/admin/presupuestos', label: 'Presupuestos y caja', icon: 'wallet', m: 'M11' },
  { to: '/admin/espera', label: 'Espera y recordatorios', icon: 'hourglass', m: 'M12' },
  { to: '/admin/tareas', label: 'Tareas', icon: 'check', m: 'M13' },
  { to: '/admin/informes', label: 'Informes', icon: 'chart', m: 'M13' },
  { to: '/admin/config', label: 'Configuración y simulador', icon: 'settings', m: 'M14' },
];

function route(segments: string[]): ReactNode {
  const [a, b, c, d] = segments;
  if (!a) return <Home />;
  if (a === 'sedes' && b) return <LocationPage id={b} />;
  if (a === 'servicios' && b) return <ServicePage id={b} />;
  if (a === 'reservar') return <Booking />;
  if (a === 'mis-turnos') return <MyAppointments />;
  if (a === 'whatsapp') return <WhatsApp />;
  if (a === 'llamada') return <CallSim />;
  if (a === 'aprender') return <Learn />;
  if (a === 'admin') {
    if (!b) return <Today />;
    if (b === 'bandeja') return <Inbox />;
    if (b === 'personas' && c && d === 'odontograma') return <Odontogram personId={c} />;
    if (b === 'personas' && c) return <PersonDetail id={c} />;
    if (b === 'personas') return <People />;
    if (b === 'odontograma') return <OdontogramPicker />;
    if (b === 'ortodoncia') return <Ortho />;
    if (b === 'presupuestos') return <Estimates />;
    if (b === 'espera') return <Waitlist />;
    if (b === 'tareas') return <Tasks />;
    if (b === 'informes') return <Reports />;
    if (b === 'config') return <Settings />;
  }
  return <NotFound />;
}

function NotFound() {
  return (
    <section className="page narrow">
      <h1 tabIndex={-1} data-page-title>No encontramos esta página</h1>
      <p>El enlace puede apuntar a un registro que ya no existe en esta demo (por ejemplo, después de restablecerla).</p>
      <div className="row"><Button variant="primary" onClick={() => navigate('/')}>Ir al inicio</Button><Button onClick={() => navigate('/admin')}>Ir a recepción</Button></div>
    </section>
  );
}

function Logo() {
  return (
    <a className="logo" href="#/" aria-label="Clínica Brisa, inicio (demo ficticia)">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#245E59" /><path d="M9 11c0-2 1.5-3.5 3.5-3.5 1.6 0 2.3.9 3.5.9s1.9-.9 3.5-.9c2 0 3.5 1.5 3.5 3.5 0 2.4-1.2 3.5-1.6 5.6-.4 2-.8 6.4-2.3 6.4-1.3 0-1.4-3.8-3.1-3.8s-1.8 3.8-3.1 3.8c-1.5 0-1.9-4.4-2.3-6.4C10.2 14.5 9 13.4 9 11z" fill="#F6F4EE" /></svg>
      <span><strong>Clínica Brisa</strong><small>DentalOS · demo</small></span>
    </a>
  );
}

function RoleSwitch() {
  const ui = useUi();
  return (
    <div className="role-switch">
      <label htmlFor="role">Vista de muestra <span className="muted">(no es inicio de sesión)</span></label>
      <select id="role" value={ui.role} onChange={(e) => { const r = ROLES.find((x) => x.id === e.target.value)!; setRole(r.id); navigate(r.home); }}>
        {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
    </div>
  );
}

function StorageStatus() {
  const snap = useStore();
  return (
    <span className="storage-status">
      <Icon name={snap.mode === 'local' ? 'check' : 'alert'} size={14} />
      {snap.mode === 'local' ? 'Guardado en este dispositivo' : 'Solo en memoria: no se guarda'}
      <span className="sep" aria-hidden="true">·</span>
      <Icon name="clock" size={14} /> <span className="tabular">Reloj de muestra: {fmtShort(snap.state.clock)}</span>
    </span>
  );
}

function SystemNotices() {
  const snap = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const downloadRaw = () => {
    const blob = new Blob([snap.corrupt?.raw ?? ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'dentalos-demo-copia-danada.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="system-notices">
      {snap.corrupt && (
        <Notice tone="error" title="Los datos guardados de la demo no son válidos" action={<div className="row wrap"><Button variant="primary" onClick={() => setConfirmReset(true)}>Restaurar demo inicial</Button><Button onClick={downloadRaw}>Descargar copia del contenido dañado</Button></div>}>
          Motivo: {snap.corrupt.reason} Mientras decidís, la demo funciona en memoria con la seed inicial y no sobrescribe lo guardado.
        </Notice>
      )}
      {snap.externalChange && (
        <Notice tone="warn" title="Otra pestaña cambió la demo" action={<div className="row wrap"><Button variant="primary" onClick={() => store.reloadFromStorage()}>Cargar el estado más reciente</Button><Button onClick={() => store.keepMemoryOnly()}>Seguir con esta pestaña</Button></div>}>
          La demo está pensada para una sola pestaña; no promete concurrencia.
        </Notice>
      )}
      {snap.notice && <Notice tone="warn" title={snap.notice} />}
      <ConfirmDialog open={confirmReset} title="¿Restaurar la demo inicial?" confirmLabel="Restaurar" tone="danger" onCancel={() => setConfirmReset(false)} onConfirm={() => { store.reset(); resetUi(); setConfirmReset(false); }}>
        Se borra solo el espacio de la demo (dentalos.demo.v1) y se repone la seed dentalos-v1 con su reloj.
      </ConfirmDialog>
    </div>
  );
}

export function App() {
  const { segments, path } = useRoute();
  const admin = segments[0] === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);

  const ui = useUi();
  useEffect(() => {
    // La vista de muestra acompaña al área elegida (no es seguridad).
    if (admin && (ui.role === 'visitante' || ui.role === 'paciente')) setRole('recepcion');
    if (!admin && ui.role !== 'visitante' && ui.role !== 'paciente') setRole('paciente');
  }, [admin, ui.role]);

  useEffect(() => {
    setMenuOpen(false);
    // El panel se carga en diferido: reintenta hasta que exista el título de la página.
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const focusTitle = () => {
      const h = document.querySelector<HTMLElement>('[data-page-title]');
      if (h) { if (document.activeElement?.tagName !== 'INPUT') h.focus({ preventScroll: false }); }
      else if (tries++ < 20) timer = setTimeout(focusTitle, 50);
    };
    focusTitle();
    window.scrollTo?.(0, 0);
    return () => clearTimeout(timer);
  }, [path]);

  const nav = admin ? ADMIN_NAV : PUBLIC_NAV;
  const isActive = (to: string) => (to === '/' || to === '/admin' ? path === to : path.startsWith(to));

  return (
    <div className={admin ? 'app admin' : 'app public'}>
      <a href="#main" className="skip" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Saltar al contenido</a>
      <div className="demo-banner" role="note">
        <strong>{BANNER}</strong>
        <StorageStatus />
      </div>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <button className="menu-toggle btn btn-ghost" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen((v) => !v)}><Icon name="list" /> <span>Menú</span></button>
          <RoleSwitch />
          <a className="switch-area" href={admin ? '#/' : '#/admin'}>{admin ? 'Ver portal de pacientes' : 'Ver panel de la clínica'} <Icon name="arrow" size={14} /></a>
        </div>
      </header>
      <div className="layout">
        <nav id="main-nav" className={`nav ${menuOpen ? 'open' : ''}`} aria-label={admin ? 'Panel de la clínica' : 'Portal de pacientes'}>
          <ul>
            {nav.map((n) => (
              <li key={n.to}><a href={`#${n.to}`} aria-current={isActive(n.to) ? 'page' : undefined}><Icon name={n.icon} /><span>{n.label}</span><small className="mod">{n.m}</small></a></li>
            ))}
          </ul>
        </nav>
        <main id="main" tabIndex={-1}>
          <SystemNotices />
          <Suspense fallback={<p className="muted" role="status">Cargando panel…</p>}>{route(segments)}</Suspense>
        </main>
      </div>
      <footer className="footer">
        <p>DentalOS · demostración pre-venta con datos sintéticos. No es un producto clínico ni historia clínica productiva. Sin backend, sin IA, sin mensajes, llamadas ni cobros reales.</p>
      </footer>
      <LiveRegion />
    </div>
  );
}
