// Arte propio de cada propuesta: ilustración principal, indicador de carga y animación de “turno confirmado”.
// Todo es decorativo (aria-hidden) salvo donde se indica; los colores salen de las variables --pp-*.
import { useId } from 'react';
import type { Content } from './content';
import type { PropId } from './tokens';

/** Contorno de molar con dos raíces (A lo traza; B lo rellena; C lo construye por piezas). */
export const MOLAR = 'M118 78 C116 58 132 48 146 54 C152 57 156 58 160 58 C164 58 168 57 174 54 C188 48 204 58 202 78 C200 98 194 112 190 126 C186 142 186 166 178 182 C174 190 166 188 165 178 L162 150 C161 144 159 144 158 150 L155 178 C154 188 146 190 142 182 C134 166 134 142 130 126 C126 112 120 98 118 78 Z';

export function HeroArt({ prop }: { prop: PropId }) {
  const uid = useId().replace(/:/g, '');
  if (prop === 'a') {
    // Línea única: arco de ventana, molar trazado, ramita y destellos dorados.
    return (
      <svg className="pp-hero-art" viewBox="0 0 320 240" aria-hidden="true" focusable="false">
        <path d="M70 222 V118 A90 90 0 0 1 250 118 V222" fill="none" stroke="var(--pp-line)" strokeWidth="1.2" />
        <path d="M84 222 V122 A76 76 0 0 1 236 122 V222" fill="none" stroke="var(--pp-line)" strokeWidth="1.2" strokeDasharray="2 5" />
        <path d="M36 222 H284" stroke="var(--pp-ink)" strokeWidth="1.2" opacity=".55" />
        <path className="pp-draw" pathLength={1} d={MOLAR} fill="var(--pp-surface)" stroke="var(--pp-accent)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M134 74 C136 64 144 61 151 64" fill="none" stroke="var(--pp-accent2)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M212 210 C218 186 232 172 252 166 M226 188 C236 186 242 180 246 172 M220 198 C214 190 206 188 198 190" fill="none" stroke="var(--pp-accent)" strokeWidth="1.4" strokeLinecap="round" />
        {[[96, 70, 6], [226, 92, 4.5], [112, 108, 3.5]].map(([x, y, r]) => (
          <path key={`${x}-${y}`} d={`M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z`} fill="var(--pp-accent2)" />
        ))}
        <text x="160" y="236" textAnchor="middle" fontFamily="var(--pp-display)" fontStyle="italic" fontSize="11" fill="var(--pp-muted)">Clínica Brisa · desde la primera consulta</text>
      </svg>
    );
  }
  if (prop === 'b') {
    // Diente esmaltado que flota sobre un disco de vidrio, con orbes de luz.
    return (
      <svg className="pp-hero-art" viewBox="0 0 320 240" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`en-${uid}`} cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#f2f7f9" /><stop offset="1" stopColor="#cfe1e8" /></radialGradient>
          <radialGradient id={`orb-${uid}`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="var(--pp-accent)" stopOpacity=".45" /><stop offset="1" stopColor="var(--pp-accent)" stopOpacity="0" /></radialGradient>
          <radialGradient id={`orb2-${uid}`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="var(--pp-accent2)" stopOpacity=".45" /><stop offset="1" stopColor="var(--pp-accent2)" stopOpacity="0" /></radialGradient>
          <linearGradient id={`disc-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--pp-glass-edge, #fff)" stopOpacity=".8" /><stop offset="1" stopColor="var(--pp-glass-edge, #fff)" stopOpacity=".15" /></linearGradient>
          <filter id={`soft-${uid}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        <circle cx="76" cy="70" r="56" fill={`url(#orb-${uid})`} />
        <circle cx="256" cy="168" r="62" fill={`url(#orb2-${uid})`} />
        <ellipse cx="160" cy="206" rx="104" ry="20" fill={`url(#disc-${uid})`} stroke="var(--pp-glass-edge, #fff)" strokeWidth="1.2" />
        <ellipse cx="160" cy="210" rx="56" ry="9" fill="#0e2232" opacity=".14" filter={`url(#soft-${uid})`} />
        <g className="pp-float">
          <path d={MOLAR} transform="translate(0 -12)" fill={`url(#en-${uid})`} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
          <ellipse cx="140" cy="66" rx="10" ry="16" transform="rotate(-24 140 66)" fill="#fff" opacity=".9" filter={`url(#soft-${uid})`} />
          <circle cx="188" cy="52" r="3" fill="#fff" />
        </g>
      </svg>
    );
  }
  // C: construcción geométrica sobre grilla de puntos, con riel de horarios.
  return (
    <svg className="pp-hero-art" viewBox="0 0 320 240" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`dots-${uid}`} width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.2" fill="var(--pp-line)" /></pattern>
      </defs>
      <rect x="8" y="8" width="304" height="200" rx="10" fill={`url(#dots-${uid})`} />
      <g fill="var(--pp-accent-soft)" stroke="var(--pp-accent)" strokeWidth="1.6" strokeLinejoin="round">
        <rect x="128" y="104" width="24" height="84" rx="12" />
        <rect x="168" y="104" width="24" height="84" rx="12" />
        <path d="M114 74 Q114 46 140 46 Q152 46 160 58 Q168 46 180 46 Q206 46 206 74 V98 Q206 122 182 122 H138 Q114 122 114 98 Z" />
      </g>
      <path d="M122 84 H198" stroke="var(--pp-accent)" strokeWidth="1" strokeDasharray="2 4" opacity=".7" />
      <g stroke="var(--pp-muted)" strokeWidth="1" strokeDasharray="3 3">
        <path d="M100 46 V188" /><path d="M220 46 V124" />
      </g>
      <g fontFamily="var(--pp-mono)" fontSize="9" fill="var(--pp-muted)">
        <text x="96" y="40" textAnchor="middle">16</text>
        <text x="224" y="40" textAnchor="middle">O · V · L</text>
      </g>
      <path d="M24 222 H296" stroke="var(--pp-line)" strokeWidth="2" strokeLinecap="round" />
      <path className="pp-rail" pathLength={1} d="M24 222 H164" stroke="var(--pp-accent2)" strokeWidth="2" strokeLinecap="round" />
      {[[24, '09:00'], [94, '10:00'], [164, '11:00'], [234, '12:00']].map(([x, t], i) => (
        <g key={t as string}>
          <circle cx={x as number} cy="222" r="4.5" fill={i < 3 ? 'var(--pp-accent2)' : 'var(--pp-surface)'} stroke="var(--pp-accent2)" strokeWidth="1.6" />
          <text x={x as number} y="236" textAnchor="middle" fontFamily="var(--pp-mono)" fontSize="9" fill="var(--pp-muted)">{t}</text>
        </g>
      ))}
    </svg>
  );
}

/** Carga con identidad propia. El texto dice qué se carga; la duración la marca la carga real en la app. */
export function LoaderArt({ prop }: { prop: PropId }) {
  if (prop === 'a') {
    return (
      <div className="pp-loader pp-loader-a" role="img" aria-label="Muestra de carga: Preparando la agenda">
        <svg viewBox="100 40 120 160" aria-hidden="true" focusable="false"><path className="pp-loader-path" pathLength={1} d={MOLAR} fill="none" stroke="var(--pp-accent)" strokeWidth="2.4" strokeLinejoin="round" /></svg>
        <p>Preparando la agenda…</p>
      </div>
    );
  }
  if (prop === 'b') {
    return (
      <div className="pp-loader pp-loader-b" role="img" aria-label="Muestra de carga: Preparando la agenda">
        <span className="pp-orb" /><span className="pp-orb" /><span className="pp-orb" />
        <p>Preparando la agenda</p>
      </div>
    );
  }
  const steps = ['agenda', 'sillones', 'turnos', 'avisos', 'listo'];
  return (
    <div className="pp-loader pp-loader-c" role="img" aria-label="Muestra de carga: 3 de 5 pasos">
      <div className="pp-seg">{steps.map((s, i) => <span key={s} className={i < 3 ? 'is-done' : i === 3 ? 'is-now' : ''} />)}</div>
      <p><span className="pp-mono">03/05</span> turnos del día</p>
    </div>
  );
}

/** Animación de “turno confirmado”. `run` cambia para repetirla. Con movimiento reducido queda el estado final. */
export function ConfirmMotion({ prop, run, next }: { prop: PropId; run: number; next: NonNullable<Content['next']> }) {
  if (prop === 'a') {
    return (
      <div className="pp-motion pp-motion-a" key={run}>
        <div className="pp-folio-mini">
          <span className="pp-folio-num">{next.day}</span>
          <span><strong>{next.dow} · {next.time}</strong><br />{next.service}</span>
        </div>
        <span className="pp-stamp">Confirmado</span>
      </div>
    );
  }
  if (prop === 'b') {
    return (
      <div className="pp-motion pp-motion-b" key={run}>
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--pp-line)" strokeWidth="5" />
          <circle className="pp-ring" pathLength={1} cx="32" cy="32" r="26" fill="none" stroke="var(--pp-accent)" strokeWidth="5" strokeLinecap="round" transform="rotate(-90 32 32)" />
          <path className="pp-check" pathLength={1} d="M21 33 l7 7 l15 -16" fill="none" stroke="var(--pp-accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="pp-glass-mini"><strong>Turno confirmado</strong><span>{next.dow} {next.dateShort} · {next.time}</span></div>
      </div>
    );
  }
  return (
    <div className="pp-motion pp-motion-c" key={run}>
      <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><rect x="2" y="2" width="36" height="36" rx="8" fill="none" stroke="var(--pp-line)" strokeWidth="2" /><path className="pp-check" pathLength={1} d="M11 21 l6 6 l12 -13" fill="none" stroke="var(--pp-accent2)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <div>
        <p className="pp-mono pp-tick"><span>{next.id}</span> <span className="pp-tick-a">solicitado</span><span className="pp-tick-b">confirmado</span></p>
        <p className="pp-small">{next.dow} {next.dateShort} · {next.time} · {next.chair}</p>
      </div>
    </div>
  );
}
