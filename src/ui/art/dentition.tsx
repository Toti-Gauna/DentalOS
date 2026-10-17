// Arte dental v4: pieza en vista oclusal (desde arriba), geometría de arcadas en U y dentadura frontal completa.
// Todo SVG propio, sin assets externos. Luz única arriba a la izquierda; los colores de encía siguen al tema.
import { useId } from 'react';
import { kindFor, type ToothArtState, type ToothKind } from './teeth';
import type { Appliance } from './ortho';

export type SurfaceKey = 'V' | 'L' | 'M' | 'D' | 'O' | 'I';
export type SurfaceMarks = Partial<Record<SurfaceKey | 'pieza', 'realizado' | 'planificado'>>;

/** Medio ancho (mesiodistal) y medio fondo (vestíbulo-lingual) de cada tipo en vista oclusal. */
const BOX: Record<ToothKind, { hw: number; hd: number }> = {
  molar: { hw: 24, hd: 24 },
  premolar: { hw: 17, hd: 20 },
  canino: { hw: 16, hd: 18 },
  incisivo: { hw: 18, hd: 13 },
};

// Contornos oclusales: -y = vestibular (afuera de la arcada), +y = lingual/palatino, +x = mesial (hacia la línea media).
const OUTLINE: Record<ToothKind, string> = {
  molar: 'M-21 -13 C-22 -21 -14 -23 -6 -22 C0 -24 8 -23 14 -21 C21 -19 23 -11 22 -3 C23 5 22 13 17 18 C11 23 2 23 -6 22 C-14 23 -20 19 -22 11 C-24 3 -23 -6 -21 -13 Z',
  premolar: 'M-15 -9 C-15 -17 -8 -19 0 -19 C8 -19 15 -17 15 -9 L15 9 C15 17 8 19 0 19 C-8 19 -15 17 -15 9 Z',
  canino: 'M0 -17 C8 -15 14 -8 14 0 C14 8 8 15 0 16 C-8 15 -14 8 -14 0 C-14 -8 -8 -15 0 -17 Z',
  incisivo: 'M-17 -5 C-17 -10 -10 -11 0 -11 C10 -11 17 -10 17 -5 C16 2 9 10 0 11 C-9 10 -16 2 -17 -5 Z',
};
const CUSPS: Record<ToothKind, [number, number, number, number][]> = {
  molar: [[-9, -9, 9, 8], [9, -9, 9, 8], [-9, 9, 9, 8], [9, 9, 9, 8]],
  premolar: [[0, -8, 11, 8], [0, 9, 10, 7]],
  canino: [[0, -4, 10, 9]],
  incisivo: [[0, -4, 14, 5]],
};
const FISSURES: Record<ToothKind, string[]> = {
  molar: ['M-15 0 C-9 -2 -4 2 0 0 C4 -2 9 2 15 0', 'M0 0 C1 -6 -1 -12 0 -19', 'M1 0 C0 6 2 12 1 18', 'M-15 0 C-17 -3 -18 -6 -18 -9', 'M15 0 C17 3 18 6 17 9'],
  premolar: ['M-11 0 C-5 -2 5 2 11 0', 'M-11 0 C-12 -3 -12 -5 -11 -7', 'M11 0 C12 3 12 5 11 7'],
  canino: ['M0 -13 L0 3', 'M0 -6 C-5 -3 -8 1 -10 4', 'M0 -6 C5 -3 8 1 10 4'],
  incisivo: ['M-13 -7 C-5 -9 5 -9 13 -7'],
};
const RESTO: Record<ToothKind, string> = {
  molar: 'M-13 -3 C-9 -6 -4 -2 0 -5 C4 -2 9 -6 13 -3 C14 2 9 6 4 4 C1 7 -2 7 -4 4 C-9 6 -14 2 -13 -3 Z',
  premolar: 'M-9 -3 C-4 -5 4 -5 9 -3 C10 2 5 4 0 4 C-5 4 -10 2 -9 -3 Z',
  canino: 'M-4 -9 C0 -11 4 -9 4 -4 C4 1 2 4 0 4 C-2 4 -4 1 -4 -4 Z',
  incisivo: 'M-9 -2 C-4 -4 4 -4 9 -2 C8 3 4 5 0 5 C-4 5 -8 3 -9 -2 Z',
};

/** Regiones de las cinco superficies, recortadas luego por el contorno. Centro: oclusal (posteriores) o incisal (anteriores). */
function surfacePaths(kind: ToothKind): Record<'V' | 'L' | 'M' | 'D' | 'C', string> {
  const { hw, hd } = BOX[kind];
  const rx = hw * 0.42; const ry = hd * 0.4;
  const W = hw + 2; const D = hd + 2;
  return {
    V: `M${-W} ${-D} H${W} L${rx} ${-ry} H${-rx} Z`,
    L: `M${-W} ${D} H${W} L${rx} ${ry} H${-rx} Z`,
    M: `M${W} ${-D} V${D} L${rx} ${ry} V${-ry} Z`,
    D: `M${-W} ${-D} V${D} L${-rx} ${ry} V${-ry} Z`,
    C: kind === 'incisivo' ? `M${-rx * 1.7} ${-hd * 0.95} H${rx * 1.7} V${-hd * 0.2} H${-rx * 1.7} Z` : `M${-rx} 0 A${rx} ${ry} 0 1 0 ${rx} 0 A${rx} ${ry} 0 1 0 ${-rx} 0 Z`,
  };
}

export interface OcclusalProps {
  kind: ToothKind;
  state?: ToothArtState;
  temporal?: boolean;
  marks?: SurfaceMarks;
  className?: string;
  /** Superficie resaltada (selección actual en el panel de detalle). */
  focus?: SurfaceKey | 'pieza' | null;
}

/** Pieza vista desde oclusal con su material y, si corresponde, superficies marcadas (realizado / planificado). */
export function OcclusalTooth({ kind, state = 'sano', temporal = false, marks = {}, className = '', focus = null }: OcclusalProps) {
  const uid = useId().replace(/:/g, '');
  const g = (n: string) => `${n}-${uid}`;
  const u = (n: string) => `url(#${g(n)})`;
  const { hw, hd } = BOX[kind];
  const ghost = state === 'ausente';
  const gold = state === 'corona_oro';
  const porc = state === 'corona_porcelana' || state === 'implante';
  const base = gold ? u('gold') : porc ? u('porc') : u(temporal ? 'milk' : 'enamel');
  const sp = surfacePaths(kind);
  const region = (k: SurfaceKey) => (k === 'O' || k === 'I' ? sp.C : sp[k as 'V' | 'L' | 'M' | 'D']);
  const wholeMark = marks.pieza;
  const surfaces = (['V', 'L', 'M', 'D', 'O', 'I'] as SurfaceKey[]).filter((k) => marks[k]);

  return (
    <svg className={`occlusal ${className}`} viewBox={`${-hw - 3} ${-hd - 3} ${(hw + 3) * 2} ${(hd + 3) * 2}`} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={g('clip')}><path d={OUTLINE[kind]} /></clipPath>
        <radialGradient id={g('enamel')} cx=".38" cy=".34" r=".8"><stop offset="0" stopColor="#fffdf8" /><stop offset=".55" stopColor="#f6efe2" /><stop offset="1" stopColor="#e2d5bb" /></radialGradient>
        <radialGradient id={g('milk')} cx=".38" cy=".34" r=".8"><stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#f8f6f1" /><stop offset="1" stopColor="#e6e1d6" /></radialGradient>
        <radialGradient id={g('porc')} cx=".38" cy=".34" r=".8"><stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#f1f6f8" /><stop offset="1" stopColor="#d3e0e6" /></radialGradient>
        <linearGradient id={g('gold')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6f4f0f" /><stop offset=".22" stopColor="#c8952c" /><stop offset=".45" stopColor="#fbe7a6" /><stop offset=".6" stopColor="#d9a842" /><stop offset="1" stopColor="#5c430d" /></linearGradient>
        <radialGradient id={g('bulge')} cx=".4" cy=".35" r=".6"><stop offset="0" stopColor="#ffffff" stopOpacity=".95" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
        <radialGradient id={g('bulgeGold')} cx=".4" cy=".35" r=".6"><stop offset="0" stopColor="#fff3c4" stopOpacity=".9" /><stop offset="1" stopColor="#fff3c4" stopOpacity="0" /></radialGradient>
        <linearGradient id={g('silver')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5f686d" /><stop offset=".35" stopColor="#c3cacd" /><stop offset=".5" stopColor="#f2f4f5" /><stop offset=".7" stopColor="#9aa3a8" /><stop offset="1" stopColor="#555d62" /></linearGradient>
        <radialGradient id={g('lesion')} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#24130a" /><stop offset=".45" stopColor="#5b3a1e" /><stop offset=".75" stopColor="#a8784a" stopOpacity=".8" /><stop offset="1" stopColor="#e8d6b0" stopOpacity="0" /></radialGradient>
        <pattern id={g('hatch')} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#d7e6ef" /><path d="M0 0 V4" stroke="#2d5770" strokeWidth="1.6" /></pattern>
        <filter id={g('drop')} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.1" floodColor="#173c3a" floodOpacity=".25" /></filter>
        <filter id={g('soft')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2" /></filter>
      </defs>
      <g transform={temporal ? 'scale(.86)' : undefined}>
        {ghost ? (
          <path d={OUTLINE[kind]} fill="var(--surface-2)" fillOpacity=".5" stroke="#a89f90" strokeWidth="1.2" strokeDasharray="3 2.5" />
        ) : (
          <g filter={u('drop')}>
            <path d={OUTLINE[kind]} fill={base} />
            <g clipPath={u('clip')}>
              {CUSPS[kind].map(([x, y, rx, ry], i) => <ellipse key={i} cx={x - 1} cy={y - 1} rx={rx} ry={ry} fill={gold ? u('bulgeGold') : u('bulge')} opacity={porc ? 0.9 : 0.75} />)}
              {FISSURES[kind].map((d, i) => (
                <g key={i}>
                  <path d={d} transform="translate(.6 .6)" stroke="#ffffff" strokeOpacity={gold ? 0.35 : 0.6} strokeWidth="1.2" fill="none" strokeLinecap="round" />
                  <path d={d} stroke={gold ? '#6e4f0e' : porc ? '#b9c7ce' : '#a28c68'} strokeOpacity={porc ? 0.8 : 0.75} strokeWidth={kind === 'incisivo' ? 1.1 : 1.5} fill="none" strokeLinecap="round" />
                </g>
              ))}
              {state === 'caries' && (
                <g>
                  <ellipse cx="-3" cy="-1" rx={kind === 'incisivo' ? 6 : 8} ry={kind === 'incisivo' ? 4 : 7} fill={u('lesion')} />
                  <path d="M-6 -2 C-5 -5 -1 -5 0 -2 C1 1 -2 3 -4 2 C-6 1 -7 0 -6 -2 Z" fill="#24130a" />
                  {kind === 'molar' && <ellipse cx="9" cy="8" rx="3" ry="2.4" fill="#6b4423" opacity=".85" />}
                </g>
              )}
              {(state === 'resina' || state === 'conducto') && <path d={RESTO[kind]} transform={state === 'conducto' ? 'scale(.7)' : undefined} fill="#fbf5e8" stroke="#c9b38a" strokeWidth=".8" />}
              {state === 'conducto' && <circle cx="0" cy="0" r="1.6" fill="#c4552f" opacity=".75" />}
              {state === 'amalgama' && (
                <g>
                  <path d={RESTO[kind]} fill={u('silver')} stroke="#3e464b" strokeWidth=".9" />
                  <path d={RESTO[kind]} fill="none" stroke="#ffffff" strokeOpacity=".5" strokeWidth=".6" transform="translate(-.5 -.6) scale(.92)" />
                </g>
              )}
              {state === 'sellador' && FISSURES[kind].map((d, i) => <path key={i} d={d} stroke="#6fb2d3" strokeOpacity=".75" strokeWidth="3.4" fill="none" strokeLinecap="round" />)}
              {state === 'implante' && <g><circle cx="0" cy="0" r={kind === 'incisivo' ? 2.4 : 3.6} fill="#c3cacd" stroke="#59636a" strokeWidth=".9" /><circle cx="0" cy="0" r="1.2" fill="#59636a" /></g>}
              {state === 'fractura' && <path d={`M${-hw} ${-hd * 0.2} L${-hw * 0.4} ${-hd * 0.35} L${-hw * 0.1} ${hd * 0.1} L${hw * 0.35} ${-hd * 0.05} L${hw} ${hd * 0.3}`} stroke="#3e3126" strokeWidth="1.3" fill="none" strokeLinejoin="round" />}
              <ellipse cx={-hw * 0.38} cy={-hd * 0.42} rx={hw * 0.18} ry={hd * 0.12} fill="#ffffff" opacity=".85" filter={u('soft')} />
              <path d={OUTLINE[kind]} fill="none" stroke="#ffffff" strokeOpacity={gold ? 0.3 : 0.6} strokeWidth="1.8" />
            </g>
            <path d={OUTLINE[kind]} fill="none" stroke={gold ? '#6e4f0e' : porc ? '#9fb3bd' : '#a99a7f'} strokeWidth="1" />
          </g>
        )}
        {/* Superficies marcadas (dónde): realizado en teal, planificado con rayado azul */}
        {!ghost && surfaces.length > 0 && (
          <g clipPath={u('clip')}>
            {surfaces.map((k) => (
              <path key={k} d={region(k)} fill={marks[k] === 'realizado' ? 'rgb(47 143 134 / 0.2)' : u('hatch')} fillOpacity={marks[k] === 'realizado' ? 1 : 0.62} stroke={marks[k] === 'realizado' ? '#2f8f86' : '#2d5770'} strokeWidth="1.2" strokeDasharray={marks[k] === 'planificado' ? '2.2 1.6' : undefined} strokeLinejoin="round" />
            ))}
          </g>
        )}
        {focus && focus !== 'pieza' && !ghost && <g clipPath={u('clip')}><path d={region(focus)} fill="none" stroke="#c8952c" strokeWidth="2.2" /></g>}
        {state === 'bracket' && (
          <g>
            <path d={`M${-hw - 3} ${-hd + 1} H${hw + 3}`} stroke="#8f989d" strokeWidth="1.4" />
            <rect x={-6} y={-hd - 2} width="12" height="6" rx="1.5" fill="#d5dbde" stroke="#5f686d" strokeWidth=".8" />
            <rect x={-7} y={-hd - 3} width="14" height="8" rx="3" fill="none" stroke="#2f8f86" strokeWidth="1.2" />
          </g>
        )}
        {state === 'extraccion' && (
          <g strokeLinecap="round">
            <path d={`M${-hw * 0.6} ${-hd * 0.6} L${hw * 0.6} ${hd * 0.6} M${hw * 0.6} ${-hd * 0.6} L${-hw * 0.6} ${hd * 0.6}`} stroke="#ffffff" strokeWidth="5" />
            <path d={`M${-hw * 0.6} ${-hd * 0.6} L${hw * 0.6} ${hd * 0.6} M${hw * 0.6} ${-hd * 0.6} L${-hw * 0.6} ${hd * 0.6}`} stroke="#a33131" strokeWidth="2.6" />
          </g>
        )}
        {(wholeMark === 'planificado' || (focus === 'pieza' && !ghost)) && (
          <path d={OUTLINE[kind]} fill="none" stroke={focus === 'pieza' ? '#c8952c' : '#2d5770'} strokeWidth={focus === 'pieza' ? 2.4 : 1.6} strokeDasharray={focus === 'pieza' ? undefined : '3 2'} transform="scale(1.1)" />
        )}
      </g>
    </svg>
  );
}

// ---------- Geometría de arcadas (vista oclusal, la derecha de la persona a la izquierda) ----------
export interface ArchSlot { tooth: number; kind: ToothKind; x: number; y: number; angle: number; mirror: boolean; w: number; d: number; lx: number; ly: number }
export const ARCH_W = 640;
export const ARCH_H = 300;

const PERM_SIZE: Record<number, number> = { 8: 40, 7: 44, 6: 46, 5: 32, 4: 32, 3: 34, 2: 31, 1: 38 };
const TEMP_SIZE: Record<number, number> = { 5: 38, 4: 32, 3: 26, 2: 22, 1: 25 };

/** Ubica una mitad de arcada sobre una elipse repartiendo las piezas por longitud de arco desde la línea media. */
function placeHalf(teeth: number[], upper: boolean, rightHalf: boolean, temporal: boolean): ArchSlot[] {
  const a = temporal ? 215 : 272; const b = temporal ? 190 : 236;
  const cx = ARCH_W / 2; const cy = upper ? ARCH_H - 28 : 28;
  const steps = 720;
  const lens: number[] = [0];
  let prev = { x: cx, y: upper ? cy - b : cy + b };
  for (let i = 1; i <= steps; i++) {
    const th = Math.PI / 2 + (i / steps) * (Math.PI / 2) * 1.0;
    const p = { x: cx + a * Math.cos(th), y: upper ? cy - b * Math.sin(th) : cy + b * Math.sin(th) };
    lens.push(lens[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  const total = lens[steps];
  const sizes = teeth.map((t) => (temporal ? TEMP_SIZE[t % 10] : PERM_SIZE[t % 10]));
  const gap = 2.5;
  const scale = (total * 0.96 - gap * teeth.length) / sizes.reduce((x, y) => x + y, 0);
  let s = gap / 2;
  return teeth.map((tooth, i) => {
    const w = sizes[i] * scale;
    const center = s + w / 2;
    s += w + gap;
    let k = lens.findIndex((l) => l >= center);
    if (k < 1) k = 1;
    const f = (center - lens[k - 1]) / (lens[k] - lens[k - 1] || 1);
    const th0 = Math.PI / 2 + ((k - 1 + f) / steps) * (Math.PI / 2);
    const th = rightHalf ? Math.PI - th0 : th0;
    const x = cx + a * Math.cos(th);
    const y = upper ? cy - b * Math.sin(th) : cy + b * Math.sin(th);
    // Normal hacia afuera de la elipse (vestibular); -y local apunta hacia allí.
    let nx = Math.cos(th) / a; let ny = (upper ? -Math.sin(th) : Math.sin(th)) / b;
    const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
    const angle = (Math.atan2(nx, -ny) * 180) / Math.PI;
    const kind = kindFor(tooth);
    const box = BOX[kind];
    const dPx = w * (box.hd / box.hw);
    return { tooth, kind, x, y, angle, mirror: upper ? rightHalf : !rightHalf, w, d: dPx, lx: x + nx * (dPx / 2 + 16), ly: y + ny * (dPx / 2 + 16) };
  });
}

export function archSlots(dentition: 'permanente' | 'temporal', upper: boolean): ArchSlot[] {
  const temporal = dentition === 'temporal';
  const n = temporal ? 5 : 8;
  const qa = temporal ? (upper ? 5 : 8) : (upper ? 1 : 4);
  const qb = temporal ? (upper ? 6 : 7) : (upper ? 2 : 3);
  const left = Array.from({ length: n }, (_, i) => qa * 10 + i + 1); // desde la línea media hacia distal
  const right = Array.from({ length: n }, (_, i) => qb * 10 + i + 1);
  return [...placeHalf(left, upper, false, temporal).reverse(), ...placeHalf(right, upper, true, temporal)];
}

/** Fondo de una arcada: encía en herradura y paladar / piso de boca, con la línea media. */
export function ArchBackdrop({ upper, temporal }: { upper: boolean; temporal: boolean }) {
  const uid = useId().replace(/:/g, '');
  const a = temporal ? 215 : 272; const b = temporal ? 190 : 236;
  const cx = ARCH_W / 2; const cy = upper ? ARCH_H - 28 : 28;
  const arc = (ra: number, rb: number) => upper
    ? `M${cx - ra} ${cy} A${ra} ${rb} 0 0 1 ${cx + ra} ${cy}`
    : `M${cx - ra} ${cy} A${ra} ${rb} 0 0 0 ${cx + ra} ${cy}`;
  return (
    <svg className="arch-backdrop" viewBox={`0 0 ${ARCH_W} ${ARCH_H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`gum-${uid}`} x1="0" y1={upper ? '0' : '1'} x2="0" y2={upper ? '1' : '0'}>
          <stop offset="0" style={{ stopColor: 'var(--gum-edge)' }} /><stop offset="1" style={{ stopColor: 'var(--gum)' }} />
        </linearGradient>
        <radialGradient id={`pal-${uid}`} cx=".5" cy={upper ? '.35' : '.65'} r=".7">
          <stop offset="0" style={{ stopColor: 'var(--palate)' }} /><stop offset=".7" style={{ stopColor: 'var(--palate)', stopOpacity: 0.7 }} /><stop offset="1" style={{ stopColor: 'var(--palate)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <path d={`${arc(a - 30, b - 30)} Z`} fill={`url(#pal-${uid})`} />
      <path d={arc(a, b)} fill="none" stroke={`url(#gum-${uid})`} strokeWidth="78" strokeLinecap="round" opacity=".9" />
      <path d={arc(a + 39, b + 39)} fill="none" style={{ stroke: 'var(--gum-edge)' }} strokeWidth="1.2" opacity=".6" />
      <path d={upper ? `M${cx} ${cy - b - 40} V${cy - b + 30}` : `M${cx} ${cy + b - 30} V${cy + b + 40}`} style={{ stroke: 'var(--line-strong)' }} strokeWidth="1.2" strokeDasharray="4 4" />
    </svg>
  );
}

// ---------- Dentadura frontal completa (sonrisa) ----------
interface Crown { tooth: number; kind: ToothKind; x: number; w: number; h: number; top: number; upper: boolean }
// Ancho y alto de cada corona vista de frente (de la línea media hacia distal), ya con perspectiva.
const UP_DIM = [[60, 80], [47, 68], [42, 72], [34, 56], [28, 48]];
const LO_DIM = [[40, 58], [42, 58], [40, 62], [34, 52], [30, 46]];

function crownPath({ kind, x, w, h }: Crown): string {
  const l = x - w / 2; const r = x + w / 2;
  // Borde gingival en y=0 e incisal en y=h; la arcada inferior se espeja al ubicarla.
  return kind === 'canino'
    ? `M${l + w * 0.08} 0 L${r - w * 0.08} 0 C${r + w * 0.03} ${h * 0.4} ${r} ${h * 0.7} ${r - w * 0.14} ${h * 0.86} C${x + w * 0.18} ${h * 0.97} ${x + w * 0.08} ${h} ${x} ${h} C${x - w * 0.08} ${h} ${x - w * 0.18} ${h * 0.97} ${l + w * 0.14} ${h * 0.86} C${l} ${h * 0.7} ${l - w * 0.03} ${h * 0.4} ${l + w * 0.08} 0 Z`
    : kind === 'premolar' || kind === 'molar'
      ? `M${l + w * 0.1} 0 L${r - w * 0.1} 0 C${r + w * 0.02} ${h * 0.4} ${r} ${h * 0.74} ${r - w * 0.16} ${h * 0.9} C${x + w * 0.2} ${h} ${x - w * 0.2} ${h} ${l + w * 0.16} ${h * 0.9} C${l} ${h * 0.74} ${l - w * 0.02} ${h * 0.4} ${l + w * 0.1} 0 Z`
      : `M${l + w * 0.06} 0 L${r - w * 0.06} 0 C${r + w * 0.03} ${h * 0.42} ${r + w * 0.01} ${h * 0.82} ${r - w * 0.07} ${h * 0.98} C${r - w * 0.3} ${h * 1.02} ${l + w * 0.3} ${h * 1.02} ${l + w * 0.07} ${h * 0.98} C${l - w * 0.01} ${h * 0.82} ${l - w * 0.03} ${h * 0.42} ${l + w * 0.06} 0 Z`;
}

function layoutFront(upper: boolean): Crown[] {
  const dims = upper ? UP_DIM : LO_DIM;
  const out: Crown[] = [];
  for (const side of [-1, 1]) {
    let edge = 300;
    dims.forEach(([w, h], k) => {
      const x = edge + side * (w / 2);
      edge += side * w * 0.985;
      const quadrant = upper ? (side < 0 ? 1 : 2) : (side < 0 ? 4 : 3);
      const tooth = quadrant * 10 + k + 1;
      // Curva de la sonrisa: los bordes suben hacia los costados; la inferior queda detrás (sobremordida).
      const top = upper ? 100 + k * 5 : 222 - h - k * 4 + (k === 0 ? 0 : 2);
      out.push({ tooth, kind: kindFor(tooth), x, w, h, top, upper });
    });
  }
  return out;
}

export interface DentitionProps { width?: number; gold?: boolean; appliance?: Appliance | null; title?: string; lips?: boolean }

/** Sonrisa completa: arcadas superior e inferior con coronas de frente, encías con papilas, interior de la boca y labios. */
export function DentitionFront({ width = 520, gold = false, appliance = null, title, lips = true }: DentitionProps) {
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${n}-${uid}`;
  const u = (n: string) => `url(#${id(n)})`;
  const W = 600; const H = 320;
  // Sin labios se muestra una vista “clínica” más abierta (sin comisuras) para que se lean los aparatos.
  const mouth = lips ? 'M56 146 C150 76 450 76 544 146 C462 262 138 262 56 146 Z' : 'M64 150 C64 34 536 34 536 150 C536 296 64 296 64 150 Z';
  const up = layoutFront(true);
  const lo = layoutFront(false);
  const crownNode = (c: Crown) => {
    const goldTooth = gold && c.tooth === 23;
    const t = c.upper ? `translate(0 ${c.top})` : `translate(0 ${c.top + c.h}) scale(1 -1)`;
    const d = crownPath(c);
    return (
      <g key={c.tooth} transform={t}>
        <path d={d} fill={goldTooth ? u('gold') : u('enamelF')} stroke={goldTooth ? '#6e4f0e' : '#c9bda6'} strokeWidth="1" />
        <clipPath id={id(`c${c.tooth}`)}><path d={d} /></clipPath>
        <g clipPath={`url(#${id(`c${c.tooth}`)})`}>
          {!goldTooth && <rect x={c.x - c.w / 2} y={c.h * 0.78} width={c.w} height={c.h * 0.24} fill={u('incisalF')} />}
          <rect x={c.x - c.w / 2} y="0" width={c.w} height={c.h} fill={u('sideF')} />
          <ellipse cx={c.x - c.w * 0.16} cy={c.h * 0.4} rx={c.w * 0.12} ry={c.h * 0.26} fill={goldTooth ? '#fff3c4' : '#ffffff'} opacity=".85" filter={u('soft')} />
          <path d={d} fill="none" stroke="#ffffff" strokeOpacity=".55" strokeWidth="2.4" />
        </g>
      </g>
    );
  };
  const bracket = (c: Crown) => ({ x: c.x, y: c.upper ? c.top + c.h * 0.52 : c.top + c.h * 0.46, s: Math.min(1, c.w / 46) });
  const upB = [...up].sort((a, b) => a.x - b.x).map(bracket);
  const loB = [...lo].sort((a, b) => a.x - b.x).map(bracket);
  const wire = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const braces = appliance === 'brackets_metalicos' || appliance === 'brackets_esteticos';
  const metal = appliance === 'brackets_metalicos';
  const sortedUp = [...up].sort((a, b) => a.w - b.w); // las chicas (más lejanas) primero
  const sortedLo = [...lo].sort((a, b) => a.w - b.w);

  return (
    <svg className="dentition-front" width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} focusable="false">
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={id('mouth')}><path d={mouth} /></clipPath>
        <radialGradient id={id('inside')} cx=".5" cy=".6" r=".62"><stop offset="0" stopColor="#6a2530" /><stop offset=".65" stopColor="#3d111a" /><stop offset="1" stopColor="#24080e" /></radialGradient>
        <linearGradient id={id('enamelF')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ecdfc6" /><stop offset=".22" stopColor="#f8f2e6" /><stop offset=".55" stopColor="#ffffff" /><stop offset="1" stopColor="#f4f2ee" /></linearGradient>
        <linearGradient id={id('incisalF')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9d3e6" stopOpacity="0" /><stop offset="1" stopColor="#b9d3e6" stopOpacity=".6" /></linearGradient>
        <linearGradient id={id('sideF')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8a7a62" stopOpacity=".22" /><stop offset=".25" stopColor="#8a7a62" stopOpacity="0" /><stop offset=".75" stopColor="#8a7a62" stopOpacity="0" /><stop offset="1" stopColor="#8a7a62" stopOpacity=".26" /></linearGradient>
        <linearGradient id={id('gold')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6f4f0f" /><stop offset=".25" stopColor="#c8952c" /><stop offset=".48" stopColor="#fff0b8" /><stop offset=".62" stopColor="#d9a842" /><stop offset="1" stopColor="#5c430d" /></linearGradient>
        <linearGradient id={id('gumU')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9827e" /><stop offset=".8" stopColor="#efada7" /><stop offset="1" stopColor="#f6c4be" /></linearGradient>
        <linearGradient id={id('gumL')} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#d47c78" /><stop offset=".8" stopColor="#eca8a2" /><stop offset="1" stopColor="#f4c0ba" /></linearGradient>
        <linearGradient id={id('lipU')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d58a8b" /><stop offset="1" stopColor="#bd6469" /></linearGradient>
        <linearGradient id={id('lipL')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9696e" /><stop offset=".6" stopColor="#dc8f90" /><stop offset="1" stopColor="#e7a8a6" /></linearGradient>
        <linearGradient id={id('wire')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3f6f7" /><stop offset="1" stopColor="#7d868c" /></linearGradient>
        <linearGradient id={id('steel')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f6f7" /><stop offset=".5" stopColor="#b9c1c5" /><stop offset="1" stopColor="#6d767c" /></linearGradient>
        <linearGradient id={id('aligner')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9f6fc" stopOpacity=".5" /><stop offset="1" stopColor="#c4e2f0" stopOpacity=".32" /></linearGradient>
        <filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" /></filter>
        <filter id={id('blur')} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <path d={mouth} fill={u('inside')} />
      <g clipPath={u('mouth')}>
        <ellipse cx="300" cy="214" rx="130" ry="30" fill="#b9566a" opacity=".5" filter={u('blur')} />
        {sortedLo.map(crownNode)}
        <path d="M30 200 C150 236 450 236 570 200 V340 H30 Z" fill={u('gumL')} />
        {lo.map((c) => <path key={`pl${c.tooth}`} d={`M${c.x - c.w / 2 - 5} ${c.top + c.h + 1} Q${c.x - c.w / 2} ${c.top + c.h - 9} ${c.x - c.w / 2 + 5} ${c.top + c.h + 1}`} fill="#f2b9b3" />)}
        {sortedUp.map(crownNode)}
        <path d="M30 40 V128 C150 98 450 98 570 128 V40 Z" fill={u('gumU')} />
        {up.map((c) => <path key={`pu${c.tooth}`} d={`M${c.x - c.w / 2 - 6} ${c.top - 1} Q${c.x - c.w / 2} ${c.top + 11} ${c.x - c.w / 2 + 6} ${c.top - 1}`} fill="#f4c0ba" />)}
        <path d="M30 128 C150 98 450 98 570 128" fill="none" stroke="#c46f6b" strokeWidth="1.2" opacity=".5" />
        {braces && (
          <g>
            <path d={wire(upB)} fill="none" stroke={metal ? u('wire') : '#d9e0e2'} strokeWidth={metal ? 2.6 : 1.8} />
            <path d={wire(loB)} fill="none" stroke={metal ? u('wire') : '#d9e0e2'} strokeWidth={metal ? 2.2 : 1.6} />
            {[...upB, ...loB].map((p, i) => (
              <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
                <rect x="-9" y="-8" width="18" height="16" rx="3.5" fill={metal ? u('steel') : '#fbfbf8'} stroke={metal ? '#5f686d' : '#a9b4b8'} strokeWidth="1" />
                <rect x="-9" y="-1.6" width="18" height="3.2" fill={metal ? '#5f686d' : '#dde3e5'} />
                {metal && <rect x="-10.5" y="-9.5" width="21" height="19" rx="7" fill="none" stroke="#2f8f86" strokeWidth="2.2" />}
                <ellipse cx="-4" cy="-4" rx="2.4" ry="1.1" fill="#fff" opacity=".9" />
              </g>
            ))}
          </g>
        )}
        {appliance === 'alineadores' && (
          <g>
            <path d={`M${up[9].x + up[9].w / 2 + 4} 118 ${[...up].sort((a, b) => b.x - a.x).map((c) => `L${c.x + c.w / 2} ${c.top + c.h + 4} L${c.x - c.w / 2} ${c.top + c.h + 4}`).join(' ')} L${up[4].x - up[4].w / 2 - 4} 118 Z`} fill={u('aligner')} stroke="#8fc3da" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M190 150 C260 160 340 160 410 150" stroke="#fff" strokeWidth="3" opacity=".6" fill="none" strokeLinecap="round" />
          </g>
        )}
        {appliance === 'retenedor_removible' && (
          <g>
            <path d={wire([...up].sort((a, b) => a.x - b.x).slice(2, 8).map((c) => ({ x: c.x, y: c.top + c.h * 0.6 })))} fill="none" stroke={u('wire')} strokeWidth="2.8" strokeLinecap="round" />
            {[2, 7].map((k) => { const c = [...up].sort((a, b) => a.x - b.x)[k]; return <circle key={k} cx={c.x} cy={c.top + c.h * 0.6} r="4" fill="none" stroke="#8f979c" strokeWidth="2" />; })}
          </g>
        )}
        {appliance === 'retenedor_fijo' && [...lo].sort((a, b) => a.x - b.x).slice(2, 8).map((c) => <ellipse key={c.tooth} cx={c.x} cy={c.top + 8} rx={c.w * 0.18} ry="3" fill="#d5dbde" stroke="#8f979c" strokeWidth=".8" opacity=".95" />)}
      </g>
      {lips && (
        <g>
          <path d="M8 146 C90 52 230 40 300 62 C370 40 510 52 592 146 L544 146 C450 76 150 76 56 146 Z" fill={u('lipU')} />
          <path d="M120 80 C200 60 262 64 300 74 C338 64 400 60 480 80" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="4" strokeLinecap="round" />
          <path d="M8 146 L56 146 C138 262 462 262 544 146 L592 146 C516 246 430 298 300 302 C170 298 84 246 8 146 Z" fill={u('lipL')} />
          <path d="M180 282 C240 292 360 292 420 282" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="5" strokeLinecap="round" />
          <path d="M8 146 L56 146 M544 146 L592 146" stroke="#a9545a" strokeWidth="2" strokeLinecap="round" opacity=".7" />
        </g>
      )}
    </svg>
  );
}
