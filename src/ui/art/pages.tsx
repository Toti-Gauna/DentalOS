// Ilustraciones de encabezado para las páginas del portal (SVG propio, decorativas).
import { useId } from 'react';
import { ToothArt } from './teeth';

export type PageArtKind = 'reservar' | 'turnos' | 'chat' | 'llamada' | 'aprender' | 'sede';

export function PageArt({ kind }: { kind: PageArtKind }) {
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${n}-${uid}`;
  const u = (n: string) => `url(#${id(n)})`;
  return (
    <svg viewBox="0 0 160 130" width="160" height="130" aria-hidden="true" focusable="false" className="page-art-svg">
      <defs>
        <linearGradient id={id('teal')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2f7d75" /><stop offset="1" stopColor="#1b4a46" /></linearGradient>
        <linearGradient id={id('gold')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b8862b" /><stop offset=".5" stopColor="#f3d98a" /><stop offset="1" stopColor="#a8781f" /></linearGradient>
        <linearGradient id={id('paper')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f3efe6" /></linearGradient>
      </defs>
      <circle cx="80" cy="66" r="58" fill="var(--surface)" stroke="var(--line)" strokeWidth="1" />
      <path d="M33 32 A58 58 0 0 1 80 8" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" />
      {kind === 'reservar' && (
        <g>
          <rect x="34" y="30" width="78" height="72" rx="12" fill={u('paper')} stroke="#c9bfae" strokeWidth="1.5" />
          <path d="M34 42 a12 12 0 0 1 12 -12 h54 a12 12 0 0 1 12 12 v6 h-78 z" fill={u('teal')} />
          {[50, 66, 82, 96].map((x) => <rect key={x} x={x - 2.5} y="24" width="5" height="14" rx="2.5" fill="#8f979c" />)}
          {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={44 + c * 15} y={58 + r * 13} width="10" height="8" rx="2" fill={r === 1 && c === 2 ? '#c8952c' : '#e5efed'} />))}
          <g transform="translate(96 46)"><ToothArt kind="molar" width={36} /></g>
          <circle cx="116" cy="100" r="11" fill={u('gold')} stroke="#fff" strokeWidth="2.5" />
          <path d="M111 100 l3.5 3.5 6.5 -7" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {kind === 'turnos' && (
        <g>
          <g transform="rotate(-8 80 66)">
            <path d="M28 38 h104 v18 a8 8 0 0 0 0 16 v18 h-104 v-18 a8 8 0 0 0 0 -16 z" fill={u('paper')} stroke="#c9bfae" strokeWidth="1.5" />
            <path d="M98 40 v48" stroke="#c9bfae" strokeWidth="1.5" strokeDasharray="3 3" />
            <rect x="38" y="48" width="44" height="7" rx="3.5" fill="#245e59" />
            <rect x="38" y="62" width="34" height="5" rx="2.5" fill="#cfe1de" />
            <rect x="38" y="72" width="40" height="5" rx="2.5" fill="#e9deca" />
            <g transform="translate(103 44)"><ToothArt kind="incisivo" width={22} /></g>
          </g>
          <circle cx="122" cy="96" r="14" fill="#fff" stroke="#245e59" strokeWidth="2.5" />
          <path d="M122 88 v8 l6 4" stroke="#245e59" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      )}
      {kind === 'chat' && (
        <g>
          <path d="M30 34 h66 a12 12 0 0 1 12 12 v22 a12 12 0 0 1 -12 12 h-46 l-12 10 v-10 h-8 a12 12 0 0 1 -12 -12 v-22 a12 12 0 0 1 12 -12 z" fill={u('teal')} />
          {[48, 63, 78].map((x) => <circle key={x} cx={x} cy="57" r="4.5" fill="#fff" opacity=".9" />)}
          <path d="M70 66 h56 a10 10 0 0 1 10 10 v16 a10 10 0 0 1 -10 10 h-4 v9 l-11 -9 h-41 a10 10 0 0 1 -10 -10 v-16 a10 10 0 0 1 10 -10 z" fill={u('paper')} stroke="#c9bfae" strokeWidth="1.5" />
          <path d="M80 80 h40 M80 89 h28" stroke="#cfe1de" strokeWidth="4" strokeLinecap="round" />
          <path d="M112 88 l3 3 6 -6 M117 88 l3 3 6 -6" stroke="#2f8f86" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      )}
      {kind === 'llamada' && (
        <g>
          <circle cx="72" cy="68" r="30" fill={u('teal')} />
          <path d="M60 56 c3 -3 6 -3 8 0 l3 5 c1.5 2.5 1 4.5 -1.5 6 c2 5 5.5 8.5 10.5 10.5 c1.5 -2.5 3.5 -3 6 -1.5 l5 3 c3 2 3 5 0 8 c-4 4 -9 4 -14 1.5 c-9 -4.5 -16 -11.5 -20.5 -20.5 c-2.5 -5 -2.5 -10 2.5 -12 z" fill="#fff" />
          {[0, 1, 2].map((i) => <path key={i} d={`M${108 + i * 9} ${48 - i * 4} q${10 + i * 4} ${20 + i * 4} 0 ${40 + i * 8}`} stroke={i === 2 ? '#c8952c' : '#2f8f86'} strokeWidth="3.5" fill="none" strokeLinecap="round" opacity={1 - i * 0.22} />)}
        </g>
      )}
      {kind === 'aprender' && (
        <g>
          <path d="M80 44 C66 36 46 34 28 38 V100 C46 96 66 98 80 106 Z" fill={u('paper')} stroke="#c9bfae" strokeWidth="1.5" />
          <path d="M80 44 C94 36 114 34 132 38 V100 C114 96 94 98 80 106 Z" fill={u('paper')} stroke="#c9bfae" strokeWidth="1.5" />
          <path d="M80 44 V106" stroke="#c9bfae" strokeWidth="1.5" />
          <path d="M38 52 h30 M38 62 h26 M38 72 h30 M38 82 h22" stroke="#cfe1de" strokeWidth="3.5" strokeLinecap="round" />
          <g transform="translate(92 44)"><ToothArt kind="premolar" width={26} /></g>
          <circle cx="116" cy="88" r="14" fill={u('gold')} stroke="#fff" strokeWidth="2.5" />
          <path d="M116 80 l2.4 5 5.4 .8 -3.9 3.8 .9 5.4 -4.8 -2.6 -4.8 2.6 .9 -5.4 -3.9 -3.8 5.4 -.8 z" fill="#fff" />
        </g>
      )}
      {kind === 'sede' && (
        <g>
          <rect x="36" y="44" width="88" height="62" rx="6" fill={u('paper')} stroke="#c9bfae" strokeWidth="1.5" />
          <path d="M30 46 L80 22 L130 46 Z" fill={u('teal')} />
          <circle cx="80" cy="36" r="8" fill="#fff" />
          <g transform="translate(74 28.5)"><ToothArt kind="molar" width={12} /></g>
          {[46, 102].map((x) => <rect key={x} x={x} y="56" width="14" height="14" rx="2" fill="#dbe8f0" stroke="#9fb3bd" />)}
          <rect x="68" y="72" width="24" height="34" rx="3" fill={u('teal')} />
          <circle cx="86" cy="90" r="1.8" fill="#f3d98a" />
          <path d="M64 106 h32" stroke="#c9bfae" strokeWidth="3" strokeLinecap="round" />
          <circle cx="138" cy="92" r="10" fill="#9fd3cc" /><rect x="136.5" y="98" width="3" height="10" fill="#8a6f4e" />
        </g>
      )}
    </svg>
  );
}
