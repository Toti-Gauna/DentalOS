import { Link } from 'react-router-dom'
import { PageHead } from '../ui/Shell'
import { Callout } from '../ui/kit'
import { COVERAGE } from './coverage'

export function Comercial() {
  return (
    <main className="wrap">
      <PageHead title="Alcance de la demo y condiciones comerciales" sub="Hoja informativa interna · valores fechados al 16/10/2026, vigencia pendiente de revalidar" />
      <Callout tone="warn">
        La demo exhibe los 15 módulos para mostrar amplitud; <strong>no se vende todo por USD 500</strong>. Mockup ≠ integración: esta demo no se integra con Fudo, Maxirest, Woki, Meitre ni ningún proveedor, y Mesa Clara y Ritual Café son negocios ficticios. Todo el contenido es de muestra.
      </Callout>
      <section className="card" style={{ marginTop: 14 }} aria-labelledby="cob">
        <h2 id="cob">Cobertura de módulos (M01–M15)</h2>
        <div className="table-wrap">
          <table className="matrix">
            <caption className="sr-only">Matriz de cobertura</caption>
            <thead><tr><th>Módulo</th><th>Ruta real</th><th>Acción</th><th>Entidad</th><th>Admin</th><th>Escenarios</th><th>Automatización</th></tr></thead>
            <tbody>
              {COVERAGE.map((c) => (
                <tr key={c.id}><td><strong>{c.id}</strong> {c.name}</td><td><code>{c.route}</code></td><td>{c.action}</td><td>{c.entity}</td><td><code>{c.admin}</code></td><td>{c.scenarios}</td><td>{c.automations}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <section className="card" aria-labelledby="impl">
          <h2 id="impl">Implementación (tarifario del 16/10/2026)</h2>
          <ul>
            <li><strong>Adaptación</strong> compatible desde USD 500, con marca y gamificación estándar incluida (50 % de anticipo y 50 % al aprobar la entrega). Una sede y hasta 25 ítems es un recorte comercial propuesto, distinto de los 42 productos del fixture.</li>
            <li><strong>Landing adicional</strong> compatible: USD 200, sin cobrarla dos veces.</li>
            <li><strong>Módulo operativo</strong> desde USD 750; <strong>fase ampliada</strong> desde USD 1.000 (dos módulos relacionados y una integración compatible; no es un ERP/POS entero).</li>
            <li><strong>WhatsApp estándar sin IA</strong>: complemento compatible USD 100 (un botón manual no es una automatización).</li>
            <li><strong>Chatbot IA y voz productiva</strong>: desde USD 750 independientes o USD 250 como complemento compatible, con caso, canal y derivación delimitados y proveedor/costos validados. Ninguna integración se incluye por mostrar un simulador.</li>
            <li><strong>Migración Excel/PDF</strong>: USD 100–300 una vez, tras una muestra.</li>
            <li>Campañas, premios, identidad completa y growth recurrente: aparte o a cotizar.</li>
          </ul>
        </section>
        <section className="card" aria-labelledby="mant">
          <h2 id="mant">Mantenimiento mensual</h2>
          <ul>
            <li><strong>Esencial</strong> USD 30/mes: incluye hasta USD 5 de terceros.</li>
            <li><strong>Conectado</strong> USD 75/mes: hasta USD 15 totales y una integración estándar.</li>
            <li><strong>Automatización/IA</strong> USD 150/mes: hasta USD 40 totales y dos flujos estándar en total (uno puede usar IA).</li>
            <li>Todos incluyen hasta dos horas mensuales totales, no acumulables. Aviso al 80 %; sin sobrecargo automático. Al agotarse, pausa del flujo acordado preservando acceso y datos, con vía manual.</li>
            <li>Dominio y renovación aparte salvo inclusión expresa. No se promete desarrollo ilimitado.</li>
          </ul>
          <h3>Pack y asesorías</h3>
          <p className="small">Pack USD 700 (adaptación + landing adicional + ambas asesorías puntuales) sujeto a compatibilidad y capacidad real; no hay bonificación fuera del pack. Asesoría de growth/marketing/marca USD 150; de gestión económica USD 150; ambas USD 250. <strong>Condición pendiente:</strong> la asesoría económica no se anuncia disponible sin responsable y metodología comprobados, y la capacidad no está confirmada: por eso no hay botón de compra.</p>
        </section>
      </div>
      <p className="muted small" style={{ marginTop: 14 }}>Estos importes provienen del tarifario aprobado del 16/10/2026 y no fueron revalidados contra la fuente en esta construcción: vigencia pendiente. No hay descuentos, escasez, cifras de retorno ni testimonios. Volver a la <Link to="/">demo</Link>.</p>
    </main>
  )
}
