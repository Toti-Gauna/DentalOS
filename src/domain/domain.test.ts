import { describe, expect, it } from 'vitest';
import { activeReplies, createSeedState, detectIntent, execute, findSlots, PRESETS, type Command, type CommandInput, type DemoState } from './index';
import { ACTIVE_STATUSES, OCCUPYING_STATUSES, validateSlot } from './scheduling';
import { overlaps } from './time';
import { clearNamespace, loadState, NAMESPACE, parseEnvelope, saveState, serialize, type KV } from './storage';
import { computeKpis, estimateTotals, ledgerNet } from './selectors';

let n = 0;
const run = (s: DemoState, cmd: CommandInput & { commandId?: string }) => execute(s, { commandId: cmd.commandId ?? `t${++n}`, ...cmd } as Command);
const appt = (s: DemoState, id: string) => s.appointments.find((a) => a.id === id)!;

describe('seed dentalos-v1', () => {
  it('es determinista y tiene las cardinalidades pedidas', () => {
    const a = createSeedState(); const b = createSeedState();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.locations).toHaveLength(2); expect(a.professionals).toHaveLength(4); expect(a.chairs).toHaveLength(3);
    expect(a.serviceTypes).toHaveLength(6); expect(a.persons).toHaveLength(12); expect(a.appointments).toHaveLength(18);
    expect(a.requests).toHaveLength(5); expect(a.conversations).toHaveLength(3); expect(a.careEpisodes).toHaveLength(2);
    expect(a.estimates).toHaveLength(3); expect(a.ledger).toHaveLength(10);
    expect(a.responsibleLinks.filter((l) => l.responsibleId === 'P-003')).toHaveLength(2);
    expect(a.clock).toBe('2026-10-19T09:00:00-03:00');
  });
  it('las 18 citas no se solapan en profesional, sillón ni persona', () => {
    const s = createSeedState();
    const occ = s.appointments.filter((a) => OCCUPYING_STATUSES.includes(a.status));
    for (const x of occ) for (const y of occ) {
      if (x.id >= y.id || !overlaps(x.start, x.end, y.start, y.end)) continue;
      expect(x.professionalId === y.professionalId || x.chairId === y.chairId || x.personId === y.personId, `${x.id} vs ${y.id}`).toBe(false);
    }
  });
  it('las citas futuras activas cumplen jornada y bloqueos', () => {
    const s = createSeedState();
    for (const a of s.appointments.filter((x) => ACTIVE_STATUSES.includes(x.status) && x.start > s.clock)) {
      const c = validateSlot(s, { start: a.start, end: a.end, professionalId: a.professionalId, chairId: a.chairId, locationId: a.locationId, serviceTypeId: a.serviceTypeId }, { ignoreAppointmentId: a.id, skipLeadCheck: true });
      expect(c, a.id).toEqual([]);
    }
  });
});

describe('disponibilidad', () => {
  it('ofrece martes 11:00 y miércoles 15:00 para el control de P-001 desde martes 10:00', () => {
    const s = createSeedState();
    const slots = findSlots(s, { serviceTypeId: 'ST-ORTO-CTRL', professionalId: 'PR-03', from: '2026-10-20T10:00:00-03:00', limit: 2, ignoreAppointmentId: 'A-0012', personId: 'P-001' });
    expect(slots.map((x) => x.start)).toEqual(['2026-10-20T11:00:00-03:00', '2026-10-21T15:00:00-03:00']);
  });
  it('contiguos son válidos y respeta anticipación mínima, horizonte y jornada', () => {
    const s = createSeedState();
    const base = { professionalId: 'PR-03', chairId: 'CH-2', locationId: 'L-CEN', serviceTypeId: 'ST-ORTO-CTRL' };
    expect(validateSlot(s, { ...base, start: '2026-10-21T15:00:00-03:00', end: '2026-10-21T15:30:00-03:00' })).toEqual([]);
    expect(validateSlot(s, { ...base, start: '2026-10-19T10:00:00-03:00', end: '2026-10-19T10:30:00-03:00' }).map((c) => c.code)).toContain('ANTICIPACION_MINIMA');
    expect(validateSlot(s, { ...base, start: '2026-11-24T10:00:00-03:00', end: '2026-11-24T10:30:00-03:00' }).map((c) => c.code)).toContain('FUERA_DE_HORIZONTE');
    expect(validateSlot(s, { ...base, start: '2026-10-24T10:00:00-03:00', end: '2026-10-24T10:30:00-03:00' }).map((c) => c.code)).toContain('FUERA_DE_JORNADA');
  });
  it('S10: no ofrece el hueco de 15 min del miércoles 14:00', () => {
    const s = createSeedState();
    const slots = findSlots(s, { serviceTypeId: 'ST-ORTO-CTRL', professionalId: 'PR-03', from: '2026-10-21T14:00:00-03:00', limit: 1 });
    expect(slots[0].start).toBe('2026-10-21T15:00:00-03:00');
  });
  it('S09: sillón ocupado aunque el profesional esté libre', () => {
    const s = PRESETS.find((p) => p.id === 'sillon_ocupado')!.build();
    const r = run(s, { type: 'book', personId: 'P-002', serviceTypeId: 'ST-CONTROL', professionalId: 'PR-02', chairId: 'CH-1', locationId: 'L-CEN', start: '2026-10-20T09:00:00-03:00', channel: 'recepcion' });
    expect(r.result.ok).toBe(false);
    if (!r.result.ok) expect(r.result.conflicts?.map((c) => c.code)).toEqual(['SILLON_OCUPADO']);
    expect(r.state).toBe(s);
  });
});

describe('recorrido protagonista (WhatsApp)', () => {
  const choose = (s: DemoState, replyLabelStarts: string) => {
    const reply = activeReplies(s, 'C-001').find((r) => r.label.startsWith(replyLabelStarts));
    expect(reply, `opción "${replyLabelStarts}" en ${JSON.stringify(activeReplies(s, 'C-001'))}`).toBeTruthy();
    return run(s, { type: 'chatChoose', conversationId: 'C-001', replyId: reply!.id }).state;
  };
  it('primera alternativa ocupada, original conservado, confirma martes 11:00 con mismo ID y versión nueva', () => {
    let s = createSeedState();
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'Hola!' }).state;
    expect(s.appointments).toHaveLength(18); expect(s.persons).toHaveLength(12);
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'Quiero cambiar mi turno' }).state;
    s = choose(s, 'Control de ortodoncia');
    s = choose(s, 'Mismo horario');
    const last = s.messages[s.messages.length - 1].text;
    expect(last).toContain('está ocupado');
    expect(last).toContain('Conservamos tu turno anterior');
    expect(appt(s, 'A-0012').start).toBe('2026-10-22T10:00:00-03:00');
    expect(activeReplies(s, 'C-001').map((r) => r.label).slice(0, 2)).toEqual(['mar 20/10 · 11:00 · Dra. Inés Galván', 'mié 21/10 · 15:00 · Dra. Inés Galván']);
    s = choose(s, 'mar 20/10 · 11:00');
    expect(appt(s, 'A-0012').version).toBe(1); // revisar no confirma
    const oldReminder = s.outbox.find((o) => o.appointmentId === 'A-0012' && o.kind === 'recordatorio_24h')!;
    s = choose(s, 'Confirmar cambio');
    const a = appt(s, 'A-0012');
    expect(a.start).toBe('2026-10-20T11:00:00-03:00'); expect(a.version).toBe(2); expect(s.appointments).toHaveLength(18);
    expect(s.outbox.find((o) => o.id === oldReminder.id)!.status).toBe('anulado');
    expect(s.outbox.some((o) => o.dedupeKey === 'rem:A-0012:v2:24h' && o.status === 'programado')).toBe(true);
    expect(s.messages[s.messages.length - 1].text).toContain('Cambio guardado en esta demo');
    expect(s.careEpisodes[0].timeline.at(-1)!.text).toContain('A-0012 reprogramado');
  });
  it('S14: fallo de commit conserva el original y el reintento aplica una sola vez', () => {
    let s = PRESETS.find((p) => p.id === 'fallo_commit')!.build();
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'quiero reprogramar' }).state;
    s = choose(s, 'Control de ortodoncia');
    s = choose(s, 'Ver horarios libres');
    s = choose(s, 'mar 20/10 · 11:00');
    s = choose(s, 'Confirmar cambio');
    expect(appt(s, 'A-0012').start).toBe('2026-10-22T10:00:00-03:00');
    expect(appt(s, 'A-0012').version).toBe(1);
    expect(s.messages.at(-1)!.text).toContain('Conservamos tu turno anterior');
    expect(s.settings.failNextCommits).toBe(0);
    s = choose(s, 'Reintentar');
    expect(appt(s, 'A-0012').version).toBe(2);
    expect(s.audit.filter((e) => e.type === 'cita_reprogramada')).toHaveLength(1);
  });
});

describe('chat: intenciones y límites', () => {
  it('normaliza saludos y variantes', () => {
    for (const t of ['Hola', 'hola!', 'Buen día', 'buenas']) expect(detectIntent(t)).toBe('saludo');
    expect(detectIntent('Quiero MOVER mi cita')).toBe('reprogramar');
    expect(detectIntent('anular el turno')).toBe('cancelar');
    expect(detectIntent('¿Dónde quedan? dirección')).toBe('ubicacion');
    expect(detectIntent('cuándo atienden')).toBe('horarios');
    expect(detectIntent('quiero hablar con recepción')).toBe('humano');
    expect(detectIntent('No quiero cancelar')).toBe('negacion');
    expect(detectIntent('me duele una muela, qué medicamento tomo')).toBe('clinico');
    expect(detectIntent('cancelar o cambiar?')).toBe('ambiguo');
  });
  it('S28: vacío no envía; S31: clínico no crea tarea hasta aceptar', () => {
    const s = createSeedState();
    const r = run(s, { type: 'chatSend', conversationId: 'C-001', text: '   ' });
    expect(r.result.ok).toBe(false); expect(r.state).toBe(s);
    let t = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'Me duele mucho' }).state;
    expect(t.tasks).toHaveLength(s.tasks.length);
    expect(t.messages.at(-1)!.text).toContain('no puedo evaluar síntomas');
    const yes = activeReplies(t, 'C-001').find((x) => x.id === 'human_yes')!;
    t = run(t, { type: 'chatChoose', conversationId: 'C-001', replyId: yes.id }).state;
    expect(t.tasks.filter((x) => x.kind === 'derivacion')).toHaveLength(2);
  });
  it('"No quiero cancelar" nunca cancela', () => {
    const s = createSeedState();
    const t = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'No quiero cancelar' }).state;
    expect(t.appointments.filter((a) => a.status === 'cancelada')).toHaveLength(1);
  });
  it('opciones de mensajes viejos no se pueden reutilizar', () => {
    let s = createSeedState();
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'hola' }).state;
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'gracias' }).state;
    const r = run(s, { type: 'chatChoose', conversationId: 'C-001', replyId: 'appt:A-0012' });
    expect(r.result.ok).toBe(false);
  });
});

describe('idempotencia y atomicidad', () => {
  it('S06: mismo commandId dos veces crea una sola cita', () => {
    const s = createSeedState();
    const cmd = { commandId: 'book-x', type: 'book', personId: 'P-001', serviceTypeId: 'ST-PRIMERA', professionalId: 'PR-01', locationId: 'L-CEN', start: '2026-10-21T11:00:00-03:00', channel: 'web' } as Command;
    const r1 = execute(s, cmd); const r2 = execute(r1.state, cmd);
    expect(r1.result.ok).toBe(true); expect(r2.replayed).toBe(true); expect(r2.state).toBe(r1.state);
    expect(r2.state.appointments).toHaveLength(19);
    expect(r1.result.ok && r1.result.info?.status).toBe('solicitada');
    expect(r2.state.requests).toHaveLength(6);
  });
  it('S07: duplicado semántico con otro commandId se detecta', () => {
    const s = createSeedState();
    const base = { type: 'book', personId: 'P-001', serviceTypeId: 'ST-PRIMERA', professionalId: 'PR-01', locationId: 'L-CEN', start: '2026-10-21T11:00:00-03:00', channel: 'web' } as const;
    const r1 = run(s, base); const r2 = run(r1.state, base);
    expect(r2.result.ok).toBe(false);
    if (!r2.result.ok) { expect(r2.result.code).toBe('DUPLICADO'); expect(r2.result.existingId).toBe(r1.result.ok && r1.result.ids?.appointmentId); }
  });
  it('S08: conflicto no muta estado', () => {
    const s = createSeedState();
    const r = run(s, { type: 'book', personId: 'P-002', serviceTypeId: 'ST-ORTO-CONS', professionalId: 'PR-03', locationId: 'L-CEN', start: '2026-10-20T10:00:00-03:00', channel: 'web' });
    expect(r.result.ok).toBe(false); expect(r.state).toBe(s);
  });
  it('S15: dentro de 12 h no mueve y crea una sola excepción', () => {
    const s = createSeedState();
    const r = run(s, { type: 'reschedule', appointmentId: 'A-0007', start: '2026-10-21T15:00:00-03:00', channel: 'web' });
    expect(r.result.ok === false && r.result.code).toBe('FUERA_DE_VENTANA');
    const h1 = run(s, { type: 'requestHumanChange', appointmentId: 'A-0007', channel: 'web' });
    const h2 = run(h1.state, { type: 'requestHumanChange', appointmentId: 'A-0007', channel: 'web' });
    expect(h2.state.tasks.filter((t) => t.kind === 'excepcion_cambio')).toHaveLength(1);
    expect(appt(h2.state, 'A-0007').start).toBe('2026-10-19T15:00:00-03:00');
  });
  it('S16: cancelar anula recordatorio; segunda cancelación no crea evento', () => {
    const s = createSeedState();
    const r1 = run(s, { type: 'cancel', appointmentId: 'A-0014', channel: 'web' });
    expect(r1.state.outbox.find((o) => o.dedupeKey === 'rem:A-0014:v1:24h')!.status).toBe('anulado');
    const r2 = run(r1.state, { type: 'cancel', appointmentId: 'A-0014', channel: 'web' });
    expect(r2.result.ok === false && r2.result.code).toBe('YA_CANCELADA');
    expect(r2.state.audit.length).toBe(r1.state.audit.length);
  });
  it('S17/S18/S19: confirmación de recepción, estados permitidos y ausencia', () => {
    let s = createSeedState();
    s = run(s, { type: 'confirmAppointment', appointmentId: 'A-0004' }).state;
    expect(appt(s, 'A-0004').status).toBe('confirmada');
    expect(run(s, { type: 'transition', appointmentId: 'A-0003', to: 'finalizada' }).result.ok).toBe(false);
    for (const to of ['en_sala', 'en_atencion', 'finalizada'] as const) s = run(s, { type: 'transition', appointmentId: 'A-0003', to }).state;
    expect(appt(s, 'A-0003').status).toBe('finalizada');
    expect(run(s, { type: 'transition', appointmentId: 'A-0013', to: 'ausente' }).result.ok).toBe(false);
    s = run(s, { type: 'transition', appointmentId: 'A-0002', to: 'ausente' }).state;
    expect(appt(s, 'A-0002').status).toBe('ausente');
  });
  it('bloqueo sobre turnos activos se rechaza', () => {
    const s = createSeedState();
    const r = run(s, { type: 'addBlock', scope: 'professional', targetId: 'PR-03', start: '2026-10-22T09:00:00-03:00', end: '2026-10-22T13:00:00-03:00', reason: 'x' });
    expect(r.result.ok === false && r.result.code).toBe('BLOQUEO_CON_TURNOS');
  });
});

describe('recordatorios A05 y reloj', () => {
  it('avanzar el reloj entrega una vez por cita+versión; repetir no duplica', () => {
    let s = createSeedState();
    s = run(s, { type: 'advanceClock', minutes: 60 * 24 }).state;
    const delivered = s.outbox.filter((o) => o.status === 'entregado_simulado' && o.kind === 'recordatorio_24h').length;
    s = run(s, { type: 'advanceClock', minutes: 1 }).state;
    expect(s.outbox.filter((o) => o.status === 'entregado_simulado' && o.kind === 'recordatorio_24h').length).toBe(delivered);
    const keys = s.outbox.map((o) => o.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('opt-out bloquea y crea tarea manual', () => {
    let s = createSeedState();
    s = run(s, { type: 'setReminderOptIn', personId: 'P-002', optIn: false }).state;
    s = run(s, { type: 'advanceClock', minutes: 60 * 24 * 4 }).state;
    expect(s.outbox.find((o) => o.dedupeKey === 'rem:A-0017:v1:24h')!.status).toBe('bloqueado_optout');
    expect(s.tasks.some((t) => t.kind === 'contacto_manual' && t.appointmentId === 'A-0017')).toBe(true);
  });
});

describe('presupuestos y caja ficticia', () => {
  it('S43: aceptar no crea movimiento; importes negativos y duplicados se rechazan', () => {
    let s = createSeedState();
    expect(run(s, { type: 'estimateAddLine', estimateId: 'EST-003', description: 'X', tooth: null, qty: 1, unitMinor: -5 }).result.ok).toBe(false);
    expect(run(s, { type: 'estimateAddLine', estimateId: 'EST-003', description: 'Aparatología de contención (muestra)', tooth: null, qty: 1, unitMinor: 5 }).result.ok).toBe(false);
    expect(run(s, { type: 'estimateAddLine', estimateId: 'EST-003', description: 'Pieza', tooth: 99, qty: 1, unitMinor: 5 }).result.ok).toBe(false);
    const ledgerBefore = s.ledger.length; const net = ledgerNet(s);
    s = run(s, { type: 'estimateTransition', estimateId: 'EST-003', to: 'emitido' }).state;
    s = run(s, { type: 'estimateTransition', estimateId: 'EST-003', to: 'aceptado' }).state;
    expect(s.estimates.find((e) => e.id === 'EST-003')!.status).toBe('aceptado');
    expect(s.ledger.length).toBe(ledgerBefore); expect(ledgerNet(s)).toBe(net);
  });
  it('S44: registrar y revertir reconcilia; reintento no duplica', () => {
    let s = createSeedState();
    const e = s.estimates.find((x) => x.id === 'EST-002')!;
    const before = estimateTotals(s, e).balance!;
    const cmd = { commandId: 'pay-1', type: 'ledgerRecord', personId: 'P-008', estimateId: 'EST-002', amountMinor: 500_000, note: '' } as Command;
    s = execute(s, cmd).state; s = execute(s, cmd).state;
    expect(estimateTotals(s, s.estimates.find((x) => x.id === 'EST-002')!).balance).toBe(before - 500_000);
    const id = s.ledger.at(-1)!.id;
    s = run(s, { type: 'ledgerReverse', entryId: id }).state;
    expect(run(s, { type: 'ledgerReverse', entryId: id }).result.ok).toBe(false);
    expect(estimateTotals(s, s.estimates.find((x) => x.id === 'EST-002')!).balance).toBe(before);
  });
});

describe('odontograma y episodios', () => {
  it('S41: pieza incompatible con dentición se rechaza sin estado parcial', () => {
    const s = createSeedState();
    const r = run(s, { type: 'toothMark', personId: 'P-004', dentition: 'temporal', tooth: 36, surface: 'O', procedure: 'Restauración', state: 'planificado' });
    expect(r.result.ok).toBe(false); expect(r.state).toBe(s);
    const ok = run(s, { type: 'toothMark', personId: 'P-004', dentition: 'temporal', tooth: 54, surface: 'O', procedure: 'Sellador', state: 'planificado' });
    expect(ok.result.ok).toBe(true);
    const undo = run(ok.state, { type: 'toothUndo', entryId: ok.state.toothChart.at(-1)!.id });
    expect(undo.state.toothChart.at(-1)!.status).toBe('deshecho');
  });
  it('S42: indicar control crea tarea, no cita', () => {
    const s = createSeedState();
    const r = run(s, { type: 'episodeIndicateControl', episodeId: 'E-001', note: 'Control indicado' });
    expect(r.state.appointments).toHaveLength(18);
    expect(r.state.tasks.some((t) => t.kind === 'control_indicado' && t.personId === 'P-001')).toBe(true);
  });
  it('aparatología: la registra la profesional, valida el valor y queda en el timeline', () => {
    const s = createSeedState();
    expect(s.careEpisodes.find((e) => e.id === 'E-001')!.appliance).toBe('brackets_esteticos');
    const r = run(s, { type: 'episodeSetAppliance', episodeId: 'E-001', appliance: 'alineadores' });
    expect(r.result.ok).toBe(true);
    const ep = r.state.careEpisodes.find((e) => e.id === 'E-001')!;
    expect(ep.appliance).toBe('alineadores');
    expect(ep.timeline.at(-1)!.kind).toBe('aparatologia');
    expect(r.state.appointments).toHaveLength(18);
    const same = run(r.state, { type: 'episodeSetAppliance', episodeId: 'E-001', appliance: 'alineadores' });
    expect(same.result.ok === false && same.result.code).toBe('SIN_CAMBIOS');
    const bad = run(r.state, { type: 'episodeSetAppliance', episodeId: 'E-001', appliance: 'imán' });
    expect(bad.result.ok === false && bad.result.code).toBe('DATOS_INVALIDOS');
    expect(bad.state).toBe(r.state);
  });
  it('odontograma: cada registro nuevo (oro, implante, ausente…) se guarda con su pieza', () => {
    const s = createSeedState();
    const r = run(s, { type: 'toothMark', personId: 'P-002', dentition: 'permanente', tooth: 26, surface: 'pieza', procedure: 'Corona de oro', state: 'realizado' });
    expect(r.result.ok).toBe(true);
    expect(r.state.toothChart.at(-1)).toMatchObject({ tooth: 26, procedure: 'Corona de oro', state: 'realizado', status: 'vigente' });
    const bad = run(s, { type: 'toothMark', personId: 'P-002', dentition: 'permanente', tooth: 26, surface: 'pieza', procedure: 'Blanqueamiento mágico', state: 'realizado' });
    expect(bad.result.ok).toBe(false);
  });
  it('control de ortodoncia sólo con control indicado', () => {
    const s = createSeedState();
    const r = run(s, { type: 'book', personId: 'P-002', serviceTypeId: 'ST-ORTO-CTRL', professionalId: 'PR-03', locationId: 'L-CEN', start: '2026-10-21T15:00:00-03:00', channel: 'web' });
    expect(r.result.ok === false && r.result.code).toBe('CONTROL_NO_INDICADO');
  });
});

describe('espera y ofertas (S45)', () => {
  it('dos aceptaciones: un ganador, sin overbooking', () => {
    let s = PRESETS.find((p) => p.id === 'dos_ofertas')!.build();
    const r1 = run(s, { type: 'offerAccept', offerId: 'OF-001' });
    expect(r1.result.ok).toBe(true); s = r1.state;
    const r2 = run(s, { type: 'offerAccept', offerId: 'OF-002' });
    expect(r2.result.ok === false && r2.result.code).toBe('OFERTA_TOMADA');
    const slot = s.offers[0].slot;
    expect(s.appointments.filter((a) => a.start === slot.start && a.chairId === slot.chairId && a.status === 'confirmada')).toHaveLength(1);
  });
  it('oferta vencida no se acepta', () => {
    let s = PRESETS.find((p) => p.id === 'dos_ofertas')!.build();
    s = run(s, { type: 'advanceClock', minutes: 11 }).state;
    expect(s.offers.every((o) => o.status === 'vencida')).toBe(true);
    expect(run(s, { type: 'offerAccept', offerId: 'OF-001' }).result.ok).toBe(false);
  });
});

describe('KPIs y educación', () => {
  it('S21: preset vacío da n=0 sin división por cero', () => {
    const s = PRESETS.find((p) => p.id === 'vacio')!.build();
    const k = computeKpis(s, { from: '2026-10-19', to: '2026-10-25' });
    expect(k.n).toBe(0); expect(k.confirmation.den).toBe(0); expect(k.noShow.den).toBe(0);
  });
  it('canceladas no cuentan como activas y el KPI cambia con el store', () => {
    let s = createSeedState();
    const f = { from: '2026-10-19', to: '2026-10-30' };
    const k1 = computeKpis(s, f);
    s = run(s, { type: 'cancel', appointmentId: 'A-0014', channel: 'recepcion' }).state;
    const k2 = computeKpis(s, f);
    expect(k2.active).toBe(k1.active - 1); expect(k2.cancelled).toBe(k1.cancelled + 1);
  });
  it('S46: completar dos veces no suma', () => {
    let s = createSeedState();
    s = run(s, { type: 'learningOpen', cardId: 'cambio' }).state;
    s = run(s, { type: 'learningAnswer', cardId: 'cambio', choiceId: 'a' }).state;
    expect(s.learning.find((l) => l.cardId === 'cambio')!.state).toBe('en_curso');
    s = run(s, { type: 'learningAnswer', cardId: 'cambio', choiceId: 'b' }).state;
    s = run(s, { type: 'learningComplete', cardId: 'cambio' }).state;
    expect(run(s, { type: 'learningComplete', cardId: 'cambio' }).result.ok).toBe(false);
  });
});

describe('storage', () => {
  const memKV = (): KV & { map: Map<string, string> } => {
    const map = new Map<string, string>();
    return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k), key: (i) => [...map.keys()][i] ?? null, get length() { return map.size; } };
  };
  it('S03/S25/S26: guarda, hidrata, detecta corrupción y reset borra solo el namespace', () => {
    const kv = memKV();
    kv.setItem('otra-app', 'x');
    const s = createSeedState();
    expect(saveState(kv, s)).toBe('ok');
    const loaded = loadState(kv);
    expect(loaded.status).toBe('ok');
    kv.setItem(NAMESPACE, '{"roto":');
    expect(loadState(kv).status).toBe('corrupt');
    expect(parseEnvelope(serialize({ ...s, appointments: [{ ...s.appointments[0], status: 'x' as never }] })).status).toBe('corrupt');
    kv.setItem(`${NAMESPACE}:draft:reserva`, '{}');
    clearNamespace(kv);
    expect(kv.getItem('otra-app')).toBe('x'); expect(kv.length).toBe(1);
  });
});

describe('cobertura adicional de la matriz', () => {
  it('S12: agenda llena da cero cupos y permite espera', () => {
    const s = PRESETS.find((p) => p.id === 'agenda_llena')!.build();
    expect(findSlots(s, { serviceTypeId: 'ST-LIMPIEZA', limit: 3 })).toEqual([]);
    expect(run(s, { type: 'waitlistAdd', personId: 'P-002', serviceTypeId: 'ST-LIMPIEZA', professionalId: null, locationId: null, period: 'cualquiera', validDays: 30 }).result.ok).toBe(true);
  });
  it('S20: filtrar no cambia datos y cero coincidencias es válido', async () => {
    const { filteredAppointments } = await import('./selectors');
    const s = createSeedState(); const snap = JSON.stringify(s);
    expect(filteredAppointments(s, { from: '2026-10-19', to: '2026-10-23', professionalId: 'PR-03' }).length).toBeGreaterThan(0);
    expect(filteredAppointments(s, { from: '2026-10-19', to: '2026-10-23', professionalId: 'PR-03', status: 'ausente' })).toEqual([]);
    expect(JSON.stringify(s)).toBe(snap);
  });
  it('S30: texto desconocido repetido ofrece humano sin inventar', () => {
    let s = createSeedState();
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'xyz qwerty' }).state;
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'blablá' }).state;
    expect(s.messages.at(-1)!.text).toContain('no quiero inventar');
    expect(activeReplies(s, 'C-001')[0].id).toBe('menu:humano');
    expect(s.tasks).toHaveLength(3);
  });
  it('S32: reabrir una conversación con flujo obsoleto muestra el estado actual', () => {
    let s = createSeedState();
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'cancelar' }).state;
    s = run(s, { type: 'chatChoose', conversationId: 'C-001', replyId: 'appt:A-0014' }).state;
    s = run(s, { type: 'cancel', appointmentId: 'A-0014', channel: 'recepcion' }).state;
    s = run(s, { type: 'chatOpen', conversationId: 'C-001' }).state;
    expect(s.messages.some((m) => m.from === 'sistema' && m.text.includes('Hubo un cambio reciente: A-0014 está cancelada'))).toBe(true);
    expect(activeReplies(s, 'C-001').some((r) => r.id === 'cancel_yes')).toBe(false);
  });
  it('S39: editar ficha versiona y rechaza versión obsoleta', () => {
    let s = createSeedState();
    s = run(s, { type: 'updatePerson', personId: 'P-007', expectedVersion: 1, patch: { adminNote: 'Nota nueva' } }).state;
    expect(s.persons.find((p) => p.id === 'P-007')!.version).toBe(2);
    expect(s.persons.find((p) => p.id === 'P-001')!.adminNote).toBe('Prefiere turnos por la mañana.');
    expect(run(s, { type: 'updatePerson', personId: 'P-007', expectedVersion: 1, patch: { adminNote: 'x' } }).result.ok).toBe(false);
  });
  it('S40: cada dependiente ve solo sus turnos', async () => {
    const { upcomingFor, dependentsOf } = await import('./selectors');
    const s = createSeedState();
    expect(dependentsOf(s, 'P-003').map((d) => d.person.id)).toEqual(['P-004', 'P-005']);
    expect(upcomingFor(s, 'P-004').every((a) => a.personId === 'P-004')).toBe(true);
    expect(upcomingFor(s, 'P-005').map((a) => a.id)).toEqual(['A-0015']);
  });
  it('A02: pedido completo por WhatsApp crea solicitud pendiente (no confirmada)', () => {
    let s = createSeedState();
    s = run(s, { type: 'chatSend', conversationId: 'C-003', text: 'quiero un turno' }).state;
    s = run(s, { type: 'chatChoose', conversationId: 'C-003', replyId: 'svc:ST-PRIMERA' }).state;
    s = run(s, { type: 'chatChoose', conversationId: 'C-003', replyId: 'slot:0' }).state;
    s = run(s, { type: 'chatChoose', conversationId: 'C-003', replyId: 'confirm' }).state;
    const a = s.appointments.at(-1)!;
    expect(a.personId).toBe('P-007'); expect(a.status).toBe('solicitada'); expect(a.origin).toBe('whatsapp');
    expect(s.requests.find((r) => r.id === a.requestId)!.status).toBe('pendiente');
  });
  it('A09: presupuesto emitido vence con el reloj y crea una sola tarea, sin cobro', () => {
    let s = createSeedState();
    const net = ledgerNet(s);
    s = run(s, { type: 'advanceClock', minutes: 60 * 24 * 8 }).state;
    s = run(s, { type: 'advanceClock', minutes: 60 }).state;
    expect(s.estimates.find((e) => e.id === 'EST-001')!.status).toBe('vencido');
    expect(s.tasks.filter((t) => t.estimateId === 'EST-001' && t.kind === 'seguimiento_presupuesto')).toHaveLength(1);
    expect(ledgerNet(s)).toBe(net);
  });
  it('A10: vincular gestión de otra persona se rechaza (no fusiona por nombre)', () => {
    let s = createSeedState();
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'quiero reprogramar' }).state;
    s = run(s, { type: 'chatChoose', conversationId: 'C-001', replyId: 'appt:A-0012' }).state;
    const reqId = s.conversations.find((c) => c.id === 'C-001')!.requestId!;
    expect(run(s, { type: 'chatLinkRequest', conversationId: 'C-003', requestId: reqId }).result.ok).toBe(false);
  });
});

describe('reglas pausables', () => {
  it('A05 pausada deja el recordatorio programado; reglas obligatorias no se pausan', () => {
    let s = createSeedState();
    s = run(s, { type: 'setAutomationRule', ruleId: 'A05', enabled: false }).state;
    s = run(s, { type: 'advanceClock', minutes: 60 * 24 * 2 }).state;
    expect(s.outbox.find((o) => o.dedupeKey === 'rem:A-0011:v1:24h')!.status).toBe('programado');
    s = run(s, { type: 'setAutomationRule', ruleId: 'A05', enabled: true }).state;
    s = run(s, { type: 'advanceClock', minutes: 1 }).state;
    expect(s.outbox.find((o) => o.dedupeKey === 'rem:A-0011:v1:24h')!.status).toBe('entregado_simulado');
    expect(run(s, { type: 'setAutomationRule', ruleId: 'A08', enabled: false }).result.ok).toBe(false);
  });
  it('A09 pausada: el presupuesto vence igual pero no crea tarea', () => {
    let s = createSeedState();
    s = run(s, { type: 'setAutomationRule', ruleId: 'A09', enabled: false }).state;
    s = run(s, { type: 'advanceClock', minutes: 60 * 24 * 8 }).state;
    expect(s.estimates.find((e) => e.id === 'EST-001')!.status).toBe('vencido');
    expect(s.tasks.some((t) => t.estimateId === 'EST-001' && t.kind === 'seguimiento_presupuesto')).toBe(false);
  });
});
