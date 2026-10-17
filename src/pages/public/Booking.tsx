import { useMemo, useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { navigate, useRoute } from '../../app/router';
import { setActingPerson, useDraft, useUi } from '../../app/ui-state';
import { findSlots, validateNewPerson, type SlotRef } from '../../domain';
import { slotKey } from '../../domain/scheduling';
import { byId, chairName, locName, personLabel, proName, serviceName } from '../../domain/selectors';
import { addDays, at, fmtDateOnly, fmtLong, parts } from '../../domain/time';
import { ConflictNotice, DateStrip } from '../../ui/components';
import { Button, EmptyState, ErrorSummary, Field, Icon, Notice, PageHeader, StatusBadge, announce } from '../../ui/kit';
import { PersonPicker } from './PersonPicker';
import { PageArt } from '../../ui/art/pages';

interface BookingDraft {
  draftId: string; who: 'existing' | 'new';
  newPerson: { firstName: string; lastName: string; birthYear: string; preferredChannel: string };
  serviceTypeId: string; locationId: string; professionalId: string; fromDate: string; period: 'cualquiera' | 'mañana' | 'tarde';
  chosen: SlotRef | null; doneAppointmentId: string | null;
}

const LABELS: Record<string, string> = { firstName: 'Nombre', lastName: 'Apellido', birthYear: 'Año de nacimiento', preferredChannel: 'Canal preferido' };

export function Booking() {
  const s = useDemo();
  const ui = useUi();
  const { query } = useRoute();
  const today = parts(s.clock).date;
  const initial: BookingDraft = {
    draftId: `r${s.revision}`, who: 'existing', newPerson: { firstName: '', lastName: '', birthYear: '', preferredChannel: '' },
    serviceTypeId: query.get('motivo') ?? 'ST-PRIMERA', locationId: query.get('sede') ?? '', professionalId: query.get('profesional') ?? '',
    fromDate: today, period: 'cualquiera', chosen: null, doneAppointmentId: null,
  };
  const [draft, setDraft, clearDraft] = useDraft<BookingDraft>('booking', initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [commitError, setCommitError] = useState<{ message: string; conflicts?: { message: string }[]; existingId?: string } | null>(null);
  const up = (patch: Partial<BookingDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const personId = draft.who === 'existing' ? ui.actingPersonId : undefined;
  const person = byId(s.persons, personId);
  const hasIndicated = !!personId && s.careEpisodes.some((e) => e.personId === personId && e.status === 'activo' && e.controls.some((c) => c.status === 'indicado'));
  const services = s.serviceTypes.filter((st) => st.selfService && (!st.requiresIndicatedControl || hasIndicated));
  const st = byId(s.serviceTypes, draft.serviceTypeId);
  const pros = s.professionals.filter((p) => st && p.serviceTypeIds.includes(st.id));

  const slots = useMemo(() => (st && services.some((x) => x.id === st.id)
    ? findSlots(s, { serviceTypeId: st.id, professionalId: draft.professionalId || null, locationId: draft.locationId || null, from: at(draft.fromDate || today, '00:00'), limit: 8, period: draft.period, personId })
    : []), [s, st, services, draft.professionalId, draft.locationId, draft.fromDate, draft.period, personId, today]);
  const dayNote = (d: string) => {
    if (!st) return null;
    const wd = parts(at(d, '12:00')).weekday;
    if (!s.availabilityRules.some((r) => r.weekday === wd && st && pros.some((p) => p.id === r.professionalId))) return 'Sin atención';
    return null;
  };
  const chosen = draft.chosen;
  const chosenListed = !!chosen && slots.some((x) => slotKey(x) === slotKey(chosen));
  // Indicador de avance: se completa solo a medida que la persona elige (no bloquea ni oculta pasos).
  const whoDone = draft.who === 'existing' ? !!person : !!(draft.newPerson.firstName.trim() && draft.newPerson.lastName.trim() && draft.newPerson.preferredChannel);
  const stepStates: ('done' | 'current' | 'todo')[] = [whoDone ? 'done' : 'current', whoDone && st ? 'done' : whoDone ? 'current' : 'todo', chosen ? 'done' : whoDone ? 'current' : 'todo', chosen ? 'current' : 'todo'];
  const firstCurrent = stepStates.indexOf('current');
  const steps = ['Para quién', 'Motivo', 'Horario', 'Confirmar'].map((label, i) => ({ label, state: stepStates[i] === 'current' && i !== firstCurrent ? 'todo' as const : stepStates[i] }));

  if (draft.doneAppointmentId) {
    const a = byId(s.appointments, draft.doneAppointmentId);
    return (
      <section className="page narrow">
        <PageHeader eyebrow="Reserva" title={a?.status === 'solicitada' ? 'Solicitud enviada' : 'Turno confirmado'} />
        {a ? (
          <article className="card stack">
            <StatusBadge status={a.status} />
            <p className="big"><strong>{serviceName(s, a.serviceTypeId)}</strong> · {fmtLong(a.start)}</p>
            <p>{proName(s, a.professionalId)} · {locName(s, a.locationId)} · {chairName(s, a.chairId)}</p>
            <p className="muted">Turno <span className="code">{a.id}</span>{a.requestId && <> · solicitud <span className="code">{a.requestId}</span></>} · {personLabel(s, a.personId)}</p>
            {a.status === 'solicitada'
              ? <Notice tone="warn" title="Todavía no es un turno confirmado">El cupo queda reservado y recepción revisa la solicitud. No enviamos mensajes reales.</Notice>
              : <Notice tone="ok" title="Guardado en este dispositivo">Recepción ve este mismo turno en la agenda. No enviamos mensajes reales.</Notice>}
            <div className="row wrap">
              <Button variant="primary" onClick={() => navigate('/mis-turnos')}>Ver en Mis turnos</Button>
              <Button onClick={() => { clearDraft(); setCommitError(null); }}>Hacer otra reserva</Button>
            </div>
          </article>
        ) : <EmptyState title="El turno ya no existe (la demo pudo restablecerse)." action={<Button onClick={() => clearDraft()}>Empezar de nuevo</Button>} />}
      </section>
    );
  }

  const submit = () => {
    setCommitError(null);
    if (draft.who === 'new') {
      const e = validateNewPerson({ ...draft.newPerson, birthYear: draft.newPerson.birthYear ? Number(draft.newPerson.birthYear) : null });
      setErrors(e);
      if (Object.keys(e).length) return;
    } else if (!person) { setErrors({ acting: 'Elegí una persona de muestra.' }); return; }
    setErrors({});
    if (!chosen) { setCommitError({ message: 'Elegí un horario de la lista.' }); return; }
    const r = dispatch({
      commandId: `book:${draft.draftId}:${slotKey(chosen)}`, type: 'book', personId, channel: 'web',
      newPerson: draft.who === 'new' ? { ...draft.newPerson, birthYear: draft.newPerson.birthYear ? Number(draft.newPerson.birthYear) : null } : undefined,
      serviceTypeId: chosen.serviceTypeId, professionalId: chosen.professionalId, chairId: chosen.chairId, locationId: chosen.locationId, start: chosen.start,
    });
    if (r.ok) {
      if (draft.who === 'new' && r.ids?.personId) setActingPerson(r.ids.personId);
      up({ doneAppointmentId: r.ids!.appointmentId });
      announce(r.message);
    } else {
      setCommitError({ message: r.message, conflicts: r.conflicts, existingId: r.existingId });
      if (r.code === 'CONFLICTO') up({ chosen: null });
      announce(r.message);
    }
  };

  const occupyChosen = () => {
    if (!chosen) return;
    const other = s.persons.find((p) => p.id !== personId && p.kind === 'adulto' && p.id !== 'P-001');
    if (!other) return;
    const r = dispatch({ type: 'book', personId: other.id, serviceTypeId: chosen.serviceTypeId, professionalId: chosen.professionalId, chairId: chosen.chairId, locationId: chosen.locationId, start: chosen.start, channel: 'recepcion' });
    announce(r.ok ? `Simulación: ${other.id} tomó ese cupo por recepción. Probá confirmar.` : r.message);
  };

  return (
    <section className="page">
      <PageHeader eyebrow="M02 · Reserva" title="Pedir un turno" art={<PageArt kind="reservar" />}>
        Elegí motivo y horario. Revalidamos profesional, sillón y jornada al confirmar. Mínimo {s.settings.minLeadHours} h de anticipación y hasta {s.settings.horizonDays} días.
      </PageHeader>
      <ErrorSummary errors={errors} labels={{ ...LABELS, acting: 'Persona' }} />

      <ol className="stepper" aria-label="Pasos de la reserva">
        {steps.map((x, i) => (
          <li key={x.label} className={`step is-${x.state}`} aria-current={x.state === 'current' ? 'step' : undefined}>
            <span className="step-n" aria-hidden="true">{x.state === 'done' ? <Icon name="check" size={14} /> : i + 1}</span>
            <span className="step-label">{x.label}<span className="sr-only">{x.state === 'done' ? ' (listo)' : x.state === 'current' ? ' (paso actual)' : ' (pendiente)'}</span></span>
          </li>
        ))}
      </ol>

      <div className="grid-2 booking-grid" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <fieldset className="stack step-card">
            <legend><span className="step-n" aria-hidden="true">1</span> Para quién</legend>
            <div className="row wrap">
              <label className="choice"><input type="radio" name="who" checked={draft.who === 'existing'} onChange={() => up({ who: 'existing', chosen: null })} /> Ya soy paciente (persona de muestra)</label>
              <label className="choice"><input type="radio" name="who" checked={draft.who === 'new'} onChange={() => up({ who: 'new', chosen: null, serviceTypeId: 'ST-PRIMERA' })} /> Es mi primera vez</label>
            </div>
            {draft.who === 'existing' ? <PersonPicker /> : (
              <div className="form-grid">
                <Field label="Nombre" error={errors.firstName} id="firstName">{(p) => <input {...p} autoComplete="off" value={draft.newPerson.firstName} onChange={(e) => up({ newPerson: { ...draft.newPerson, firstName: e.target.value } })} />}</Field>
                <Field label="Apellido" error={errors.lastName} id="lastName">{(p) => <input {...p} autoComplete="off" value={draft.newPerson.lastName} onChange={(e) => up({ newPerson: { ...draft.newPerson, lastName: e.target.value } })} />}</Field>
                <Field label="Año de nacimiento (opcional)" error={errors.birthYear} id="birthYear" hint="Dato ficticio de muestra.">{(p) => <input {...p} inputMode="numeric" value={draft.newPerson.birthYear} onChange={(e) => up({ newPerson: { ...draft.newPerson, birthYear: e.target.value.replace(/\D/g, '').slice(0, 4) } })} />}</Field>
                <Field label="Cómo preferís que te contacte recepción" error={errors.preferredChannel} id="preferredChannel" hint="Simulado: no pedimos ni usamos teléfono o email reales.">{(p) => (
                  <select {...p} value={draft.newPerson.preferredChannel} onChange={(e) => up({ newPerson: { ...draft.newPerson, preferredChannel: e.target.value } })}>
                    <option value="">Elegí un canal</option><option value="whatsapp">WhatsApp (simulado)</option><option value="llamada">Llamada (simulada)</option><option value="portal">Solo portal</option>
                  </select>)}</Field>
              </div>
            )}
          </fieldset>

          <fieldset className="stack step-card">
            <legend><span className="step-n" aria-hidden="true">2</span> Motivo y preferencias</legend>
            <div className="form-grid">
              <Field label="Motivo" id="serviceTypeId">{(p) => (
                <select {...p} value={draft.serviceTypeId} onChange={(e) => up({ serviceTypeId: e.target.value, professionalId: '', chosen: null })}>
                  {!services.some((x) => x.id === draft.serviceTypeId) && <option value={draft.serviceTypeId}>{serviceName(s, draft.serviceTypeId)} (no disponible para esta persona)</option>}
                  {services.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.durationMin} min</option>)}
                </select>)}</Field>
              <Field label="Sede">{(p) => (
                <select {...p} value={draft.locationId} onChange={(e) => up({ locationId: e.target.value, chosen: null })}>
                  <option value="">Cualquiera</option>{s.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>)}</Field>
              <Field label="Profesional">{(p) => (
                <select {...p} value={draft.professionalId} onChange={(e) => up({ professionalId: e.target.value, chosen: null })}>
                  <option value="">Cualquiera</option>{pros.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>)}</Field>
              <Field label="Franja">{(p) => (
                <select {...p} value={draft.period} onChange={(e) => up({ period: e.target.value as BookingDraft['period'], chosen: null })}>
                  <option value="cualquiera">Cualquiera</option><option value="mañana">Mañana</option><option value="tarde">Tarde</option>
                </select>)}</Field>
            </div>
            {st?.requiresIndicatedControl === false && st.id === 'ST-ORTO-CONS' && <p className="muted small">Consulta informativa; no evaluamos ni indicamos tratamientos por este medio.</p>}
            {!hasIndicated && draft.who === 'existing' && <p className="muted small">El control de ortodoncia aparece solo si tu profesional lo indicó.</p>}
          </fieldset>
        </div>

        <div className="stack step-card">
          <h2 className="step-title"><span className="step-n" aria-hidden="true">3</span> Horarios disponibles</h2>
          <DateStrip label="Buscar desde" value={draft.fromDate} start={today} days={14} min={today} max={addDays(today, s.settings.horizonDays - 1)}
            onChange={(d) => up({ fromDate: d, chosen: null })} note={dayNote} />
          {slots.length === 0 ? (
            <EmptyState title="No hay cupos con estos filtros" icon="calendar" action={
              <div className="row wrap">
                <Button onClick={() => up({ professionalId: '', locationId: '', period: 'cualquiera', fromDate: today })}>Quitar filtros</Button>
                {person && st && <Button variant="primary" onClick={() => { const r = dispatch({ commandId: `wait:${person.id}:${st.id}`, type: 'waitlistAdd', personId: person.id, serviceTypeId: st.id, professionalId: draft.professionalId || null, locationId: draft.locationId || null, period: draft.period, validDays: 30 }); announce(r.message); setCommitError(r.ok ? null : { message: r.message }); }}>Sumarme a la lista de espera</Button>}
              </div>}>
              Cero resultados en {s.settings.horizonDays} días. No forzamos un turno ficticio. La lista de espera no es una reserva.
            </EmptyState>
          ) : (
            <fieldset>
              <legend className="sr-only">Elegí un horario</legend>
              {[...new Set(slots.map((x) => parts(x.start).date))].map((d) => (
                <div key={d}>
                  <h3 className="slot-day">{fmtDateOnly(d)}</h3>
                  <ul className="list slot-grid">
                    {slots.filter((x) => parts(x.start).date === d).map((x) => (
                      <li key={slotKey(x)}>
                        <label className="list-item slot-option">
                          <input type="radio" name="slot" checked={!!chosen && slotKey(chosen) === slotKey(x)} onChange={() => { up({ chosen: x }); setCommitError(null); }} />
                          <span className="slot-body"><span className="sr-only">{fmtLong(x.start)}</span><strong className="slot-time tabular" aria-hidden="true">{x.start.slice(11, 16)}</strong><span className="slot-pro">{proName(s, x.professionalId)}</span><span className="muted small">{locName(s, x.locationId)} · {chairName(s, x.chairId)}</span></span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </fieldset>
          )}
          {commitError && (
            <ConflictNotice title={commitError.message} conflicts={commitError.conflicts} keptLabel="Tus datos siguen en el formulario.">
              {commitError.existingId && <div><Button size="sm" onClick={() => navigate('/mis-turnos')}>Abrir turno {commitError.existingId}</Button></div>}
            </ConflictNotice>
          )}
          {chosen && st && (
            <div className="card stack review-card">
              <h3 className="step-title"><span className="step-n" aria-hidden="true">4</span> Revisá antes de confirmar</h3>
              {!chosenListed && <Notice tone="warn" title="Este horario ya no figura como libre">Si confirmás, lo revalidamos y te mostramos alternativas sin perder tus datos.</Notice>}
              <dl className="kv">
                <dt>Persona</dt><dd>{draft.who === 'new' ? `${draft.newPerson.firstName || '—'} ${draft.newPerson.lastName} (nueva)` : personLabel(s, personId)}</dd>
                <dt>Motivo</dt><dd>{st.name} · {st.durationMin} min</dd>
                <dt>Cuándo</dt><dd className="tabular">{fmtLong(chosen.start)}</dd>
                <dt>Dónde</dt><dd>{proName(s, chosen.professionalId)} · {locName(s, chosen.locationId)}</dd>
                <dt>Resultado</dt><dd>{st.needsReceptionConfirmation ? 'Solicitud pendiente: recepción confirma.' : 'Turno confirmado si el cupo sigue libre.'}</dd>
              </dl>
              <div className="row wrap">
                <Button variant="primary" size="lg" icon="check" onClick={submit}>{st.needsReceptionConfirmation ? 'Enviar solicitud' : 'Confirmar turno'}</Button>
                <Button variant="ghost" size="sm" onClick={occupyChosen} title="Simulador de competencia">
                  <Icon name="user" size={14} /> Simular que otra persona toma este cupo
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
