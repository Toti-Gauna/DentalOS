import { createElement, lazy, Suspense, useEffect, useRef, useState, type ComponentProps, type ComponentType, type ReactNode } from 'react';
import { DemoBadge, DemoDock, RoleGate } from './DemoShell';
import { roleById } from './roles';
import { navigate, useRoute } from './router';
import { store, useStore } from './store';
import { resetUi, setRole, useUi } from './ui-state';
import { Button, ConfirmDialog, CrumbsContext, Icon, LiveRegion, Notice, type Crumbs } from '../ui/kit';
import { LoadingState } from '../ui/components';
import { Home, LocationPage, ServicePage } from '../pages/public/Home';
import { Booking } from '../pages/public/Booking';
import { MyAppointments } from '../pages/public/MyAppointments';
import { WhatsApp } from '../pages/public/WhatsApp';
import { CallSim } from '../pages/public/CallSim';
import { Learn } from '../pages/public/Learn';
import { Kids } from '../pages/public/Kids';
import { BrandMark } from '../ui/art/brand';
import { sound, type Sfx } from '../ui/sound';
import { CommandPalette } from '../ui/CommandPalette';
import { ThemeSwitcher, useApplyTheme } from '../ui/ThemeSwitcher';

// El panel de la clínica se carga aparte: el portal de pacientes no descarga su código.
// Si una sección no llega (red caída, versión nueva publicada), se muestra el error con un reintento real.
// Mismo tipo que acepta React.lazy: cada sección declara sus propias props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Section = ComponentType<any>;
let retries = 0;
/** Carga diferida con reintento. El navegador recuerda un import() fallido, así que el reintento pide la misma URL con
 *  un parámetro nuevo (la URL viene en el mensaje de error en Chromium y Firefox); si no la informa, queda recargar. */
function lazyRetry<M, C extends Section>(load: () => Promise<M>, pick: (m: M) => C) {
  return lazy(async () => {
    try { return { default: pick(await load()) }; } catch (first) {
      let error: unknown = first;
      const retry = async () => {
        const url = /https?:\/\/\S+?\.js/.exec(String((error as Error)?.message ?? ''))?.[0];
        try {
          if (!url) return pick(await load());
          const mod = await import(/* @vite-ignore */ `${url}?reintento=${++retries}`) as Record<string, unknown>;
          // En el build, la sección expone su espacio de nombres dentro del chunk: se busca ahí si no está en la raíz.
          const found = [mod, ...Object.values(mod).filter((v) => typeof v === 'object' && v !== null && (v as Record<symbol, unknown>)[Symbol.toStringTag] === 'Module')]
            .map((m) => pick(m as M)).find(Boolean);
          if (!found) throw new Error('La sección cargada no tiene el componente esperado.');
          return found;
        } catch (e) { error = e; throw e; }
      };
      const Fallback = (props: ComponentProps<C>) => <ChunkError retry={retry} props={props} />;
      return { default: Fallback as unknown as C };
    }
  });
}

function ChunkError<C extends Section>({ retry, props }: { retry: () => Promise<C>; props: ComponentProps<C> }) {
  const [loaded, setLoaded] = useState<C | null>(null);
  const [state, setState] = useState<'error' | 'loading' | 'again'>('error');
  if (loaded) return createElement(loaded as ComponentType<ComponentProps<C>>, props);
  const onRetry = () => {
    setState('loading');
    retry().then((c) => setLoaded(() => c)).catch(() => setState('again'));
  };
  return (
    <section className="page narrow chunk-error">
      <Notice tone="error" title="No se pudo cargar esta sección"
        action={<div className="row wrap"><Button variant="primary" icon="refresh" onClick={onRetry} disabled={state === 'loading'}>{state === 'loading' ? 'Reintentando…' : 'Reintentar'}</Button>{state === 'again' && <Button onClick={() => window.location.reload()}>Recargar la página</Button>}</div>}>
        {state === 'again' ? 'Volvió a fallar. Recargar la página trae la versión publicada más reciente; tus datos de la demo quedan guardados en este dispositivo.' : 'La parte del panel que pediste no llegó. Tus datos de la demo no se tocaron.'}
      </Notice>
    </section>
  );
}
const Today = lazyRetry(() => import('../pages/admin/Today'), (m) => m.Today);
const Inbox = lazyRetry(() => import('../pages/admin/Inbox'), (m) => m.Inbox);
const People = lazyRetry(() => import('../pages/admin/People'), (m) => m.People);
const PersonDetail = lazyRetry(() => import('../pages/admin/People'), (m) => m.PersonDetail);
const Odontogram = lazyRetry(() => import('../pages/admin/Odontogram'), (m) => m.Odontogram);
const OdontogramPicker = lazyRetry(() => import('../pages/admin/Odontogram'), (m) => m.OdontogramPicker);
const Ortho = lazyRetry(() => import('../pages/admin/Ortho'), (m) => m.Ortho);
const Estimates = lazyRetry(() => import('../pages/admin/Estimates'), (m) => m.Estimates);
const Waitlist = lazyRetry(() => import('../pages/admin/Waitlist'), (m) => m.Waitlist);
const Tasks = lazyRetry(() => import('../pages/admin/Tasks'), (m) => m.Tasks);
const Reports = lazyRetry(() => import('../pages/admin/Reports'), (m) => m.Reports);
const Settings = lazyRetry(() => import('../pages/admin/Settings'), (m) => m.Settings);
const Gallery = lazyRetry(() => import('../pages/public/Gallery'), (m) => m.Gallery);

export const BANNER = 'Demo · Clínica Brisa ficticia · Datos de muestra · Sin envíos reales';


const PUBLIC_NAV = [
  { to: '/', label: 'Inicio', icon: 'home', m: 'M01' },
  { to: '/reservar', label: 'Reservar', icon: 'calendar', m: 'M02' },
  { to: '/mis-turnos', label: 'Mis turnos', icon: 'list', m: 'M03' },
  { to: '/whatsapp', label: 'WhatsApp', icon: 'chat', m: 'M06' },
  { to: '/llamada', label: 'Llamada', icon: 'phone', m: 'M07' },
  { to: '/aprender', label: 'Tu primera visita', icon: 'book', m: 'M15' },
  { to: '/chicos', label: 'Chicos', icon: 'smile', m: 'M15' },
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
const ADMIN_GROUPS: { label: string; items: string[] }[] = [
  { label: 'Operación', items: ['/admin', '/admin/bandeja', '/admin/espera', '/admin/tareas'] },
  { label: 'Pacientes', items: ['/admin/personas', '/admin/odontograma', '/admin/ortodoncia'] },
  { label: 'Gestión', items: ['/admin/presupuestos', '/admin/informes', '/admin/config'] },
];
// Bottom bar (móvil): cuatro destinos fijos y “Más”.
const PUBLIC_TABS = ['/', '/reservar', '/mis-turnos', '/whatsapp'];
const ADMIN_TABS = ['/admin', '/admin/bandeja', '/admin/personas'];
const TAB_LABEL: Record<string, string> = { '/': 'Inicio', '/reservar': 'Reservar', '/mis-turnos': 'Turnos', '/whatsapp': 'Chat', '/admin': 'Agenda', '/admin/bandeja': 'Bandeja', '/admin/personas': 'Personas' };
const PALETTE_ROUTES = [{ group: 'Panel de la clínica', items: ADMIN_NAV }, { group: 'Portal de pacientes', items: PUBLIC_NAV }];

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
  if (a === 'chicos') return <Kids />;
  if (a === 'galeria') return <Gallery />;
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
      <BrandMark size={38} />
      <span><strong>Clínica Brisa</strong><small>DentalOS · demo</small></span>
    </a>
  );
}

const SILENT = new Set(['chatOpen', 'learningOpen', 'callSave']);
function soundFor(type: string, ok: boolean, info?: Record<string, unknown>): Sfx | null {
  if (SILENT.has(type)) return null;
  if (!ok) return 'error';
  if (type === 'chatSend' || type === 'chatChoose' || type === 'chatStaffReply') return 'message';
  if (type === 'learningComplete') return 'stamp';
  if (type === 'learningAnswer') return info?.correct ? 'success' : 'tap';
  if (type === 'advanceClock') return 'tick';
  return 'success';
}


/** Capa ambiental animada (aurora + grano). Decorativa: queda quieta con movimiento reducido. */
function Ambient({ kids }: { kids: boolean }) {
  return (
    <div className="ambient" aria-hidden="true">
      <span className="blob b1" /><span className="blob b2" /><span className="blob b3" />
      {kids && <span className="fizz-layer">{Array.from({ length: 12 }, (_, i) => <span key={i} className={`fizz k${i}`} />)}</span>}
      <span className="grain" />
    </div>
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
  const kids = segments[0] === 'chicos';
  const [paletteOpen, setPaletteOpen] = useState(false);
  const prevTitle = useRef<HTMLElement | null>(null);
  const prevText = useRef<string | null>(null);

  const ui = useUi();
  useApplyTheme();
  // Sonidos de interfaz: preferencia del dispositivo; se escuchan solo resultados reales de comandos.
  useEffect(() => { sound.setEnabled(ui.sound); }, [ui.sound]);
  useEffect(() => {
    const off = store.onResult((cmd, r) => {
      if (r.replayed) return; // un doble clic idempotente no vuelve a sonar
      const sfx = soundFor(cmd.type, r.ok, r.ok ? r.info : undefined);
      if (sfx) sound.play(sfx);
    });
    return () => { off(); };
  }, []);
  useEffect(() => {
    // La vista de muestra acompaña al área elegida (no es seguridad). Solo reacciona al cambio de área,
    // así elegir una vista no se pisa antes de que cambie la ruta.
    if (admin && (ui.role === 'visitante' || ui.role === 'paciente')) setRole('recepcion');
    if (!admin && ui.role !== 'visitante' && ui.role !== 'paciente') setRole('paciente');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  useEffect(() => {
    // Al navegar se cierran hojas y menús abiertos (popovers).
    document.querySelectorAll<HTMLElement>('[popover]').forEach((p) => { try { if (p.matches(':popover-open')) p.hidePopover(); } catch { /* sin soporte */ } });
    // El panel se carga en diferido: reintenta hasta que exista el título de la página.
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startActive = document.activeElement;
    const focusTitle = () => {
      const h = document.querySelector<HTMLElement>('[data-page-title]');
      // Mientras el panel diferido carga, puede seguir montado el título anterior: esperar al nuevo.
      if (h && (h !== prevTitle.current || h.textContent !== prevText.current)) {
        prevTitle.current = h;
        prevText.current = h.textContent;
        // No robar el foco si la persona ya se movió dentro del contenido nuevo mientras cargaba.
        const a = document.activeElement;
        const movedOn = a && a !== startActive && a !== document.body && !!document.getElementById('main')?.contains(a);
        if (a?.tagName !== 'INPUT' && !movedOn) h.focus({ preventScroll: false });
      } else if (tries++ < 40) timer = setTimeout(focusTitle, 50);
    };
    focusTitle();
    window.scrollTo?.(0, 0);
    return () => clearTimeout(timer);
  }, [path]);

  // ⌘K / Ctrl+K abre la paleta de comandos en cualquier área.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isActive = (to: string) => {
    if (to === '/' || to === '/admin') return path === to;
    // La ruta del odontograma vive bajo /admin/personas/:id: se marca su módulo, no Personas.
    if (path.endsWith('/odontograma')) return to === '/admin/odontograma';
    return path.startsWith(to);
  };
  const nav = admin ? ADMIN_NAV : PUBLIC_NAV;
  const current = nav.find((n) => isActive(n.to)) ?? null;
  const crumbs: Crumbs = { area: admin ? 'Panel de la clínica' : 'Portal de pacientes', areaHref: admin ? '#/admin' : '#/', module: current && current.to !== (admin ? '/admin' : '/') ? { label: current.label, href: `#${current.to}` } : null };

  return (
    <div className={`app ${admin ? 'admin' : 'public'}${kids ? ' kids-mode' : ''}`}>
      <Ambient kids={kids} />
      <a href="#main" className="skip" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Saltar al contenido</a>
      <div className="masthead">
        <header className="site-header">
          <div className="site-header-inner">
            <Logo />
            <DemoBadge />
            {admin ? (
              <>
                <span className="header-area">Panel de la clínica</span>
                <button type="button" className="header-search" onClick={() => setPaletteOpen(true)} aria-label="Buscar (Ctrl K)" aria-keyshortcuts="Control+K Meta+K">
                  <Icon name="search" size={16} /><span>Buscar módulo o persona…</span><kbd>Ctrl K</kbd>
                </button>
              </>
            ) : (
              <nav className="primary-nav" aria-label="Portal de pacientes">
                <ul>
                  {PUBLIC_NAV.map((n) => <li key={n.to}><a href={`#${n.to}`} aria-current={isActive(n.to) ? 'page' : undefined}>{n.label}</a></li>)}
                </ul>
              </nav>
            )}
            <div className="header-actions">
              <ThemeSwitcher />
              {admin
                ? <button type="button" className="view-chip" popoverTarget="demo-dock-panel" title="Vista de muestra (no es inicio de sesión). Cambiar desde la botonera Demo"><Icon name="user" size={14} /> {roleById(ui.role).label}</button>
                : <a className="btn btn-primary btn-sm header-cta" href="#/reservar"><Icon name="calendar" size={16} /> <span>Pedir turno</span></a>}
            </div>
          </div>
        </header>
      </div>
      <div className="layout">
        {admin && (
          <nav id="main-nav" className="sidebar" aria-label="Panel de la clínica">
            {ADMIN_GROUPS.map((g) => (
              <div key={g.label} className="sidebar-group">
                <p className="sidebar-label" id={`grp-${g.label}`}>{g.label}</p>
                <ul aria-labelledby={`grp-${g.label}`}>
                  {g.items.map((to) => { const n = ADMIN_NAV.find((x) => x.to === to)!; return <li key={to}><a href={`#${to}`} aria-current={isActive(to) ? 'page' : undefined}><Icon name={n.icon} /><span>{n.label}</span><small className="mod">{n.m}</small></a></li>; })}
                </ul>
              </div>
            ))}
            <a className="sidebar-portal" href="#/"><Icon name="user" size={16} /> Ver portal de pacientes</a>
          </nav>
        )}
        <main id="main" tabIndex={-1}>
          <CrumbsContext.Provider value={crumbs}>
            <SystemNotices />
            <Suspense fallback={<LoadingState label="Cargando panel de la clínica…" />}>{route(segments)}</Suspense>
          </CrumbsContext.Provider>
        </main>
      </div>
      <SiteFooter admin={admin} />
      <BottomBar admin={admin} isActive={isActive} onSearch={() => setPaletteOpen(true)} />
      <DemoDock />
      <RoleGate />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} routes={PALETTE_ROUTES} />
      <LiveRegion />
    </div>
  );
}

function SiteFooter({ admin }: { admin: boolean }) {
  return (
    <footer className="footer">
      {!admin && (
        <div className="footer-cta">
          <div>
            <p className="footer-cta-eyebrow">Demo para clínicas</p>
            <p className="footer-cta-title">¿Querés ver cómo lo gestiona recepción?</p>
            <p className="footer-cta-text">Agenda, bandeja, odontograma y caja ficticia, con los mismos turnos que ves en el portal.</p>
          </div>
          <a className="btn btn-lg footer-cta-btn" href="#/admin"><Icon name="calendar" /> Ver panel demo</a>
        </div>
      )}
      <div className="footer-inner">
        <div className="footer-brand">
          <BrandMark size={44} />
          <div><strong>Clínica Brisa</strong><span>Cada consulta tiene un próximo paso.</span></div>
        </div>
        {admin ? (
          <nav aria-label="Pie de página" className="footer-cols">
            <div><p className="footer-h">Panel</p><a href="#/admin">Hoy y agenda</a><a href="#/admin/bandeja">Bandeja</a><a href="#/admin/personas">Personas</a></div>
            <div><p className="footer-h">Demo</p><a href="#/admin/config">Presets y restablecer</a><a className="btn btn-sm footer-cta-btn" href="#/">Ver portal de pacientes</a></div>
          </nav>
        ) : (
          <nav aria-label="Pie de página" className="footer-cols">
            <div><p className="footer-h">Pacientes</p><a href="#/reservar">Reservar</a><a href="#/mis-turnos">Mis turnos</a><a href="#/aprender">Tu primera visita</a><a href="#/chicos">Brisa Chicos</a></div>
            <div><p className="footer-h">Contacto</p><a href="#/whatsapp">WhatsApp (simulado)</a><a href="#/llamada">Llamada (simulada)</a><a href="#/sedes/L-CEN">Sede Centro</a><a href="#/sedes/L-NOR">Sede Norte</a></div>
            <div><p className="footer-h">Demo</p><a href="#/admin">Panel de la clínica (recepción)</a><a href="#/admin/config">Presets y restablecer</a></div>
          </nav>
        )}
        <p className="footer-note">DentalOS · demostración pre-venta con datos sintéticos. No es un producto clínico ni historia clínica productiva. Sin backend, sin IA, sin mensajes, llamadas ni cobros reales.</p>
      </div>
    </footer>
  );
}

/** Navegación inferior en móvil: cuatro destinos y “Más” (hoja en popover nativo con el resto). */
function BottomBar({ admin, isActive, onSearch }: { admin: boolean; isActive: (to: string) => boolean; onSearch: () => void }) {
  const tabs = admin ? ADMIN_TABS : PUBLIC_TABS;
  const all = admin ? ADMIN_NAV : PUBLIC_NAV;
  const rest = all.filter((n) => !tabs.includes(n.to));
  const moreActive = rest.some((n) => isActive(n.to));
  return (
    <nav className="bottombar" aria-label="Navegación inferior">
      <ul>
        {tabs.map((to) => { const n = all.find((x) => x.to === to)!; return (
          <li key={to}><a href={`#${to}`} aria-current={isActive(to) ? 'page' : undefined}><Icon name={n.icon} size={22} /><span>{TAB_LABEL[to]}</span></a></li>
        ); })}
        {admin && <li><button type="button" onClick={onSearch}><Icon name="search" size={22} /><span>Buscar</span></button></li>}
        <li><button type="button" popoverTarget="more-sheet" aria-current={moreActive ? 'page' : undefined}><Icon name="grid" size={22} /><span>Más</span></button></li>
      </ul>
      <div id="more-sheet" popover="auto" className="sheet" role="dialog" aria-label="Más secciones">
        <div className="sheet-grip" aria-hidden="true" />
        <p className="sheet-title">{admin ? 'Panel de la clínica' : 'Portal de pacientes'}</p>
        <ul className="sheet-grid">
          {rest.map((n) => <li key={n.to}><a href={`#${n.to}`} aria-current={isActive(n.to) ? 'page' : undefined}><span className="sheet-ico"><Icon name={n.icon} size={20} /></span><span>{n.label}</span></a></li>)}
        </ul>
        <a className="btn btn-primary sheet-cta" href={admin ? '#/' : '#/admin'}><Icon name={admin ? 'user' : 'calendar'} /> {admin ? 'Ver portal de pacientes' : 'Ver panel demo'}</a>
      </div>
    </nav>
  );
}
