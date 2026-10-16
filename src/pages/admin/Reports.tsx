import { useDemo } from '../../app/store';
import { useDraft } from '../../app/ui-state';
import { computeKpis, filteredAppointments, money, proName, ratioText, STATUS_LABEL } from '../../domain/selectors';
import { addDays, fmtDateOnly, parts, startOfWeek } from '../../domain/time';
import { Button, EmptyState, Field, Kpi, Notice, PageHeader } from '../../ui/kit';

export function Reports() {
  const s = useDemo();
  const today = parts(s.clock).date;
  const [f, setF] = useDraft('reports:f', { preset: 'semana', from: startOfWeek(today), to: addDays(startOfWeek(today), 4), professionalId: '', locationId: '' });
  const setPreset = (preset: string) => {
    if (preset === 'semana') setF({ ...f, preset, from: startOfWeek(today), to: addDays(startOfWeek(today), 4) });
    else if (preset === '30d') setF({ ...f, preset, from: today, to: addDays(today, 29) });
    else if (preset === 'pasada') setF({ ...f, preset, from: addDays(startOfWeek(today), -7), to: addDays(startOfWeek(today), -3) });
    else setF({ ...f, preset });
  };
  const filter = { from: f.from, to: f.to < f.from ? f.from : f.to, professionalId: f.professionalId || undefined, locationId: f.locationId || undefined };
  const k = computeKpis(s, filter);
  const appts = filteredAppointments(s, filter);
  const byStatus = Object.keys(STATUS_LABEL).filter((st) => ['solicitada', 'confirmada', 'en_sala', 'en_atencion', 'finalizada', 'ausente', 'cancelada'].includes(st)).map((st) => ({ st, n: appts.filter((a) => a.status === st).length }));
  const byPro = s.professionals.map((p) => ({ p, n: appts.filter((a) => a.professionalId === p.id && a.status !== 'cancelada').length }));
  const ruleRuns = s.automationRules.map((r) => ({ r, outbox: s.outbox.filter((o) => o.ruleId === r.id).length, tasks: s.tasks.filter((t) => t.ruleId === r.id).length }));
  return (
    <section className="page">
      <PageHeader eyebrow="M13 · Dirección" title="Informes calculados">
        Todo se calcula desde el store local con denominador, intervalo y n explícitos. Cancelados fuera de activos. Sin progreso clínico, ROI ni proyecciones.
      </PageHeader>
      <div className="agenda-toolbar">
        <Field label="Intervalo">{(p) => <select {...p} value={f.preset} onChange={(e) => setPreset(e.target.value)}><option value="semana">Esta semana</option><option value="pasada">Semana pasada</option><option value="30d">Próximos 30 días</option><option value="custom">Personalizado</option></select>}</Field>
        <Field label="Desde">{(p) => <input {...p} type="date" value={f.from} onChange={(e) => setF({ ...f, preset: 'custom', from: e.target.value || today })} />}</Field>
        <Field label="Hasta">{(p) => <input {...p} type="date" value={f.to} onChange={(e) => setF({ ...f, preset: 'custom', to: e.target.value || today })} />}</Field>
        <Field label="Profesional">{(p) => <select {...p} value={f.professionalId} onChange={(e) => setF({ ...f, professionalId: e.target.value })}><option value="">Todos</option>{s.professionals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
        <Field label="Sede">{(p) => <select {...p} value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}><option value="">Todas</option>{s.locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
        <Button size="sm" variant="ghost" onClick={() => setPreset('semana')}>Restablecer</Button>
      </div>
      <p className="small muted" role="status">Intervalo: {fmtDateOnly(filter.from)} al {fmtDateOnly(filter.to)} · n = <span className="tabular">{k.n}</span> turnos (incluye cancelados).</p>
      {k.n === 0 && <EmptyState title="Sin datos para este intervalo (n=0)" icon="chart">Los indicadores muestran "Sin datos" en lugar de 0 % o divisiones por cero. Probá otro intervalo o restaurá la demo desde Configuración.</EmptyState>}
      <div className="kpis">
        <Kpi label="Turnos activos" value={String(k.active)} detail="solicitados, confirmados, en sala o en atención" n={`n=${k.n}`} />
        <Kpi label="Cancelados" value={String(k.cancelled)} detail="fuera de activos" />
        <Kpi label={k.confirmation.label} value={ratioText(k.confirmation)} detail={k.confirmation.detail} n={`${k.confirmation.num}/${k.confirmation.den}`} />
        <Kpi label={k.noShow.label} value={ratioText(k.noShow)} detail={k.noShow.detail} n={`${k.noShow.num}/${k.noShow.den}`} />
        <Kpi label={k.occupancy.label} value={ratioText(k.occupancy)} detail={k.occupancy.detail} n={`${Math.round(k.occupancy.num)}/${k.occupancy.den} min`} />
        <Kpi label="Solicitudes abiertas" value={String(k.requestsPending)} detail="pendientes o asignadas (todas las fechas)" />
        <Kpi label="Tareas abiertas" value={String(k.tasksOpen)} detail={`${k.tasksUnassigned} sin responsable · ${k.tasksOverdue} vencidas`} />
        <Kpi label="Outbox simulado" value={String(k.outboxDelivered)} detail={`entregados (simulados) · ${k.outboxVoided} anulados · ${k.outboxBlocked} bloqueados`} />
        <Kpi label="Presupuestos aceptados" value={money(k.acceptedTotal)} detail={`${k.estimatesAccepted.length} aceptados · no es cobrado`} />
        <Kpi label="Caja ficticia neta" value={money(k.ledgerNet)} detail="suma de movimientos simulados y contrapartidas" />
        <Kpi label={k.learning.label} value={ratioText(k.learning)} detail={k.learning.detail} n={`${k.learning.num}/${k.learning.den}`} />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="table-wrap">
          <table><caption style={{ textAlign: 'left', padding: 12, fontWeight: 700 }}>Turnos por estado</caption><thead><tr><th>Estado</th><th>n</th></tr></thead>
            <tbody>{byStatus.map(({ st, n }) => <tr key={st}><td>{STATUS_LABEL[st]}</td><td className="tabular">{n}</td></tr>)}</tbody></table>
        </div>
        <div className="table-wrap">
          <table><caption style={{ textAlign: 'left', padding: 12, fontWeight: 700 }}>No cancelados por profesional</caption><thead><tr><th>Profesional</th><th>n</th></tr></thead>
            <tbody>{byPro.map(({ p, n }) => <tr key={p.id}><td>{proName(s, p.id)}</td><td className="tabular">{n}</td></tr>)}</tbody></table>
        </div>
      </div>
      <div className="table-wrap">
        <table><caption style={{ textAlign: 'left', padding: 12, fontWeight: 700 }}>Registro de automatizaciones locales (A01–A10)</caption>
          <thead><tr><th>Regla</th><th>Disparador</th><th>Condición</th><th>Outbox</th><th>Tareas</th></tr></thead>
          <tbody>{ruleRuns.map(({ r, outbox, tasks }) => <tr key={r.id}><td><strong>{r.id}</strong> {r.name}</td><td className="small">{r.trigger}</td><td className="small">{r.condition}</td><td className="tabular">{outbox}</td><td className="tabular">{tasks}</td></tr>)}</tbody>
        </table>
      </div>
      <Notice tone="info" title="Lectura responsable">Son datos ficticios de una demo. Ningún indicador mide salud, resultados clínicos ni retorno económico.</Notice>
    </section>
  );
}
