// Familia de ilustraciones de la dirección A (lote 4): línea fina en teal, acentos de oro y rellenos de papel.
// Todas comparten viewBox 160×120, trazo de 1.6 px y colores del tema (sirven en claro y oscuro).
// Son decorativas (aria-hidden) salvo que reciban `title`: entonces son imágenes con nombre accesible.
import { useId, type ReactNode } from 'react';

export type SpotKind =
  | 'visitante' | 'paciente' | 'recepcion' | 'profesional' | 'direccion'
  | 'comprobante' | 'ticket' | 'campana' | 'guia' | 'cierre' | 'juego';

export const SPOTS: { kind: SpotKind; label: string; use: string }[] = [
  { kind: 'visitante', label: 'Visitante', use: 'Selector de vista' },
  { kind: 'paciente', label: 'Paciente / responsable', use: 'Selector de vista' },
  { kind: 'recepcion', label: 'Recepción', use: 'Selector de vista' },
  { kind: 'profesional', label: 'Profesional', use: 'Selector de vista' },
  { kind: 'direccion', label: 'Dirección', use: 'Selector de vista' },
  { kind: 'comprobante', label: 'Comprobante de turno', use: 'Reserva confirmada' },
  { kind: 'ticket', label: 'Ticket con código', use: 'Códigos y QR (lote 7)' },
  { kind: 'campana', label: 'Campaña administrativa', use: 'Campañas (lote 6)' },
  { kind: 'guia', label: 'Guía de recorrido', use: 'Guía y retomar (lote 9)' },
  { kind: 'cierre', label: 'Cierre comercial', use: 'Cierre Eclipse (lote 9)' },
  { kind: 'juego', label: 'Juego de Brisa Chicos', use: 'Juegos (lote 5)' },
];

const INK = 'var(--primary)';
const GOLD = 'var(--gold)';
const PAPER = 'var(--surface)';
const TINT = 'var(--primary-50)';
const HAIR = 'var(--line)';
const MUTED = 'var(--line-strong)';

/** Molar de dos raíces, en una caja de 28×40 con origen arriba a la izquierda. */
const MOLAR = 'M2 9 C1.5 3 6 0 10 1.6 C11.6 2.3 12.8 2.6 14 2.6 C15.2 2.6 16.4 2.3 18 1.6 C22 0 26.5 3 26 9 C25.5 14.5 23.8 18 22.8 22 C21.6 26.6 21.6 33.4 19.2 38 C18 40.3 15.8 39.7 15.5 36.8 L14.6 29 C14.3 27.4 13.7 27.4 13.4 29 L12.5 36.8 C12.2 39.7 10 40.3 8.8 38 C6.4 33.4 6.4 26.6 5.2 22 C4.2 18 2.5 14.5 2 9 Z';

function Sparkle({ x, y, r = 4 }: { x: number; y: number; r?: number }) {
  const k = r * 0.28;
  return <path d={`M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`} fill={GOLD} />;
}

function Molar({ x, y, s = 1, fill = PAPER }: { x: number; y: number; s?: number; fill?: string }) {
  return <path d={MOLAR} transform={`translate(${x} ${y}) scale(${s})`} fill={fill} stroke={INK} strokeWidth={1.6 / s} strokeLinejoin="round" />;
}

function Ground() {
  return <path d="M14 108 H146" stroke={MUTED} strokeWidth="1.2" strokeLinecap="round" opacity=".6" />;
}

const DRAW: Record<SpotKind, (id: (n: string) => string) => ReactNode> = {
  visitante: () => (
    <>
      <Ground />
      <path d="M46 108 V60 A34 34 0 0 1 114 60 V108" fill={PAPER} stroke={INK} strokeWidth="1.6" />
      <path d="M56 108 V62 A24 24 0 0 1 104 62 V108" fill="none" stroke={HAIR} strokeWidth="1.2" strokeDasharray="2 4" />
      <Molar x={66} y={50} s={1} />
      <path d="M68 40 H92" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M118 108 C120 96 128 88 140 85 M126 96 C131 95 135 92 137 88" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <Sparkle x={34} y={40} r={5} /><Sparkle x={126} y={30} r={3.5} />
    </>
  ),
  paciente: () => (
    <>
      <Ground />
      <circle cx="52" cy="46" r="15" fill={PAPER} stroke={INK} strokeWidth="1.6" />
      <path d="M26 108 V98 C26 82 37 74 52 74 C67 74 78 82 78 98 V108" fill={PAPER} stroke={INK} strokeWidth="1.6" />
      <path d="M44 48 Q52 54 60 48" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <g transform="rotate(-6 114 64)">
        <rect x="90" y="36" width="48" height="60" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.6" />
        {[44, 52, 60, 68, 76, 84].map((y) => <circle key={y} cx="90" cy={y} r="2.2" fill="var(--bg)" stroke={INK} strokeWidth="1" />)}
        <text x="114" y="68" textAnchor="middle" fontFamily="var(--font-display)" fontSize="24" fill={INK}>22</text>
        <path d="M100 76 H128 M100 84 H120" stroke={HAIR} strokeWidth="2" strokeLinecap="round" />
        <path d="M100 45 H118" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </>
  ),
  recepcion: () => (
    <>
      <Ground />
      <rect x="34" y="28" width="92" height="74" rx="4" fill={PAPER} stroke={INK} strokeWidth="1.6" />
      <path d="M34 44 H126" stroke={INK} strokeWidth="1.2" />
      {[52, 72, 92, 108].map((x) => <path key={x} d={`M${x} 22 V34`} stroke={INK} strokeWidth="2" strokeLinecap="round" />)}
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => (
        <rect key={`${r}-${c}`} x={42 + c * 21} y={51 + r * 16} width="15" height="10" rx="2" fill={r === 1 && c === 2 ? TINT : 'none'} stroke={r === 1 && c === 2 ? GOLD : HAIR} strokeWidth={r === 1 && c === 2 ? 1.6 : 1.1} />
      )))}
      <path d="M88 72 l3 3 l6 -6" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <Sparkle x={136} y={30} r={4} />
    </>
  ),
  profesional: () => (
    <>
      <Ground />
      <Molar x={36} y={42} s={1.45} fill={TINT} />
      <circle cx="112" cy="40" r="15" fill={PAPER} stroke={INK} strokeWidth="1.6" />
      <circle cx="112" cy="40" r="10" fill="none" stroke={HAIR} strokeWidth="1.2" />
      <path d="M103 52 L76 100" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M103 52 L76 100" stroke={PAPER} strokeWidth="1" strokeLinecap="round" />
      <path d="M44 40 Q50 34 56 38" fill="none" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
      <Sparkle x={134} y={70} r={4} />
    </>
  ),
  direccion: () => (
    <>
      <path d="M30 24 V102 H136" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      {[40, 64, 88].map((y) => <path key={y} d={`M30 ${y} H136`} stroke={HAIR} strokeWidth="1" strokeDasharray="2 4" />)}
      {[[42, 70], [62, 52], [82, 60], [102, 38]].map(([x, top], i) => (
        <rect key={x} x={x} y={top} width="14" height={102 - top} rx="1.5" fill={i === 3 ? GOLD : TINT} stroke={i === 3 ? GOLD : INK} strokeWidth="1.2" opacity={i === 3 ? 0.85 : 1} />
      ))}
      <path d="M49 62 L69 44 L89 52 L109 30 L128 24" fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {[[49, 62], [69, 44], [89, 52], [109, 30]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.6" fill={PAPER} stroke={INK} strokeWidth="1.3" />)}
      <text x="128" y="18" textAnchor="end" fontFamily="var(--font-ui)" fontSize="9" fill={INK}>n = 14</text>
    </>
  ),
  comprobante: () => (
    <>
      <Ground />
      <path d="M50 14 H110 V100 L104 105 L98 100 L92 105 L86 100 L80 105 L74 100 L68 105 L62 100 L56 105 L50 100 Z" fill={PAPER} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="60" y="24" width="16" height="16" rx="2" fill={TINT} stroke={INK} strokeWidth="1.4" />
      <path d="M64 31 H72 M64 35 H70" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M82 28 H100 M82 35 H96" stroke={HAIR} strokeWidth="2" strokeLinecap="round" />
      <path d="M60 52 H100 M60 60 H92 M60 68 H96" stroke={HAIR} strokeWidth="2" strokeLinecap="round" />
      <path d="M58 46 H102" stroke={GOLD} strokeWidth="1.2" />
      <g transform="rotate(-12 96 84)">
        <circle cx="96" cy="84" r="13" fill="none" stroke={GOLD} strokeWidth="1.6" />
        <path d="M90 84 l4 4 l8 -8" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <Sparkle x={124} y={26} r={4} />
    </>
  ),
  ticket: (id) => (
    <>
      <defs><mask id={id('notch')}><rect x="0" y="0" width="160" height="120" fill="#fff" /><circle cx="104" cy="30" r="5" fill="#000" /><circle cx="104" cy="94" r="5" fill="#000" /></mask></defs>
      <g mask={`url(#${id('notch')})`}>
        <rect x="18" y="30" width="126" height="64" rx="4" fill={PAPER} stroke={INK} strokeWidth="1.6" />
      </g>
      <path d="M104 38 V86" stroke={INK} strokeWidth="1.2" strokeDasharray="3 3" />
      <text x="30" y="62" fontFamily="var(--font-display)" fontSize="15" fill={INK}>A-0012</text>
      <path d="M30 71 H86 M30 79 H74" stroke={HAIR} strokeWidth="2" strokeLinecap="round" />
      <path d="M30 43 H52" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
      {/* Motivo de código decorativo: no es un QR legible. */}
      <g fill={INK}>
        {[[112, 44], [128, 44], [112, 70]].map(([x, y]) => (
          <g key={`${x}-${y}`}><rect x={x} y={y} width="10" height="10" rx="1.5" fill="none" stroke={INK} strokeWidth="1.6" /><rect x={x + 3.2} y={y + 3.2} width="3.6" height="3.6" /></g>
        ))}
        {[[128, 64], [134, 70], [128, 76], [134, 58], [122, 64], [140, 76]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx=".8" />)}
      </g>
    </>
  ),
  campana: () => (
    <>
      <Ground />
      <rect x="30" y="44" width="78" height="54" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.6" />
      <path d="M30 46 L69 74 L108 46" fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M30 96 L58 70 M108 96 L80 70" stroke={HAIR} strokeWidth="1.2" />
      <g transform="translate(104 22)">
        <path d="M8 28 C8 14 13 8 20 8 C27 8 32 14 32 28 L35 33 H5 Z" fill={TINT} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M16 36 Q20 41 24 36" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="20" cy="5" r="2" fill={GOLD} />
      </g>
      <path d="M44 58 H62" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
      <Sparkle x={22} y={30} r={4} />
    </>
  ),
  guia: () => (
    <>
      <Ground />
      <path d="M28 92 C44 92 44 64 62 64 C80 64 78 88 96 86 C114 84 108 50 128 40" fill="none" stroke={INK} strokeWidth="1.6" strokeDasharray="1 5" strokeLinecap="round" />
      {[[28, 92, '1'], [62, 64, '2'], [96, 86, '3']].map(([x, y, n]) => (
        <g key={n as string}>
          <circle cx={x as number} cy={y as number} r="9" fill={PAPER} stroke={INK} strokeWidth="1.6" />
          <text x={x as number} y={(y as number) + 4} textAnchor="middle" fontFamily="var(--font-display)" fontSize="12" fill={INK}>{n}</text>
        </g>
      ))}
      <path d="M128 40 V18" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M128 18 L146 23 L128 29 Z" fill={GOLD} stroke={GOLD} strokeWidth="1" strokeLinejoin="round" />
      <circle cx="128" cy="40" r="3" fill={INK} />
    </>
  ),
  cierre: () => (
    <>
      <Ground />
      <rect x="38" y="16" width="70" height="88" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.6" />
      <path d="M50 32 H96 M50 41 H90 M50 50 H94 M50 59 H82" stroke={HAIR} strokeWidth="2" strokeLinecap="round" />
      <path d="M50 26 H70" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M50 86 C56 78 60 92 66 84 C70 79 74 88 80 83" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M50 92 H86" stroke={MUTED} strokeWidth="1" />
      <g transform="translate(112 70)">
        <path d="M-8 10 L-12 30 L-3 24 L2 32 L5 12 Z" fill={GOLD} opacity=".55" />
        <circle cx="0" cy="0" r="15" fill={PAPER} stroke={GOLD} strokeWidth="1.8" />
        <circle cx="0" cy="0" r="10" fill="none" stroke={GOLD} strokeWidth="1" strokeDasharray="1.5 2.5" />
        <Sparkle x={0} y={0} r={5} />
      </g>
    </>
  ),
  juego: () => (
    <>
      <Ground />
      <g transform="rotate(-28 80 64)">
        <rect x="24" y="60" width="96" height="9" rx="4.5" fill={TINT} stroke={INK} strokeWidth="1.6" />
        <rect x="112" y="48" width="22" height="13" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.4" />
        {[115, 120, 125, 130].map((x) => <path key={x} d={`M${x} 48 V38`} stroke={INK} strokeWidth="1.6" strokeLinecap="round" />)}
      </g>
      {[[44, 34, 7], [60, 22, 4.5], [30, 52, 4]].map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={r} fill="none" stroke={INK} strokeWidth="1.2" />)}
      <path d="M118 84 L121.5 91 L129 92 L123.5 97 L125 104.5 L118 101 L111 104.5 L112.5 97 L107 92 L114.5 91 Z" fill={GOLD} stroke={GOLD} strokeWidth="1" strokeLinejoin="round" />
      <Sparkle x={140} y={70} r={4} />
    </>
  ),
};

/** Ilustración de la familia editorial. Con `title` es una imagen con nombre; sin `title`, decorativa. */
export function SpotArt({ kind, size = 160, title, className = '' }: { kind: SpotKind; size?: number; title?: string; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `sp-${n}-${uid}`;
  const labelled = title ? { role: 'img', 'aria-labelledby': id('t') } : { 'aria-hidden': true as const };
  return (
    <svg className={`spot-art spot-${kind} ${className}`} viewBox="0 0 160 120" width={size} height={size * 0.75} focusable="false" {...labelled}>
      {title && <title id={id('t')}>{title}</title>}
      {DRAW[kind](id)}
    </svg>
  );
}
