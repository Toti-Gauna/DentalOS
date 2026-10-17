// Arte del juego de Brisa Chicos: boca caricaturesca, dientes con brillo, bichitos simpáticos y estrellas.
// Ilustración original (SVG); los bichitos son amigables a propósito: el juego no busca asustar.
import { useId } from 'react';

/** Diente de caricatura (corona sola). `lower` lo espeja para la fila de abajo. */
export function KidTooth({ lower = false, shine = false }: { lower?: boolean; shine?: boolean }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg className="kid-tooth-art" viewBox="0 0 60 70" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`kt-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#f6f1e6" /><stop offset="1" stopColor="#e3d6bd" /></linearGradient>
      </defs>
      <g transform={lower ? 'translate(0 70) scale(1 -1)' : undefined}>
        <path d="M6 4 H54 C57 4 58 7 58 10 V44 C58 60 47 67 30 67 C13 67 2 60 2 44 V10 C2 7 3 4 6 4 Z" fill={`url(#kt-${uid})`} stroke="#b9a988" strokeWidth="2.4" />
        <path d="M12 12 C11 24 11 36 14 46" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".9" />
        {shine && <path d="M44 16 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 z" fill="#f6c94c" />}
      </g>
    </svg>
  );
}

/** Bichito: una manchita verde con antenas, cara divertida y burbujas. */
export function Germ({ variant = 0 }: { variant?: number }) {
  const body = ['#8fd16b', '#b38ce0', '#f2a65a'][variant % 3];
  const dark = ['#4f8f34', '#7350a8', '#b8652a'][variant % 3];
  return (
    <svg className="germ" viewBox="0 0 60 60" aria-hidden="true" focusable="false">
      <path d="M22 12 Q18 4 13 5 M38 12 Q42 4 47 5" stroke={dark} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="13" cy="5" r="3.4" fill={body} stroke={dark} strokeWidth="1.6" />
      <circle cx="47" cy="5" r="3.4" fill={body} stroke={dark} strokeWidth="1.6" />
      <path d="M30 10 C44 10 54 18 54 32 C54 46 44 54 30 54 C16 54 6 46 6 32 C6 18 16 10 30 10 Z" fill={body} stroke={dark} strokeWidth="2.4" />
      <circle cx="17" cy="40" r="3" fill={dark} opacity=".35" /><circle cx="44" cy="22" r="2.4" fill={dark} opacity=".35" /><circle cx="46" cy="42" r="2" fill={dark} opacity=".35" />
      <ellipse cx="23" cy="29" rx="5.4" ry="6.4" fill="#fff" /><ellipse cx="38" cy="29" rx="5.4" ry="6.4" fill="#fff" />
      <circle cx="24" cy="30.5" r="2.8" fill="#173c3a" /><circle cx="37" cy="30.5" r="2.8" fill="#173c3a" />
      <path d="M24 41 Q30 46 36 41" stroke="#173c3a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M27 42.6 v3 M33 42.6 v3" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

/** Boca del tablero: labios, encías y lengua. Los dientes son botones que se ubican encima. */
export function GameMouth() {
  const uid = useId().replace(/:/g, '');
  const mouth = 'M48 112 C150 40 450 40 552 112 C540 250 430 316 300 316 C170 316 60 250 48 112 Z';
  return (
    <svg className="game-mouth" viewBox="0 0 600 340" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`in-${uid}`} cx=".5" cy=".55" r=".6"><stop offset="0" stopColor="#7a2f3a" /><stop offset="1" stopColor="#3b1018" /></radialGradient>
        <clipPath id={`m-${uid}`}><path d={mouth} /></clipPath>
      </defs>
      <path d={mouth} fill={`url(#in-${uid})`} />
      <g clipPath={`url(#m-${uid})`}>
        <ellipse cx="300" cy="300" rx="150" ry="70" fill="#e27d8c" />
        <path d="M300 250 V320" stroke="#c9606f" strokeWidth="4" strokeLinecap="round" />
        <path d="M30 40 V118 C160 72 440 72 570 118 V40 Z" fill="#f2a7a2" />
        <path d="M30 330 V282 C160 312 440 312 570 282 V330 Z" fill="#f2a7a2" />
      </g>
      <path d={mouth} fill="none" stroke="#e58f95" strokeWidth="26" strokeLinejoin="round" />
      <path d={mouth} fill="none" stroke="#c96a73" strokeWidth="3" />
      <path d="M150 34 C220 18 380 18 450 34" stroke="#fff" strokeOpacity=".45" strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function StarArt({ filled }: { filled: boolean }) {
  return (
    <svg className={`star-art ${filled ? 'is-on' : ''}`} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path d="M20 3 L25 14.6 L37.6 15.6 L28 23.8 L31 36 L20 29.4 L9 36 L12 23.8 L2.4 15.6 L15 14.6 Z" fill={filled ? '#f6c94c' : 'none'} stroke={filled ? '#b8862b' : 'currentColor'} strokeWidth="2.4" strokeLinejoin="round" />
      {filled && <path d="M14 15 L18 10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".8" />}
    </svg>
  );
}
