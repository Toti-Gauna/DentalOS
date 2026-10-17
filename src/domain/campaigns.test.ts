import { describe, expect, it } from 'vitest';
import { activeReplies, createSeedState, detectIntent, execute, type CampaignInput, type Command, type CommandInput, type DemoState } from './index';
import {
  TEMPLATES, breakeven, buildAudience, campaignEconomics, campaignResults, capacityFor, checkMessage, emptyEconomics, occurrences,
  renderMessage, reviewCampaign, segmentMembers,
} from './campaigns';
import { detectDirectorIntent, directorAnswer } from './assistant';
import { unitEconomics } from './campaigns';
import { parseEnvelope, serialize } from './storage';
import { at } from './time';

let n = 0;
const run = (s: DemoState, cmd: CommandInput & { commandId?: string }) => execute(s, { commandId: cmd.commandId ?? `c${++n}`, ...cmd } as Command);
const code = (r: ReturnType<typeof run>) => (r.result.ok ? 'OK' : r.result.code);
const idsOf = (r: ReturnType<typeof run>) => (r.result.ok ? r.result.ids ?? {} : {}) as Record<string, string>;
const input = (over: Partial<CampaignInput> = {}): CampaignInput => ({
  name: 'Campaña de prueba', kind: 'segmentada', trigger: 'manual', cadence: 'unica', segmentIds: ['controles_pendientes'], personId: null,
  templateId: 'control_indicado', extraNote: '', serviceTypeId: null, scheduledFor: null, economics: { ...emptyEconomics(), fixedCostMinor: 0 }, ...over,
});
/** Crea una campaña y devuelve el estado y su ID. */
function create(s: DemoState, over: Partial<CampaignInput> = {}) {
  const r = run(s, { type: 'campaignCreate', input: input(over) });
  expect(r.result.ok, r.result.message).toBe(true);
  return { s: r.state, id: idsOf(r).campaignId };
}
/** Borrador → vista previa → aprobación → activación. */
function launch(s: DemoState, id: string) {
  for (const type of ['campaignPreview', 'campaignApprove', 'campaignActivate'] as const) {
    const r = run(s, { type, campaignId: id });
    expect(r.result.ok, `${type}: ${r.result.message}`).toBe(true);
    s = r.state;
  }
  return s;
}

describe('S79–S82 · segmentos y audiencia', () => {
  it('S79: los segmentos salen del store (controles indicados, presupuestos, consultas, cancelados)', () => {
    const s = createSeedState();
    expect(segmentMembers(s, 'controles_pendientes').map((m) => [m.personId, m.sourceId])).toEqual([['P-009', 'IC-003']]);
    expect(segmentMembers(s, 'presupuestos_sin_respuesta').map((m) => m.sourceId)).toEqual(['EST-001', 'EST-004']);
    expect(segmentMembers(s, 'consultas_sin_turno').map((m) => [m.personId, m.sourceId])).toEqual([[null, 'R-002']]);
    expect(segmentMembers(s, 'reprogramaciones').map((m) => [m.personId, m.sourceId])).toEqual([['P-012', 'A-0016']]);
  });

  it('S80: un menor se contacta por su responsable; baja, exclusión y frecuencia quedan fuera con su motivo', () => {
    const s = createSeedState();
    const a = buildAudience(s, { id: 'X', kind: 'masiva', segmentIds: [], personId: null });
    expect(a.eligible.map((e) => e.contactId)).toEqual(['P-001', 'P-006', 'P-007', 'P-008', 'P-010', 'P-012']);
    expect(a.excluded.map((e) => [e.contactId, e.reason])).toEqual([['P-002', 'exclusion'], ['P-003', 'frecuencia'], ['P-011', 'baja']]);
    expect(a.eligible.find((e) => e.contactId === 'P-006')!.forPersonIds).toEqual(['P-006', 'P-009']);
    expect(a.eligible.find((e) => e.contactId === 'P-006')!.channel).toBe('llamada');
  });

  it('S81: deduplicación multicanal: una persona en dos segmentos recibe un solo mensaje', () => {
    const s = createSeedState();
    const a = buildAudience(s, { id: 'X', kind: 'segmentada', segmentIds: ['controles_pendientes', 'presupuestos_sin_respuesta'], personId: null });
    expect(a.members).toBe(3);
    expect(a.merged).toBe(1);
    expect(a.eligible).toHaveLength(1);
    expect(a.eligible[0]).toMatchObject({ contactId: 'P-006', forPersonIds: ['P-009', 'P-006'] });
    expect(a.eligible[0].reasons).toHaveLength(2);
  });

  it('S82: audiencia vacía (consulta sin identificar) bloquea la vista previa y deja el borrador', () => {
    const { s, id } = create(createSeedState(), { segmentIds: ['consultas_sin_turno'], templateId: 'consulta_sin_turno' });
    const aud = buildAudience(s, s.campaigns.find((c) => c.id === id)!);
    expect(aud.excluded.map((e) => e.reason)).toEqual(['sin_identificar']);
    const r = run(s, { type: 'campaignPreview', campaignId: id });
    expect(code(r)).toBe('AUDIENCIA_VACIA');
    expect(r.state.campaigns.find((c) => c.id === id)!.status).toBe('borrador');
  });
});

describe('S83–S86 · ciclo de vida y envío simulado', () => {
  it('S83: borrador → lista → aprobada → activa; no se puede saltar pasos ni editar una activa', () => {
    const made = create(createSeedState()); let s = made.s; const id = made.id;
    expect(code(run(s, { type: 'campaignApprove', campaignId: id }))).toBe('ESTADO_INVALIDO');
    expect(code(run(s, { type: 'campaignActivate', campaignId: id }))).toBe('ESTADO_INVALIDO');
    s = launch(s, id);
    const c = s.campaigns.find((x) => x.id === id)!;
    expect(c.status).toBe('activa');
    const ds = s.campaignDeliveries.filter((x) => x.campaignId === id);
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ contactId: 'P-006', channel: 'llamada', status: 'entregado_simulado' });
    // La llamada es de recepción: queda como tarea, no como llamada automática.
    expect(s.tasks.some((t) => t.dedupeKey === `camp:${id}:P-006:llamada`)).toBe(true);
    expect(code(run(s, { type: 'campaignUpdate', campaignId: id, patch: { name: 'Otro nombre' } }))).toBe('ESTADO_INVALIDO');
  });

  it('S84: editar una campaña aprobada la devuelve a borrador; reintentar un comando no duplica entregas', () => {
    const made = create(createSeedState()); let s = made.s; const id = made.id;
    s = run(s, { type: 'campaignPreview', campaignId: id }).state;
    s = run(s, { type: 'campaignApprove', campaignId: id }).state;
    s = run(s, { type: 'campaignUpdate', campaignId: id, patch: { name: 'Controles indicados · octubre' } }).state;
    expect(s.campaigns.find((c) => c.id === id)!).toMatchObject({ status: 'borrador', approvedAt: null, version: 2 });
    s = run(s, { type: 'campaignPreview', campaignId: id }).state;
    s = run(s, { type: 'campaignApprove', campaignId: id }).state;
    const first = run(s, { type: 'campaignActivate', campaignId: id, commandId: 'act-1' });
    const again = run(first.state, { type: 'campaignActivate', campaignId: id, commandId: 'act-1' });
    expect(again.replayed).toBe(true);
    expect(again.state.campaignDeliveries.filter((x) => x.campaignId === id)).toHaveLength(1);
  });

  it('S85: programada → pausa retiene; reanudar y avanzar el reloj entrega; una baja previa al envío bloquea', () => {
    const base = createSeedState();
    const made = create(base, { kind: 'masiva', segmentIds: [], templateId: 'horarios', trigger: 'programada', scheduledFor: at('2026-10-21', '10:00') }); let s = made.s; const id = made.id;
    s = launch(s, id);
    const mine = () => s.campaignDeliveries.filter((x) => x.campaignId === id);
    expect(mine().every((x) => x.status === 'programado')).toBe(true);
    s = run(s, { type: 'campaignPause', campaignId: id }).state;
    expect(mine().every((x) => x.status === 'pausado')).toBe(true);
    s = run(s, { type: 'advanceClock', minutes: 3 * 1440 }).state;
    expect(mine().every((x) => x.status === 'pausado')).toBe(true);
    s = run(s, { type: 'campaignResume', campaignId: id }).state;
    s = run(s, { type: 'contactPrefSet', personId: 'P-007', optOut: true }).state;
    s = run(s, { type: 'advanceClock', minutes: 60 }).state;
    expect(mine().find((x) => x.contactId === 'P-007')!.status).toBe('bloqueado');
    expect(mine().filter((x) => x.status === 'entregado_simulado')).toHaveLength(mine().length - 1);
  });

  it('S86: por evento: quien entra al segmento recibe una vez; si ya tenía mensaje por otra persona a cargo, no se duplica', () => {
    const made = create(createSeedState(), { segmentIds: ['presupuestos_sin_respuesta'], templateId: 'presupuesto_pendiente', trigger: 'evento' }); let s = made.s; const id = made.id;
    s = launch(s, id);
    expect(s.campaignDeliveries.filter((x) => x.campaignId === id).map((x) => x.contactId)).toEqual(['P-006']);
    // Diego (menor de Ramiro) recibe un presupuesto: Ramiro ya tiene mensaje de esta campaña.
    s = run(s, { type: 'estimateTransition', estimateId: 'EST-003', to: 'emitido' }).state;
    // Martina P-007 recibe uno nuevo: entra al segmento.
    let r = run(s, { type: 'estimateCreate', personId: 'P-007', professionalId: 'PR-01' }); s = r.state;
    const est = idsOf(r).estimateId;
    s = run(s, { type: 'estimateAddLine', estimateId: est, description: 'Control (muestra)', tooth: null, qty: 1, unitMinor: 1_000_000 }).state;
    s = run(s, { type: 'estimateTransition', estimateId: est, to: 'emitido' }).state;
    r = run(s, { type: 'advanceClock', minutes: 30 }); s = r.state;
    r = run(s, { type: 'advanceClock', minutes: 30 }); s = r.state;
    expect(s.campaignDeliveries.filter((x) => x.campaignId === id).map((x) => x.contactId)).toEqual(['P-006', 'P-007']);
  });
});

describe('S87–S91 · economía, ND, capacidad y resultados separados', () => {
  it('S87: ejemplo ficticio 100 − 60 − 5 = 35; con descuento 10: neto 90, contribución 25 (27,8 %); fijo 100 → 4 atenciones', () => {
    expect(unitEconomics(100, 0, 60, 5)).toEqual({ netRevenue: 100, contribution: 35, contributionPct: 0.35 });
    const d = unitEconomics(100, 10, 60, 5);
    expect(d.netRevenue).toBe(90);
    expect(d.contribution).toBe(25);
    expect((d.contributionPct! * 100).toFixed(1)).toBe('27.8');
    expect(breakeven(100, 25)).toBe(4);
    expect(breakeven(100, 0)).toBeNull();
    expect(breakeven(100, -5)).toBeNull();
  });

  it('S88: faltantes → ND y la campaña sigue en borrador; al cargarlos avanza', () => {
    const made = create(createSeedState(), { serviceTypeId: 'ST-ORTO-CTRL', economics: { ...emptyEconomics(), listPriceMinor: 1_200_000 } }); let s = made.s; const id = made.id;
    const c = () => s.campaigns.find((x) => x.id === id)!;
    const eco = campaignEconomics(s, c(), buildAudience(s, c()));
    expect(eco.missing).toEqual(['Costo fijo de la campaña', 'Costo de servicio cargado por atención', 'Otros costos variables por atención', 'Respuesta supuesta (%)']);
    expect(eco.unit).toBeNull();
    expect(eco.breakevenAttentions).toBeNull();
    const r = run(s, { type: 'campaignPreview', campaignId: id });
    expect(code(r)).toBe('DATOS_FALTANTES');
    expect(r.result.message).toContain('ND');
    s = run(s, { type: 'campaignUpdate', campaignId: id, patch: { economics: { ...c().economics, serviceCostMinor: 700_000, otherVariableMinor: 50_000, fixedCostMinor: 100_000, responseRatePct: 50 } } }).state;
    const ok = campaignEconomics(s, c(), buildAudience(s, c()));
    expect(ok.missing).toEqual([]);
    expect(ok.unit).toEqual({ netRevenue: 1_200_000, contribution: 450_000, contributionPct: 0.375 });
    // Comunicación: 1 llamada de recepción × $300 + fijo $1.000 = $1.300 → equilibrio 1 atención.
    expect(ok.commCostMinor).toBe(30_000);
    expect(ok.campaignCostMinor).toBe(130_000);
    expect(ok.breakevenAttentions).toBe(1);
    expect(code(run(s, { type: 'campaignPreview', campaignId: id }))).toBe('OK');
  });

  it('S89: contribución ≤ 0 → sin equilibrio por volumen; costo de un canal sin cargar → ND', () => {
    const made = create(createSeedState(), { serviceTypeId: 'ST-ORTO-CTRL', economics: { listPriceMinor: 100, discountMinor: 40, serviceCostMinor: 60, otherVariableMinor: 5, fixedCostMinor: 100, responseRatePct: 100 } }); let s = made.s; const id = made.id;
    const c = () => s.campaigns.find((x) => x.id === id)!;
    const eco = campaignEconomics(s, c(), buildAudience(s, c()));
    expect(eco.unit!.contribution).toBe(-5);
    expect(eco.noBreakeven).toBe(true);
    expect(eco.breakevenAttentions).toBeNull();
    s = run(s, { type: 'campaignConfigSet', commCostMinor: { llamada: null } }).state;
    const nd = campaignEconomics(s, c(), buildAudience(s, c()));
    expect(nd.commCostMinor).toBeNull();
    expect(nd.missing).toContain('Costo por contacto de llamada de recepción');
  });

  it('S90: capacidad insuficiente bloquea; la capacidad cuenta turnos libres sin superponer', () => {
    const s0 = createSeedState();
    const cap = capacityFor(s0, 'ST-ORTO-CTRL');
    expect(cap.slots).toBeGreaterThan(0);
    expect(cap.byProfessional.map((p) => p.professionalId)).toEqual(['PR-03']);
    s0.blocks.push({ id: 'B-900', scope: 'professional', targetId: 'PR-03', start: s0.clock, end: at('2026-12-31', '23:00'), reason: 'Agenda completa (prueba)' });
    expect(capacityFor(s0, 'ST-ORTO-CTRL').slots).toBe(0);
    const { s, id } = create(s0, { serviceTypeId: 'ST-ORTO-CTRL', economics: { listPriceMinor: 1_000, discountMinor: 0, serviceCostMinor: 500, otherVariableMinor: 0, fixedCostMinor: 0, responseRatePct: 100 } });
    const r = run(s, { type: 'campaignPreview', campaignId: id });
    expect(code(r)).toBe('CAPACIDAD_INSUFICIENTE');
    expect(r.result.message).toContain('hay 0 turnos libres');
  });

  it('S91: simulado y observado se cuentan aparte; reservar no es atender ni cobrar', () => {
    const made = create(createSeedState(), { kind: 'individual', segmentIds: [], personId: 'P-007', templateId: 'reprogramar', serviceTypeId: 'ST-CONTROL', economics: { listPriceMinor: 1_000_000, discountMinor: 0, serviceCostMinor: 600_000, otherVariableMinor: 50_000, fixedCostMinor: 0, responseRatePct: 100 } }); let s = made.s; const id = made.id;
    s = launch(s, id);
    const c = s.campaigns.find((x) => x.id === id)!;
    expect(campaignResults(s, c).observed).toEqual({ booked: 0, attended: 0, paidMinor: 0 });
    s = run(s, { type: 'book', personId: 'P-007', serviceTypeId: 'ST-CONTROL', professionalId: 'PR-01', locationId: 'L-CEN', start: at('2026-10-20', '11:00'), channel: 'whatsapp' }).state;
    const res = campaignResults(s, c);
    expect(res.simulated.delivered).toBe(1);
    expect(res.observed).toEqual({ booked: 1, attended: 0, paidMinor: 0 });
  });
});

describe('S77 · R-GRW-07 · mensajes discretos', () => {
  it('todas las plantillas pasan el control; miedo, urgencia, oferta o detalle clínico no', () => {
    const s = createSeedState();
    for (const t of TEMPLATES) {
      const msg = renderMessage(s, t.id, 'P-003', ['P-003', 'P-004']);
      expect(checkMessage(msg), `${t.id}: ${msg}`).toEqual([]);
      expect(msg).toContain('(Mensaje simulado de la demo)');
    }
    expect(checkMessage('¡¡Últimos turnos!! Urgente: descuento en ortodoncia para tu caries')).toEqual(['urgencia inventada', 'estímulo comercial a un tratamiento', 'detalle clínico o sensible', 'tono alarmista']);
  });
  it('una nota agregada que no es discreta bloquea la vista previa', () => {
    const { s, id } = create(createSeedState(), { extraNote: 'Aprovechá el descuento antes de que sea tarde' });
    const r = reviewCampaign(s, s.campaigns.find((c) => c.id === id)!);
    expect(r.blockers.map((b) => b.code)).toContain('MENSAJE_NO_DISCRETO');
  });
});

describe('calendario, preferencias y persistencia', () => {
  it('las repeticiones previstas siguen la cadencia (semanal, mensual, bimestral, estacional)', () => {
    const { s, id } = create(createSeedState(), { trigger: 'programada', scheduledFor: at('2026-10-21', '10:00'), cadence: 'mensual' });
    const c = s.campaigns.find((x) => x.id === id)!;
    expect(occurrences(c, '2026-10-19', '2027-01-31')).toEqual(['2026-10-21', '2026-11-21', '2026-12-21', '2027-01-21']);
    expect(occurrences({ ...c, cadence: 'semanal' }, '2026-10-19', '2026-11-05')).toEqual(['2026-10-21', '2026-10-28', '2026-11-04']);
    expect(occurrences({ ...c, cadence: 'bimestral' }, '2026-10-19', '2027-03-01')).toEqual(['2026-10-21', '2026-12-21', '2027-02-21']);
    expect(occurrences({ ...c, cadence: 'estacional' }, '2026-10-19', '2027-05-01')).toEqual(['2026-10-21', '2027-01-21', '2027-04-21']);
  });
  it('la exclusión administrativa no acepta datos clínicos', () => {
    const s = createSeedState();
    expect(code(run(s, { type: 'contactPrefSet', personId: 'P-001', exclusion: 'Tiene una infección' }))).toBe('DATOS_INVALIDOS');
    const r = run(s, { type: 'contactPrefSet', personId: 'P-001', exclusion: 'Prefiere que la llamen solo por turnos' });
    expect(r.state.persons.find((p) => p.id === 'P-001')!.campaignExclusion).toBe('Prefiere que la llamen solo por turnos');
  });
  it('datos guardados antes del lote 6 se completan al cargar (sin campañas ni A11)', () => {
    const old = createSeedState() as Partial<DemoState>;
    delete old.campaigns; delete old.campaignDeliveries; delete old.campaignConfig;
    old.automationRules = old.automationRules!.filter((r) => r.id !== 'A11');
    const loaded = parseEnvelope(serialize(old as DemoState));
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.state.campaigns).toEqual([]);
    expect(loaded.state.campaignConfig.maxPer30d).toBe(2);
    expect(loaded.state.automationRules.some((r) => r.id === 'A11')).toBe(true);
  });
});

describe('S92–S94 · asistente de dirección determinista', () => {
  it('S92: entiende las cuatro preguntas y responde con cifras del store', () => {
    expect(detectDirectorIntent('¿cuántos controles indicados hay pendientes?')).toBe('controles');
    expect(detectDirectorIntent('¿qué capacidad tenemos?')).toBe('capacidad');
    expect(detectDirectorIntent('¿qué datos faltan?')).toBe('faltantes');
    expect(detectDirectorIntent('¿cuánto cuesta la campaña?')).toBe('costo');
    expect(detectDirectorIntent('contame un chiste')).toBe('ayuda');
    const s = createSeedState();
    const a = directorAnswer(s, 'controles', null);
    expect(a.title).toBe('1 control(es) indicado(s) sin turno');
    expect(a.paragraphs.join(' ')).toContain('Diego Funes (P-009)');
    expect(a.paragraphs.join(' ')).toContain('Ramiro Quiroga (P-006), su responsable');
    expect(a.action).toBe('crear_borrador_controles');
  });
  it('S93: pide faltantes de la campaña elegida y explica el costo con la cuenta', () => {
    const s = createSeedState();
    expect(directorAnswer(s, 'faltantes', null).title).toBe('Elegí una campaña');
    const f = directorAnswer(s, 'faltantes', 'CMP-003');
    expect(f.missing).toEqual(['Costo fijo de la campaña']);
    const c = directorAnswer(s, 'costo', 'CMP-003');
    expect(c.paragraphs.join(' ')).toContain('Llamada de recepción: 1 × $ 300,00 = $ 300,00');
    expect(c.paragraphs.join(' ')).toContain('Costo de la campaña: ND');
  });
  it('S94: la capacidad sale de la agenda real y cambia con un bloqueo', () => {
    const s = createSeedState();
    const before = directorAnswer(s, 'capacidad', null).paragraphs.find((p) => p.startsWith('Control de ortodoncia'))!;
    s.blocks.push({ id: 'B-901', scope: 'professional', targetId: 'PR-03', start: s.clock, end: at('2026-12-31', '23:00'), reason: 'prueba' });
    const after = directorAnswer(s, 'capacidad', null).paragraphs.find((p) => p.startsWith('Control de ortodoncia'))!;
    expect(before).not.toBe(after);
    expect(after).toBe('Control de ortodoncia: 0 turno(s) libre(s).');
  });
});

describe('S95, S96 · asistente del paciente en WhatsApp', () => {
  const lastText = (s: DemoState, conv: string) => s.messages.filter((m) => m.conversationId === conv).at(-1)!.text;
  it('S95: turno propio, presupuesto y seguimiento por ID, también de quienes tiene a cargo', () => {
    expect(detectIntent('¿cuándo es mi turno?')).toBe('mi_turno');
    expect(detectIntent('quiero cambiar mi turno')).toBe('reprogramar');
    expect(detectIntent('quiero un turno')).toBe('reservar');
    expect(detectIntent('mi presupuesto')).toBe('presupuesto');
    let s = createSeedState();
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: '¿cuándo es mi turno?' }).state;
    expect(lastText(s, 'C-001')).toContain('A-0012');
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'mi seguimiento' }).state;
    expect(lastText(s, 'C-001')).toContain('El control IC-001 ya tiene turno');
    // Ramiro (responsable de Diego): control indicado para coordinar y presupuesto, sin decidir nada clínico.
    s.conversations[0].personId = 'P-006';
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'mi seguimiento' }).state;
    expect(lastText(s, 'C-001')).toContain('Diego: hay un control ya indicado por la profesional para coordinar (IC-003)');
    expect(activeReplies(s, 'C-001').map((r) => r.label)).toContain('Pedir el turno del control');
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'mi presupuesto' }).state;
    expect(lastText(s, 'C-001')).toContain('EST-001: emitido');
    expect(lastText(s, 'C-001')).toContain('no es un pago');
  });
  it('S96: lo clínico se deriva a recepción sin evaluar gravedad', () => {
    let s = createSeedState();
    s = run(s, { type: 'chatSend', conversationId: 'C-001', text: 'me duele mucho, ¿qué tomo?' }).state;
    const t = lastText(s, 'C-001').toLowerCase();
    expect(t).toMatch(/recepci|profesional/);
    for (const bad of ['grave', 'leve', 'ibuprofeno', 'te recomiendo tomar', 'diagnóstico:']) expect(t).not.toContain(bad);
  });
});
