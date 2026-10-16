import { useState } from 'react'
import { useApp } from '../../store'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Callout, Empty } from '../../ui/kit'
import { previewRuleText } from '../../domain/automations'
import { fmtDateTime } from '../../domain/time'
import type { AutomationRun } from '../../domain/types'

const RUN_TONE: Record<AutomationRun['status'], 'ok' | 'warn' | 'err' | 'info' | 'neutral'> = {
  ejecutada: 'ok', recuperada: 'ok', pendiente: 'warn', fallida: 'err', omitida: 'neutral', derivada: 'info', suprimida: 'neutral',
}
const DELIVERS = ['AU02', 'AU03', 'AU05']

export function AdminAutomatizaciones() {
  const state = useApp()
  const bizId = state.session.businessId
  const rules = state.rules.filter((r) => r.businessId === bizId)
  const [filter, setFilter] = useState<'todas' | AutomationRun['status']>('todas')
  const [preview, setPreview] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [camp, setCamp] = useState<{ included: string[]; excluded: string[]; id: string } | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const runs = state.runs.filter((r) => r.businessId === bizId && (filter === 'todas' || r.status === filter)).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
  const pending = state.runs.filter((r) => r.businessId === bizId && ['fallida', 'pendiente'].includes(r.status)).length

  return (
    <>
      <PageHead title="Automatizaciones" sub="Reglas simuladas: el registro y el próximo paso cambian localmente; no se envía nada real" />
      <Callout>Todos los canales son simulados. Una ejecución por regla, versión, entidad y disparador: los reintentos reutilizan la misma ejecución y la misma clave de mensaje.</Callout>
      {msg && <Callout tone={msg.tone === 'ok' ? 'ok' : 'err'} role="alert">{msg.text}</Callout>}
      <p aria-live="polite"><strong data-testid="runs-pending">{pending}</strong> ejecución(es) fallida(s) o pendiente(s).</p>
      <div className="grid cols-2">
        {rules.map((r) => (
          <section className="card" key={r.id} aria-labelledby={`r-${r.id}`} data-testid={`rule-${r.code}`}>
            <div className="row between">
              <h2 id={`r-${r.id}`}>{r.code} · {r.name}</h2>
              <label className="choice"><input type="checkbox" checked={r.enabled} onChange={(e) => act({ type: 'rule/toggle', ruleId: r.id, enabled: e.target.checked }, `${r.code} ${e.target.checked ? 'activada' : 'pausada'}`)} data-testid={`toggle-${r.code}`} aria-label={`Regla ${r.code} activa`} /> {r.enabled ? 'Activa' : 'Pausada'}</label>
            </div>
            <p className="small"><strong>Canal:</strong> {r.channel}<br /><strong>Disparador:</strong> {r.trigger}<br /><strong>Acción simulada:</strong> {r.action}<br /><span className="muted">v{r.version}</span></p>
            <div className="row">
              <button className="btn secondary small" type="button" onClick={() => setPreview(preview === r.id ? null : r.id)} aria-expanded={preview === r.id}>Vista previa</button>
              {DELIVERS.includes(r.code) && (
                <label className="choice"><input type="checkbox" checked={r.failNext} onChange={(e) => act({ type: 'rule/failNext', ruleId: r.id, value: e.target.checked }, e.target.checked ? 'Fallo armado' : 'Fallo desarmado')} data-testid={`fail-${r.code}`} /> Inyectar fallo en la próxima entrega</label>
              )}
              {r.code === 'AU03' && (
                <label className="field" style={{ margin: 0 }}>
                  <span className="label small">Horas previas</span>
                  <input type="number" min={1} max={24} style={{ width: 80 }} defaultValue={Number(r.config.leadHours ?? 2)} onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(r.config.leadHours ?? 2)) { const o = act({ type: 'rule/config', ruleId: r.id, patch: { leadHours: v } }, 'Regla actualizada (nueva versión)'); if (!o.ok) setMsg({ tone: 'err', text: o.message }) } }} />
                </label>
              )}
              {r.code === 'AU10' && <button className="btn small" type="button" data-testid="preview-campaign" onClick={() => { const o = act({ type: 'campaign/preview', businessId: bizId }); if (o.ok) { setCamp(o.data as never); setMsg(null) } else setMsg({ tone: 'err', text: o.message }) }}>Previsualizar campaña de muestra</button>}
            </div>
            {preview === r.id && <div className="callout" style={{ marginTop: 8 }} role="status">{previewRuleText(state, r)}</div>}
          </section>
        ))}
      </div>

      {camp && (
        <section className="card" style={{ marginTop: 14 }} aria-labelledby="camp" data-testid="campaign-result">
          <h2 id="camp">Vista previa {camp.id}</h2>
          <p><strong>Destinatarios con consentimiento promocional:</strong> {camp.included.join(', ') || 'ninguno'}</p>
          <p><strong>Omitidos (sin consentimiento promocional):</strong> {camp.excluded.join(', ') || 'ninguno'} — omisión registrada en el audit.</p>
          <p className="small muted">Ningún mensaje saliente real. Los previews se cuentan aparte de las ventas ({state.campaignPreviews.filter((c) => c.businessId === bizId).length} en total).</p>
        </section>
      )}

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="runs-h">
        <div className="row between">
          <h2 id="runs-h">Ejecuciones</h2>
          <label className="field" style={{ margin: 0 }}>
            <span className="label small">Estado</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as 'todas')} data-testid="run-filter">
              <option value="todas">Todas</option>
              {Object.keys(RUN_TONE).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        {runs.length === 0 ? <Empty title="Sin ejecuciones con ese filtro">Se crean cuando ocurre el disparador de una regla activa.</Empty> : (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Ejecuciones de automatizaciones</caption>
              <thead><tr><th>Ejecución</th><th>Regla</th><th>Entidad</th><th>Estado</th><th>Intentos</th><th>Detalle</th><th /></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} data-testid={`run-${r.id}`}>
                    <td>{r.id}<div className="small muted">{fmtDateTime(r.createdAt)}</div></td>
                    <td>{r.ruleCode} v{r.ruleVersion}</td>
                    <td>{r.entityType} {r.entityId}</td>
                    <td><Badge tone={RUN_TONE[r.status]} label={r.status} icon={r.status === 'fallida' ? '✕' : r.status === 'recuperada' || r.status === 'ejecutada' ? '✓' : '◔'} /></td>
                    <td className="num">{r.attempts}</td>
                    <td className="small">{r.detail}
                      {open === r.id && <div className="log" style={{ marginTop: 6 }}>{r.log.map((l, i) => <div key={i}>{fmtDateTime(l.at)} — {l.text}</div>)}<div className="muted">clave: {r.key}<br />correlación: {r.correlationId}</div></div>}
                    </td>
                    <td className="row">
                      {['fallida', 'pendiente'].includes(r.status) && <button className="btn small" type="button" data-testid={`retry-${r.id}`} onClick={() => { const o = act({ type: 'run/retry', runId: r.id }, 'Reintento realizado sobre la misma ejecución'); setMsg({ tone: o.ok ? 'ok' : 'err', text: o.ok ? (o.duplicate ? 'La ejecución ya estaba completa.' : 'Reintento realizado sobre la misma ejecución (un solo mensaje).') : o.message }) }}>Reintentar</button>}
                      <button className="btn ghost small" type="button" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>Log</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
