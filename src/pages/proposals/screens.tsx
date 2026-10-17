// Pantallas de muestra de cada propuesta, con el mismo contenido real (inicio del paciente, hoy y agenda,
// reserva móvil, WhatsApp y familia de marca). Son prototipos de dirección visual, no pantallas productivas:
// los botones no ejecutan comandos.
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../../ui/kit';
import { ToothCharacter } from '../../ui/art/characters';
import { HeroArt, MOLAR } from './art';
import type { Content } from './content';
import type { PropId } from './tokens';

const NAV = ['Inicio', 'Reservar', 'Mis turnos', 'WhatsApp', 'Chicos'];
const ADMIN_NAV: [string, string][] = [['calendar', 'Hoy y agenda'], ['inbox', 'Bandeja'], ['user', 'Personas'], ['tooth', 'Odontograma'], ['refresh', 'Ortodoncia'], ['wallet', 'Presupuestos'], ['chart', 'Informes']];

export function Logo({ prop }: { prop: PropId }) {
  return (
    <span className="pp-logo">
      <svg viewBox="100 40 120 160" aria-hidden="true" focusable="false" className="pp-logo-mark">
        {prop === 'c'
          ? <><rect x="114" y="46" width="92" height="78" rx="30" fill="var(--pp-accent)" /><rect x="126" y="100" width="26" height="86" rx="13" fill="var(--pp-accent)" /><rect x="168" y="100" width="26" height="86" rx="13" fill="var(--pp-accent)" /></>
          : <path d={MOLAR} fill={prop === 'a' ? 'none' : 'var(--pp-accent)'} stroke="var(--pp-accent)" strokeWidth={prop === 'a' ? 9 : 0} strokeLinejoin="round" />}
      </svg>
      <span className="pp-logo-word"><strong>Clínica Brisa</strong><small>DentalOS · demo</small></span>
    </span>
  );
}

function DemoPill() {
  return <span className="pp-demo" title="Demostración con datos ficticios: no hay envíos, cobros ni turnos reales"><Icon name="info" size={13} /> Demo</span>;
}

/** Botonera de demostración (abajo a la derecha), plegada: vista previa del lote 3. */
function Dock() {
  return <span className="pp-dock" aria-hidden="true"><Icon name="settings" size={16} /> <span>Demo</span></span>;
}

export function StatusChip({ prop, status, label }: { prop: PropId; status: string; label: string }) {
  const tone = status === 'confirmada' ? 'ok' : status === 'solicitada' ? 'warn' : 'neutral';
  return (
    <span className={`pp-chip pp-chip-${tone}`}>
      {prop === 'c'
        ? <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false" className="pp-shape">{tone === 'ok' ? <circle cx="5" cy="5" r="4" /> : tone === 'warn' ? <path d="M5 1 L9 9 H1 Z" /> : <rect x="1" y="1" width="8" height="8" />}</svg>
        : <span className="pp-dot" aria-hidden="true" />}
      {label}
    </span>
  );
}

export function Frame({ prop, kind, label, style, children }: { prop: PropId; kind: 'desk' | 'phone'; label: string; style: CSSProperties; children: ReactNode }) {
  return (
    <figure className={`pp-figure pp-figure-${kind}`}>
      <figcaption>{label}</figcaption>
      <div className={kind === 'desk' ? 'pp-scroll' : 'pp-phone-wrap'}>
        <div className={`pp-frame pp-frame-${kind}`} data-prop={prop} style={style}>{children}</div>
      </div>
    </figure>
  );
}

function SiteHeader({ prop }: { prop: PropId }) {
  return (
    <header className="pp-header">
      <Logo prop={prop} />
      <nav aria-label="Navegación de muestra"><ul>{NAV.map((n, i) => <li key={n}><span className={i === 0 ? 'is-current' : ''}>{n}</span></li>)}</ul></nav>
      <div className="pp-header-end"><DemoPill /><span className="pp-btn pp-btn-primary pp-btn-sm">Pedir turno</span></div>
    </header>
  );
}

// ---------- Inicio del paciente ----------
export function HomeScreen({ prop, c }: { prop: PropId; c: Content }) {
  const n = c.next;
  const nextCard = n && (
    prop === 'a' ? (
      <article className="pp-folio" aria-label="Tu próximo paso">
        <p className="pp-eyebrow">Tu próximo paso · {c.person.first} ({c.person.id})</p>
        <div className="pp-folio-date">
          <span className="pp-folio-day">{n.day}</span>
          <span className="pp-folio-meta"><span>{n.dowLong}</span><span>{n.monthLong}</span><strong>{n.time} h</strong></span>
        </div>
        <p className="pp-folio-service">{n.service}</p>
        <p className="pp-muted">{n.pro} · {n.loc}</p>
        <div className="pp-row"><StatusChip prop={prop} status={n.status} label={n.statusLabel} /><span className="pp-link">Ver o cambiar →</span></div>
      </article>
    ) : prop === 'b' ? (
      <article className="pp-glass pp-next-b" aria-label="Tu próximo paso">
        <svg viewBox="0 0 44 44" className="pp-ring-count" aria-hidden="true" focusable="false"><circle cx="22" cy="22" r="18" fill="none" stroke="var(--pp-line)" strokeWidth="4" /><circle cx="22" cy="22" r="18" fill="none" stroke="var(--pp-accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${113 * (1 - Math.min(n.daysAway, 7) / 7)} 113`} transform="rotate(-90 22 22)" /><text x="22" y="26" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--pp-ink)">{n.daysAway}d</text></svg>
        <div>
          <p className="pp-row pp-between"><span className="pp-eyebrow">Tu próximo turno · {c.person.first}</span><StatusChip prop={prop} status={n.status} label={n.statusLabel} /></p>
          <p className="pp-next-b-when">{n.dow} {n.day} {n.month} · {n.time}</p>
          <p className="pp-muted">{n.service} · {n.pro}</p>
        </div>
      </article>
    ) : (
      <article className="pp-card pp-next-c" aria-label="Tu próximo paso">
        <div className="pp-row pp-between"><p className="pp-label">Próximo turno</p><span className="pp-mono pp-muted">{n.id}</span></div>
        <p className="pp-next-c-time"><span className="pp-mono">{n.time}</span> <span>{n.dow} {n.dateShort}</span></p>
        <p>{n.service}</p>
        <p className="pp-muted">{n.pro} · {n.loc} · {n.chair}</p>
        <ol className="pp-rail-list">
          <li className="is-done"><span className="pp-mono">✓</span> Solicitado</li>
          <li className="is-done"><span className="pp-mono">✓</span> Confirmado</li>
          <li><span className="pp-mono">24 h</span> Recordatorio (simulado)</li>
          <li><span className="pp-mono">{n.time}</span> Consulta</li>
        </ol>
        <StatusChip prop={prop} status={n.status} label={n.statusLabel} />
      </article>
    )
  );

  return (
    <div className="pp-home">
      {prop === 'b' && <div className="pp-mist" aria-hidden="true"><span /><span /><span /></div>}
      <SiteHeader prop={prop} />
      <section className="pp-hero">
        <div className="pp-hero-copy">
          <p className="pp-eyebrow">Clínica Brisa · odontología general y ortodoncia</p>
          <h1 className="pp-h1">Cada consulta tiene un <em>próximo paso.</em></h1>
          <p className="pp-lede">Pedí tu primera visita, cambiá un turno o hablá con recepción. Información administrativa clara; las decisiones clínicas las toma tu profesional en consulta.</p>
          <div className="pp-row">
            <span className="pp-btn pp-btn-primary">Pedir primera consulta</span>
            <span className="pp-btn pp-btn-ghost">Cómo es la primera visita</span>
          </div>
          {prop === 'a' && (
            <ol className="pp-steps-a">
              <li><span>01</span>Pedís online, por WhatsApp o por teléfono.</li>
              <li><span>02</span>Recepción confirma sillón y profesional.</li>
              <li><span>03</span>Seguís tu próximo paso con el mismo número de turno.</li>
            </ol>
          )}
          {prop === 'b' && (
            <ul className="pp-tiles-b">
              {[['calendar', 'Reservar'], ['list', 'Mis turnos'], ['chat', 'WhatsApp'], ['smile', 'Chicos']].map(([i, t]) => <li key={t} className="pp-glass"><Icon name={i} size={18} /> {t}</li>)}
            </ul>
          )}
        </div>
        <div className="pp-hero-side">
          <HeroArt prop={prop} />
          {nextCard}
        </div>
      </section>
      <Dock />
    </div>
  );
}

// ---------- Hoy y agenda (panel) ----------
export function AgendaScreen({ prop, c }: { prop: PropId; c: Content }) {
  const t = c.today;
  const span = t.toMin - t.fromMin;
  const hours: number[] = [];
  for (let m = Math.ceil(t.fromMin / 60) * 60; m <= t.toMin; m += 60) hours.push(m);
  const pct = (m: number) => `${((m - t.fromMin) / span) * 100}%`;
  return (
    <div className="pp-admin">
      {prop === 'b' && <div className="pp-mist" aria-hidden="true"><span /><span /><span /></div>}
      <header className="pp-header pp-header-admin">
        <Logo prop={prop} />
        <span className="pp-search"><Icon name="search" size={15} /> Buscar persona, turno o módulo <kbd>Ctrl K</kbd></span>
        <div className="pp-header-end"><DemoPill /><span className="pp-avatar" aria-hidden="true">R</span></div>
      </header>
      <div className="pp-admin-body">
        <nav className="pp-side" aria-label="Panel de muestra">
          <p className="pp-side-h">Operación</p>
          <ul>{ADMIN_NAV.map(([i, l], k) => <li key={l} className={k === 0 ? 'is-current' : ''}><Icon name={i} size={16} /> {l}</li>)}</ul>
        </nav>
        <main className="pp-admin-main">
          <div className="pp-row pp-between pp-admin-title">
            <div><p className="pp-eyebrow">Recepción · Sede Centro y Norte</p><h2 className="pp-h2">Hoy · {t.label}</h2></div>
            <div className="pp-row"><span className="pp-btn pp-btn-ghost pp-btn-sm">Semana</span><span className="pp-btn pp-btn-primary pp-btn-sm">Nuevo turno</span></div>
          </div>
          <dl className="pp-kpis">
            {t.kpis.map((k) => <div key={k.label} className="pp-kpi"><dt>{k.label}</dt><dd>{k.value}</dd><span className="pp-small pp-muted">{k.hint}</span></div>)}
          </dl>
          <div className="pp-agenda" style={{ ['--cols' as string]: t.chairs.length, ['--span' as string]: span }}>
            <div className="pp-agenda-axis" aria-hidden="true">{hours.map((h) => <span key={h} style={{ top: pct(h) }}>{`${String(h / 60).padStart(2, '0')}:00`}</span>)}</div>
            {t.chairs.map((ch) => (
              <section key={ch.id} className="pp-agenda-col" aria-label={`${ch.name}, ${ch.loc}`}>
                <header><strong>{ch.name}</strong><span className="pp-small pp-muted">{ch.loc}</span></header>
                <div className="pp-agenda-track">
                  {hours.map((h) => <span key={h} className="pp-hour-line" style={{ top: pct(h) }} />)}
                  <span className="pp-now" style={{ top: pct(t.nowMin) }} aria-hidden="true" />
                  {ch.items.length === 0 && <p className="pp-empty pp-small">Sin turnos hoy</p>}
                  {ch.items.map((it) => (
                    <article key={it.id} className={`pp-appt pp-appt-${it.status}${it.endMin - it.startMin < 45 ? ' is-short' : it.endMin - it.startMin < 60 ? ' is-mid' : ''}`} style={{ top: pct(it.startMin), height: `calc(${((it.endMin - it.startMin) / span) * 100}% - 4px)` }}>
                      <p className="pp-appt-time"><span className="pp-mono">{it.start}<span className="pp-appt-end">–{it.end}</span></span> <span className="pp-mono pp-muted">{it.id}</span></p>
                      <p className="pp-appt-name">{it.patient}</p>
                      <p className="pp-small pp-muted">{it.service}</p>
                      <StatusChip prop={prop} status={it.status} label={it.statusLabel} />
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
      <Dock />
    </div>
  );
}

// ---------- Reserva en el teléfono (390 px) ----------
export function BookingScreen({ prop, c }: { prop: PropId; c: Content }) {
  const b = c.booking;
  const sel = b.days.find((d) => d.date === b.selectedDate);
  const chip = (t: string) => <li key={t}><span className={`pp-slot ${t === b.selectedTime ? 'is-selected' : ''}`}>{t}</span></li>;
  return (
    <div className="pp-mobile">
      {prop === 'b' && <div className="pp-mist" aria-hidden="true"><span /><span /><span /></div>}
      <header className="pp-appbar">
        <span className="pp-icon-btn" aria-hidden="true"><Icon name="back" size={18} /></span>
        <strong>Pedir turno</strong>
        <DemoPill />
      </header>
      <ol className="pp-stepper" aria-label="Paso 2 de 4">{['Motivo', 'Horario', 'Datos', 'Revisar'].map((s, i) => <li key={s} className={i < 1 ? 'is-done' : i === 1 ? 'is-current' : ''}><span>{i + 1}</span>{s}</li>)}</ol>
      <div className="pp-mobile-body">
        <p className="pp-eyebrow">{b.service} · {b.minutes} min</p>
        <h2 className="pp-h2">Elegí el horario</h2>
        <ul className="pp-days">{b.days.map((d) => <li key={d.date}><span className={`pp-day ${d.date === b.selectedDate ? 'is-selected' : ''}`}><small>{d.dow}</small><strong>{d.day}</strong><small>{d.count} lib.</small></span></li>)}</ul>
        <p className="pp-label">Mañana</p>
        <ul className="pp-slots">{b.morning.slice(0, 9).map(chip)}</ul>
        {b.afternoon.length > 0 && <><p className="pp-label">Tarde</p><ul className="pp-slots">{b.afternoon.slice(0, 6).map(chip)}</ul></>}
        <p className="pp-small pp-muted">Es una solicitud: recepción la confirma. Revalidamos la disponibilidad al enviar.</p>
      </div>
      <footer className="pp-mobile-cta">
        <span className="pp-small">{sel ? `${sel.dow} ${sel.day}` : ''} · <strong>{b.selectedTime ?? '—'}</strong></span>
        <span className="pp-btn pp-btn-primary">Continuar</span>
      </footer>
    </div>
  );
}

// ---------- WhatsApp simulado en el teléfono ----------
export function ChatScreen({ prop, c }: { prop: PropId; c: Content }) {
  return (
    <div className="pp-mobile pp-chat">
      {prop === 'b' && <div className="pp-mist" aria-hidden="true"><span /><span /><span /></div>}
      <header className="pp-appbar pp-chat-bar">
        <span className="pp-chat-avatar" aria-hidden="true"><Logo prop={prop} /></span>
        <span><strong>Clínica Brisa</strong><small className="pp-muted"> · asistente local</small></span>
        <span className="pp-sim">Simulación</span>
      </header>
      <ol className="pp-thread">
        {c.chat.map((m, i) => (
          <li key={i} className={`pp-msg pp-msg-${m.from}`}>
            <p>{m.text}</p>
            {m.chips && <ul className="pp-msg-chips">{m.chips.map((ch) => <li key={ch}><span>{ch}</span></li>)}</ul>}
          </li>
        ))}
      </ol>
      <footer className="pp-composer"><span>Escribí un mensaje</span><span className="pp-icon-btn pp-send" aria-hidden="true"><Icon name="arrow" size={16} /></span></footer>
    </div>
  );
}

// ---------- Familia de la marca: general, ortodoncia y Brisa Chicos ----------
export function BrandFamily({ prop }: { prop: PropId }) {
  return (
    <ul className="pp-family">
      <li className="pp-fam pp-fam-general"><Logo prop={prop} /><p><strong>General</strong><span className="pp-small pp-muted">Portal, reserva, panel. Acento principal.</span></p></li>
      <li className="pp-fam pp-fam-ortho">
        <svg viewBox="0 0 120 50" aria-hidden="true" focusable="false" className="pp-fam-art">{[14, 38, 62, 86].map((x) => <g key={x}><rect x={x} y="10" width="20" height="30" rx={prop === 'c' ? 6 : 9} fill="var(--pp-surface)" stroke="var(--pp-ink)" strokeOpacity=".35" /><rect x={x + 6} y="21" width="8" height="8" rx="1.5" fill="var(--pp-accent2)" /></g>)}<path d="M10 25 H110" stroke="var(--pp-accent2-ink)" strokeWidth="1.6" /></svg>
        <p><strong>Ortodoncia</strong><span className="pp-small pp-muted">Mismo sistema; segundo acento para continuidad y controles.</span></p>
      </li>
      <li className="pp-fam pp-fam-kids"><ToothCharacter who="lia" mood="feliz" size={52} /><p><strong>Brisa Chicos</strong><span className="pp-small pp-muted">Personajes y juegos; colores más cálidos sin salir de la marca.</span></p></li>
    </ul>
  );
}
