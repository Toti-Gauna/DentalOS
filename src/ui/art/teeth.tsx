// Ilustraciones dentales propias (SVG inline, sin assets externos). Un estado ilustrado por cada caso de registro.
// Anatomía simplificada por tipo de pieza; las piezas superiores se dibujan invertidas (raíz hacia arriba), como en un odontograma.
import { useId } from 'react';

export type ToothKind = 'incisivo' | 'canino' | 'premolar' | 'molar';
export type ToothArtState =
  | 'sano' | 'caries' | 'resina' | 'amalgama' | 'corona_oro' | 'corona_porcelana' | 'conducto'
  | 'implante' | 'ausente' | 'extraccion' | 'fractura' | 'sellador' | 'bracket';

export const TOOTH_STATES: { state: ToothArtState; label: string; detail: string }[] = [
  { state: 'sano', label: 'Sin registro', detail: 'Pieza sin registros en la ficha de muestra.' },
  { state: 'caries', label: 'Caries (hallazgo)', detail: 'Hallazgo registrado por la profesional.' },
  { state: 'resina', label: 'Restauración de resina', detail: 'Material del color del diente.' },
  { state: 'amalgama', label: 'Restauración de amalgama', detail: 'Restauración metálica previa.' },
  { state: 'corona_oro', label: 'Corona de oro', detail: 'Corona metálica áurea.' },
  { state: 'corona_porcelana', label: 'Corona de porcelana', detail: 'Corona estética.' },
  { state: 'conducto', label: 'Tratamiento de conducto', detail: 'Conductos obturados.' },
  { state: 'implante', label: 'Implante', detail: 'Tornillo de titanio con corona.' },
  { state: 'sellador', label: 'Sellador', detail: 'Película protectora en fosas y fisuras.' },
  { state: 'fractura', label: 'Fractura (hallazgo)', detail: 'Línea de fractura registrada.' },
  { state: 'bracket', label: 'Bracket', detail: 'Aparatología de ortodoncia.' },
  { state: 'extraccion', label: 'Extracción indicada', detail: 'Indicada por la profesional; no realizada.' },
  { state: 'ausente', label: 'Pieza ausente', detail: 'Sin pieza en boca.' },
];

/** Procedimiento registrado en la ficha → ilustración. */
export const PROCEDURE_ART: Record<string, ToothArtState> = {
  'Caries (hallazgo)': 'caries', 'Restauración': 'resina', 'Restauración de resina': 'resina', 'Restauración de amalgama': 'amalgama',
  'Corona': 'corona_porcelana', 'Corona de porcelana': 'corona_porcelana', 'Corona de oro': 'corona_oro', 'Corona provisoria': 'corona_porcelana',
  'Tratamiento de conducto': 'conducto', 'Implante': 'implante', 'Sellador': 'sellador', 'Fractura (hallazgo)': 'fractura',
  'Bracket': 'bracket', 'Extracción indicada': 'extraccion', 'Pieza ausente': 'ausente', 'Control': 'sano',
};
const PRIORITY: ToothArtState[] = ['implante', 'ausente', 'extraccion', 'corona_oro', 'corona_porcelana', 'conducto', 'bracket', 'amalgama', 'resina', 'sellador', 'fractura', 'caries', 'sano'];
export function primaryState(procedures: string[]): ToothArtState {
  const states = procedures.map((p) => PROCEDURE_ART[p] ?? 'sano');
  return PRIORITY.find((s) => states.includes(s)) ?? 'sano';
}

export function kindFor(tooth: number): ToothKind {
  const q = Math.floor(tooth / 10); const n = tooth % 10;
  const temporal = q >= 5;
  if (n <= 2) return 'incisivo';
  if (n === 3) return 'canino';
  if (temporal) return 'molar';
  return n <= 5 ? 'premolar' : 'molar';
}

const SHAPES: Record<ToothKind, { crown: string; roots: string; cusp: string; canals: string[]; cx: number }> = {
  molar: {
    crown: 'M7 40 C5 30 6 18 11 11 C14 7 18 8 21 12 C23 7 28 6 30 10 C32 6 37 7 39 12 C42 8 46 7 49 11 C54 18 55 30 53 40 C47 45 13 45 7 40 Z',
    roots: 'M12 38 C10 56 12 76 17 90 C19 96 24 95 25 88 C26 74 27 60 30 50 C33 60 34 74 35 88 C36 95 41 96 43 90 C48 76 50 56 48 38 Z',
    cusp: 'M10 16 C14 10 19 10 21 14 C24 9 28 9 30 13 C32 9 36 9 39 14 C42 10 46 10 50 16 C47 20 13 20 10 16 Z',
    canals: ['M23 30 C21 52 19 72 20 88', 'M37 30 C39 52 41 72 40 88'], cx: 30,
  },
  premolar: {
    crown: 'M12 40 C10 30 11 19 16 12 C19 8 24 9 27 13 C29 8 33 8 35 12 C38 9 42 9 45 13 C50 20 50 31 48 40 C42 45 18 45 12 40 Z',
    roots: 'M17 38 C15 58 18 80 25 93 C28 98 32 98 35 93 C42 80 45 58 43 38 Z',
    cusp: 'M15 17 C18 12 23 12 27 15 C30 11 34 11 36 14 C39 11 43 12 46 17 C42 21 19 21 15 17 Z',
    canals: ['M30 30 C30 54 30 76 30 92'], cx: 30,
  },
  canino: {
    crown: 'M14 40 C12 30 15 18 22 10 C25 6 28 3 30 3 C32 3 35 6 38 10 C45 18 48 30 46 40 C40 45 20 45 14 40 Z',
    roots: 'M20 38 C18 60 22 84 28 96 C29 99 31 99 32 96 C38 84 42 60 40 38 Z',
    cusp: 'M20 16 C24 10 28 6 30 6 C32 6 36 10 40 16 C35 19 25 19 20 16 Z',
    canals: ['M30 28 C30 54 30 80 30 95'], cx: 30,
  },
  incisivo: {
    crown: 'M15 40 C14 30 14 18 15 9 C16 5 19 4 30 4 C41 4 44 5 45 9 C46 18 46 30 45 40 C39 45 21 45 15 40 Z',
    roots: 'M21 38 C19 60 22 82 27 95 C28 98 32 98 33 95 C38 82 41 60 39 38 Z',
    cusp: 'M17 8 C18 6 22 5.5 30 5.5 C38 5.5 42 6 43 8 C41 11 19 11 17 8 Z',
    canals: ['M30 26 C30 54 30 80 30 94'], cx: 30,
  },
};

export interface ToothArtProps {
  kind: ToothKind;
  state?: ToothArtState;
  /** Superior: raíz hacia arriba. */
  flip?: boolean;
  temporal?: boolean;
  planned?: boolean;
  width?: number;
  title?: string;
  className?: string;
}

export function ToothArt({ kind, state = 'sano', flip = false, temporal = false, planned = false, width = 40, title, className = '' }: ToothArtProps) {
  const uid = useId().replace(/:/g, '');
  const g = (n: string) => `${n}-${uid}`;
  const sh = SHAPES[kind];
  const ghost = state === 'ausente';
  const implant = state === 'implante';
  const crownFill = state === 'corona_oro' ? `url(#${g('gold')})` : state === 'corona_porcelana' || implant ? `url(#${g('porc')})` : `url(#${g('enamel')})`;
  const height = (width * 100) / 60;
  const inner = (
    <g transform={`${flip ? 'translate(0 100) scale(1 -1)' : ''} ${temporal ? 'translate(5.4 9) scale(0.82)' : ''}`}>
      {/* Raíz o implante */}
      {implant ? (
        <g>
          <path d="M24 46 L36 46 L35 90 C33 95 27 95 25 90 Z" fill={`url(#${g('ti')})`} stroke="#5f686d" strokeWidth="1.2" />
          {[52, 58, 64, 70, 76, 82].map((y) => <path key={y} d={`M24.5 ${y} L35.5 ${y + 3}`} stroke="#5f686d" strokeWidth="1.3" />)}
          <path d="M26 40 L34 40 L33 47 L27 47 Z" fill="#aeb6ba" stroke="#5f686d" strokeWidth="1" />
        </g>
      ) : (
        <path d={sh.roots} fill={ghost ? 'none' : `url(#${g('root')})`} stroke={ghost ? '#b5ae9f' : '#9c9484'} strokeWidth="1.3" strokeDasharray={ghost ? '3 3' : undefined} />
      )}
      {/* Conductos */}
      {state === 'conducto' && (
        <g>
          <ellipse cx={sh.cx} cy="31" rx="7" ry="4.5" fill="#f3b38a" stroke="#c96f33" strokeWidth=".8" />
          {sh.canals.map((d, i) => <path key={i} d={d} stroke="#d9822b" strokeWidth="2.6" strokeLinecap="round" fill="none" />)}
        </g>
      )}
      {/* Corona */}
      <path d={sh.crown} fill={ghost ? 'none' : crownFill} stroke={ghost ? '#b5ae9f' : state === 'corona_oro' ? '#7a5a12' : '#9c9484'} strokeWidth="1.4" strokeDasharray={ghost ? '3 3' : undefined} />
      {!ghost && state !== 'corona_oro' && <path d={sh.cusp} fill="#ffffff" opacity=".55" />}
      {!ghost && <ellipse cx="22" cy="20" rx="5" ry="8" fill="#ffffff" opacity={state === 'corona_oro' ? 0.45 : 0.5} transform="rotate(-18 22 20)" />}
      {/* Margen de corona */}
      {(state === 'corona_oro' || state === 'corona_porcelana' || implant) && <path d="M9 41 C20 46 40 46 51 41" stroke={state === 'corona_oro' ? '#6e4f0e' : '#a9b8bf'} strokeWidth="1.6" fill="none" />}
      {state === 'corona_oro' && <path d="M38 12 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 z" fill="#fff8dc" />}
      {/* Caries */}
      {state === 'caries' && (
        <g>
          <path d="M21 17 c3 -4 9 -2 9 3 c1 6 -6 8 -9 5 c-3 -2 -3 -5 0 -8 z" fill="#a8784a" opacity=".55" />
          <path d="M22.5 18.5 c2 -2.5 6 -1.5 6 2 c0.5 4 -4 5 -6 3.5 c-2 -1.5 -2 -3.5 0 -5.5 z" fill="#5b3a1e" />
          <path d="M35 28 c2 -2 5.5 -1 5 2 c-0.5 3 -4 3.5 -5 1.5 c-0.6 -1.2 -0.6 -2.5 0 -3.5 z" fill="#6b4423" />
        </g>
      )}
      {/* Restauraciones */}
      {(state === 'resina' || state === 'conducto') && <path d="M20 15 C26 11 36 12 40 17 C42 23 38 29 30 30 C22 30 18 23 20 15 Z" fill="#f8f2e4" stroke="#cdbb95" strokeWidth="1" strokeDasharray="2 1.5" />}
      {state === 'amalgama' && <path d="M20 15 C26 11 36 12 40 17 C42 23 38 29 30 30 C22 30 18 23 20 15 Z" fill={`url(#${g('silver')})`} stroke="#6e777c" strokeWidth="1" />}
      {/* Sellador */}
      {state === 'sellador' && <path d={sh.cusp} fill="#7fb3cf" opacity=".55" stroke="#4f8aa8" strokeWidth="1" />}
      {/* Fractura */}
      {state === 'fractura' && <path d="M17 7 L25 19 L21 25 L31 34 L27 42" stroke="#4a3b2e" strokeWidth="1.8" fill="none" strokeLinejoin="round" />}
      {/* Bracket */}
      {state === 'bracket' && (
        <g>
          <path d="M-4 25 L64 25" stroke="#8f979c" strokeWidth="1.8" />
          <rect x="22" y="19" width="16" height="12" rx="2.5" fill={`url(#${g('steel')})`} stroke="#5f686d" strokeWidth="1" />
          <path d="M22 25 L38 25" stroke="#5f686d" strokeWidth="1.2" />
          <circle cx="30" cy="25" r="2.4" fill="#245e59" opacity=".9" />
        </g>
      )}
      {/* Extracción indicada */}
      {state === 'extraccion' && <path d="M16 12 L44 40 M44 12 L16 40" stroke="#8a5700" strokeWidth="3" strokeLinecap="round" />}
    </g>
  );
  return (
    <svg className={`tooth-art ${className}`} width={width} height={height} viewBox="-4 -4 68 108" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} focusable="false">
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={g('enamel')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#efe8da" /></linearGradient>
        <linearGradient id={g('root')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3e6ca" /><stop offset="1" stopColor="#e2cfa8" /></linearGradient>
        <linearGradient id={g('gold')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a6514" /><stop offset=".32" stopColor="#e2b84a" /><stop offset=".5" stopColor="#fbe8a6" /><stop offset=".7" stopColor="#c8952c" /><stop offset="1" stopColor="#7a5a12" /></linearGradient>
        <linearGradient id={g('porc')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#f2f7f9" /><stop offset="1" stopColor="#dfe9ee" /></linearGradient>
        <linearGradient id={g('silver')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8e989e" /><stop offset=".5" stopColor="#d5dbde" /><stop offset="1" stopColor="#7d878d" /></linearGradient>
        <linearGradient id={g('ti')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7d868c" /><stop offset=".45" stopColor="#d3d9dc" /><stop offset="1" stopColor="#7f888e" /></linearGradient>
        <linearGradient id={g('steel')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9edef" /><stop offset="1" stopColor="#9aa3a8" /></linearGradient>
      </defs>
      {inner}
      {planned && <rect x="-2" y="-2" width="64" height="104" rx="10" fill="none" stroke="#2d5770" strokeWidth="2" strokeDasharray="5 4" />}
    </svg>
  );
}

/** Sonrisa de muestra (frente superior) para composiciones de marca: coronas grandes, raíces bajo la encía. */
export function SmileArt({ width = 320, gold = true }: { width?: number; gold?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const teeth: { kind: ToothKind; w: number; dy: number }[] = [
    { kind: 'canino', w: 92, dy: 10 }, { kind: 'incisivo', w: 96, dy: 4 }, { kind: 'incisivo', w: 108, dy: 0 },
    { kind: 'incisivo', w: 108, dy: 0 }, { kind: 'incisivo', w: 96, dy: 4 }, { kind: 'canino', w: 92, dy: 10 },
  ];
  const xs = [8, 58, 110, 166, 222, 270];
  return (
    <svg width={width} height={(width * 190) / 380} viewBox="0 0 380 190" aria-hidden="true" focusable="false" className="smile-art">
      <defs>
        <linearGradient id={`gum-${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#efb3ad" /><stop offset="1" stopColor="#dc8f89" /></linearGradient>
      </defs>
      {teeth.map((t, i) => (
        <g key={i} transform={`translate(${xs[i]} ${-26 + t.dy})`}>
          <ToothArt kind={t.kind} state={gold && i === 4 ? 'corona_oro' : 'sano'} flip width={t.w} />
        </g>
      ))}
      <path d="M0 44 C110 2 270 2 380 44 V92 C330 70 290 86 250 78 C210 70 170 70 130 78 C90 86 50 70 0 92 Z" fill={`url(#gum-${uid})`} />
      <path d="M0 92 C50 70 90 86 130 78 C170 70 210 70 250 78 C290 86 330 70 380 92" stroke="#c97a74" strokeWidth="2" fill="none" />
    </svg>
  );
}
