// Ilustración por motivo de consulta (composición propia con las piezas y aparatos ilustrados).
import { useId } from 'react';
import { OrthoArt } from './ortho';
import { ToothArt } from './teeth';

export function ServiceArt({ serviceTypeId, size = 96 }: { serviceTypeId: string; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const ortho = serviceTypeId.startsWith('ST-ORTO');
  return (
    <svg className="service-art" width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`sc-${uid}`}><circle cx="48" cy="48" r="46" /></clipPath>
      </defs>
      <circle cx="48" cy="48" r="46" fill={ortho ? 'var(--primary-50)' : 'var(--sand-50)'} stroke="var(--line)" strokeWidth="1" />
      <path d="M14 22 A46 46 0 0 1 48 2" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" />
      <g clipPath={`url(#sc-${uid})`}>
      {serviceTypeId === 'ST-PRIMERA' && (
        <g>
          <g transform="translate(16 12)"><ToothArt kind="incisivo" width={40} /></g>
          <rect x="52" y="34" width="28" height="36" rx="4" fill="#fff" stroke="#9c9484" strokeWidth="1.5" />
          <rect x="60" y="30" width="12" height="7" rx="2" fill="#245e59" />
          <path d="M57 46 h18 M57 53 h18 M57 60 h12" stroke="#c9bfae" strokeWidth="2" strokeLinecap="round" />
          <circle cx="76" cy="66" r="8" fill="#245e59" /><path d="M72 66 l3 3 5 -6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {serviceTypeId === 'ST-CONTROL' && (
        <g>
          <g transform="translate(14 10)"><ToothArt kind="molar" width={44} /></g>
          <circle cx="62" cy="40" r="13" fill="#e7f1f6" fillOpacity=".7" stroke="#173c3a" strokeWidth="3.5" />
          <path d="M71 50 L82 62" stroke="#173c3a" strokeWidth="5" strokeLinecap="round" />
          <path d="M56 36 q4 -5 10 -2" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      )}
      {serviceTypeId === 'ST-LIMPIEZA' && (
        <g>
          <g transform="translate(14 10)"><ToothArt kind="incisivo" width={42} /></g>
          <g transform="rotate(35 64 50)"><rect x="60" y="30" width="8" height="44" rx="4" fill="#2f8f86" stroke="#1b4a46" strokeWidth="1.2" /><rect x="58" y="18" width="12" height="14" rx="3" fill="#fff" stroke="#8f979c" strokeWidth="1.2" /><path d="M60 21 v9 M63 21 v9 M66 21 v9" stroke="#9fd3cc" strokeWidth="1.4" /></g>
          <circle cx="24" cy="24" r="4" fill="#fff" stroke="#bfe0ee" /><circle cx="30" cy="16" r="2.6" fill="#fff" stroke="#bfe0ee" /><circle cx="70" cy="74" r="3.4" fill="#fff" stroke="#bfe0ee" />
          <path d="M40 12 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 z" fill="#e2b84a" />
        </g>
      )}
      {serviceTypeId === 'ST-TRAT' && (
        <g>
          <g transform="translate(10 12)"><ToothArt kind="molar" state="corona_oro" width={40} /></g>
          <g transform="translate(46 12)"><ToothArt kind="premolar" state="resina" width={40} /></g>
        </g>
      )}
      {serviceTypeId === 'ST-ORTO-CONS' && <g transform="translate(-14 16)"><OrthoArt kind="brackets_metalicos" width={124} /></g>}
      {serviceTypeId === 'ST-ORTO-CTRL' && (
        <g>
          <g transform="translate(-14 12)"><OrthoArt kind="alineadores" width={124} /></g>
          <rect x="58" y="58" width="26" height="24" rx="4" fill="#fff" stroke="#173c3a" strokeWidth="1.6" />
          <rect x="58" y="58" width="26" height="7" rx="3" fill="#245e59" />
          <circle cx="71" cy="73" r="3.5" fill="#c8952c" />
        </g>
      )}
      </g>
    </svg>
  );
}
