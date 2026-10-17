// Lote 2 · Tres propuestas visuales sobre el mismo contenido real, para que Ignacio elija.
// Ruta aislada (#/propuestas): no forma parte del producto ni de la navegación de la demo.
import '@fontsource/newsreader/latin-500.css';
import '@fontsource/newsreader/latin-600.css';
import '@fontsource/newsreader/latin-500-italic.css';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './proposals.css';
import { useEffect, useState, type CSSProperties } from 'react';
import { navigate, useRoute } from '../../app/router';
import { ConfirmMotion, LoaderArt } from './art';
import { measure } from './contrast';
import { useProposalContent, type Content } from './content';
import { AgendaScreen, BookingScreen, BrandFamily, ChatScreen, Frame, HomeScreen } from './screens';
import { cssVars, PROPOSALS, proposalById, type Mode, type Palette, type Proposal } from './tokens';

type Screen = 'inicio' | 'agenda' | 'reserva' | 'whatsapp';
const SCREENS: { id: Screen; label: string }[] = [
  { id: 'inicio', label: 'Inicio del paciente' }, { id: 'agenda', label: 'Hoy y agenda (recepción)' },
  { id: 'reserva', label: 'Reservar en el teléfono' }, { id: 'whatsapp', label: 'WhatsApp simulado' },
];

const SWATCHES: { key: keyof Palette; role: string }[] = [
  { key: 'bg', role: 'Fondo' }, { key: 'surface', role: 'Superficie' }, { key: 'ink', role: 'Texto' }, { key: 'muted', role: 'Secundario' },
  { key: 'line', role: 'Filete' }, { key: 'accent', role: 'Acento' }, { key: 'accent2', role: 'Segundo acento' },
  { key: 'success', role: 'Éxito' }, { key: 'warn', role: 'Aviso' }, { key: 'danger', role: 'Error' },
];

function useParams() {
  const { query } = useRoute();
  const view = query.get('v') === 'comparar' ? 'compare' : 'one';
  const p = proposalById(query.get('p'));
  const mode: Mode = query.get('m') === 'oscuro' ? 'dark' : 'light';
  const screen = (SCREENS.find((s) => s.id === query.get('s'))?.id ?? 'inicio') as Screen;
  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ v: view === 'compare' ? 'comparar' : 'una', p: p.id, m: mode === 'dark' ? 'oscuro' : 'claro', s: screen, ...patch });
    navigate(`/propuestas?${next.toString()}`);
  };
  return { view, p, mode, screen, go };
}

function ScreenFor({ p, mode, screen, c }: { p: Proposal; mode: Mode; screen: Screen; c: Content }) {
  const style = cssVars(p, mode) as CSSProperties;
  const label = `${p.letter} · ${SCREENS.find((s) => s.id === screen)!.label} · ${mode === 'dark' ? 'oscuro' : 'claro'}`;
  if (screen === 'inicio') return <Frame prop={p.id} kind="desk" label={label} style={style}><HomeScreen prop={p.id} c={c} /></Frame>;
  if (screen === 'agenda') return <Frame prop={p.id} kind="desk" label={label} style={style}><AgendaScreen prop={p.id} c={c} /></Frame>;
  if (screen === 'reserva') return <Frame prop={p.id} kind="phone" label={label} style={style}><BookingScreen prop={p.id} c={c} /></Frame>;
  return <Frame prop={p.id} kind="phone" label={label} style={style}><ChatScreen prop={p.id} c={c} /></Frame>;
}

function MotionTile({ p, mode, c }: { p: Proposal; mode: Mode; c: Content }) {
  const [run, setRun] = useState(0);
  return (
    <div className="pp-frame pp-frame-tile" data-prop={p.id} style={cssVars(p, mode) as CSSProperties}>
      <p className="pp-label">Movimiento · turno confirmado</p>
      {c.next && <ConfirmMotion prop={p.id} run={run} next={c.next} />}
      <button type="button" className="pv-replay" onClick={() => setRun((r) => r + 1)}>Repetir animación</button>
      <p className="pp-small pp-muted">{p.motion.note}</p>
    </div>
  );
}

function Board({ p, mode, c }: { p: Proposal; mode: Mode; c: Content }) {
  const ratios = measure(p, mode);
  const pal = p.palettes[mode];
  const style = cssVars(p, mode) as CSSProperties;
  return (
    <article className="pv-board" aria-labelledby={`pv-${p.id}`}>
      <header className="pv-intro">
        <span className="pv-letter" aria-hidden="true">{p.letter}</span>
        <div>
          <h2 id={`pv-${p.id}`}>{p.letter} · {p.name}</h2>
          <p className="pv-tag">{p.tagline}</p>
          <div className="pv-cols">
            <div><h3>Por qué encaja</h3><ul>{p.why.map((w) => <li key={w}>{w}</li>)}</ul></div>
            <div><h3>Riesgos y cómo se controlan</h3><ul>{p.risks.map((w) => <li key={w}>{w}</li>)}</ul></div>
          </div>
          <p className="pv-sign"><strong>Componente distintivo:</strong> {p.signature}</p>
        </div>
      </header>

      <section aria-label="Pantallas" className="pv-screens">
        <ScreenFor p={p} mode={mode} screen="inicio" c={c} />
        <ScreenFor p={p} mode={mode} screen="agenda" c={c} />
        <div className="pv-phones">
          <ScreenFor p={p} mode={mode} screen="reserva" c={c} />
          <ScreenFor p={p} mode={mode} screen="whatsapp" c={c} />
          <div className="pv-tiles">
            <div className="pp-frame pp-frame-tile" data-prop={p.id} style={style}><p className="pp-label">Carga · muestra</p><LoaderArt prop={p.id} /><p className="pp-small pp-muted">En la app, la carga dura lo que tarda de verdad: sin esperas fingidas.</p></div>
            <MotionTile p={p} mode={mode} c={c} />
            <div className="pp-frame pp-frame-tile" data-prop={p.id} style={style}><p className="pp-label">Familia de la marca</p><BrandFamily prop={p.id} /></div>
          </div>
        </div>
      </section>

      <section className="pv-system" aria-labelledby={`pv-sys-${p.id}`}>
        <h3 id={`pv-sys-${p.id}`}>Sistema de {p.letter} ({mode === 'dark' ? 'oscuro' : 'claro'})</h3>
        <div className="pv-sys-grid">
          <div>
            <h4>Paleta y roles</h4>
            <ul className="pv-swatches">{SWATCHES.map((s) => <li key={s.key}><span className="pv-sw" style={{ background: pal[s.key] as string }} /><span>{s.role}<code>{pal[s.key] as string}</code></span></li>)}</ul>
          </div>
          <div>
            <h4>Contraste medido (peor caso)</h4>
            <table className="pv-ratios"><caption className="sr-only">Contraste de los pares que usa la interfaz</caption><thead><tr><th>Par</th><th>Ratio</th><th>Mínimo</th></tr></thead>
              <tbody>{ratios.map((r) => <tr key={r.label}><td>{r.label}</td><td className="tabular">{r.value.toFixed(1)}:1</td><td className={r.pass ? 'pv-ok' : 'pv-bad'}>{r.pass ? '✓' : '✗'} {r.min}</td></tr>)}</tbody>
            </table>
          </div>
          <div>
            <h4>Tipografía</h4>
            <div className="pp-frame pp-frame-tile pv-type" data-prop={p.id} style={style}>
              <p className="pp-h1" style={{ fontSize: 40 }}>Próximo paso</p>
              <p className="pp-h2">Hoy · lunes 19 de octubre</p>
              <p>Pedí tu primera visita o cambiá un turno: la clínica confirma sillón y profesional.</p>
              {c.next && <p className="pp-mono">{c.next.id} · {c.next.dow} {c.next.dateShort} {c.next.time} · {c.next.chair}</p>}
            </div>
            <p className="pv-note">{p.fontNote}</p>
            <h4>Grilla y densidad</h4><p className="pv-note">{p.grid} {p.density}</p>
            <h4>Superficies, radios y sombra</h4><p className="pv-note">{p.surfaces} Radios: tarjeta {p.radii.card} px · control {p.radii.control} px · chip {p.radii.chip === 999 ? 'píldora' : `${p.radii.chip} px`}.</p>
            <h4>Motion</h4><p className="pv-note">{p.motion.note} Rápido {p.motion.fast} ms · base {p.motion.base} ms · lento {p.motion.slow} ms · curva <code>{p.motion.ease}</code>. Con movimiento reducido: estado final sin animación.</p>
          </div>
        </div>
      </section>
    </article>
  );
}

export function Proposals() {
  const c = useProposalContent();
  const { view, p, mode, screen, go } = useParams();
  useEffect(() => { document.title = 'Propuestas visuales · DentalOS'; }, []);
  return (
    <div className="pv-page">
      <header className="pv-top">
        <a className="pv-back" href="#/">← Volver a la demo</a>
        <h1 tabIndex={-1} data-page-title>Propuestas visuales · DentalOS</h1>
        <p className="pv-lede">Tres direcciones sobre <strong>el mismo contenido real</strong> de la demo (turnos de hoy, el turno A-0012 de Martina y los horarios libres de primera consulta). <strong>Ninguna está aprobada.</strong> Elegí una, combiná partes o pedí correcciones; recién entonces se extiende a toda la app.</p>
      </header>

      <div className="pv-controls">
        <div role="group" aria-label="Qué ver" className="pv-seg">
          {PROPOSALS.map((x) => <button key={x.id} type="button" aria-pressed={view === 'one' && p.id === x.id} onClick={() => go({ v: 'una', p: x.id })}>{x.letter} · {x.name}</button>)}
          <button type="button" aria-pressed={view === 'compare'} onClick={() => go({ v: 'comparar' })}>Comparar las tres</button>
        </div>
        <div role="group" aria-label="Modo" className="pv-seg">
          <button type="button" aria-pressed={mode === 'light'} onClick={() => go({ m: 'claro' })}>Claro</button>
          <button type="button" aria-pressed={mode === 'dark'} onClick={() => go({ m: 'oscuro' })}>Oscuro</button>
        </div>
      </div>

      {view === 'one' ? <Board p={p} mode={mode} c={c} /> : (
        <section aria-labelledby="pv-cmp" className="pv-compare">
          <h2 id="pv-cmp">Comparar la misma pantalla</h2>
          <div role="group" aria-label="Pantalla" className="pv-seg">
            {SCREENS.map((s) => <button key={s.id} type="button" aria-pressed={screen === s.id} onClick={() => go({ s: s.id })}>{s.label}</button>)}
          </div>
          <div className={`pv-cmp-grid ${screen === 'reserva' || screen === 'whatsapp' ? 'is-phone' : ''}`}>
            {PROPOSALS.map((x) => <ScreenFor key={x.id} p={x} mode={mode} screen={screen} c={c} />)}
          </div>
        </section>
      )}

      <footer className="pv-foot">
        <h2>Cómo elegir</h2>
        <p>Respondé con una letra (A, B o C), con una combinación (por ejemplo “A en el portal con la agenda de C”) o con correcciones concretas. Después de la elección se congelan los tokens y se aplican a todas las pantallas, en claro y oscuro (lote 3). Las fuentes de las propuestas descartadas se quitan del proyecto.</p>
        <p className="pv-note">Prototipos de dirección visual: los botones no ejecutan acciones. Datos ficticios de la demo; sin envíos reales.</p>
      </footer>
    </div>
  );
}
