import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useBiz } from '../../ui/hooks'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Callout, ConfirmDialog, DemoTag, Empty } from '../../ui/kit'
import { callOptions } from '../../domain/call'
import { dispatch, setPrefs, useSnapshot } from '../../store'
import { audioSupported, playMotif, stopAudio } from '../../ui/audio'
import type { AppState, BusinessId, CallSession, Conversation, Message } from '../../domain/types'
import { CHANNEL_LABEL } from '../../ui/format'
import { fmtDateTime } from '../../domain/time'

const GUION: { label: string; text: string; note: string }[] = [
  { label: 'Saludo', text: 'Hola', note: 'Responde con opciones.' },
  { label: 'Pedir mesa', text: 'Mesa para 4 el lunes a las 20', note: 'No hay cupo a las 20:00; ofrece 21:45.' },
  { label: 'Elegir la alternativa', text: '21:45', note: 'Arma el resumen y pide confirmación.' },
  { label: 'Confirmar', text: 'Sí, confirmo', note: 'Crea la solicitud R-019 (todavía sin confirmar por el equipo).' },
  { label: 'Alergia', text: 'Tengo alergia a frutos secos', note: 'Deriva a revisión humana, sin garantías.' },
  { label: 'Cancelar', text: 'Quiero cancelar', note: 'Busca tu reserva y pide confirmación.' },
  { label: 'Fuera de alcance', text: 'Quiero una hipoteca', note: 'Dos fallos seguidos derivan al equipo.' },
]
const GUION_CAFE: typeof GUION = [
  { label: 'Saludo', text: 'Hola', note: 'Responde con opciones.' },
  { label: 'Pedido', text: 'Un flat white con leche vegetal', note: 'Pide tamaño, sede y hora; después resumen.' },
  { label: 'Ya lo hice por la web', text: 'Ya lo hice por la web', note: 'Pide el folio y lo enlaza sin crear otro.' },
  { label: 'Reservar', text: 'Quiero reservar una mesa para 4', note: 'Este perfil atiende por orden de llegada: explica y deriva.' },
  { label: 'Gluten', text: '¿Está libre de gluten?', note: 'Informa la anotación de muestra y deriva al equipo.' },
]

function statusBadge(m: Message) {
  if (m.from === 'cliente') return null
  const map = { pendiente: ['warn', '◔', 'Pendiente'], enviado: ['info', '✓', 'Enviado'], entregado: ['ok', '✓✓', 'Entregado'], fallido: ['err', '✕', 'Falló'] } as const
  const [tone, icon, label] = map[m.status]
  return <Badge tone={tone as 'warn'} icon={icon} label={`${label} (simulado)`} />
}

export function SimPanel({ biz, guided }: { biz: BusinessId; guided: boolean }) {
  const { state } = useSnapshot()
  const [params] = useSearchParams()
  const convs = state.conversations.filter((c) => c.businessId === biz)
  const sessionCustomer = state.session.customerByBusiness[biz]
  const fromQuery = params.get('c')
  const preferred = convs.find((c) => c.id === fromQuery) ?? convs.find((c) => sessionCustomer && c.customerId === sessionCustomer) ?? convs[0]
  const [convId, setConvId] = useState<string | undefined>(preferred?.id)
  const [tab, setTab] = useState<'chat' | 'voz'>(params.get('canal') === 'voz' ? 'voz' : 'chat')
  const conv = convs.find((c) => c.id === convId) ?? preferred
  const bizP = state.businesses.find((b) => b.id === biz)!
  const customer = state.customers.find((c) => c.id === conv?.customerId)

  const newThread = () => {
    const o = act({ type: 'chat/new', businessId: biz, channel: 'whatsapp' }, 'Hilo nuevo creado')
    if (o.ok) setConvId((o.data as { conversationId: string }).conversationId)
  }
  return (
    <div className="stack">
      <Callout tone="warn">
        <strong>Conversación de demostración. No se envían mensajes.</strong> Los canales de WhatsApp y llamada son simulaciones locales con reglas deterministas: no hay IA real, micrófono, telefonía ni WhatsApp. {conv && <>Hilo <strong>{conv.id}</strong>{customer ? <> · cliente ficticio {customer.alias}</> : ' · cliente sin identificar'}.</>}
      </Callout>
      <div className="row">
        <label className="field" style={{ margin: 0 }}>
          <span className="label small">Hilo</span>
          <select value={conv?.id ?? ''} onChange={(e) => setConvId(e.target.value)} data-testid="thread-select">
            {convs.map((c) => <option key={c.id} value={c.id}>{c.id} · {state.customers.find((x) => x.id === c.customerId)?.alias ?? 'sin identificar'}</option>)}
          </select>
        </label>
        <button className="btn secondary small" type="button" onClick={newThread} data-testid="new-thread">Nuevo hilo</button>
        <div role="tablist" aria-label="Canal simulado" className="row">
          <button role="tab" aria-selected={tab === 'chat'} className={`btn small ${tab === 'chat' ? '' : 'secondary'}`} onClick={() => setTab('chat')} id="tab-chat" aria-controls="panel-chat">WhatsApp</button>
          <button role="tab" aria-selected={tab === 'voz'} className={`btn small ${tab === 'voz' ? '' : 'secondary'}`} onClick={() => setTab('voz')} id="tab-voz" aria-controls="panel-voz" data-testid="tab-voz">Llamada</button>
        </div>
      </div>
      {!conv ? (
        <Empty title="No hay hilos" action={<button className="btn" type="button" onClick={newThread}>Crear un hilo</button>}>Creá un hilo para probar el simulador.</Empty>
      ) : tab === 'chat' ? (
        <div role="tabpanel" id="panel-chat" aria-labelledby="tab-chat">
          <ChatPanel state={state} conv={conv} guided={guided} kind={bizP.kind} />
        </div>
      ) : (
        <div role="tabpanel" id="panel-voz" aria-labelledby="tab-voz">
          <CallPanel state={state} conv={conv} />
        </div>
      )}
    </div>
  )
}

function ChatPanel({ state, conv, guided, kind }: { state: AppState; conv: Conversation; guided: boolean; kind: 'bodegon' | 'cafe' }) {
  const [text, setText] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const msgs = state.messages.filter((m) => m.conversationId === conv.id)
  const biz = state.businesses.find((b) => b.id === conv.businessId)!
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [msgs.length])
  const send = (t: string, payload?: string) => {
    if (!t.trim() && !payload) return
    dispatch({ type: 'chat/send', conversationId: conv.id, text: t.trim() || payload || '', payload })
    setText('')
  }
  const guion = kind === 'cafe' ? GUION_CAFE : GUION
  return (
    <div className="sim-layout">
      <div className="phone" aria-label="Chat simulado">
        <div className="phone-head">
          <strong>{biz.name} · asistente de demostración</strong>
          <small>Conversación de demostración. No se envían mensajes. <DemoTag /></small>
        </div>
        <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label="Mensajes" data-testid="chat-log">
          {msgs.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>Todavía no hay mensajes. Probá escribir “Hola”.</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`bubble ${m.from === 'cliente' ? 'me' : m.from === 'sistema' ? 'sys' : ''}`} data-testid="bubble">
              <span className="sr-only">{m.from === 'cliente' ? 'Vos' : m.from === 'sistema' ? 'Aviso automático' : 'Asistente'}: </span>
              {m.text}
              {m.link && <div><Link to={m.link.to} onClick={() => undefined}>{m.link.label}</Link></div>}
              {m.actions.length > 0 && (
                <div className="acts">
                  {m.actions.map((a) => (
                    <button key={a.id} type="button" className="btn secondary small" onClick={() => send(a.label, a.payload)}>{a.label}</button>
                  ))}
                </div>
              )}
              <span className="meta">{CHANNEL_LABEL[m.channel] ?? m.channel} · {fmtDateTime(m.createdAt)} {statusBadge(m)}</span>
            </div>
          ))}
        </div>
        <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(text) }}>
          <label className="sr-only" htmlFor="chat-input">Escribí un mensaje</label>
          <input id="chat-input" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí un mensaje…" autoComplete="off" data-testid="chat-input" />
          <button className="btn" type="submit" disabled={!text.trim()} data-testid="chat-send">Enviar</button>
        </form>
      </div>
      <div className="stack">
        {guided && (
          <section className="card" aria-labelledby="guion">
            <h2 id="guion">Guion sugerido</h2>
            <p className="muted small">Cada frase se interpreta con reglas locales (minúsculas, acentos y sinónimos). Probá las tuyas también.</p>
            <ol style={{ paddingLeft: 18 }}>
              {guion.map((g) => (
                <li key={g.label} style={{ marginBottom: 6 }}>
                  <button type="button" className="btn secondary small" onClick={() => setText(g.text)}>{g.label}</button>{' '}
                  <span className="small">“{g.text}” — {g.note}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <section className="card" aria-labelledby="hilo">
          <h2 id="hilo">Hilo {conv.id}</h2>
          <p className="small muted">correlationId {conv.correlationId}. Reservas enlazadas: {conv.reservationIds.join(', ') || 'ninguna'} · pedidos: {conv.orderIds.join(', ') || 'ninguno'}.</p>
          {conv.handoff && <Badge tone="warn" icon="⚑" label="Derivado al equipo" />}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn ghost small" type="button" onClick={() => { const o = dispatch({ type: 'chat/reset', conversationId: conv.id }); if (!o.ok) { setResetMsg(o.message); setResetOpen(true) } else announceReset() }}>Reiniciar la conversación</button>
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={resetOpen}
        title="Reiniciar sin cancelar"
        confirmLabel="Conservar reservas y reiniciar"
        cancelLabel="Volver"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => { act({ type: 'chat/reset', conversationId: conv.id, keep: true }, 'Conversación reiniciada; las reservas se conservaron'); setResetOpen(false) }}
        body={<p>{resetMsg} Para cancelar, usá el flujo “Quiero cancelar” o la pantalla de la reserva.</p>}
      />
    </div>
  )
}
function announceReset() {
  /* sin reservas vinculadas: el reinicio ya se aplicó */
}

function CallPanel({ state, conv }: { state: AppState; conv: Conversation }) {
  const { prefs } = useSnapshot()
  const calls = state.callSessions.filter((c) => c.conversationId === conv.id)
  const call = calls[calls.length - 1] as CallSession | undefined
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const live = call && !['finalizada', 'solicitud_creada', 'derivada'].includes(call.status)
  const busy = call?.status === 'procesando'
  const audioOn = prefs.audio && audioSupported()

  // Timers cancelables ligados al estado y al token: detener o salir los anula.
  useEffect(() => {
    if (!call) return
    let t: ReturnType<typeof setTimeout> | undefined
    if (call.status === 'iniciando') {
      t = setTimeout(() => {
        dispatch({ type: 'call/ready', callId: call.id, token: call.token })
      }, 250)
    } else if (call.status === 'procesando') {
      t = setTimeout(async () => {
        dispatch({ type: 'call/respond', callId: call.id, token: call.token })
        if (audioOn) void playMotif('respuesta', prefs.volume)
      }, 600)
    }
    return () => {
      if (t) clearTimeout(t)
    }
  }, [call?.id, call?.status, call?.token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopAudio(), [])
  useEffect(() => {
    if (!audioOn) stopAudio()
  }, [audioOn])

  const gestureSound = async (m: 'inicio' | 'turno' | 'fin') => {
    if (!audioOn) return
    const ok = await playMotif(m, prefs.volume)
    if (!ok) {
      setAudioBlocked(true)
      setPrefs({ audio: false })
    }
  }
  const start = () => {
    const o = act({ type: 'call/start', conversationId: conv.id }, 'Llamada de prueba iniciada (simulada)')
    if (o.ok) void gestureSound('inicio')
  }
  const options = call ? callOptions(call) : []
  const transcript = call?.transcript ?? []
  const res = call?.reservationId ? state.reservations.find((r) => r.id === call.reservationId) : undefined
  return (
    <div className="sim-layout">
      <section className="card" aria-labelledby="call-h">
        <h2 id="call-h">Llamada simulada <DemoTag /></h2>
        <p className="muted small">No se realiza ninguna llamada ni se usa el micrófono: elegís lo que “dice” la persona con botones. Todo queda en la transcripción; el audio es opcional.</p>
        {!call || !live ? (
          <div className="stack">
            {call && !live && (
              <Callout tone={call.status === 'solicitud_creada' ? 'ok' : 'info'} role="status">
                Estado: <strong data-testid="call-status">{call.status.replace('_', ' ')}</strong>{call.endReason ? ` · motivo: ${call.endReason}` : ''}
                {res && <> · <Link to={`/${res.businessId}/reservas/${res.id}`}>Ver mi reserva {res.id}</Link> ({res.status.replace('_', ' ')})</>}
              </Callout>
            )}
            <div className="row">
              <button className="btn" type="button" onClick={start} data-testid="call-start">Iniciar llamada de prueba</button>
              {call && <button className="btn secondary" type="button" onClick={() => { const o = dispatch({ type: 'call/reset', callId: call.id }); if (!o.ok) setResetOpen(true) }} data-testid="call-reset">Reiniciar</button>}
            </div>
          </div>
        ) : (
          <div className="stack">
            <p>Estado: <Badge tone="info" label={call.status.replace('_', ' ')} /> <span data-testid="call-status" className="sr-only">{call.status}</span> · silencios: {call.silences}/2</p>
            {busy && <p role="status" className="muted">Procesando el turno (simulado)…</p>}
            <div className="stack tight" role="group" aria-label="Qué decir (botones)">
              {options.map((o) => (
                <button key={o.id} type="button" className={`btn ${o.id === 'silence' ? 'secondary' : ''}`} style={{ justifyContent: 'flex-start', textAlign: 'left' }} disabled={busy} onClick={() => { act({ type: 'call/say', callId: call.id, optionId: o.id }); void gestureSound('turno') }} data-testid={`opt-${o.id}`}>
                  {o.label}
                </button>
              ))}
              {options.length === 0 && !busy && <p className="muted">No hay turnos disponibles ahora.</p>}
            </div>
            <div className="row">
              <button className="btn secondary small" type="button" disabled={busy} onClick={() => act({ type: 'call/tick', callId: call.id, seconds: 10 }, 'Pasaron 10 s de silencio (reloj de la llamada)')} data-testid="call-wait">Esperar 10 s (reloj de la llamada)</button>
              <button className="btn danger small" type="button" onClick={() => { act({ type: 'call/end', callId: call.id }, 'Llamada detenida'); stopAudio() }} data-testid="call-stop">Detener</button>
              <button className="btn secondary small" type="button" onClick={() => { const o = dispatch({ type: 'call/reset', callId: call.id }); if (!o.ok) setResetOpen(true) }}>Reiniciar</button>
            </div>
          </div>
        )}
        <fieldset style={{ marginTop: 12 }}>
          <legend>Audio opcional</legend>
          <label className="choice"><input type="checkbox" checked={prefs.audio} disabled={!audioSupported()} onChange={(e) => { setAudioBlocked(false); setPrefs({ audio: e.target.checked }); if (e.target.checked) void playMotif('inicio', prefs.volume).then((ok) => { if (!ok) { setAudioBlocked(true); setPrefs({ audio: false }) } }) }} data-testid="audio-toggle" /> Motivos sonoros sintéticos de 150–350 ms (no es voz)</label>
          <label className="field" style={{ margin: 0 }}>
            <span className="label small">Volumen</span>
            <input type="range" min={0} max={1} step={0.05} value={prefs.volume} onChange={(e) => setPrefs({ volume: Number(e.target.value) })} aria-valuetext={`${Math.round(prefs.volume * 100)}%`} />
          </label>
          <button className="btn ghost small" type="button" onClick={() => { setPrefs({ audio: false }); stopAudio() }}>Continuar sin audio</button>
          {audioBlocked && <p className="error-text" role="status">El navegador bloqueó el audio. Seguimos sin audio: la transcripción tiene todo.</p>}
          {!audioSupported() && <p className="muted small">Este navegador no ofrece Web Audio: la llamada funciona solo con transcripción.</p>}
        </fieldset>
      </section>
      <section className="card" aria-labelledby="tr-h">
        <h2 id="tr-h">Transcripción</h2>
        <div className="transcript" role="log" aria-live="polite" data-testid="transcript">
          {transcript.length === 0 && <p className="muted">Iniciá una llamada para ver la transcripción.</p>}
          {transcript.map((t, i) => (
            <p key={i}>
              <span className="who">{t.who === 'cliente' ? 'Vos' : t.who === 'asistente' ? 'Asistente' : 'Sistema'}</span>
              <br />
              {t.text}
            </p>
          ))}
        </div>
        {calls.length > 1 && <p className="small muted">Sesiones de voz de este hilo: {calls.map((c) => c.id).join(', ')} (un solo registro de negocio por operación).</p>}
      </section>
      <ConfirmDialog
        open={resetOpen}
        title="Reiniciar la llamada"
        confirmLabel="Conservar la reserva y reiniciar"
        cancelLabel="Volver"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => { if (call) act({ type: 'call/reset', callId: call.id, keep: true }, 'Llamada reiniciada; la reserva se conservó'); setResetOpen(false) }}
        body={<p>La llamada creó una solicitud. Reiniciar <strong>no la cancela</strong>. Para cancelarla usá su flujo en “Mi reserva”.</p>}
      />
    </div>
  )
}

export function Simulador() {
  const { biz } = useBiz()
  return (
    <main>
      <PageHead title="Simulador de WhatsApp y llamada" sub="Vista guiada · reglas deterministas, sin IA ni envíos reales" />
      <SimPanel biz={biz.id} guided />
    </main>
  )
}
