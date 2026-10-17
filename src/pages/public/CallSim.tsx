import { useCallback, useEffect, useRef, useState } from 'react';
import { dispatch, store, useDemo } from '../../app/store';
import { useDraft } from '../../app/ui-state';
import { findSlots, type CallLine, type SlotRef } from '../../domain';
import { resolveChair } from '../../domain/scheduling';
import { byId, personLabel, proName, serviceName, upcomingFor } from '../../domain/selectors';
import { addDays, at, fmtShort, parts, toMs } from '../../domain/time';
import { Button, Icon, Notice, PageHeader, announce } from '../../ui/kit';
import { ToneEngine } from '../../ui/tones';
import { PageArt } from '../../ui/art/pages';
import { BrandMark } from '../../ui/art/brand';
import { ExpandableSurface, PhoneFrame } from '../../ui/Device';

interface Option { id: string; label: string }
interface Step { line: string; options: Option[] }
interface Session {
  startedAt: string; personId: string | null; requestId: string | null; branch: string; transcript: CallLine[];
  step: Step; appointmentId?: string; serviceTypeId?: string; candidates?: SlotRef[]; chosen?: SlotRef; committedAppointmentId?: string | null; silences: number; status: 'activa' | 'detenida' | 'finalizada'; outcome?: 'derivada';
}

const WELCOME: Step = {
  line: 'Hola, te atiende la llamada simulada de Clínica Brisa. Es una demo: no hay reconocimiento de voz ni llamada real. Elegí una opción.',
  options: [{ id: 'change', label: 'Cambiar mi control o turno' }, { id: 'book', label: 'Pedir un turno' }, { id: 'clinical', label: 'Tengo una consulta clínica' }, { id: 'human', label: 'Hablar con recepción' }],
};
const END: Option = { id: 'end', label: 'Terminar llamada' };

export function CallSim() {
  const s = useDemo();
  const [personId, setPersonId] = useDraft('call:person', 'P-001');
  const [requestId, setRequestId] = useDraft<string>('call:request', '');
  const [muted, setMuted] = useDraft('call:muted', false);
  const [volume, setVolume] = useDraft('call:volume', 0.5);
  const [soundOptIn, setSoundOptIn] = useDraft('call:sound', false);
  const [reading, setReading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState(false);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const tones = useRef(new ToneEngine());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const alive = useRef(true);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current.clear(); };
  const hardStop = useCallback(() => { alive.current = false; clearTimers(); tones.current.stop(); setPending(false); }, []);
  useEffect(() => () => hardStop(), [hardStop]); // salir de la ruta: limpia sin commits ni mensajes tardíos
  // Pestaña oculta: se cierra el audio (no suena en segundo plano). Se reactiva solo con un gesto ("Activar sonido").
  useEffect(() => {
    const onVis = () => { if (document.hidden) tones.current.stop(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => { tones.current.muted = muted || reading; tones.current.volume = volume; }, [muted, reading, volume]);

  const requests = s.requests.filter((r) => r.personId === personId && (r.status === 'pendiente' || r.status === 'asignada'));

  const say = (sess: Session, step: Step, patientText?: string): Session => {
    const transcript = [...sess.transcript];
    if (patientText) transcript.push({ from: 'paciente', text: patientText });
    transcript.push({ from: 'asistente', text: step.line });
    return { ...sess, step, transcript };
  };

  /** Muestra la respuesta tras un breve "turno de habla"; el timer se cancela al detener. */
  const advance = (next: Session) => {
    setSession({ ...next, step: { line: next.step.line, options: [] } });
    setPending(true);
    tones.current.cue(next.committedAppointmentId && next.committedAppointmentId !== session?.committedAppointmentId ? 'guardado' : 'habla');
    const t = setTimeout(() => { timers.current.delete(t); if (!alive.current) return; setSession(next); setPending(false); announce(next.step.line); }, 350);
    timers.current.add(t);
  };

  const start = () => {
    alive.current = true;
    clearTimers();
    let note: string | null = null;
    if (soundOptIn && !muted) {
      const ok = tones.current.start();
      if (!ok) note = 'El audio no está disponible o fue bloqueado: la llamada sigue en texto completo.';
    }
    setAudioNote(note);
    const base: Session = { startedAt: store.getSnapshot().state.clock, personId: personId || null, requestId: requestId || null, branch: 'inicio', transcript: [{ from: 'sistema', text: `Llamada simulada iniciada · ${personId ? personLabel(s, personId) : 'sin identificar'}${requestId ? ` · gestión ${requestId}` : ''}` }], step: WELCOME, silences: 0, status: 'activa', committedAppointmentId: null };
    advance(say(base, WELCOME));
  };

  const persist = (sess: Session, status: 'detenida' | 'finalizada' | 'derivada') => {
    if (sess.transcript.length <= 1) return;
    dispatch({ commandId: `call:${sess.startedAt}:${sess.transcript.length}:${status}`, type: 'callSave', personId: sess.personId, requestId: sess.requestId, branch: sess.branch, status, transcript: sess.transcript, startedAt: sess.startedAt, appointmentId: sess.committedAppointmentId ?? null });
  };

  const stop = () => {
    if (!session) return;
    hardStop();
    const stopped: Session = { ...session, status: 'detenida', transcript: [...session.transcript, { from: 'sistema', text: 'Llamada detenida. No se confirmó nada pendiente.' }], step: { line: 'Llamada detenida.', options: [] } };
    persist(stopped, 'detenida');
    setSession(stopped);
    announce('Llamada detenida. Sin sonido. No se confirmó nada pendiente.');
  };
  const restart = () => { if (session && session.status === 'activa') stop(); start(); };

  // ---------- Ramas ----------
  const pickAppt = (sess: Session): Session => {
    if (!sess.personId) return say({ ...sess, branch: 'cambio' }, { line: 'Para cambiar un turno necesito que elijas la persona por ID antes de llamar. No busco por nombre porque puede haber homónimos.', options: [{ id: 'human', label: 'Hablar con recepción' }, END] });
    const appts = upcomingFor(store.getSnapshot().state, sess.personId).filter((a) => a.status === 'confirmada' || a.status === 'solicitada');
    const linked = sess.requestId ? byId(s.requests, sess.requestId)?.appointmentId : null;
    const target = appts.find((a) => a.id === linked);
    if (target) return changeFor({ ...sess, branch: 'cambio' }, target.id);
    if (!appts.length) return say({ ...sess, branch: 'cambio' }, { line: 'No encontré turnos activos para esta persona.', options: [{ id: 'book', label: 'Pedir un turno' }, END] });
    if (appts.length === 1) return changeFor({ ...sess, branch: 'cambio' }, appts[0].id);
    return say({ ...sess, branch: 'cambio' }, { line: `Hay ${appts.length} turnos activos. ¿Cuál querés cambiar?`, options: [...appts.map((a) => ({ id: `appt:${a.id}`, label: `${serviceName(s, a.serviceTypeId)} · ${fmtShort(a.start)} (${a.id})` })), END] });
  };
  const changeFor = (sess: Session, apptId: string): Session => {
    const st = store.getSnapshot().state;
    const a = byId(st.appointments, apptId)!;
    if ((toMs(a.start) - toMs(st.clock)) / 3_600_000 < st.settings.changeWindowHours) {
      return say({ ...sess, appointmentId: a.id }, { line: `Tu turno ${a.id} es en menos de ${st.settings.changeWindowHours} horas. No puedo moverlo; puedo pedirle a recepción que lo revise. Tu turno sigue igual.`, options: [{ id: 'windowhelp', label: 'Pedir ayuda a recepción' }, END] });
    }
    const hhmm = parts(a.start).hhmm;
    let pref: string | null = null;
    for (let i = 1; i <= 14 && !pref; i++) {
      const date = addDays(parts(st.clock).date, i);
      if (date === parts(a.start).date) continue;
      const wd = parts(at(date, '12:00')).weekday;
      if (st.availabilityRules.some((r) => r.professionalId === a.professionalId && r.locationId === a.locationId && r.weekday === wd && r.start <= hhmm && hhmm < r.end)) pref = at(date, hhmm);
    }
    return say({ ...sess, appointmentId: a.id, candidates: pref ? [{ start: pref } as SlotRef] : [] }, { line: `Tu turno actual es ${fmtShort(a.start)} (${a.id}, versión ${a.version}) y sigue reservado mientras elegimos. ${pref ? `¿Te sirve el mismo horario el ${fmtShort(pref)}?` : ''}`, options: [...(pref ? [{ id: 'pref', label: `Probar ${fmtShort(pref)}` }] : []), { id: 'free', label: 'Escuchar horarios libres' }, END] });
  };
  const tryStart = (sess: Session, startIso: string): Session => {
    const st = store.getSnapshot().state;
    const a = byId(st.appointments, sess.appointmentId)!;
    const { slot, conflicts } = resolveChair(st, a.serviceTypeId, a.professionalId, a.locationId, startIso, { ignoreAppointmentId: a.id, personId: a.personId });
    if (slot) return review(sess, slot);
    const alts = findSlots(st, { serviceTypeId: a.serviceTypeId, professionalId: a.professionalId, locationId: a.locationId, from: startIso, limit: 2, ignoreAppointmentId: a.id, personId: a.personId });
    return say({ ...sess, candidates: alts }, { line: `Ese horario está ocupado: ${conflicts[0]?.message ?? ''} Conservamos tu turno anterior. ${alts.length ? 'Opciones compatibles:' : 'No encontré alternativas cercanas.'}`, options: [...alts.map((x, i) => ({ id: `slot:${i}`, label: fmtShort(x.start) })), { id: 'human', label: 'Hablar con recepción' }, END] });
  };
  const freeList = (sess: Session): Session => {
    const st = store.getSnapshot().state;
    const a = byId(st.appointments, sess.appointmentId)!;
    const alts = findSlots(st, { serviceTypeId: a.serviceTypeId, professionalId: a.professionalId, locationId: a.locationId, limit: 3, ignoreAppointmentId: a.id, personId: a.personId }).filter((x) => x.start !== a.start);
    return say({ ...sess, candidates: alts }, { line: alts.length ? 'Horarios libres:' : 'No hay horarios libres en el horizonte. Puedo derivarte a recepción.', options: [...alts.map((x, i) => ({ id: `slot:${i}`, label: fmtShort(x.start) })), { id: 'human', label: 'Hablar con recepción' }, END] });
  };
  const review = (sess: Session, slot: SlotRef): Session => {
    const a = byId(store.getSnapshot().state.appointments, sess.appointmentId)!;
    return say({ ...sess, chosen: slot }, { line: `Antes: ${fmtShort(a.start)}. Después: ${fmtShort(slot.start)}, con ${proName(s, slot.professionalId)}. Mismo turno ${a.id}, versión ${a.version + 1}. ¿Confirmás el cambio?`, options: [{ id: 'confirm', label: 'Confirmar cambio' }, { id: 'free', label: 'Elegir otro horario' }, END] });
  };
  const confirmChange = (sess: Session): Session => {
    const a = byId(store.getSnapshot().state.appointments, sess.appointmentId)!;
    const r = dispatch({ commandId: `resched:${a.id}:v${a.version}:${sess.chosen!.start}`, type: 'reschedule', appointmentId: a.id, start: sess.chosen!.start, chairId: sess.chosen!.chairId, channel: 'llamada', expectedVersion: a.version });
    if (r.ok || r.replayed) {
      const after = byId(store.getSnapshot().state.appointments, a.id)!;
      if (sess.requestId) dispatch({ type: 'updateRequest', requestId: sess.requestId, status: 'resuelta', note: `Cambio confirmado por llamada simulada: ${a.id} v${after.version}.` });
      return say({ ...sess, committedAppointmentId: a.id }, { line: `Cambio guardado en esta demo. Recepción ve el mismo turno ${a.id} actualizado: ${fmtShort(after.start)}, versión ${after.version}. No hicimos ninguna llamada real.`, options: [END] });
    }
    return say(sess, { line: `No pudimos guardar el cambio: ${r.message} Conservamos tu turno anterior.`, options: [{ id: 'confirm', label: 'Reintentar' }, { id: 'free', label: 'Elegir otro horario' }, { id: 'human', label: 'Hablar con recepción' }, END] });
  };
  const bookStart = (sess: Session): Session => {
    if (!sess.personId) return say({ ...sess, branch: 'turno' }, { line: 'Para pedir un turno en la demo, elegí la persona por ID antes de llamar o hablá con recepción.', options: [{ id: 'human', label: 'Hablar con recepción' }, END] });
    const svc = s.serviceTypes.filter((x) => x.selfService && !x.requiresIndicatedControl);
    return say({ ...sess, branch: 'turno' }, { line: '¿Qué motivo administrativo necesitás?', options: [...svc.map((x) => ({ id: `svc:${x.id}`, label: x.name })), END] });
  };
  const bookService = (sess: Session, serviceTypeId: string): Session => {
    const st = store.getSnapshot().state;
    const slots = findSlots(st, { serviceTypeId, limit: 2, personId: sess.personId! });
    if (!slots.length) return say({ ...sess, serviceTypeId, branch: 'sin_cupo' }, { line: `No hay cupos de ${serviceName(s, serviceTypeId)} en los próximos ${st.settings.horizonDays} días. Puedo sumarte a la lista de espera (no es una reserva) o derivarte.`, options: [{ id: 'wait', label: 'Sumarme a la lista de espera' }, { id: 'human', label: 'Hablar con recepción' }, END] });
    return say({ ...sess, serviceTypeId, candidates: slots }, { line: `Tengo estos cupos de ${serviceName(s, serviceTypeId)}:`, options: [...slots.map((x, i) => ({ id: `bslot:${i}`, label: `${fmtShort(x.start)} · ${proName(s, x.professionalId)}` })), END] });
  };
  const bookConfirm = (sess: Session): Session => {
    const c = sess.chosen!;
    const r = dispatch({ commandId: `book:call:${sess.personId}:${c.serviceTypeId}:${c.start}`, type: 'book', personId: sess.personId!, serviceTypeId: c.serviceTypeId, professionalId: c.professionalId, chairId: c.chairId, locationId: c.locationId, start: c.start, channel: 'llamada', requestId: sess.requestId ?? undefined });
    if (r.ok) {
      const a = byId(store.getSnapshot().state.appointments, r.ids!.appointmentId)!;
      return say({ ...sess, committedAppointmentId: a.id }, { line: a.status === 'solicitada' ? `Solicitud enviada (${a.id}). Recepción la confirma; todavía no es un turno confirmado.` : `Turno confirmado: ${fmtShort(a.start)} (${a.id}). Lo ves en Mis turnos y en recepción.`, options: [END] });
    }
    return say(sess, { line: `${r.message}`, options: [{ id: 'book', label: 'Elegir otro motivo u horario' }, { id: 'human', label: 'Hablar con recepción' }, END] });
  };
  const human = (sess: Session, clinical: boolean): Session => say({ ...sess, branch: clinical ? 'clinico' : 'humano' }, {
    line: clinical
      ? 'Soy un asistente administrativo: no puedo evaluar síntomas, indicar medicación ni decir si es urgente. ¿Querés que recepción te contacte? No puedo garantizar un tiempo de respuesta. Ante una emergencia, comunicate con un servicio de emergencias.'
      : '¿Querés que derive la gestión a recepción? Queda pendiente hasta que una persona la tome.',
    options: [{ id: clinical ? 'derive_clinical' : 'derive', label: 'Sí, que me contacte recepción' }, { id: 'menu', label: 'No, volver' }, END],
  });
  const derive = (sess: Session, clinical: boolean): Session => {
    const r = dispatch({ type: 'createTask', kind: 'derivacion', title: `Derivación desde llamada simulada (${sess.personId ? personLabel(s, sess.personId) : 'sin identificar'})`, detail: clinical ? 'Consulta clínica: derivar a una persona. El asistente no evaluó ni clasificó.' : 'Pidió hablar con recepción.', personId: sess.personId, requestId: sess.requestId, dedupeKey: `deriv:call:${sess.personId ?? 'anon'}:${sess.requestId ?? sess.startedAt}`, ruleId: 'A08' });
    return say({ ...sess, outcome: 'derivada' }, { line: `${r.message} Queda pendiente; no garantizamos un tiempo de respuesta.`, options: [END] });
  };

  const choose = (opt: Option) => {
    if (!session || session.status !== 'activa' && opt.id !== 'end') return;
    const sess = session;
    const said = (step: Session) => advance({ ...step, transcript: [...sess.transcript, { from: 'paciente', text: opt.label }, ...step.transcript.slice(sess.transcript.length)] });
    const id = opt.id;
    if (id === 'end') {
      hardStop();
      const done: Session = { ...sess, status: 'finalizada', transcript: [...sess.transcript, { from: 'paciente', text: opt.label }, { from: 'sistema', text: 'Llamada finalizada.' }], step: { line: 'Llamada finalizada.', options: [] } };
      persist(done, sess.outcome ?? 'finalizada');
      setSession(done);
      announce('Llamada finalizada.');
      return;
    }
    let next: Session;
    if (id === 'change') next = pickAppt(sess);
    else if (id.startsWith('appt:')) next = changeFor(sess, id.slice(5));
    else if (id === 'pref') next = tryStart(sess, sess.candidates![0].start);
    else if (id === 'free') next = freeList(sess);
    else if (id.startsWith('slot:')) next = review(sess, sess.candidates![Number(id.slice(5))]);
    else if (id === 'confirm') next = confirmChange(sess);
    else if (id === 'book') next = bookStart(sess);
    else if (id.startsWith('svc:')) next = bookService(sess, id.slice(4));
    else if (id.startsWith('bslot:')) { const c = sess.candidates![Number(id.slice(6))]; next = say({ ...sess, chosen: c }, { line: `${serviceName(s, c.serviceTypeId)} el ${fmtShort(c.start)} con ${proName(s, c.professionalId)}. ¿Confirmás?`, options: [{ id: 'bconfirm', label: 'Confirmar' }, { id: 'book', label: 'Elegir otro' }, END] }); }
    else if (id === 'bconfirm') next = bookConfirm(sess);
    else if (id === 'wait') { const r = dispatch({ commandId: `wait:${sess.personId}:${sess.serviceTypeId}`, type: 'waitlistAdd', personId: sess.personId!, serviceTypeId: sess.serviceTypeId!, professionalId: null, locationId: null, period: 'cualquiera', validDays: 30 }); next = say({ ...sess, branch: 'espera' }, { line: r.message, options: [END] }); }
    else if (id === 'clinical') next = human(sess, true);
    else if (id === 'human') next = human(sess, false);
    else if (id === 'derive') next = derive(sess, false);
    else if (id === 'derive_clinical') next = derive(sess, true);
    else if (id === 'windowhelp') { const r = dispatch({ type: 'requestHumanChange', appointmentId: sess.appointmentId!, channel: 'llamada' }); next = say(sess, { line: r.message, options: [END] }); }
    else if (id === 'repeat') next = say(sess, sess.step);
    else if (id === 'reading') { setReading(true); next = say(sess, { ...sess.step, line: 'Modo lectura activado: seguís con el texto completo y sin sonidos.' }); next = { ...next, step: { ...next.step, options: sess.step.options.filter((o) => !['repeat', 'reading'].includes(o.id)) } }; }
    else next = say(sess, WELCOME);
    said(next);
  };

  const silence = () => {
    if (!session || session.status !== 'activa' || pending) return;
    const n = session.silences + 1;
    const base = session.step.options.filter((o) => !['repeat', 'reading', 'human'].includes(o.id));
    const next: Session = {
      ...session, silences: n,
      transcript: [...session.transcript, { from: 'sistema', text: '(silencio simulado: pasaron unos segundos de muestra sin respuesta)' }, { from: 'asistente', text: n > 1 ? 'Sigo esperando. No confirmo nada por silencio.' : 'No escuché una respuesta. Puedo repetir, pasar a modo lectura o derivarte a recepción.' }],
      step: { line: n > 1 ? 'Sigo esperando. No confirmo nada por silencio.' : 'No escuché una respuesta. Puedo repetir, pasar a modo lectura o derivarte a recepción.', options: [{ id: 'repeat', label: 'Repetir' }, { id: 'reading', label: 'Modo lectura' }, { id: 'human', label: 'Hablar con recepción' }, ...base] },
    };
    advance(next);
  };

  const active = session?.status === 'activa';
  const soundState = !soundOptIn ? { on: false, label: 'Tonos no activados' }
    : audioNote ? { on: false, label: 'Audio no disponible' }
    : reading ? { on: false, label: 'Modo lectura: sin sonido' }
    : muted ? { on: false, label: 'Silenciado' }
    : { on: true, label: 'Tonos suaves activos' };
  return (
    <section className="page">
      <PageHeader eyebrow="M07 · Canal simulado" title="Llamada simulada" art={<PageArt kind="llamada" />}>
        Voluntaria y local: sin micrófono, sin reconocimiento ni voz sintetizada, sin telefonía. Respuestas preparadas y transcripción completa. Los sonidos son dos tonos suaves opcionales.
      </PageHeader>
      <ExpandableSurface title="Llamada simulada · Clínica Brisa" className="xsurface-call">
        <div className="call-layout">
          <PhoneFrame className="device-call">
            <div className="call-phone">
              <header className="call-caller">
                <span className="call-avatar" aria-hidden="true"><BrandMark size={44} /></span>
                <p className="call-name">Clínica Brisa</p>
                <p className="call-state">{!session ? 'Llamada simulada · sin telefonía' : active ? (pending ? 'Asistente hablando (texto)…' : 'Llamada activa · simulada') : session.status === 'detenida' ? 'Llamada detenida' : 'Llamada terminada'}{session && active && <span className="wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>}</p>
                {session && <p className="call-who small">{session.personId ? personLabel(s, session.personId) : 'Sin identificar'}{session.requestId ? ` · ${session.requestId}` : ''}</p>}
              </header>
              {!session ? (
                <div className="call-setup stack">
                  <h2>Antes de empezar</h2>
                  <p>Vas a ver frases del asistente y elegir respuestas con botones. Nada se confirma sin que toques <strong>Confirmar</strong>; detener, salir o el silencio nunca confirman.</p>
                  <div className="field">
                    <label htmlFor="call-person">Persona (por ID)</label>
                    <select id="call-person" value={personId} onChange={(e) => { setPersonId(e.target.value); setRequestId(''); }}>
                      <option value="">Sin identificar</option>
                      {s.persons.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.firstName} {p.lastName} ({p.birthYear})</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="call-req">Continuar una gestión existente (opcional)</label>
                    <select id="call-req" value={requestId} onChange={(e) => setRequestId(e.target.value)}>
                      <option value="">Nueva gestión</option>
                      {requests.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.summary.slice(0, 50)}</option>)}
                    </select>
                    <p className="hint">Si empezaste por WhatsApp, elegí la misma gestión: la llamada comparte el caso y no crea otra cita.</p>
                  </div>
                  <label className="choice"><input type="checkbox" checked={soundOptIn} onChange={(e) => setSoundOptIn(e.target.checked)} /> Activar tonos sintéticos suaves (opcional)</label>
                  <Button variant="primary" size="lg" icon="phone" className="call-start" onClick={start}>Probar llamada simulada</Button>
                </div>
              ) : (
                <div className="call-screen" aria-label="Llamada simulada">
                  <div className="call-status" aria-label="Estado de la llamada">
                    <span className={`call-chip ${soundState.on ? '' : 'is-off'}`}><Icon name={soundState.on ? 'volume' : 'mute'} size={14} /> {soundState.label}</span>
                    <span className="call-chip"><Icon name="info" size={14} /> Sin micrófono · sin voz</span>
                  </div>
                  <p className={`call-line ${pending ? '' : 'is-speaking'}`} aria-live="off" key={session.transcript.length}>{session.step.line}</p>
                  {active && !pending && session.step.options.length > 0 && (
                    <div className="call-options" role="group" aria-label="Respuestas">
                      {session.step.options.map((o) => <Button key={o.id} variant={o.id === 'confirm' || o.id === 'bconfirm' ? 'primary' : 'secondary'} onClick={() => choose(o)}>{o.label}</Button>)}
                    </div>
                  )}
                  <div className="call-keys" role="group" aria-label="Controles de la llamada">
                    {active && <Button icon="pause" className="call-key" onClick={silence} disabled={pending}>Simular silencio</Button>}
                    {active && <Button icon="refresh" className="call-key" onClick={() => choose({ id: 'repeat', label: 'Repetir' })} disabled={pending}>Repetir</Button>}
                    <Button icon={muted ? 'volume' : 'mute'} className="call-key" onClick={() => { if (muted && soundOptIn && !reading) { const ok = tones.current.start(); setAudioNote(ok ? null : 'El audio no está disponible o fue bloqueado: la llamada sigue en texto completo.'); } setMuted(!muted); }} aria-pressed={muted}>{muted ? 'Activar sonido' : 'Silenciar'}</Button>
                    <Button icon="book" className="call-key" onClick={() => setReading(!reading)} aria-pressed={reading}>{reading ? 'Salir de modo lectura' : 'Modo lectura'}</Button>
                    <Button icon="refresh" className="call-key" onClick={restart}>Reiniciar</Button>
                    {active && <Button variant="danger" icon="stop" className="call-key call-hang" onClick={stop}>Detener</Button>}
                  </div>
                  <div className="field call-volume">
                    <label htmlFor="vol">Volumen de los tonos</label>
                    <input id="vol" type="range" min={0} max={1} step={0.1} value={volume} onChange={(e) => setVolume(Number(e.target.value))} disabled={muted || reading} />
                  </div>
                </div>
              )}
            </div>
          </PhoneFrame>
          <aside className="card stack call-transcript">
            <h2>Transcripción</h2>
            {!session ? <p className="muted">Aparece al iniciar. Se guarda como registro de la gestión al terminar o detener.</p> : (
              <div className="transcript" role="log" aria-live="polite" tabIndex={0}>
                {session.transcript.map((l, i) => <p key={i}><strong>{l.from === 'asistente' ? 'Asistente' : l.from === 'paciente' ? 'Vos' : 'Sistema'}:</strong> {l.text}</p>)}
              </div>
            )}
            {reading && <Notice tone="info" title="Modo lectura">Sin sonidos. Todo el contenido está en texto.</Notice>}
            {audioNote && <Notice tone="warn" title={audioNote} />}
            {session && !soundOptIn && <p className="small muted">Sin tonos: elegiste no activarlos. La llamada es igual de completa en texto.</p>}
            <h3>Llamadas anteriores</h3>
            {s.callSessions.length === 0 ? <p className="muted small">Ninguna todavía.</p> : <ul className="plain small">{s.callSessions.slice(-5).reverse().map((c) => <li key={c.id}><span className="code">{c.id}</span> · {c.branch} · {c.status} · {c.transcript.length} líneas{c.appointmentId ? ` · ${c.appointmentId}` : ''}</li>)}</ul>}
          </aside>
        </div>
      </ExpandableSurface>
    </section>
  );
}
