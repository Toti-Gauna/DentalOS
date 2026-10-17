// Marca propia de la clínica ficticia y avatares ilustrados del equipo (sin fotos reales).
import { useId } from 'react';
import { OrthoArt } from './ortho';
import { ToothArt } from './teeth';

export function BrandMark({ size = 36 }: { size?: number }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`bm-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2c6f69" /><stop offset="1" stopColor="#173c3a" /></linearGradient>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#c8952c" /><stop offset=".5" stopColor="#f3d98a" /><stop offset="1" stopColor="#b8862b" /></linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#bm-${uid})`} />
      <path d="M14 17c0-3.2 2.4-5.6 5.6-5.6 2.4 0 3.4 1.3 4.4 1.3s2-1.3 4.4-1.3c3.2 0 5.6 2.4 5.6 5.6 0 3.8-1.9 5.6-2.6 8.9-.6 3.2-1.3 10.1-3.6 10.1-2 0-2.2-6-4.9-6s-2.9 6-4.9 6c-2.3 0-3-6.9-3.6-10.1C15.9 22.6 14 20.8 14 17z" fill="#f6f4ee" />
      <path d="M9 30c8-5 22-5 30 0" stroke={`url(#bg-${uid})`} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="37" cy="12" r="2.4" fill={`url(#bg-${uid})`} />
    </svg>
  );
}

const PALETTES = [['#2c6f69', '#173c3a'], ['#8a6514', '#5c430d'], ['#2d5770', '#1d3a4b'], ['#526865', '#33423f']];

/** Avatar ilustrado con iniciales y emblema de especialidad. */
export function ProAvatar({ name, specialty, index = 0, size = 56 }: { name: string; specialty: string; index?: number; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const initials = name.replace(/^(Dra?|Lic)\.\s*/, '').split(' ').map((w) => w[0]).slice(0, 2).join('');
  const [a, b] = PALETTES[index % PALETTES.length];
  const ortho = specialty === 'Ortodoncia';
  return (
    <span className="pro-avatar" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 64 64" focusable="false">
        <defs>
          <linearGradient id={`av-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
          <linearGradient id={`ring-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c8952c" /><stop offset=".5" stopColor="#f3d98a" /><stop offset="1" stopColor="#b8862b" /></linearGradient>
        </defs>
        <circle cx="32" cy="32" r="31" fill={`url(#ring-${uid})`} />
        <circle cx="32" cy="32" r="28" fill={`url(#av-${uid})`} />
        <text x="32" y="38" textAnchor="middle" fontFamily="'Source Sans 3', sans-serif" fontWeight="700" fontSize="18" fill="#fff">{initials}</text>
      </svg>
      <span className="pro-avatar-badge">{ortho ? <OrthoArt kind="brackets_metalicos" width={26} /> : <ToothArt kind="molar" width={14} />}</span>
    </span>
  );
}

const PERSON_PALETTES = [['#2c6f69', '#173c3a'], ['#2d5770', '#1d3a4b'], ['#7a5410', '#5c430d'], ['#5a4a7a', '#3a2f52'], ['#8a3f4a', '#5e2a32'], ['#526865', '#33423f']];

/** Avatar de persona con iniciales sobre un degradé estable por ID (ilustración, nunca foto). */
export function PersonAvatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  const n = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [a, b] = PERSON_PALETTES[n % PERSON_PALETTES.length];
  const initials = name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <span className="person-avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: `linear-gradient(135deg, ${a}, ${b})` }}>{initials}</span>;
}
