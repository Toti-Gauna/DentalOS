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

interface Shape { crown: string; roots: string; cusp: string; cej: string; grooves: string[]; chamber: string; canals: string[]; incisal: boolean }
// Siluetas por tipo (vista vestibular, corona arriba). La unión amelo-cementaria queda cerca de y=41.
const SHAPES: Record<ToothKind, Shape> = {
  molar: {
    crown: 'M8 41 C5.5 31 6 20 9.5 13 C11.5 8.5 15.5 7 19 9.5 C21 11 22.5 11.5 24 9.5 C26.5 6 33.5 6 36 9.5 C37.5 11.5 39 11 41 9.5 C44.5 7 48.5 8.5 50.5 13 C54 20 54.5 31 52 41 C46 46 14 46 8 41 Z',
    roots: 'M11 39 C9.5 55 11 74 15.5 89 C17.5 95.5 23 95.5 24.5 89 C25.8 76 27 62 30 52 C33 62 34.2 76 35.5 89 C37 95.5 42.5 95.5 44.5 89 C49 74 50.5 55 49 39 Z',
    cusp: 'M9.5 15 C11.5 9.5 16 8 19.5 10.5 C22 12.5 23 12 24.5 10.5 C27 7.2 33 7.2 35.5 10.5 C37 12 38 12.5 40.5 10.5 C44 8 48.5 9.5 50.5 15 C44 18.5 16 18.5 9.5 15 Z',
    cej: 'M9.5 41.5 C20 46.5 40 46.5 50.5 41.5',
    grooves: ['M24 10.5 C24.8 16 24.8 21.5 23.6 27', 'M36 10.5 C35.2 16 35.2 21.5 36.4 27'],
    chamber: 'M20 26 C20 21.5 40 21.5 40 26 C40 31.5 36 33 30 33 C24 33 20 31.5 20 26 Z',
    canals: ['M22.5 31 C21 50 19 70 20 89', 'M37.5 31 C39 50 41 70 40 89'], incisal: false,
  },
  premolar: {
    crown: 'M12 41 C10 31 10.5 21 14 14.5 C16.5 10 21 7.5 26 6 C28.5 5.2 31.5 5.2 34 6 C39 7.5 43.5 10 46 14.5 C49.5 21 50 31 48 41 C42 46 18 46 12 41 Z',
    roots: 'M17 39 C15.5 58 18 79 25 93 C27.5 98 32.5 98 35 93 C42 79 44.5 58 43 39 Z',
    cusp: 'M14.5 16 C17 11 21.5 8.5 26 7.2 C28.5 6.5 31.5 6.5 34 7.2 C38.5 8.5 43 11 45.5 16 C38 19.5 22 19.5 14.5 16 Z',
    cej: 'M13.5 41.5 C22 46 38 46 46.5 41.5',
    grooves: ['M22 10.5 C21 18 21 25 22 31', 'M38 10.5 C39 18 39 25 38 31'],
    chamber: 'M25 24 C25 20 35 20 35 24 C35 28.5 32.5 30 30 30 C27.5 30 25 28.5 25 24 Z',
    canals: ['M30 29 C30 53 30 76 30 93'], incisal: false,
  },
  canino: {
    crown: 'M14 41 C12 31 14 19 20 12 C23.5 8 27 4.5 30 2.5 C33 4.5 36.5 8 40 12 C46 19 48 31 46 41 C40 46 20 46 14 41 Z',
    roots: 'M20 39 C18 61 21.5 85 28 97 C29.3 99.5 30.7 99.5 32 97 C38.5 85 42 61 40 39 Z',
    cusp: 'M19 15.5 C23 10.5 27 6.8 30 5 C33 6.8 37 10.5 41 15.5 C35 18.5 25 18.5 19 15.5 Z',
    cej: 'M15.5 41.5 C23 46 37 46 44.5 41.5',
    grooves: ['M24.5 11 C23.5 19 23.5 26 24.5 32', 'M35.5 11 C36.5 19 36.5 26 35.5 32'],
    chamber: 'M26.5 22 C26.5 17.5 33.5 17.5 33.5 22 C33.5 26.5 32 28 30 28 C28 28 26.5 26.5 26.5 22 Z',
    canals: ['M30 27 C30 54 30 80 30 95'], incisal: true,
  },
  incisivo: {
    crown: 'M15 41 C13.8 31 13.8 19 14.6 10 C15 6 17.5 4.2 23 4 C26 3.9 34 3.9 37 4 C42.5 4.2 45 6 45.4 10 C46.2 19 46.2 31 45 41 C39 46 21 46 15 41 Z',
    roots: 'M21 39 C19 60 22 82 27 95 C28.2 98 31.8 98 33 95 C38 82 41 60 39 39 Z',
    cusp: 'M16 8.5 C17 5.8 20 5 24 4.9 C28 4.8 32 4.8 36 4.9 C40 5 43 5.8 44 8.5 C38 11.5 22 11.5 16 8.5 Z',
    cej: 'M16.5 41.5 C24 46 36 46 43.5 41.5',
    grooves: ['M24.5 5 C24.8 7.5 25 9.5 24.8 12', 'M35.5 5 C35.2 7.5 35 9.5 35.2 12'],
    chamber: 'M26.5 21 C26.5 17 33.5 17 33.5 21 C33.5 25.5 32 27 30 27 C28 27 26.5 25.5 26.5 21 Z',
    canals: ['M30 26 C30 54 30 80 30 94'], incisal: true,
  },
};
const RESTORATION = 'M19 13 C23 10.5 27 12 30 11 C33 12 37 10.5 41 13 C43 18 40 24 34.5 25.5 C31 26.5 28 26.5 25 25.5 C20 24 17.5 18 19 13 Z';
const CHIP = 'M-10 -10 H70 V110 H-10 Z M12 1.5 L27.5 1.5 L24.5 8 L19 11.5 L12 13.5 Z';

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

/**
 * Pieza ilustrada con luz única arriba a la izquierda: esmalte en capas (cuerpo, cervical cálido, borde incisal
 * translúcido), brillo especular desenfocado, luz de borde y sombra de contacto. Cada estado tiene su material.
 */
export function ToothArt({ kind, state = 'sano', flip = false, temporal = false, planned = false, width = 40, title, className = '' }: ToothArtProps) {
  const uid = useId().replace(/:/g, '');
  const g = (n: string) => `${n}-${uid}`;
  const u = (n: string) => `url(#${g(n)})`;
  const sh = SHAPES[kind];
  const ghost = state === 'ausente';
  const implant = state === 'implante';
  const gold = state === 'corona_oro';
  const porcelain = state === 'corona_porcelana' || implant;
  const canal = state === 'conducto';
  const crownFill = gold ? u('gold') : porcelain ? u('porc') : u(temporal ? 'milk' : 'enamel');
  const height = (width * 100) / 60;

  const crownLayers = !ghost && (
    <g clipPath={u('crownclip')}>
      {!gold && <rect x="0" y="22" width="60" height="26" fill={u('cervical')} />}
      {sh.incisal && !gold && !porcelain && <rect x="0" y="0" width="60" height="16" fill={u('incisal')} />}
      {porcelain && <rect x="0" y="0" width="60" height="48" fill={u('iris')} />}
      {gold && <path d="M4 31 C18 22 38 19 56 23 L56 29 C38 25 20 27 4 37 Z" fill="#fff6d8" opacity=".32" />}
      {!gold && !porcelain && sh.grooves.map((d, i) => <path key={i} d={d} stroke="#b9a684" strokeWidth=".9" strokeLinecap="round" fill="none" opacity=".45" />)}
      {!gold && <path d={sh.cusp} fill="#ffffff" opacity={porcelain ? 0.5 : 0.42} />}
      <ellipse cx="21" cy="18" rx="4.4" ry="10" fill={gold ? '#fff3c4' : '#ffffff'} opacity=".9" transform="rotate(-14 21 18)" filter={u('soft')} />
      <ellipse cx="19.4" cy="12.5" rx="1.3" ry="2.6" fill="#ffffff" opacity=".95" transform="rotate(-14 19.4 12.5)" />
      <path d={sh.crown} fill="none" stroke="#ffffff" strokeWidth="2" opacity={gold ? 0.35 : 0.6} />
    </g>
  );

  const body = (
    <g opacity={state === 'extraccion' ? 0.72 : canal ? 0.8 : 1}>
      {implant ? (
        <g>
          <path d="M25 40.5 L35 40.5 L34 48 L26 48 Z" fill={u('ti')} stroke="#4f585d" strokeWidth=".9" />
          <path d="M24.5 48 L35.5 48 L35 84 C34.6 90 32.5 93.5 30 93.5 C27.5 93.5 25.4 90 25 84 Z" fill={u('ti')} stroke="#4f585d" strokeWidth="1" />
          {[51, 55.2, 59.4, 63.6, 67.8, 72, 76.2, 80.4, 84.6].map((y) => (
            <g key={y}>
              <path d={`M24.6 ${y} L22.6 ${y + 1.2} L24.7 ${y + 2.4} M35.4 ${y + 1} L37.4 ${y + 2.2} L35.3 ${y + 3.4}`} fill="#aeb7bc" stroke="#4f585d" strokeWidth=".7" strokeLinejoin="round" />
              <path d={`M24.8 ${y} L35.2 ${y + 2.2}`} stroke="#4f585d" strokeWidth="1.1" />
              <path d={`M25 ${y + 0.9} L35 ${y + 3.1}`} stroke="#f4f7f8" strokeWidth=".55" opacity=".85" />
            </g>
          ))}
          <path d="M27.5 50 L27 86" stroke="#ffffff" strokeWidth="1" opacity=".55" strokeLinecap="round" />
        </g>
      ) : ghost ? (
        <path d={sh.roots} fill="#efeae0" fillOpacity=".35" stroke="#b5ae9f" strokeWidth="1.2" strokeDasharray="3 3" />
      ) : (
        <g>
          <path d={sh.roots} fill={u('root')} stroke="#a89878" strokeWidth="1" />
          <path d={sh.roots} fill={u('apex')} />
          <path d="M33 46 C34 60 34.5 74 35 86" stroke="#ffffff" strokeWidth="1.1" opacity=".35" fill="none" strokeLinecap="round" />
          <g clipPath={u('rootclip')}><path d={sh.cej} transform="translate(0 1.2)" stroke="#8c693c" strokeWidth="2.8" opacity=".3" fill="none" filter={u('soft')} /></g>
        </g>
      )}
      {canal && (
        <g>
          <path d={sh.chamber} fill={u('pulp')} stroke="#9c3b22" strokeWidth=".7" />
          {sh.canals.map((d, i) => (
            <g key={i}>
              <path d={d} stroke="#a8432a" strokeWidth="2.8" strokeLinecap="round" fill="none" />
              <path d={d} stroke="#f2a07c" strokeWidth=".9" strokeLinecap="round" fill="none" opacity=".9" />
            </g>
          ))}
        </g>
      )}
      <g clipPath={state === 'fractura' ? u('chip') : undefined}>
        <path d={sh.crown} fill={ghost ? '#efeae0' : crownFill} fillOpacity={ghost ? 0.35 : canal ? 0.88 : 1} />
        {crownLayers}
        <path d={sh.crown} fill="none" stroke={ghost ? '#b5ae9f' : gold ? '#6e4f0e' : porcelain ? '#9fb3bd' : '#a99d86'} strokeWidth={ghost ? 1.2 : 1} strokeDasharray={ghost ? '3 3' : undefined} />
      </g>
      {(gold || porcelain) && <path d={sh.cej} stroke={gold ? '#5c430d' : '#93a8b2'} strokeWidth="1.3" fill="none" />}
      {gold && <path d="M39.5 10.5 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3 z" fill="#fffbe8" />}
    </g>
  );

  return (
    <svg className={`tooth-art ${className}`} width={width} height={height} viewBox="-4 -4 68 108" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} focusable="false">
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={g('crownclip')}><path d={sh.crown} /></clipPath>
        <clipPath id={g('rootclip')}><path d={sh.roots} /></clipPath>
        <clipPath id={g('chip')}><path d={CHIP} clipRule="evenodd" /></clipPath>
        <filter id={g('soft')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.5" /></filter>
        <filter id={g('drop')} x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="1.3" stdDeviation="1.2" floodColor="#173c3a" floodOpacity=".22" /></filter>
        <radialGradient id={g('enamel')} cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#ffffff" /><stop offset=".45" stopColor="#fbf8f1" /><stop offset=".8" stopColor="#efe6d4" /><stop offset="1" stopColor="#e2d5bc" /></radialGradient>
        <radialGradient id={g('milk')} cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#fbfbf8" /><stop offset=".85" stopColor="#eeebe2" /><stop offset="1" stopColor="#e1dccf" /></radialGradient>
        <linearGradient id={g('cervical')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d6b480" stopOpacity="0" /><stop offset="1" stopColor="#d6b480" stopOpacity=".42" /></linearGradient>
        <linearGradient id={g('incisal')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#96bedb" stopOpacity=".55" /><stop offset="1" stopColor="#96bedb" stopOpacity="0" /></linearGradient>
        <linearGradient id={g('iris')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd6e6" stopOpacity=".22" /><stop offset=".5" stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#bedcff" stopOpacity=".28" /></linearGradient>
        <linearGradient id={g('root')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#d8c094" /><stop offset=".38" stopColor="#f2e2bf" /><stop offset=".55" stopColor="#f5e7c8" /><stop offset="1" stopColor="#d1b687" /></linearGradient>
        <linearGradient id={g('apex')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b28c56" stopOpacity="0" /><stop offset="1" stopColor="#b28c56" stopOpacity=".38" /></linearGradient>
        <linearGradient id={g('gold')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6f4f0f" /><stop offset=".18" stopColor="#b8862b" /><stop offset=".38" stopColor="#f3d98a" /><stop offset=".5" stopColor="#fff3c4" /><stop offset=".62" stopColor="#d9a842" /><stop offset=".82" stopColor="#8a6514" /><stop offset="1" stopColor="#5c430d" /></linearGradient>
        <radialGradient id={g('porc')} cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#f6f9fa" /><stop offset=".85" stopColor="#e4edf1" /><stop offset="1" stopColor="#d3e0e6" /></radialGradient>
        <linearGradient id={g('silver')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5f686d" /><stop offset=".3" stopColor="#b9c1c5" /><stop offset=".5" stopColor="#eef1f2" /><stop offset=".7" stopColor="#9aa3a8" /><stop offset="1" stopColor="#5a6267" /></linearGradient>
        <radialGradient id={g('resin')} cx=".35" cy=".3" r=".9"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#efe3c8" /></radialGradient>
        <linearGradient id={g('ti')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6d767c" /><stop offset=".35" stopColor="#c9d0d4" /><stop offset=".5" stopColor="#eef2f4" /><stop offset=".7" stopColor="#a6afb4" /><stop offset="1" stopColor="#687177" /></linearGradient>
        <linearGradient id={g('steel')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f6f7" /><stop offset=".45" stopColor="#c4cbcf" /><stop offset="1" stopColor="#808a90" /></linearGradient>
        <radialGradient id={g('pulp')} cx=".5" cy=".4" r=".7"><stop offset="0" stopColor="#f3a07c" /><stop offset="1" stopColor="#b9452a" /></radialGradient>
        <radialGradient id={g('lesion')} cx=".48" cy=".5" r=".55"><stop offset="0" stopColor="#24130a" /><stop offset=".35" stopColor="#4f2f17" /><stop offset=".6" stopColor="#8f5d2e" /><stop offset=".82" stopColor="#d2b07a" stopOpacity=".85" /><stop offset="1" stopColor="#efe2c4" stopOpacity="0" /></radialGradient>
      </defs>
      <g transform={`${flip ? 'translate(0 100) scale(1 -1)' : ''} ${temporal ? 'translate(5.4 9) scale(0.82)' : ''}`}>
        <g filter={ghost ? undefined : u('drop')}>{body}</g>
        {/* Restauraciones y hallazgos sobre la corona */}
        {state === 'resina' && (
          <g>
            <path d={RESTORATION} fill={u('resin')} stroke="#c8b184" strokeWidth=".8" />
            <ellipse cx="25" cy="15" rx="2.6" ry="1.3" fill="#ffffff" opacity=".85" />
          </g>
        )}
        {canal && <path d={RESTORATION} transform="translate(6 3) scale(.8)" fill={u('resin')} stroke="#c8b184" strokeWidth=".9" />}
        {state === 'amalgama' && (
          <g>
            <path d={RESTORATION} fill="none" stroke="#3c4246" strokeOpacity=".3" strokeWidth="2.2" />
            <path d={RESTORATION} fill={u('silver')} stroke="#454c51" strokeWidth=".9" />
            <path d="M22 15 C26 13 33 13.5 38 15.5" stroke="#ffffff" strokeWidth="1.2" opacity=".75" fill="none" strokeLinecap="round" />
            <ellipse cx="34" cy="20" rx="1.6" ry=".9" fill="#ffffff" opacity=".7" />
          </g>
        )}
        {state === 'caries' && (
          <g clipPath={u('crownclip')}>
            <path d={sh.crown} fill="#c4a060" opacity=".14" />
            <path d="M16.5 13.5 C19.5 8.5 28.5 8 33 12.5 C36.8 16.4 35 25 29.5 27 C24 29 17.5 26.5 16.3 21 C15.9 18.3 15.7 15.6 16.5 13.5 Z" fill={u('lesion')} />
            <path d="M22 15.3 C24.2 12.6 28.8 13.4 29.8 16.6 C30.8 20 28.1 22.9 25 22.6 C21.8 22.3 20.3 18.3 22 15.3 Z" fill="#26140a" />
            <path d="M24.2 16 L26.2 18.6 L25.4 20.6" stroke="#6b4423" strokeWidth=".7" fill="none" />
            <path d="M36.5 31 C38.4 29.4 41.6 30.2 41.4 32.8 C41.2 35.2 38 35.8 36.8 34.2 C36 33.2 35.9 31.9 36.5 31 Z" fill="#6b4423" opacity=".85" />
          </g>
        )}
        {state === 'sellador' && (
          <g>
            <path d={sh.cusp} fill="#7ebad6" opacity=".5" stroke="#4f8aa8" strokeWidth=".8" />
            <path d="M18 12.5 C24 10 36 10 42 12.5" stroke="#ffffff" strokeWidth="1" opacity=".8" fill="none" strokeLinecap="round" />
          </g>
        )}
        {state === 'fractura' && (
          <g>
            <path d="M19 11.5 L24.5 8 L25.6 10.2 L20.6 13.4 Z" fill="#e6cf9f" />
            <path d="M25.3 8.6 L28.2 15 L25.6 20.4 L30 27 L28 34" stroke="#ffffff" strokeWidth="1.2" fill="none" strokeLinejoin="round" opacity=".7" transform="translate(.8 0)" />
            <path d="M24.5 8 L27.5 15 L25 20.5 L29.5 27 L27.5 34" stroke="#3e3126" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
          </g>
        )}
        {state === 'bracket' && (
          <g>
            <path d="M-4 24 L64 24" stroke="#99a2a7" strokeWidth="1.7" />
            <path d="M-4 23.4 L64 23.4" stroke="#f1f4f5" strokeWidth=".5" />
            <rect x="21" y="17.5" width="18" height="13" rx="2" fill={u('steel')} stroke="#5f686d" strokeWidth=".8" />
            {[[20, 15.2], [34, 15.2], [20, 28.6], [34, 28.6]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="6" height="4.2" rx="1.6" fill={u('steel')} stroke="#5f686d" strokeWidth=".7" />)}
            <rect x="21" y="22.6" width="18" height="2.8" fill="#59636a" />
            <path d="M-4 24 L64 24" stroke="#8f989d" strokeWidth="1.2" />
            <rect x="19" y="15.8" width="22" height="16.6" rx="6" fill="none" stroke="#2f8f86" strokeWidth="1.6" />
            <ellipse cx="25" cy="19.5" rx="1.6" ry=".8" fill="#ffffff" opacity=".9" />
          </g>
        )}
        {state === 'extraccion' && (
          <g strokeLinecap="round">
            <path d="M16 12 L44 40 M44 12 L16 40" stroke="#ffffff" strokeWidth="6" />
            <path d="M16 12 L44 40 M44 12 L16 40" stroke="#a33131" strokeWidth="3.2" />
          </g>
        )}
      </g>
      {planned && <rect x="-2" y="-2" width="64" height="104" rx="10" fill="none" stroke="#2d5770" strokeWidth="2" strokeDasharray="5 4" />}
    </svg>
  );
}
