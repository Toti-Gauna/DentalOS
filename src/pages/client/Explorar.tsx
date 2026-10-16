import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBiz } from '../../ui/hooks'
import { PageHead } from '../../ui/Shell'
import { act, Badge, Callout } from '../../ui/kit'
import { PASSPORT_CARDS, PASSPORT_PICKS } from '../../domain/content'
import { getPassport } from '../../domain/cmd-engage'

export function Explorar() {
  const { state, biz } = useBiz()
  const cards = PASSPORT_CARDS.filter((c) => c.businessId === biz.id)
  const pass = getPassport(state, biz.id, state.session.customerByBusiness[biz.id] ?? null)
  const done = pass ? Object.values(pass.cards).filter((c) => c.done).length : 0
  const [feedback, setFeedback] = useState<Record<string, { correct: boolean; text: string }>>({})
  const picks = PASSPORT_PICKS[biz.id]
  const label = biz.kind === 'cafe' ? 'método, origen y perfil' : 'ingrediente, preparación e historia'
  return (
    <main>
      <PageHead title="Explorar sabores" sub={`Pasaporte de sabores · ${label}`} />
      <Callout>
        Tres tarjetas de 20–30 segundos con una pregunta opcional. Podés equivocarte y reintentar sin penalización. <strong>El logro no se compra ni da descuentos</strong>: es para descubrir y recordar tus preferencias. También podés pedir sin jugar.
      </Callout>
      {biz.passportPaused && <Callout tone="warn" role="alert">La mecánica de pasaporte está pausada por el encargado. Podés leer las tarjetas pero no suman.</Callout>}
      <p aria-live="polite" style={{ marginTop: 10 }}><strong data-testid="passport-progress">{done} de {cards.length}</strong> tarjetas completadas · estado: <Badge tone={pass?.badge === 'guardada' ? 'ok' : 'info'} label={pass ? pass.badge.replace('-', ' ') : 'sin empezar'} /></p>
      <div className="grid cols-3">
        {cards.map((c) => {
          const prog = pass?.cards[c.id]
          const fb = feedback[c.id]
          return (
            <article key={c.id} className="pcard" data-done={!!prog?.done} data-testid={`pcard-${c.id}`}>
              <p className="muted small" style={{ margin: 0 }}>{c.axis}</p>
              <h2 style={{ fontSize: '1.2rem' }}>{c.title}</h2>
              <p>{c.body}</p>
              {prog?.done ? (
                <p className="ok-text">✓ Tarjeta completada. {c.explanation}</p>
              ) : (
                <fieldset>
                  <legend>{c.question} <span className="muted">(opcional)</span></legend>
                  {c.options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="btn secondary"
                      style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6, textAlign: 'left' }}
                      onClick={() => {
                        const r = act({ type: 'pass/answer', businessId: biz.id, cardId: c.id, optionId: o.id })
                        if (r.ok) setFeedback((f) => ({ ...f, [c.id]: { correct: (r.data as { correct: boolean }).correct, text: (r.data as { explanation: string }).explanation } }))
                        else setFeedback((f) => ({ ...f, [c.id]: { correct: false, text: r.message } }))
                      }}
                    >
                      {o.text}
                    </button>
                  ))}
                  {fb && (
                    <p className={fb.correct ? 'ok-text' : 'error-text'} role="status" data-testid={`fb-${c.id}`}>
                      {fb.correct ? '✓ ¡Correcto! ' : 'Casi. Sin penalización, podés reintentar. '}
                      {fb.text}
                    </p>
                  )}
                  <button className="btn ghost small" type="button" onClick={() => act({ type: 'pass/read', businessId: biz.id, cardId: c.id }, 'Tarjeta marcada como leída')}>Ya la leí, seguir sin responder</button>
                </fieldset>
              )}
            </article>
          )
        })}
      </div>
      {pass && (pass.badge === 'disponible' || pass.badge === 'guardada') && (
        <section className="card" style={{ marginTop: 16 }} aria-labelledby="badge">
          <h2 id="badge">🏅 Insignia de {biz.kind === 'cafe' ? 'catador' : 'comensal'} curioso</h2>
          <p>Completaste las tres tarjetas. Podés guardar una selección para recordarla en la carta. Sin compra ni premio real.</p>
          <div className="row">
            {picks.map((p) => (
              <button key={p.id} type="button" className="btn secondary" aria-pressed={pass.savedPreference === p.id} onClick={() => act({ type: 'pass/save', businessId: biz.id, itemId: p.id }, `Guardaste ${p.label}`)}>
                {pass.savedPreference === p.id ? '★ ' : ''}{p.label}
              </button>
            ))}
          </div>
          {pass.badge === 'guardada' && <p className="ok-text" role="status">Selección guardada. Aparece marcada en la carta.</p>}
        </section>
      )}
      <div className="row" style={{ marginTop: 16 }}>
        <Link className="btn" to={`/${biz.id}/pasaporte`}>Ver mi pasaporte</Link>
        <button className="btn ghost" type="button" onClick={() => act({ type: 'pass/reset', businessId: biz.id }, 'Pasaporte reiniciado')}>Reiniciar mis tarjetas</button>
      </div>
    </main>
  )
}
