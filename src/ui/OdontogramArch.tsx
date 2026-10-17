// Odontograma anatómico: arcadas en U con cada pieza en vista oclusal y las superficies marcadas sobre el diente.
// Cada pieza es un <button> real (foco, teclado y nombre accesible con sus registros); la geometría solo ubica.
import type { CSSProperties } from 'react';
import type { ToothChartEntry } from '../domain';
import { ARCH_H, ARCH_W, ArchBackdrop, OcclusalTooth, archSlots, type SurfaceMarks } from './art/dentition';
import { primaryState } from './art/teeth';

/** Marcas por superficie: lo planificado (pendiente) se muestra por encima de lo realizado. */
export function marksFor(entries: ToothChartEntry[]): SurfaceMarks {
  const m: SurfaceMarks = {};
  for (const e of entries) {
    const k = e.surface;
    if (e.state === 'planificado') m[k] = 'planificado';
    else if (!m[k]) m[k] = 'realizado';
  }
  // “Pieza completa realizada” ya la cuenta la ilustración del material; solo se marca lo planificado.
  if (m.pieza === 'realizado') delete m.pieza;
  return m;
}

export function OdontogramArch({ dentition, entries, selected, onPick }: { dentition: 'permanente' | 'temporal'; entries: ToothChartEntry[]; selected: number | null; onPick: (n: number) => void }) {
  const temporal = dentition === 'temporal';
  const arch = (upper: boolean) => {
    const slots = archSlots(dentition, upper);
    return (
      <div className={`arch-map ${upper ? 'is-upper' : 'is-lower'}`} style={{ aspectRatio: `${ARCH_W} / ${ARCH_H}` }}>
        <ArchBackdrop upper={upper} temporal={temporal} />
        {slots.map((sl) => {
          const es = entries.filter((t) => t.tooth === sl.tooth);
          const art = primaryState(es.filter((e) => e.state === 'realizado').map((e) => e.procedure));
          const style: CSSProperties = {
            left: `${(sl.x / ARCH_W) * 100}%`, top: `${(sl.y / ARCH_H) * 100}%`, width: `${(sl.w / ARCH_W) * 100}%`,
            aspectRatio: `${sl.w} / ${sl.d}`, transform: `translate(-50%, -50%) rotate(${sl.angle.toFixed(2)}deg)${sl.mirror ? ' scaleX(-1)' : ''}`,
          };
          return (
            <span key={sl.tooth} style={{ display: 'contents' }}>
              <button type="button" className="arch-tooth" style={style} data-art={art} aria-pressed={selected === sl.tooth} onClick={() => onPick(sl.tooth)}
                aria-label={`Pieza ${sl.tooth}${es.length ? `, ${es.length} registro(s): ${es.map((e) => `${e.procedure} ${e.state}`).join('; ')}` : ''}`}>
                <OcclusalTooth kind={sl.kind} state={art} temporal={temporal} marks={marksFor(es)} />
              </button>
              <span className={`arch-num ${selected === sl.tooth ? 'is-on' : ''} ${es.length ? 'has-records' : ''}`} aria-hidden="true" style={{ left: `${(sl.lx / ARCH_W) * 100}%`, top: `${(sl.ly / ARCH_H) * 100}%` }}>{sl.tooth}</span>
            </span>
          );
        })}
      </div>
    );
  };
  return (
    <div className="arch-chart">
      <p className="arch-caption">Superior · vista oclusal (la derecha de la persona, a la izquierda)</p>
      <div className="arch-scroll">{arch(true)}</div>
      <div className="arch-scroll">{arch(false)}</div>
      <p className="arch-caption">Inferior · vista oclusal</p>
    </div>
  );
}
