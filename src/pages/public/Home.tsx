import { useDemo } from '../../app/store';
import { navigate } from '../../app/router';
import { useUi } from '../../app/ui-state';
import { byId, locName, proName, serviceName, upcomingFor } from '../../domain/selectors';
import { fmtLong } from '../../domain/time';
import { Button, EmptyState, Icon, StatusBadge } from '../../ui/kit';

function NextAppointmentCard() {
  const s = useDemo();
  const ui = useUi();
  const person = byId(s.persons, ui.actingPersonId);
  const next = person ? upcomingFor(s, person.id)[0] : undefined;
  return (
    <aside className="next-card" aria-labelledby="next-title">
      <p className="eyebrow" id="next-title">Tu próximo paso{person ? ` · ${person.firstName} (${person.id})` : ''}</p>
      {next ? (
        <>
          <p className="big">{serviceName(s, next.serviceTypeId)}</p>
          <p className="tabular">{fmtLong(next.start)}<br />{proName(s, next.professionalId)} · {locName(s, next.locationId)}</p>
          <StatusBadge status={next.status} />
          <div className="row wrap">
            <Button variant="secondary" icon="list" onClick={() => navigate('/mis-turnos')}>Ver o cambiar</Button>
            <Button variant="ghost" icon="chat" onClick={() => navigate('/whatsapp')} style={{ color: '#fff' }}>Escribir por WhatsApp</Button>
          </div>
        </>
      ) : (
        <>
          <p className="big">Sin turnos próximos</p>
          <p className="muted">Pedí tu primera consulta o un control. Revalidamos la disponibilidad al confirmar.</p>
          <Button variant="secondary" icon="calendar" onClick={() => navigate('/reservar')}>Pedir turno</Button>
        </>
      )}
    </aside>
  );
}

export function Home() {
  const s = useDemo();
  return (
    <section className="page">
      <div className="hero">
        <div>
          <p className="eyebrow">{s.clinic.name} · odontología general y ortodoncia</p>
          <h1 tabIndex={-1} data-page-title>Cada consulta tiene un próximo paso.</h1>
          <p className="lede">Pedí tu primera visita, cambiá un turno o hablá con recepción. Información administrativa clara; las decisiones clínicas las toma tu profesional en consulta.</p>
          <div className="row wrap">
            <Button variant="primary" size="lg" icon="calendar" onClick={() => navigate('/reservar?motivo=ST-PRIMERA')}>Pedir primera consulta</Button>
            <Button size="lg" icon="book" onClick={() => navigate('/aprender')}>Cómo es la primera visita</Button>
          </div>
        </div>
        <NextAppointmentCard />
      </div>

      <section aria-labelledby="services-title" className="stack">
        <h2 id="services-title">Motivos de consulta</h2>
        <p className="muted">Elegí un motivo administrativo. Si no sabés cuál, recepción te orienta: no hace falta adivinar.</p>
        <div className="service-grid">
          {s.serviceTypes.map((st) => (
            <article key={st.id} className="card service">
              <h3>{st.name}</h3>
              <span className="duration tabular"><Icon name="clock" size={14} /> {st.durationMin} min · {st.specialty === 'ortodoncia' ? 'Ortodoncia' : 'Odontología general'}</span>
              <p>{st.summary}</p>
              <p className="muted small">{st.forWhom}</p>
              <div className="row wrap">
                <Button variant="quiet" size="sm" onClick={() => navigate(`/servicios/${st.id}`)}>Más información</Button>
                {st.selfService && !st.requiresIndicatedControl
                  ? <Button variant="primary" size="sm" onClick={() => navigate(`/reservar?motivo=${st.id}`)}>Pedir este turno</Button>
                  : <Button size="sm" onClick={() => navigate('/whatsapp')}>Pedir ayuda a recepción</Button>}
              </div>
            </article>
          ))}
          <article className="card service sand">
            <h3>No sé qué motivo elegir</h3>
            <p>Recepción te ayuda a elegir. El asistente no evalúa síntomas ni indica tratamientos.</p>
            <Button onClick={() => navigate('/whatsapp')} icon="chat">Hablar con recepción</Button>
          </article>
        </div>
      </section>

      <section aria-labelledby="sedes-title" className="grid-2">
        <div className="stack">
          <h2 id="sedes-title">Sedes</h2>
          {s.locations.map((l) => (
            <article key={l.id} className="card">
              <h3>{l.name}</h3>
              <p className="row"><Icon name="map" /> {l.address}</p>
              <p className="muted">{l.hoursText}</p>
              <Button size="sm" onClick={() => navigate(`/sedes/${l.id}`)}>Ver sede y equipo</Button>
            </article>
          ))}
        </div>
        <div className="stack">
          <h2>Tu primera visita, paso a paso</h2>
          <ol className="steps">
            <li><div><strong>Pedís el turno</strong><br /><span className="muted">Por web, WhatsApp o llamada. Queda como solicitud hasta que recepción la confirma.</span></div></li>
            <li><div><strong>Recepción confirma</strong><br /><span className="muted">Revalida la agenda y te avisa (en esta demo, nada se envía de verdad).</span></div></li>
            <li><div><strong>Llegás a la sede</strong><br /><span className="muted">Recepción registra tu llegada. La profesional define los próximos pasos.</span></div></li>
          </ol>
          <p className="muted small">La guía educativa es opcional: toda esta información está disponible sin jugar.</p>
        </div>
      </section>
    </section>
  );
}

export function LocationPage({ id }: { id: string }) {
  const s = useDemo();
  const l = byId(s.locations, id);
  if (!l) {
    return (
      <section className="page narrow">
        <h1 tabIndex={-1} data-page-title>Sede no encontrada</h1>
        <EmptyState title={`No existe la sede "${id}" en esta demo.`} action={<Button variant="primary" onClick={() => navigate('/')}>Volver a sedes</Button>} />
      </section>
    );
  }
  const pros = s.professionals.filter((p) => s.availabilityRules.some((r) => r.professionalId === p.id && r.locationId === l.id));
  return (
    <section className="page">
      <header className="page-head"><div><p className="eyebrow">Sede ficticia</p><h1 tabIndex={-1} data-page-title>{l.name}</h1><p className="lede">{l.address} · {l.hoursText}</p></div></header>
      <div className="grid-2">
        <article className="card"><h2>Cómo llegar</h2><p>{l.access}</p><p className="muted small">Sin mapas ni servicios externos: la dirección es de muestra.</p></article>
        <article className="card"><h2>Sillones</h2><ul className="plain">{s.chairs.filter((c) => c.locationId === l.id).map((c) => <li key={c.id}>{c.name}</li>)}</ul></article>
      </div>
      <h2>Equipo en esta sede</h2>
      <div className="service-grid">
        {pros.map((p) => (
          <article key={p.id} className="card">
            <h3>{p.name}</h3><p className="muted">{p.specialty}</p><p>{p.bio}</p>
            <Button variant="primary" size="sm" onClick={() => navigate(`/reservar?profesional=${p.id}&sede=${l.id}`)}>Pedir turno con {p.name.split(' ')[0]} {p.name.split(' ')[1]}</Button>
          </article>
        ))}
      </div>
      <div><Button icon="back" onClick={() => navigate('/')}>Volver al inicio</Button></div>
    </section>
  );
}

export function ServicePage({ id }: { id: string }) {
  const s = useDemo();
  const st = byId(s.serviceTypes, id);
  if (!st) {
    return (
      <section className="page narrow">
        <h1 tabIndex={-1} data-page-title>Motivo no encontrado</h1>
        <EmptyState title="Ese motivo no existe en la demo." action={<Button variant="primary" onClick={() => navigate('/')}>Ver motivos</Button>} />
      </section>
    );
  }
  const pros = s.professionals.filter((p) => p.serviceTypeIds.includes(st.id));
  return (
    <section className="page narrow">
      <header className="page-head"><div><p className="eyebrow">Motivo administrativo</p><h1 tabIndex={-1} data-page-title>{st.name}</h1><p className="lede">{st.summary}</p></div></header>
      <article className="card stack">
        <dl className="kv">
          <dt>Duración de muestra</dt><dd className="tabular">{st.durationMin} minutos</dd>
          <dt>Para quién</dt><dd>{st.forWhom}</dd>
          <dt>Confirmación</dt><dd>{st.needsReceptionConfirmation ? 'Queda como solicitud hasta que recepción la confirma.' : 'Se confirma al reservar si el cupo sigue libre.'}</dd>
          <dt>Profesionales</dt><dd>{pros.map((p) => p.name).join(', ')}</dd>
        </dl>
        {st.requiresIndicatedControl && <p className="muted">Se reserva solo cuando tu profesional indicó el control. Si no lo tenés indicado, recepción te ayuda.</p>}
        {!st.selfService && <p className="muted">Lo coordina recepción cuando la profesional lo indicó.</p>}
        <p className="muted small">Información administrativa: no reemplaza la evaluación profesional.</p>
        <div className="row wrap">
          {st.selfService ? <Button variant="primary" onClick={() => navigate(`/reservar?motivo=${st.id}`)}>Pedir este turno</Button> : <Button variant="primary" onClick={() => navigate('/whatsapp')}>Pedir ayuda a recepción</Button>}
          <Button icon="back" onClick={() => navigate('/')}>Volver</Button>
        </div>
      </article>
    </section>
  );
}
