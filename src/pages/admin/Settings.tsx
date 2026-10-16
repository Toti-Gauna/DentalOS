import { useState } from 'react';
import { dispatch, store, useStore } from '../../app/store';
import { navigate } from '../../app/router';
import { resetUi } from '../../app/ui-state';
import { PRESETS, TOGGLEABLE_RULES } from '../../domain';
import { NAMESPACE, serialize } from '../../domain/storage';
import { dayName, fmtShort } from '../../domain/time';
import { proName, locName, chairName } from '../../domain/selectors';
import { Button, ConfirmDialog, Field, Notice, PageHeader, announce, useResult } from '../../ui/kit';
import { ClockControls } from './Waitlist';

export function Settings() {
  const snap = useStore();
  const s = snap.state;
  const { show, view } = useResult();
  const [confirmReset, setConfirmReset] = useState(false);
  const [presetToLoad, setPresetToLoad] = useState<string | null>(null);
  const [ruleEdits, setRuleEdits] = useState<Record<string, { start: string; end: string }>>({});
  const [durations, setDurations] = useState<Record<string, string>>({});
  const size = serialize(s).length;

  const exportJson = () => {
    const blob = new Blob([serialize(s)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `dentalos-demo-${s.preset}-rev${s.revision}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Exportación descargada: solo datos ficticios de la demo.');
  };

  return (
    <section className="page">
      <PageHeader eyebrow="M14 · Dirección / operador" title="Configuración y simulador">
        Jornadas, duraciones, bloqueos y escenarios. Esquema local versionado (v{s.schemaVersion}), seed {s.seed}. Sin secretos ni credenciales.
      </PageHeader>
      {view}
      <div className="ops">
        <div className="stack">
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Jornadas por profesional</h2>
            <p className="small muted">Si un turno activo quedaría fuera de la nueva jornada, el cambio se rechaza: no hay movimientos silenciosos.</p>
            <div className="table-wrap">
              <table><caption className="sr-only">Reglas de disponibilidad</caption>
                <thead><tr><th>Profesional</th><th>Sede</th><th>Día</th><th>Desde</th><th>Hasta</th><th><span className="sr-only">Guardar</span></th></tr></thead>
                <tbody>{s.availabilityRules.map((r) => {
                  const e = ruleEdits[r.id] ?? { start: r.start, end: r.end };
                  const dirty = e.start !== r.start || e.end !== r.end;
                  return (
                    <tr key={r.id}>
                      <td className="small">{proName(s, r.professionalId)}</td><td className="small">{locName(s, r.locationId)}</td><td>{dayName(r.weekday)}</td>
                      <td><label className="sr-only" htmlFor={`${r.id}-s`}>Desde</label><input id={`${r.id}-s`} value={e.start} onChange={(ev) => setRuleEdits({ ...ruleEdits, [r.id]: { ...e, start: ev.target.value } })} style={{ width: 90 }} /></td>
                      <td><label className="sr-only" htmlFor={`${r.id}-e`}>Hasta</label><input id={`${r.id}-e`} value={e.end} onChange={(ev) => setRuleEdits({ ...ruleEdits, [r.id]: { ...e, end: ev.target.value } })} style={{ width: 90 }} /></td>
                      <td><Button size="sm" disabled={!dirty} onClick={() => { const res = dispatch({ type: 'updateRule', ruleId: r.id, start: e.start, end: e.end }); show(res); if (res.ok) { const n = { ...ruleEdits }; delete n[r.id]; setRuleEdits(n); } }}>Guardar</Button></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Duraciones de muestra</h2>
            <p className="small muted">Aplican a turnos nuevos; los existentes conservan su intervalo.</p>
            {s.serviceTypes.map((st) => (
              <div key={st.id} className="row wrap" style={{ alignItems: 'end' }}>
                <Field label={`${st.name} (min)`}>{(p) => <input {...p} inputMode="numeric" value={durations[st.id] ?? String(st.durationMin)} onChange={(e) => setDurations({ ...durations, [st.id]: e.target.value.replace(/\D/g, '') })} style={{ maxWidth: 120 }} />}</Field>
                <Button size="sm" disabled={(durations[st.id] ?? String(st.durationMin)) === String(st.durationMin)} onClick={() => show(dispatch({ type: 'updateServiceDuration', serviceTypeId: st.id, durationMin: Number(durations[st.id]) }))}>Guardar</Button>
              </div>
            ))}
          </div>
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Bloqueos</h2>
            {s.blocks.length === 0 ? <p className="muted">Sin bloqueos.</p> : <ul className="list">{s.blocks.map((b) => (
              <li key={b.id} className="list-item"><div className="row between"><span><span className="code">{b.id}</span> {b.reason}</span><Button size="sm" variant="ghost" onClick={() => show(dispatch({ type: 'removeBlock', blockId: b.id }))}>Quitar</Button></div>
                <span className="small muted tabular">{b.scope === 'professional' ? proName(s, b.targetId) : b.scope === 'chair' ? chairName(s, b.targetId) : locName(s, b.targetId)} · {fmtShort(b.start)} → {fmtShort(b.end)}</span></li>))}</ul>}
            <Button size="sm" onClick={() => navigate('/admin')}>Crear bloqueo desde la agenda</Button>
          </div>
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Auditoría local (últimos 25)</h2>
            <ul className="plain small">{s.audit.slice(-25).reverse().map((e) => <li key={e.id}><span className="code">{e.id}</span> <span className="tabular">{fmtShort(e.at)}</span> · {e.type} · {e.entity} {e.entityId} · {e.detail}</li>)}</ul>
          </div>
        </div>

        <aside className="stack">
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Automatizaciones locales</h2>
            <p className="small muted">Ninguna envía nada real. Solo A05, A06 y A09 se pueden pausar; el resto protege consistencia o la derivación humana.</p>
            <ul className="list">{s.automationRules.map((r) => {
              const toggleable = (TOGGLEABLE_RULES as readonly string[]).includes(r.id);
              return (
                <li key={r.id} className="list-item">
                  {toggleable
                    ? <label className="choice"><input type="checkbox" checked={r.enabled} onChange={(e) => show(dispatch({ type: 'setAutomationRule', ruleId: r.id, enabled: e.target.checked }))} /> <strong>{r.id}</strong> {r.name}</label>
                    : <span><strong>{r.id}</strong> {r.name} <span className="tag">obligatoria</span></span>}
                  <span className="small muted">{r.trigger} · {r.condition}</span>
                </li>
              );
            })}</ul>
          </div>
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Escenarios (presets)</h2>
            <p className="small muted">Cada preset parte de la seed para aislar precondiciones. Activo: <strong>{s.preset}</strong>.</p>
            <ul className="list">{PRESETS.map((p) => (
              <li key={p.id} className="list-item">
                <strong>{p.name}</strong><span className="small">{p.description}</span><span className="small muted">Casos: {p.cases}</span>
                <div className="row wrap"><Button size="sm" variant="quiet" onClick={() => setPresetToLoad(p.id)}>Cargar</Button></div>
              </li>
            ))}</ul>
          </div>
          <ClockControls />
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Simulador de fallos y cupos</h2>
            <label className="choice"><input type="checkbox" checked={s.settings.failNextCommits > 0} onChange={(e) => show(dispatch({ type: 'setSetting', key: 'failNextCommits', value: e.target.checked ? 1 : 0 }))} /> Forzar fallo en el próximo guardado de turno/caja</label>
            <Field label="Cupo de recordatorios simulados">{(p) => <input {...p} inputMode="numeric" defaultValue={s.settings.reminderQuota} key={s.settings.reminderQuota} onBlur={(e) => { const v = Number(e.target.value); if (v !== s.settings.reminderQuota) show(dispatch({ type: 'setSetting', key: 'reminderQuota', value: v })); }} />}</Field>
            <p className="small muted">Ventana de cambio {s.settings.changeWindowHours} h · anticipación mínima {s.settings.minLeadHours} h · horizonte {s.settings.horizonDays} días · hold {s.settings.holdMinutes} min (valores de muestra).</p>
          </div>
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Almacenamiento</h2>
            <dl className="kv small">
              <dt>Modo</dt><dd>{snap.mode === 'local' ? 'Guardado en este dispositivo' : 'Solo memoria'}</dd>
              <dt>Namespace</dt><dd className="code">{NAMESPACE}</dd>
              <dt>Revisión</dt><dd className="tabular">{s.revision}</dd>
              <dt>Tamaño</dt><dd className="tabular">{(size / 1024).toFixed(1)} KB</dd>
              <dt>Pestañas</dt><dd>Pensado para una sola pestaña; si otra cambia la demo, avisamos.</dd>
            </dl>
            <div className="row wrap">
              <Button onClick={exportJson}>Exportar JSON ficticio</Button>
              <Button variant="danger" onClick={() => setConfirmReset(true)}>Restablecer demo</Button>
            </div>
          </div>
          <Notice tone="info" title="Sin integraciones">No hay API, base de datos, mensajería, telefonía, pagos ni analytics. Los enlaces de WhatsApp no abren aplicaciones externas.</Notice>
        </aside>
      </div>
      <ConfirmDialog open={confirmReset} title="¿Restablecer la demo?" confirmLabel="Restablecer" tone="danger" onCancel={() => { setConfirmReset(false); announce('Restablecimiento cancelado: no cambió nada.'); }}
        onConfirm={() => { store.reset(); resetUi(); setConfirmReset(false); announce('Demo restablecida: seed dentalos-v1 y reloj inicial.'); show({ ok: true, message: 'Demo restablecida: seed dentalos-v1, reloj lun 19/10 09:00 y progreso educativo inicial.' }); }}>
        Se borran solo las claves del namespace <span className="code">{NAMESPACE}</span> y se repone exactamente la seed, el reloj y el progreso. Otras aplicaciones no se tocan.
      </ConfirmDialog>
      <ConfirmDialog open={!!presetToLoad} title={`¿Cargar el preset "${PRESETS.find((p) => p.id === presetToLoad)?.name}"?`} confirmLabel="Cargar" onCancel={() => setPresetToLoad(null)}
        onConfirm={() => { const p = PRESETS.find((x) => x.id === presetToLoad)!; store.loadPreset(p.id); resetUi(); setPresetToLoad(null); announce(`Preset ${p.name} cargado.`); if (p.id !== 'storage_invalido') navigate(p.route.replace('#', '')); }}>
        Reemplaza el estado actual de la demo por el escenario elegido (partiendo de la seed).
      </ConfirmDialog>
    </section>
  );
}
