// Sistema de componentes de DentalOS demo. Ver docs/design.md (reglas, variantes y descartes).
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useDemo, useLastChange } from '../app/store';
import type { Appointment, OutboxItem, Surface, ToothChartEntry } from '../domain';
import { byId, chairName, locName, money, personLabel, proName, serviceName } from '../domain/selectors';
import { addDays, at, diffMinutes, parts } from '../domain/time';
import { Icon, StatusBadge } from './kit';

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// ---------- TurnoCard: hora, tipo, profesional, sillón y estado, siempre con texto ----------
export interface TurnoCardProps {
  a: Appointment;
  variant?: 'patient' | 'admin';
  actions?: ReactNode;
  showPerson?: boolean;
  extra?: ReactNode;
  onOpen?: () => void;
  headingLevel?: 'h2' | 'h3';
  /** Resalte por enlace (p. ej. desde el portal), además del último cambio del store. */
  forceHighlight?: boolean;
}

export function TurnoCard({ a, variant = 'patient', actions, showPerson = false, extra, onOpen, headingLevel = 'h3', forceHighlight = false }: TurnoCardProps) {
  const s = useDemo();
  const last = useLastChange();
  const hid = useId();
  const ref = useRef<HTMLElement>(null);
  const p = parts(a.start);
  const changedHere = last?.appointmentId === a.id;
  const highlight = changedHere || forceHighlight;
  const Heading = headingLevel;
  const minutes = diffMinutes(a.end, a.start);
  useEffect(() => { if (highlight) ref.current?.scrollIntoView?.({ block: 'nearest' }); }, [highlight, last?.revision]);
  return (
    <article ref={ref} className={`turno turno--${variant} st-${a.status} ${highlight ? 'is-updated' : ''}`} aria-labelledby={hid} data-appointment={a.id} key={highlight ? `h${last?.revision}` : 'n'}>
      {variant === 'patient' ? (
        <div className="turno-when" aria-hidden="true">
          <span className="turno-dow">{DAYS[p.weekday]}</span>
          <span className="turno-day tabular">{p.day}</span>
          <span className="turno-month">{MONTHS[p.month - 1]}</span>
        </div>
      ) : (
        <div className="turno-when turno-when--time" aria-hidden="true">
          <span className="turno-hour tabular">{p.hhmm}</span>
          <span className="turno-month tabular">{parts(a.end).hhmm}</span>
        </div>
      )}
      <div className="turno-body">
        <div className="turno-top">
          <Heading id={hid} className="turno-title">
            {showPerson ? personLabel(s, a.personId) : serviceName(s, a.serviceTypeId)}
          </Heading>
          <StatusBadge status={a.status} />
        </div>
        <p className="turno-time tabular">
          {variant === 'patient' && <><span className="sr-only">{DAYS[p.weekday]} {p.day} de {MONTHS[p.month - 1]}, </span><strong>{p.hhmm}</strong>–{parts(a.end).hhmm} · </>}
          {variant === 'admin' && <span className="sr-only">{p.hhmm} a {parts(a.end).hhmm}, </span>}
          {showPerson ? `${serviceName(s, a.serviceTypeId)} · ` : ''}{minutes} min
        </p>
        <p className="turno-meta"><Icon name="user" size={14} /> {proName(s, a.professionalId)} <span aria-hidden="true">·</span> <Icon name="map" size={14} /> {locName(s, a.locationId)} · {chairName(s, a.chairId)}</p>
        <p className="turno-id">
          Turno <span className="code">{a.id}</span> · versión {a.version}
          {a.patientConfirmedVersion === a.version && a.status === 'confirmada' && <> · <span className="turno-flag"><Icon name="check" size={12} /> asistencia confirmada</span></>}
          {highlight && <> <span className="badge-updated" role="status"><Icon name="refresh" size={12} /> {changedHere ? (last?.kind === 'nuevo' ? 'Nuevo' : 'Actualizado recién') : 'Turno enlazado'}</span></>}
        </p>
        {extra}
        {(actions || onOpen) && <div className="turno-actions">{actions}{onOpen && <button className="btn btn-ghost btn-sm" onClick={onOpen}>Ver detalle<span className="sr-only"> de {a.id}</span></button>}</div>}
      </div>
    </article>
  );
}

/** Enlace visual entre portal y recepción para la misma cita. */
export function agendaLink(a: Appointment) {
  return `#/admin?dia=${parts(a.start).date}&turno=${a.id}`;
}

// ---------- DateStrip: selector de fecha como lista accesible + fecha libre ----------
export interface DateStripProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  start: string;
  days?: number;
  min?: string;
  max?: string;
  note?: (date: string) => string | null; // p. ej. "Cerrado" o "3 turnos"
}

export function DateStrip({ label, value, onChange, start, days = 7, min, max, note }: DateStripProps) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -i : e.key === 'End' ? days - 1 - i : 0;
    if (!delta) return;
    e.preventDefault();
    const target = Math.max(0, Math.min(days - 1, i + delta));
    listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-date]')[target]?.focus();
  };
  const shift = (n: number) => onChange(clampDate(addDays(value, n), min, max));
  return (
    <div className="datestrip" role="group" aria-labelledby={`${id}-l`}>
      <span className="datestrip-label" id={`${id}-l`}>{label}</span>
      <div className="datestrip-row">
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => shift(-days)} disabled={!!min && addDays(start, -1) < min} aria-label={`${days} días antes`}><Icon name="back" /></button>
        <div className="datestrip-days" ref={listRef}>
          {dates.map((d, i) => {
            const p = parts(at(d, '12:00'));
            const out = (min && d < min) || (max && d > max);
            const n = note?.(d);
            return (
              <button key={d} type="button" data-date={d} className="datestrip-day" aria-pressed={d === value} disabled={!!out}
                tabIndex={d === value || (!dates.includes(value) && i === 0) ? 0 : -1}
                onKeyDown={(e) => onKey(e, i)} onClick={() => onChange(d)}
                aria-label={`${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][p.weekday]} ${p.day}${n ? `, ${n}` : ''}`}>
                <span className="dd-dow">{DAYS[p.weekday]}</span>
                <span className="dd-num tabular">{p.day}</span>
                <span className="dd-note">{n ?? ' '}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => shift(days)} disabled={!!max && addDays(start, days) > max} aria-label={`${days} días después`}><Icon name="arrow" /></button>
        <label className="datestrip-free">
          <span className="sr-only">Otra fecha</span>
          <input type="date" value={value} min={min} max={max} onChange={(e) => e.target.value && onChange(clampDate(e.target.value, min, max))} />
        </label>
      </div>
    </div>
  );
}
function clampDate(d: string, min?: string, max?: string) {
  if (min && d < min) return min;
  if (max && d > max) return max;
  return d;
}

// ---------- Resumen operativo en línea (en vez de mosaico de KPI) ----------
export function SummaryStrip({ items, label }: { label: string; items: { label: string; value: string; detail?: string; tone?: 'warn' | 'ok' }[] }) {
  return (
    <dl className="summary-strip" aria-label={label}>
      {items.map((it) => (
        <div key={it.label} className={`summary-item ${it.tone ? `tone-${it.tone}` : ''}`}>
          <dt>{it.label}</dt>
          <dd><span className="tabular">{it.value}</span>{it.detail && <small>{it.detail}</small>}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- Dinero: total, aceptado, movimientos y saldo separados ----------
export function MoneySummary({ total, accepted, paid, balance }: { total: number; accepted: boolean; paid: number; balance: number | null }) {
  return (
    <dl className="money" aria-label="Resumen económico ficticio">
      <div><dt>Presupuestado</dt><dd className="tabular">{money(total)}</dd></div>
      <div className={accepted ? 'is-accepted' : ''}><dt>Aceptado</dt><dd className="tabular">{accepted ? money(total) : '—'}</dd><small>{accepted ? 'no es cobro' : 'sin aceptación'}</small></div>
      <div><dt>Movimientos simulados</dt><dd className="tabular">{money(paid)}</dd><small>vinculados, netos</small></div>
      <div className="is-balance"><dt>Saldo</dt><dd className="tabular">{balance === null ? '—' : money(balance)}</dd><small>{balance === null ? 'solo si fue aceptado' : 'aceptado − movimientos'}</small></div>
    </dl>
  );
}

// ---------- Outbox: estado del mensaje simulado como pipeline ----------
const STEP_LABEL: Record<string, string> = { programado: 'Programado', entregado_simulado: 'Entregado (simulado)', anulado: 'Anulado', bloqueado_optout: 'Bloqueado por opt-out', sin_cupo: 'Sin cupo de muestra' };
export function OutboxPipeline({ o }: { o: OutboxItem }) {
  const done = o.status === 'entregado_simulado';
  const stopped = o.status === 'anulado' || o.status === 'bloqueado_optout' || o.status === 'sin_cupo';
  return (
    <ol className="pipeline" aria-label={`${o.id}: ${STEP_LABEL[o.status]}`}>
      <li className="is-done"><Icon name="check" size={12} /> Creado v{o.appointmentVersion ?? '—'}</li>
      <li className={o.status === 'programado' ? 'is-current' : done || stopped ? 'is-done' : ''}><Icon name="clock" size={12} /> {o.kind === 'recordatorio_24h' ? 'Programado 24 h antes' : 'Inmediato'}</li>
      <li className={done ? 'is-current is-ok' : stopped ? 'is-current is-stop' : ''}>
        <Icon name={stopped ? 'x' : done ? 'check' : 'arrow'} size={12} /> {stopped ? STEP_LABEL[o.status] : done ? 'Entregado (simulado)' : 'Pendiente'}
      </li>
    </ol>
  );
}

// ---------- Estados ----------
export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="skeleton w60" /><div className="skeleton w90" /><div className="skeleton w75" />
    </div>
  );
}

export function ConflictNotice({ title, conflicts, keptLabel, children }: { title: string; conflicts?: { message: string }[]; keptLabel?: string; children?: ReactNode }) {
  return (
    <div className="notice notice-error conflict" role="alert">
      <Icon name="alert" />
      <div className="notice-body">
        <strong>{title}</strong>
        {conflicts && conflicts.length > 0 && <ul className="plain">{conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>}
        {keptLabel && <p className="kept"><Icon name="check" size={14} /> {keptLabel}</p>}
        {children}
      </div>
    </div>
  );
}

/** Explica por qué una acción no está disponible (el disabled nunca va sin causa). */
export function DisabledReason({ id, children }: { id: string; children: ReactNode }) {
  return <p className="disabled-reason" id={id}><Icon name="info" size={14} /> {children}</p>;
}

// ---------- Identidad por ID ----------
export function IdChip({ id, label }: { id: string; label?: string }) {
  return <span className="id-chip"><span className="sr-only">{label ?? 'ID'} </span>{id}</span>;
}

export function PersonLine({ personId }: { personId: string | null }) {
  const s = useDemo();
  const p = byId(s.persons, personId);
  if (!p) return <span className="muted">Sin identificar</span>;
  return <span className="person-line">{p.firstName} {p.lastName} <IdChip id={p.id} /></span>;
}

// ---------- Odontograma: glifo de 5 superficies ----------
export function ToothGlyph({ tooth, entries }: { tooth: number; entries: ToothChartEntry[] }) {
  const q = Math.floor(tooth / 10);
  const upper = q === 1 || q === 2 || q === 5 || q === 6;
  const mesialRight = q === 1 || q === 4 || q === 5 || q === 8; // lado derecho de la persona: mesial hacia la línea media
  const anterior = tooth % 10 <= 3;
  const state = (sf: Surface) => {
    const es = entries.filter((e) => e.surface === sf || e.surface === 'pieza');
    if (es.some((e) => e.state === 'realizado')) return 'realizado';
    if (es.some((e) => e.state === 'planificado')) return 'planificado';
    return '';
  };
  const top: Surface = upper ? 'V' : 'L';
  const bottom: Surface = upper ? 'L' : 'V';
  const right: Surface = mesialRight ? 'M' : 'D';
  const left: Surface = mesialRight ? 'D' : 'M';
  const center: Surface = anterior ? 'I' : 'O';
  return (
    <svg className="tooth-glyph" viewBox="0 0 30 30" aria-hidden="true">
      <polygon points="0,0 30,0 21,9 9,9" className={`sf ${state(top)}`} />
      <polygon points="30,0 30,30 21,21 21,9" className={`sf ${state(right)}`} />
      <polygon points="30,30 0,30 9,21 21,21" className={`sf ${state(bottom)}`} />
      <polygon points="0,30 0,0 9,9 9,21" className={`sf ${state(left)}`} />
      <rect x="9" y="9" width="12" height="12" className={`sf ${state(center)}`} />
    </svg>
  );
}
