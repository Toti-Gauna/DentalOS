import { useState } from 'react';
import { useDemo } from '../../app/store';
import { navigate } from '../../app/router';
import { useUi } from '../../app/ui-state';
import { byId, locName, proName, serviceName, upcomingFor } from '../../domain/selectors';
import { fmtLong, parts } from '../../domain/time';
import { agendaLink } from '../../ui/components';
import { DentitionFront } from '../../ui/art/dentition';
import { ServiceArt } from '../../ui/art/services';
import { ProAvatar } from '../../ui/art/brand';
import { ToothCharacter } from '../../ui/art/characters';
import { Button, EmptyState, Icon, SectionHeader, StatusBadge } from '../../ui/kit';
import { PageArt } from '../../ui/art/pages';

const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function NextAppointmentCard() {
  const s = useDemo();
  const ui = useUi();
  const person = byId(s.persons, ui.actingPersonId);
  const next = person ? upcomingFor(s, person.id)[0] : undefined;
  const p = next ? parts(next.start) : null;
  return (
    <aside className="next-card" aria-labelledby="next-title">
      <p className="eyebrow" id="next-title" style={{ margin: 0 }}>Tu próximo paso{person ? ` · ${person.firstName} (${person.id})` : ''}</p>
      {next && p ? (
        <>
          <div className="next-when">
            <div className="turno-when" aria-hidden="true"><span className="turno-dow">{DOW[p.weekday]}</span><span className="turno-day tabular">{p.day}</span><span className="turno-month">{MON[p.month - 1]}</span></div>
            <div>
              <p className="big">{serviceName(s, next.serviceTypeId)}</p>
              <p className="tabular" style={{ margin: 0 }}>{fmtLong(next.start)}</p>
            </div>
          </div>
          <p style={{ margin: 0 }}>{proName(s, next.professionalId)} · {locName(s, next.locationId)}</p>
          <StatusBadge status={next.status} />
          {next.status === 'solicitada' && <p className="on-dark-muted small" style={{ margin: 0 }}>Es una solicitud: recepción la confirma. Todavía no es un turno confirmado.</p>}
          <div className="row wrap">
            <Button variant="secondary" icon="list" onClick={() => navigate('/mis-turnos')}>Ver o cambiar</Button>
            <Button variant="ghost" icon="chat" onClick={() => navigate('/whatsapp')}>Escribir por WhatsApp</Button>
          </div>
          <a className="on-dark-muted small" href={agendaLink(next)} style={{ color: 'var(--on-dark-muted)' }}>Ver este mismo turno en la agenda de recepción</a>
        </>
      ) : (
        <>
          <p className="big">Sin turnos próximos</p>
          <p className="on-dark-muted">Pedí tu primera consulta o un control. Revalidamos la disponibilidad al confirmar.</p>
          <Button variant="secondary" icon="calendar" onClick={() => navigate('/reservar')}>Pedir turno</Button>
        </>
      )}
    </aside>
  );
}

const BENEFITS = [
  { icon: 'calendar', title: 'Turnos que no se pisan', text: 'Profesional y sillón se validan juntos al confirmar.' },
  { icon: 'clock', title: 'Recordatorios a tu elección', text: 'Opt-in 24 h antes (simulado en esta demo).' },
  { icon: 'wallet', title: 'Presupuestos claros', text: 'Aceptar no es pagar; la cobertura la verifica recepción.' },
  { icon: 'refresh', title: 'Ortodoncia con seguimiento', text: 'Controles indicados por tu profesional, sin perder el hilo.' },
];

const FAQ: [string, string][] = [
  ['¿Puedo cambiar o cancelar mi turno?', 'Sí, desde Mis turnos, por WhatsApp o por llamada. Si faltan menos de 12 horas, el cambio lo gestiona recepción para no perder el horario.'],
  ['¿Cómo sé si mi turno está confirmado?', 'Cada turno muestra su estado con texto: “Confirmado” o “Pendiente de confirmación”. Una solicitud la confirma una persona de recepción; nada se confirma solo.'],
  ['¿El asistente me dice qué tratamiento necesito?', 'No. El asistente es administrativo: no evalúa síntomas ni indica tratamientos. Las decisiones clínicas las toma tu profesional en la consulta.'],
  ['¿Aceptar un presupuesto es pagarlo?', 'No. Aceptar un presupuesto no es un cobro ni un tratamiento realizado. En esta demo no hay pagos reales.'],
  ['¿Dónde quedan mis datos en esta demo?', 'Solo en este dispositivo. No hay servidor, no se envían mensajes ni se hacen llamadas reales.'],
];

export function Home() {
  const s = useDemo();
  const [filter, setFilter] = useState<'todos' | 'general' | 'ortodoncia'>('todos');
  const services = s.serviceTypes.filter((st) => filter === 'todos' || st.specialty === filter);
  const daysOf = (proId: string) => [...new Set(s.availabilityRules.filter((r) => r.professionalId === proId).map((r) => ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][r.weekday]))].join(', ');
  return (
    <section className="page home">
      <div className="hero">
        <div className="hero-copy">
          <p className="pill"><span className="pill-dot" aria-hidden="true" /> {s.clinic.name} · odontología general y ortodoncia</p>
          <h1 tabIndex={-1} data-page-title>Cada consulta tiene un <span className="accent">próximo paso.</span></h1>
          <p className="lede">Pedí tu primera visita, cambiá un turno o hablá con recepción. Información administrativa clara; las decisiones clínicas las toma tu profesional en consulta.</p>
          <div className="row wrap">
            <Button variant="primary" size="lg" icon="calendar" onClick={() => navigate('/reservar?motivo=ST-PRIMERA')}>Pedir primera consulta</Button>
            <Button size="lg" icon="book" onClick={() => navigate('/aprender')}>Cómo es la primera visita</Button>
          </div>
          <dl className="trust">
            <div><dt>Sedes</dt><dd className="tabular">{s.locations.length}</dd></div>
            <div><dt>Profesionales</dt><dd className="tabular">{s.professionals.length}</dd></div>
            <div><dt>Motivos para reservar online</dt><dd className="tabular">{s.serviceTypes.filter((x) => x.selfService).length}</dd></div>
          </dl>
        </div>
        <div className="hero-visual">
          <div className="hero-stage" aria-hidden="true">
            <DentitionFront gold width={420} />
            <span className="sparkle s1" /><span className="sparkle s2" /><span className="sparkle s3" />
          </div>
          <NextAppointmentCard />
        </div>
      </div>

      <ul className="benefits" aria-label="Lo que cuida la clínica">
        {BENEFITS.map((b) => (
          <li key={b.title}><span className="benefit-ico" aria-hidden="true"><Icon name={b.icon} size={20} /></span><span><strong>{b.title}</strong><span className="small muted">{b.text}</span></span></li>
        ))}
      </ul>

      <section aria-labelledby="how-title" className="how home-section">
        <SectionHeader eyebrow="Cómo funciona" id="how-title" title="Tres pasos, sin vueltas">Pedís, recepción confirma y seguís tu próximo paso con el mismo número de turno en todos los canales.</SectionHeader>
        <ol className="how-steps">
          <li><span className="how-n">1</span><div><strong>Elegís motivo y horario</strong><p>Por web, WhatsApp o llamada. Revalidamos profesional y sillón al confirmar.</p></div></li>
          <li><span className="how-n">2</span><div><strong>Recepción confirma</strong><p>Si es una solicitud, una persona la revisa. Nada se confirma solo.</p></div></li>
          <li><span className="how-n">3</span><div><strong>Seguís tu próximo paso</strong><p>Mismo número de turno en tu portal y en la clínica, siempre actualizado.</p></div></li>
        </ol>
      </section>

      <section aria-labelledby="services-title" className="stack home-section">
        <div className="section-head">
          <div><p className="eyebrow">Motivos de consulta</p><h2 id="services-title">¿Qué necesitás hoy?</h2></div>
          <div className="chips" role="group" aria-label="Filtrar motivos">
            {([['todos', 'Todos'], ['general', 'Odontología general'], ['ortodoncia', 'Ortodoncia']] as const).map(([k, l]) => (
              <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} <span className="tabular">({s.serviceTypes.filter((st) => k === 'todos' || st.specialty === k).length})</span></button>
            ))}
          </div>
        </div>
        <p className="muted" style={{ margin: 0 }}>Elegí un motivo administrativo. Si no sabés cuál, recepción te orienta: no hace falta adivinar.</p>
        <div className="service-grid" aria-live="polite">
          {services.map((st) => (
            <article key={st.id} className="card service lift">
              <ServiceArt serviceTypeId={st.id} size={84} />
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
            <ToothCharacter who="ivo" mood="guino" size={80} />
            <h3>No sé qué motivo elegir</h3>
            <p>Recepción te ayuda a elegir. El asistente no evalúa síntomas ni indica tratamientos.</p>
            <Button onClick={() => navigate('/whatsapp')} icon="chat">Hablar con recepción</Button>
          </article>
        </div>
      </section>

      <section aria-labelledby="team-title" className="stack home-section">
        <SectionHeader eyebrow="Equipo" id="team-title" title="Profesionales de la clínica">Odontología general y ortodoncia en dos sedes. Elegís con quién atenderte al reservar.</SectionHeader>
        <div className="team-grid">
          {s.professionals.map((p, i) => (
            <article key={p.id} className="card team-card lift">
              <ProAvatar name={p.name} specialty={p.specialty} index={i} size={64} />
              <div className="stack" style={{ gap: 4 }}>
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                <p className="muted small" style={{ margin: 0 }}>{p.specialty} · {daysOf(p.id)}</p>
                <p className="small" style={{ margin: 0 }}>{p.bio}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>Equipo ficticio de la demo. Los avatares son ilustraciones, no fotos de personas reales.</p>
      </section>

      <section className="kids-band" aria-labelledby="kids-title">
        <div className="kids-band-art" aria-hidden="true">
          <ToothCharacter who="coco" mood="valiente" size={96} />
          <ToothCharacter who="lia" mood="feliz" size={80} />
          <ToothCharacter who="mora" mood="guino" size={104} />
        </div>
        <div className="stack">
          <p className="eyebrow">Brisa Chicos</p>
          <h2 id="kids-title">Una primera visita sin miedo</h2>
          <p style={{ margin: 0 }}>Personajes, un cuento de la primera visita y un reloj de cepillado de dos minutos con stickers. Para jugar en familia.</p>
          <div><Button variant="primary" icon="smile" onClick={() => navigate('/chicos')}>Ir a Brisa Chicos</Button></div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="stack home-section">
        <SectionHeader eyebrow="Preguntas frecuentes" id="faq-title" title="Lo que más nos preguntan" />
        <div className="faq">
          {FAQ.map(([q, a], i) => (
            <details key={q} name="faq" open={i === 0}>
              <summary>{q}</summary>
              <p className="faq-body">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="sedes-title" className="stack home-section">
        <SectionHeader eyebrow="Sedes" id="sedes-title" title="Dos sedes, la misma agenda">Elegí la que te quede cómoda; recepción ve los turnos de ambas.</SectionHeader>
        <div className="sede-grid">
          {s.locations.map((l) => (
            <article key={l.id} className="card sede-card lift">
              <div className="sede-art" aria-hidden="true"><PageArt kind="sede" /></div>
              <div className="stack" style={{ gap: 6 }}>
                <h3 style={{ margin: 0 }}>{l.name}</h3>
                <p className="row" style={{ margin: 0 }}><Icon name="map" /> {l.address}</p>
                <p className="muted small" style={{ margin: 0 }}><Icon name="clock" size={14} /> {l.hoursText}</p>
                <div className="row wrap"><Button size="sm" onClick={() => navigate(`/sedes/${l.id}`)}>Ver sede y equipo</Button><Button size="sm" variant="quiet" onClick={() => navigate(`/reservar?sede=${l.id}`)}>Reservar acá</Button></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta" aria-labelledby="final-title">
        <div>
          <p className="eyebrow">Tu próximo paso</p>
          <h2 id="final-title">Pedí tu turno en menos de un minuto</h2>
          <p style={{ margin: 0 }}>Elegís motivo y horario; recepción revalida la agenda. Sin llamadas de espera ni mensajes reales en esta demo.</p>
        </div>
        <div className="row wrap">
          <Button variant="primary" size="lg" icon="calendar" onClick={() => navigate('/reservar')}>Pedir turno</Button>
          <Button size="lg" icon="chat" onClick={() => navigate('/whatsapp')}>Escribir por WhatsApp</Button>
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
      <header className="page-head has-art"><div><p className="eyebrow">Sede ficticia</p><h1 tabIndex={-1} data-page-title>{l.name}</h1><p className="lede">{l.address} · {l.hoursText}</p></div><div className="page-art" aria-hidden="true"><PageArt kind="sede" /></div></header>
      <div className="grid-2">
        <article className="card"><h2>Cómo llegar</h2><p>{l.access}</p><p className="muted small">Sin mapas ni servicios externos: la dirección es de muestra.</p></article>
        <article className="card"><h2>Sillones</h2><ul className="chips" aria-label="Sillones de la sede" style={{ listStyle: 'none', padding: 0, margin: 0 }}>{s.chairs.filter((c) => c.locationId === l.id).map((c) => <li key={c.id} className="chair-chip"><Icon name="check" size={14} /> {c.name}</li>)}</ul></article>
      </div>
      <h2>Equipo en esta sede</h2>
      <div className="service-grid">
        {pros.map((p) => (
          <article key={p.id} className="card lift stack">
            <div className="with-avatar"><ProAvatar name={p.name} specialty={p.specialty} index={s.professionals.indexOf(p)} size={56} /><div><h3 style={{ margin: 0 }}>{p.name}</h3><p className="muted" style={{ margin: 0 }}>{p.specialty}</p></div></div><p style={{ margin: 0 }}>{p.bio}</p>
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
