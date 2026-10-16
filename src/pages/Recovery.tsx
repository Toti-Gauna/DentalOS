import { Callout } from '../ui/kit'
import { PageHead } from '../ui/Shell'
import { recoverInMemory, recoverWith, recoveryDiagnostic, useSnapshot } from '../store'

export function Recovery() {
  const { recovery } = useSnapshot()
  if (!recovery) return null
  const title =
    recovery.kind === 'corrupt'
      ? 'El estado guardado de la demo no es válido'
      : recovery.kind === 'future'
        ? 'El estado guardado es de una versión más nueva'
        : 'El estado guardado es de una versión anterior sin migración'
  const download = () => {
    const d = recoveryDiagnostic()
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tableflow-diagnostico-sintetico.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <main className="wrap" data-testid="recovery">
      <PageHead title={title} />
      <Callout tone="warn" role="alert">
        La demo no pisa ni borra nada sola. Elegí cómo seguir: exportá un diagnóstico sintético, restaurá un seed (el texto original se resguarda antes en la clave <code>tableflow.demo.v1.corrupt-backup</code>) o seguí en memoria sin tocar lo guardado.
      </Callout>
      {recovery.kind === 'corrupt' && (
        <section className="card" style={{ marginTop: 14 }}>
          <h2>Problemas detectados ({recovery.errors.length})</h2>
          <ul>
            {recovery.errors.slice(0, 12).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>
      )}
      {recovery.kind !== 'corrupt' && (
        <section className="card" style={{ marginTop: 14 }}>
          <p>
            Versión encontrada: <strong>{recovery.version}</strong>. Esta build entiende la versión 1 y no tiene migrador explícito para esa versión. Podés reiniciar a un seed (se resguarda el original) o seguir en memoria.
          </p>
        </section>
      )}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn secondary" type="button" onClick={download} data-testid="export-diag">Exportar diagnóstico</button>
        <button className="btn" type="button" onClick={() => recoverWith('servicio')} data-testid="restore-servicio">Restaurar seed “servicio cargado”</button>
        <button className="btn secondary" type="button" onClick={() => recoverWith('vacio')} data-testid="restore-vacio">Restaurar seed vacío</button>
        <button className="btn ghost" type="button" onClick={recoverInMemory} data-testid="continue-memory">Seguir en memoria (sin guardar)</button>
      </div>
    </main>
  )
}
