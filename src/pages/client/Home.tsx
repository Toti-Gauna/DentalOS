import { Link } from 'react-router-dom'
import { useBiz } from '../../ui/hooks'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Callout } from '../../ui/kit'
import { windowsFor, locationOpenNow } from '../../domain/availability'
import { dateKeyOf, hhmm, minutesOfDay } from '../../domain/time'
import { eventSeats } from '../../domain/cmd-engage'
import { fmtDateShort } from '../../domain/time'

export function Home() {
  const { state, biz, locationId } = useBiz()
  const today = dateKeyOf(state.clock.nowMs)
  const wins = windowsFor(state, locationId, today)
  const open = locationOpenNow(state, locationId)
  const events = state.tastingEvents.filter((e) => e.businessId === biz.id && e.status === 'abierta')
  const isRest = biz.kind === 'bodegon'
  const nowMin = minutesOfDay(state.clock.nowMs)
  const nextOpen = wins.find((w) => w.startMin > nowMin)
  return (
    <main>
      <PageHead title={biz.name} sub={biz.tagline} />
      <section className="hero">
        <p className="lead">{biz.story}</p>
        <div className="row">
          <Link className="btn" to={`/${biz.id}/carta`}>Ver la carta</Link>
          {biz.reservationsEnabled ? (
            <Link className="btn accent" to={`/${biz.id}/reservar`}>Reservar una mesa</Link>
          ) : (
            <Badge tone="info" label="Atendemos por orden de llegada" icon="➜" />
          )}
          <Link className="btn secondary" to={`/${biz.id}/explorar`}>Explorar sabores</Link>
        </div>
        {!biz.reservationsEnabled && (
          <Callout>
            En este perfil atendemos por orden de llegada: no tomamos reservas. La carta está disponible y podés {biz.kind === 'cafe' ? 'pedir para retirar por franja' : 'pedir en tu mesa'}.
          </Callout>
        )}
      </section>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <section className="card" aria-labelledby="hoy">
          <h2 id="hoy">Hoy · {fmtDateShort(today)}</h2>
          <p>
            {open ? <Badge tone="ok" label="Abierto ahora" icon="●" /> : <Badge tone="warn" label="Cerrado en este momento" icon="○" />}{' '}
            <span className="muted small">(según el reloj simulado, {hhmm(nowMin)})</span>
          </p>
          <ul>
            {wins.length ? wins.map((w) => <li key={w.id}>{w.label}: {hhmm(w.startMin)}–{hhmm(w.endMin)}</li>) : <li>Hoy no hay servicio.</li>}
          </ul>
          {!open && nextOpen && <p className="muted">Abre a las {hhmm(nextOpen.startMin)}. Usá el reloj de la demo para saltar a esa hora.</p>}
          {!open && isRest && (
            <button className="btn secondary small" type="button" onClick={() => act({ type: 'clock/jump', minutes: 12 * 60 }, 'Reloj en 12:00')}>
              Ir a las 12:00
            </button>
          )}
        </section>
        <section className="card" aria-labelledby="catas">
          <h2 id="catas">Próximas catas</h2>
          {events.length === 0 ? (
            <p className="muted">No hay catas programadas.</p>
          ) : (
            <ul>
              {events.map((e) => {
                const { free } = eventSeats(state, e)
                return (
                  <li key={e.id}>
                    <Link to={`/${biz.id}/catas`}>{e.title}</Link> · {fmtDateShort(e.dateKey)} {hhmm(e.startMin)} · {free > 0 ? `${free} lugar(es)` : 'cupo completo'}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="tour">
        <h2 id="tour">Recorrido guiado de 60–90 segundos</h2>
        {isRest ? (
          <ol>
            <li>
              Pasá el reloj a las 12:00 (el salón abre al mediodía):{' '}
              <button className="btn secondary small" type="button" onClick={() => act({ type: 'clock/jump', minutes: 12 * 60 }, 'Reloj en 12:00')}>Ir a las 12:00</button>
            </li>
            <li><Link to={`/${biz.id}/carta`}>Elegí una milanesa</Link> con guarnición y agregala.</li>
            <li><Link to={`/${biz.id}/pedido`}>Mi pedido</Link>: indicá tu mesa y enviá. Verás el folio.</li>
            <li>Como <Link to="/admin/pedidos">recepción</Link>, aceptá el pedido; en <Link to="/admin/cocina">cocina</Link> prepará y marcá listo; el <Link to="/admin/salon">mozo</Link> lo sirve.</li>
            <li>En <Link to="/admin/caja">caja</Link> abrí la caja, dividí la cuenta, registrá los pagos DEMO y cerrá la mesa.</li>
          </ol>
        ) : (
          <ol>
            <li>Elegí la sede en la barra de la demo (Centro o Norte).</li>
            <li><Link to={`/${biz.id}/explorar`}>Explorá sabores</Link> o andá a la <Link to={`/${biz.id}/carta`}>carta</Link>.</li>
            <li>Configurá un flat white (tamaño y leche) y pedilo para <Link to={`/${biz.id}/pedido`}>retirar</Link>.</li>
            <li>Como <Link to="/admin/cocina">barra</Link>, aceptá, prepará y marcá listo; después marcá retirado.</li>
          </ol>
        )}
      </section>
    </main>
  )
}
