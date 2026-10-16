import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { act, ConfirmDialog, DemoTag } from './kit'
import { DEFAULT_ADMIN, isClientRole, ROLE_LABEL } from './format'
import { dismissNotice, dispatch, resetDemo, setPrefs, useSnapshot } from '../store'
import { fmtClock, dateKeyOf, fmtDateLong, hhmm, minutesOfDay } from '../domain/time'
import type { BusinessId, FixtureId, Role } from '../domain/types'

export const BIZ_IDS: BusinessId[] = ['mesa-clara', 'ritual-cafe']

export function DemoBanner() {
  const { state, storageMode } = useSnapshot()
  return (
    <div className="demo-banner" role="region" aria-label="Aviso de demostración">
      <span>
        <strong>DEMO</strong> Datos ficticios · no se envía, cobra, publica ni conecta nada · sin validez fiscal
      </span>
      <span className="small">
        Reloj simulado: <time>{fmtClock(state.clock.nowMs)}</time> · {storageMode === 'local' ? 'guardado en este navegador' : 'solo memoria'}
      </span>
    </div>
  )
}

export function StatusStrips() {
  const { warning, notice } = useSnapshot()
  return (
    <>
      {warning && (
        <div className="storage-warning" role="alert" data-testid="storage-warning">
          <span>⚠ {warning}</span>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button className="linklike" type="button" onClick={dismissNotice}>
            Cerrar aviso
          </button>
        </div>
      )}
    </>
  )
}

const JUMPS: { label: string; minutes: number }[] = [
  { label: 'Ir a las 08:00', minutes: 8 * 60 },
  { label: 'Ir a las 12:00 (almuerzo)', minutes: 12 * 60 },
  { label: 'Ir a las 20:00 (cena)', minutes: 20 * 60 },
  { label: 'Ir a las 21:45', minutes: 21 * 60 + 45 },
]

export function DemoBar() {
  const { state, prefs } = useSnapshot()
  const nav = useNavigate()
  const loc = useLocation()
  const [resetOpen, setResetOpen] = useState(false)
  const [fx, setFx] = useState<FixtureId>('servicio')
  const biz = state.session.businessId
  const locs = state.locations.filter((l) => l.businessId === biz)
  const now = state.clock.nowMs

  const onRole = (role: Role) => {
    act({ type: 'session/setRole', role })
    if (isClientRole(role)) {
      if (loc.pathname.startsWith('/admin') || loc.pathname === '/') nav(`/${biz}`)
    } else nav(`/admin/${DEFAULT_ADMIN[role]}`)
  }
  const onBiz = (b: BusinessId) => {
    dispatch({ type: 'session/setBusiness', businessId: b })
    const m = /^\/(mesa-clara|ritual-cafe)(\/.*)?$/.exec(loc.pathname)
    if (m) {
      const rest = m[2] ?? ''
      // los folios son de un negocio: al cambiar de perfil se vuelve a la sección, no al registro
      nav(`/${b}${/^\/(pedido|reservas)\/[^/]+/.test(rest) ? rest.split('/').slice(0, 2).join('/') : rest}`)
    }
  }
  return (
    <div className="demo-bar" role="region" aria-label="Controles de la demo">
      <div className="demo-bar-inner">
        <label>
          Rol (vista, no permisos)
          <select value={state.session.role} onChange={(e) => onRole(e.target.value as Role)} data-testid="role-select">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Perfil ficticio
          <select value={biz} onChange={(e) => onBiz(e.target.value as BusinessId)} data-testid="biz-select">
            {BIZ_IDS.map((b) => (
              <option key={b} value={b}>
                {state.businesses.find((x) => x.id === b)!.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sede
          <select value={state.session.locationByBusiness[biz]} onChange={(e) => dispatch({ type: 'session/setLocation', locationId: e.target.value })} data-testid="loc-select">
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <div className="clock" role="group" aria-label="Reloj simulado">
          <span className="clock-now" data-testid="sim-clock">
            <span aria-hidden="true">🕙</span>
            <span>
              <span className="sr-only">Día simulado: </span>
              <time dateTime={new Date(now).toISOString()}>
                {fmtDateLong(dateKeyOf(now))} · {hhmm(minutesOfDay(now))}
              </time>
            </span>
          </span>
          <button className="btn secondary small" type="button" onClick={() => act({ type: 'clock/advance', minutes: 15 }, 'Reloj +15 min')} data-testid="clock-15">
            +15 min
          </button>
          <button className="btn secondary small" type="button" onClick={() => act({ type: 'clock/advance', minutes: 60 }, 'Reloj +1 h')} data-testid="clock-60">
            +1 h
          </button>
          <label style={{ textTransform: 'none' }}>
            <span className="sr-only">Saltar a una hora</span>
            <select
              aria-label="Saltar a una hora"
              value=""
              data-testid="clock-jump"
              onChange={(e) => {
                const j = JUMPS[Number(e.target.value)]
                if (j) act({ type: 'clock/jump', minutes: j.minutes }, `Reloj en ${hhmm(j.minutes)}`)
              }}
            >
              <option value="">Saltar a…</option>
              {JUMPS.map((j, i) => (
                <option key={j.label} value={i}>
                  {j.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn secondary small" type="button" onClick={() => setResetOpen(true)} data-testid="reset-open">
            Reiniciar demo
          </button>
          <button
            className="btn ghost small"
            type="button"
            aria-pressed={prefs.reducedMotion === 'on'}
            onClick={() => setPrefs({ reducedMotion: prefs.reducedMotion === 'on' ? 'auto' : 'on' })}
          >
            Movimiento reducido: {prefs.reducedMotion === 'on' ? 'sí' : 'según el sistema'}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={resetOpen}
        title="Reiniciar la demo"
        confirmLabel="Reiniciar demo"
        danger
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          resetDemo(fx)
          setResetOpen(false)
          nav('/')
        }}
        body={
          <>
            <p>
              Se borran <strong>solo los datos de TableFlow</strong> de este navegador (claves <code>tableflow.demo.v1*</code>) y se restaura el seed elegido, con el reloj en lunes 19/10/2026 10:00. No se toca nada más. Si cancelás, se conserva el estado actual.
            </p>
            <fieldset>
              <legend>Seed</legend>
              <label className="choice">
                <input type="radio" name="fx" checked={fx === 'servicio'} onChange={() => setFx('servicio')} /> Servicio cargado (18 reservas, 12 pedidos, 8 clientes…)
              </label>
              <label className="choice">
                <input type="radio" name="fx" checked={fx === 'vacio'} onChange={() => setFx('vacio')} /> Vacío (perfiles, carta y stock sin actividad)
              </label>
            </fieldset>
          </>
        }
      />
    </div>
  )
}

export function Footer() {
  return (
    <footer className="site">
      <div className="wrap">
        <p>
          <DemoTag /> TableFlow es una demo frontend local con datos ficticios (Mesa Clara y Ritual Café). Los canales de WhatsApp y llamada son simulaciones: no se envían mensajes, no se usa el micrófono ni se realizan cobros. <Link to="/comercial">Alcance y cobertura de la demo</Link>
        </p>
      </div>
    </footer>
  )
}

export function PageHead({ title, children, sub }: { title: string; children?: ReactNode; sub?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · TableFlow demo`
  }, [title])
  return (
    <div className="page-title">
      <div>
        <h1 tabIndex={-1} id="page-h1">{title}</h1>
        {sub && <p className="muted" style={{ margin: 0 }}>{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  )
}

export function MainNavLink({ to, children, end, onClick, ...rest }: { to: string; children: ReactNode; end?: boolean; onClick?: () => void; [k: string]: unknown }) {
  return (
    <NavLink to={to} end={end} onClick={onClick} {...rest}>
      {children}
    </NavLink>
  )
}
