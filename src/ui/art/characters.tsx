// "Los Brisitos": personajes dientes propios para la sección infantil y estados vacíos del portal.
// Ilustración original (SVG). Sin marcas ni personajes de terceros.
import { useId, type ReactNode } from 'react';

export type Character = 'mora' | 'coco' | 'ivo' | 'lia';
export type Mood = 'feliz' | 'guino' | 'valiente' | 'dormido' | 'sorpresa';

export const CHARACTERS: { id: Character; name: string; tooth: string; bio: string }[] = [
  { id: 'mora', name: 'Muela Mora', tooth: 'Muela (molar)', bio: 'Tritura la comida con fuerza. Le encanta que la cepilles bien atrás, donde casi nadie llega.' },
  { id: 'coco', name: 'Colmillo Coco', tooth: 'Colmillo (canino)', bio: 'Es el más puntiagudo y deportista. Ayuda a cortar y siempre pide hilo dental después del partido.' },
  { id: 'ivo', name: 'Incisivo Ivo', tooth: 'Incisivo', bio: 'Es el primero en saludar cuando sonreís. Usa anteojos y sabe todo sobre la primera visita.' },
  { id: 'lia', name: 'Dientecito Lía', tooth: 'Diente de leche', bio: 'Es pequeña y un día va a dejarle lugar a un diente nuevo. Mientras tanto, también quiere estar limpita.' },
];

const BODY: Record<Character, { body: string; cx: number; eyeY: number; legs: [string, string] }> = {
  mora: {
    body: 'M18 72 C12 50 14 28 27 18 C33 12 41 14 45 20 C49 12 57 10 61 16 C65 10 73 12 77 20 C81 14 89 12 94 18 C106 28 108 50 102 72 C98 92 92 100 86 104 L34 104 C28 100 22 92 18 72 Z',
    cx: 60, eyeY: 56,
    legs: ['M36 102 C34 118 36 130 42 136 C46 140 52 138 52 130 L54 102 Z', 'M84 102 C86 118 84 130 78 136 C74 140 68 138 68 130 L66 102 Z'],
  },
  coco: {
    body: 'M30 78 C24 56 34 32 50 18 C54 14 58 9 60 9 C62 9 66 14 70 18 C86 32 96 56 90 78 C86 94 82 102 76 106 L44 106 C38 102 34 94 30 78 Z',
    cx: 60, eyeY: 60,
    legs: ['M44 104 C42 118 44 130 50 136 C53 139 58 138 58 130 L59 104 Z', 'M76 104 C78 118 76 130 70 136 C67 139 62 138 62 130 L61 104 Z'],
  },
  ivo: {
    body: 'M30 80 C28 62 28 34 30 20 C31 13 36 10 60 10 C84 10 89 13 90 20 C92 34 92 62 90 80 C88 96 84 102 78 106 L42 106 C36 102 32 96 30 80 Z',
    cx: 60, eyeY: 56,
    legs: ['M44 104 C42 118 44 130 50 136 C53 139 58 138 58 130 L59 104 Z', 'M76 104 C78 118 76 130 70 136 C67 139 62 138 62 130 L61 104 Z'],
  },
  lia: {
    body: 'M30 84 C24 66 26 46 36 36 C41 31 47 33 50 37 C54 31 66 31 70 37 C73 33 79 31 84 36 C94 46 96 66 90 84 C87 98 82 104 76 108 L44 108 C38 104 33 98 30 84 Z',
    cx: 60, eyeY: 66,
    legs: ['M46 106 C44 118 46 128 51 133 C54 136 58 135 58 128 L59 106 Z', 'M74 106 C76 118 74 128 69 133 C66 136 62 135 62 128 L61 106 Z'],
  },
};

export function ToothCharacter({ who, mood = 'feliz', size = 120, title, className = '' }: { who: Character; mood?: Mood; size?: number; title?: string; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const g = (n: string) => `${n}-${uid}`;
  const b = BODY[who];
  const ex = 13;
  const eyes = [b.cx - ex, b.cx + ex];
  const ink = '#173c3a';
  const outline = '#9c8f7a';
  const eye = (x: number, closed: boolean, big = false) => closed
    ? <path key={x} d={`M${x - 5} ${b.eyeY} Q${x} ${b.eyeY - 4} ${x + 5} ${b.eyeY}`} stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
    : <g key={x}><ellipse cx={x} cy={b.eyeY} rx={big ? 6.5 : 5} ry={big ? 8 : 6.5} fill={ink} /><circle cx={x - 1.8} cy={b.eyeY - 2.4} r={big ? 2.2 : 1.7} fill="#fff" /></g>;
  const my = b.eyeY + 16;
  const mouth: Record<Mood, ReactNode> = {
    feliz: <path d={`M${b.cx - 10} ${my} Q${b.cx} ${my + 10} ${b.cx + 10} ${my}`} stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />,
    guino: <path d={`M${b.cx - 10} ${my} Q${b.cx} ${my + 10} ${b.cx + 10} ${my}`} stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />,
    valiente: <g><path d={`M${b.cx - 11} ${my - 1} Q${b.cx} ${my + 14} ${b.cx + 11} ${my - 1} Z`} fill="#7a3b3b" stroke={ink} strokeWidth="2.2" strokeLinejoin="round" /><path d={`M${b.cx - 5} ${my + 6} Q${b.cx} ${my + 3} ${b.cx + 5} ${my + 6} Q${b.cx} ${my + 10} ${b.cx - 5} ${my + 6} Z`} fill="#f08f8f" /></g>,
    dormido: <path d={`M${b.cx - 5} ${my + 2} Q${b.cx} ${my + 5} ${b.cx + 5} ${my + 2}`} stroke={ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />,
    sorpresa: <ellipse cx={b.cx} cy={my + 3} rx="5" ry="6.5" fill="#7a3b3b" stroke={ink} strokeWidth="2.2" />,
  };
  return (
    <svg className={`character ${className}`} width={size} height={(size * 150) / 120} viewBox="0 0 120 150" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} focusable="false">
      {title && <title>{title}</title>}
      <defs>
        <radialGradient id={g('body')} cx=".36" cy=".28" r=".9"><stop offset="0" stopColor="#ffffff" /><stop offset=".45" stopColor="#fcf9f3" /><stop offset=".8" stopColor="#f0e8d8" /><stop offset="1" stopColor="#e4d8c0" /></radialGradient>
        <linearGradient id={g('warm')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d6b480" stopOpacity="0" /><stop offset="1" stopColor="#d6b480" stopOpacity=".35" /></linearGradient>
        <clipPath id={g('clip')}><path d={b.body} /></clipPath>
        <filter id={g('soft')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" /></filter>
        <linearGradient id={g('cape')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2f8f86" /><stop offset="1" stopColor="#1b4a46" /></linearGradient>
        <linearGradient id={g('gold')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c8952c" /><stop offset=".5" stopColor="#f6dc8c" /><stop offset="1" stopColor="#b8862b" /></linearGradient>
      </defs>
      <ellipse cx="60" cy="142" rx="34" ry="5" fill="#173c3a" opacity=".08" />
      {mood === 'valiente' && <path d="M30 40 C14 70 12 104 22 128 L60 112 L98 128 C108 104 106 70 90 40 Z" fill={`url(#${g('cape')})`} />}
      {b.legs.map((d, i) => <path key={i} d={d} fill={`url(#${g('body')})`} stroke={outline} strokeWidth="2.5" strokeLinejoin="round" />)}
      {/* brazos */}
      <path d={`M${b.cx - 40} 78 C${b.cx - 52} 80 ${b.cx - 56} 92 ${b.cx - 50} 98`} stroke={outline} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d={`M${b.cx - 40} 78 C${b.cx - 52} 80 ${b.cx - 56} 92 ${b.cx - 50} 98`} stroke="#fbf8f2" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d={`M${b.cx + 40} 78 C${b.cx + 52} 76 ${b.cx + 56} 64 ${b.cx + 52} 56`} stroke={outline} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d={`M${b.cx + 40} 78 C${b.cx + 52} 76 ${b.cx + 56} 64 ${b.cx + 52} 56`} stroke="#fbf8f2" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d={b.body} fill={`url(#${g('body')})`} />
      <g clipPath={`url(#${g('clip')})`}>
        <rect x="0" y={b.eyeY + 18} width="120" height="60" fill={`url(#${g('warm')})`} />
        <ellipse cx={b.cx - 22} cy={b.eyeY - 20} rx="8" ry="14" fill="#fff" opacity=".95" transform={`rotate(-20 ${b.cx - 22} ${b.eyeY - 20})`} filter={`url(#${g('soft')})`} />
        <ellipse cx={b.cx - 25} cy={b.eyeY - 27} rx="2.6" ry="4.6" fill="#fff" transform={`rotate(-20 ${b.cx - 25} ${b.eyeY - 27})`} />
        <path d={b.body} fill="none" stroke="#fff" strokeWidth="4" opacity=".6" />
      </g>
      <path d={b.body} fill="none" stroke={outline} strokeWidth="2.8" strokeLinejoin="round" />
      {/* mejillas */}
      <ellipse cx={b.cx - 24} cy={b.eyeY + 12} rx="7" ry="4.5" fill="#f4a7a3" opacity=".75" />
      <ellipse cx={b.cx + 24} cy={b.eyeY + 12} rx="7" ry="4.5" fill="#f4a7a3" opacity=".75" />
      {eye(eyes[0], mood === 'guino' || mood === 'dormido', mood === 'sorpresa')}
      {eye(eyes[1], mood === 'dormido', mood === 'sorpresa')}
      {mood === 'valiente' && <><path d={`M${eyes[0] - 7} ${b.eyeY - 11} L${eyes[0] + 5} ${b.eyeY - 8}`} stroke={ink} strokeWidth="3" strokeLinecap="round" /><path d={`M${eyes[1] + 7} ${b.eyeY - 11} L${eyes[1] - 5} ${b.eyeY - 8}`} stroke={ink} strokeWidth="3" strokeLinecap="round" /></>}
      {mouth[mood]}
      {/* accesorios por personaje */}
      {who === 'ivo' && <g fill="none" stroke={ink} strokeWidth="2.4"><circle cx={eyes[0]} cy={b.eyeY} r="9.5" /><circle cx={eyes[1]} cy={b.eyeY} r="9.5" /><path d={`M${eyes[0] + 9.5} ${b.eyeY} L${eyes[1] - 9.5} ${b.eyeY}`} /></g>}
      {who === 'coco' && <path d="M36 34 C50 26 70 26 84 34 L82 42 C70 35 50 35 38 42 Z" fill="#2f8f86" stroke="#1b4a46" strokeWidth="1.5" />}
      {who === 'lia' && <g><path d="M60 30 L46 22 L46 38 Z M60 30 L74 22 L74 38 Z" fill={`url(#${g('gold')})`} stroke="#8a6514" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="60" cy="30" r="4" fill="#c8952c" stroke="#8a6514" strokeWidth="1.2" /></g>}
      {who === 'mora' && mood !== 'valiente' && <path d="M88 20 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill={`url(#${g('gold')})`} />}
      {/* cepillo en la mano derecha (valiente) */}
      {mood === 'valiente' && <g transform={`rotate(-30 ${b.cx + 52} 54)`}><rect x={b.cx + 48} y="22" width="8" height="40" rx="4" fill="#2f8f86" stroke="#1b4a46" strokeWidth="1.5" /><rect x={b.cx + 46} y="12" width="12" height="13" rx="3" fill="#fff" stroke="#8f979c" strokeWidth="1.5" /><path d={`M${b.cx + 48} 15 v8 M${b.cx + 51} 15 v8 M${b.cx + 54} 15 v8 M${b.cx + 57} 15 v8`} stroke="#9fd3cc" strokeWidth="1.4" /></g>}
      {mood === 'dormido' && <g fill={ink} fontFamily="Manrope, sans-serif" fontWeight="800"><text x="92" y="30" fontSize="14">z</text><text x="102" y="18" fontSize="10">z</text></g>}
    </svg>
  );
}
