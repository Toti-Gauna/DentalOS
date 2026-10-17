// Ilustraciones de aparatología de ortodoncia (SVG propio). Vista frontal del sector anterior superior.
import { useId } from 'react';

export type Appliance = 'brackets_metalicos' | 'brackets_esteticos' | 'alineadores' | 'retenedor_fijo' | 'retenedor_removible';

export const APPLIANCES: { id: Appliance; label: string; detail: string }[] = [
  { id: 'brackets_metalicos', label: 'Brackets metálicos', detail: 'Brackets de acero, arco y ligaduras.' },
  { id: 'brackets_esteticos', label: 'Brackets estéticos', detail: 'Brackets cerámicos del color del diente.' },
  { id: 'alineadores', label: 'Alineadores transparentes', detail: 'Placas removibles transparentes.' },
  { id: 'retenedor_fijo', label: 'Retenedor fijo', detail: 'Alambre adherido por detrás de los dientes.' },
  { id: 'retenedor_removible', label: 'Retenedor removible', detail: 'Placa con arco vestibular.' },
];

const TEETH = [
  { x: 26, w: 28, h: 50, y: 46 }, { x: 56, w: 30, h: 54, y: 42 }, { x: 88, w: 34, h: 60, y: 40 },
  { x: 124, w: 34, h: 60, y: 40 }, { x: 160, w: 30, h: 54, y: 42 }, { x: 192, w: 28, h: 50, y: 46 },
];
const crown = (t: (typeof TEETH)[number], i: number) => {
  const pointy = i === 0 || i === 5;
  const { x, y, w, h } = t;
  return pointy
    ? `M${x} ${y} L${x + w} ${y} C${x + w + 1} ${y + h * 0.5} ${x + w * 0.75} ${y + h * 0.85} ${x + w / 2} ${y + h} C${x + w * 0.25} ${y + h * 0.85} ${x - 1} ${y + h * 0.5} ${x} ${y} Z`
    : `M${x} ${y} L${x + w} ${y} C${x + w + 1} ${y + h * 0.5} ${x + w} ${y + h * 0.9} ${x + w - 4} ${y + h} L${x + 4} ${y + h} C${x} ${y + h * 0.9} ${x - 1} ${y + h * 0.5} ${x} ${y} Z`;
};

export function OrthoArt({ kind, width = 240, title }: { kind: Appliance; width?: number; title?: string }) {
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${n}-${uid}`;
  const mids = TEETH.map((t) => ({ cx: t.x + t.w / 2, cy: t.y + t.h * 0.45 }));
  const wire = `M2 ${mids[0].cy + 6} ` + mids.map((m) => `L${m.cx} ${m.cy}`).join(' ') + ` L238 ${mids[5].cy + 6}`;
  return (
    <svg className="ortho-art" width={width} height={(width * 130) / 240} viewBox="0 0 240 130" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} focusable="false">
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={id('gum')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3c1bb" /><stop offset=".6" stopColor="#e7a29c" /><stop offset="1" stopColor="#d88a84" /></linearGradient>
        <radialGradient id={id('en')} cx=".38" cy=".35" r=".9"><stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#fbf8f1" /><stop offset=".85" stopColor="#efe6d4" /><stop offset="1" stopColor="#e2d5bc" /></radialGradient>
        <linearGradient id={id('incisal')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#96bedb" stopOpacity="0" /><stop offset="1" stopColor="#96bedb" stopOpacity=".5" /></linearGradient>
        <linearGradient id={id('cerv')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d6b480" stopOpacity=".45" /><stop offset="1" stopColor="#d6b480" stopOpacity="0" /></linearGradient>
        <filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
        <linearGradient id={id('steel')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0f3f4" /><stop offset=".5" stopColor="#aab2b7" /><stop offset="1" stopColor="#7d868c" /></linearGradient>
        <linearGradient id={id('aligner')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9eef7" stopOpacity=".55" /><stop offset="1" stopColor="#bfe0ee" stopOpacity=".35" /></linearGradient>
        <linearGradient id={id('acrylic')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd3cc" stopOpacity=".85" /><stop offset="1" stopColor="#6fb9b0" stopOpacity=".7" /></linearGradient>
      </defs>
      {kind === 'retenedor_removible' && <path d="M8 6 C70 -4 170 -4 232 6 L232 40 C170 30 70 30 8 40 Z" fill={`url(#${id('acrylic')})`} />}
      <path d="M0 8 C60 18 180 18 240 8 L240 52 C200 44 170 40 120 40 C70 40 40 44 0 52 Z" fill={`url(#${id('gum')})`} />
      {TEETH.map((t, i) => (
        <g key={i}>
          <clipPath id={id(`c${i}`)}><path d={crown(t, i)} /></clipPath>
          <path d={crown(t, i)} fill={`url(#${id('en')})`} />
          <g clipPath={`url(#${id(`c${i}`)})`}>
            <rect x={t.x - 2} y={t.y + t.h * 0.72} width={t.w + 4} height={t.h * 0.3} fill={`url(#${id('incisal')})`} />
            <rect x={t.x - 2} y={t.y - 2} width={t.w + 4} height={t.h * 0.35} fill={`url(#${id('cerv')})`} />
            <ellipse cx={t.x + t.w * 0.32} cy={t.y + t.h * 0.42} rx={t.w * 0.13} ry={t.h * 0.24} fill="#fff" opacity=".85" filter={`url(#${id('soft')})`} />
            <ellipse cx={t.x + t.w * 0.28} cy={t.y + t.h * 0.3} rx={t.w * 0.05} ry={t.h * 0.08} fill="#fff" />
            <path d={crown(t, i)} fill="none" stroke="#fff" strokeWidth="2.4" opacity=".55" />
          </g>
          <path d={crown(t, i)} fill="none" stroke="#a99d86" strokeWidth="1.2" />
        </g>
      ))}
      <path d="M0 52 C40 44 70 40 120 40 C170 40 200 44 240 52" stroke="#7d3b37" strokeOpacity=".22" strokeWidth="6" fill="none" filter={`url(#${id('soft')})`} />
      <path d="M0 52 C40 44 70 40 120 40 C170 40 200 44 240 52" stroke="#c2706a" strokeWidth="1.4" fill="none" />
      <path d="M14 22 C70 26 170 26 226 22" stroke="#fff" strokeOpacity=".35" strokeWidth="3" fill="none" strokeLinecap="round" filter={`url(#${id('soft')})`} />

      {(kind === 'brackets_metalicos' || kind === 'brackets_esteticos') && (
        <g>
          <path d={wire} fill="none" stroke={kind === 'brackets_metalicos' ? '#7d868c' : '#b9c1c5'} strokeWidth={kind === 'brackets_metalicos' ? 2.4 : 1.6} />
          {mids.map((m, i) => (
            <g key={i}>
              <rect x={m.cx - 7} y={m.cy - 6} width="14" height="12" rx="3" fill={kind === 'brackets_metalicos' ? `url(#${id('steel')})` : '#fbfbf9'} stroke={kind === 'brackets_metalicos' ? '#5f686d' : '#c9d2d6'} strokeWidth="1.2" />
              <rect x={m.cx - 7} y={m.cy - 1.2} width="14" height="2.4" fill={kind === 'brackets_metalicos' ? '#5f686d' : '#dfe4e6'} opacity=".8" />
              <ellipse cx={m.cx - 3} cy={m.cy - 3.2} rx="2" ry="1" fill="#fff" opacity=".9" />
              {kind === 'brackets_metalicos'
                ? <circle cx={m.cx} cy={m.cy} r="4.6" fill="none" stroke="#2f8f86" strokeWidth="2.2" />
                : <rect x={m.cx - 4} y={m.cy - 1} width="8" height="2" fill="#d8dee1" />}
            </g>
          ))}
        </g>
      )}
      {kind === 'alineadores' && (
        <g>
          <path d={`M20 44 ${TEETH.map((t) => `L${t.x} ${t.y - 2} L${t.x + t.w} ${t.y - 2}`).join(' ')} L222 44 L222 ${TEETH[5].y + TEETH[5].h + 2} ${[...TEETH].reverse().map((t) => `L${t.x + t.w / 2} ${t.y + t.h + 3}`).join(' ')} L20 ${TEETH[0].y + TEETH[0].h + 2} Z`} fill={`url(#${id('aligner')})`} stroke="#7fb3cf" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M40 60 C80 52 150 52 200 60" stroke="#fff" strokeWidth="3" opacity=".7" fill="none" strokeLinecap="round" />
        </g>
      )}
      {kind === 'retenedor_fijo' && (
        <g opacity=".85">
          <path d={`M${mids[0].cx} 58 ` + mids.map((m) => `L${m.cx} 56`).join(' ')} stroke="#9aa3a8" strokeWidth="2" fill="none" strokeDasharray="1 0" />
          {mids.map((m, i) => <ellipse key={i} cx={m.cx} cy="57" rx="5" ry="3.2" fill="#d5dbde" stroke="#8f979c" />)}
        </g>
      )}
      {kind === 'retenedor_removible' && (
        <g>
          <path d={`M14 30 C14 60 ${mids[0].cx - 6} 72 ${mids[0].cx} 74 ` + mids.slice(1, 5).map((m) => `L${m.cx} 76`).join(' ') + ` L${mids[5].cx} 74 C${mids[5].cx + 6} 72 226 60 226 30`} stroke="#8f979c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx={mids[0].cx - 3} cy="66" r="4" fill="none" stroke="#8f979c" strokeWidth="2" />
          <circle cx={mids[5].cx + 3} cy="66" r="4" fill="none" stroke="#8f979c" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}
