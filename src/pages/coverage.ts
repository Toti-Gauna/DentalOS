// Matriz de cobertura M01–M15 → ruta real → acción → entidad → admin → S/AU.
// Fuente única: la usan la página /comercial, docs/tableflow/coverage.md y los tests.
export interface Coverage {
  id: string
  name: string
  route: string
  action: string
  entity: string
  admin: string
  scenarios: string
  automations: string
}
export const COVERAGE: Coverage[] = [
  { id: 'M01', name: 'Carta', route: '/:perfil/carta', action: 'Buscar, filtrar, favoritas, detalle y selector de sede', entity: 'MenuItem, Location', admin: '/admin/carta', scenarios: 'S01, S09', automations: '—' },
  { id: 'M02', name: 'Configuración y carrito', route: '/:perfil/carta/:itemId · /:perfil/pedido', action: 'Modificadores obligatorios/máximos, cantidad, nota, precio cambiado', entity: 'Cart, CartLine, ModifierGroup', admin: '/admin/pedidos', scenarios: 'S02, S03, S04, S05, S08', automations: '—' },
  { id: 'M03', name: 'Reservas y espera', route: '/:perfil/reservar · /:perfil/reservas/:id', action: 'Solicitar, reprogramar, cancelar, alternativas, lista de espera', entity: 'Reservation, WaitlistEntry, Table, ServiceWindow', admin: '/admin/reservas · /admin/configuracion', scenarios: 'S10–S16, S30, S34', automations: 'AU01, AU02, AU03, AU04' },
  { id: 'M04', name: 'Salón', route: '/admin/salon', action: 'Plano/lista, sentar, abrir, mover y combinar (regla de muestra)', entity: 'TableSession, Table', admin: '/admin/salon', scenarios: 'S17, S18', automations: '—' },
  { id: 'M05', name: 'Pedidos', route: '/:perfil/pedido/:id', action: 'Enviar, aceptar/rechazar, editar, cancelar, duplicar, folio', entity: 'Order, OrderLine, KitchenTicket', admin: '/admin/pedidos', scenarios: 'S05, S06, S10, S42', automations: 'AU05' },
  { id: 'M06', name: 'Cocina / barra', route: '/admin/cocina', action: 'Cola por estación, aceptar, preparar, listo, entregar, incidencia', entity: 'KitchenTicket, Order', admin: '/admin/cocina', scenarios: 'S19, S20', automations: 'AU05' },
  { id: 'M07', name: 'Caja', route: '/admin/caja', action: 'Apertura, movimientos, división, pagos DEMO, arqueo y cierre', entity: 'CashSession, PaymentSimulation', admin: '/admin/caja', scenarios: 'S23–S26', automations: '—' },
  { id: 'M08', name: 'Carta (admin)', route: '/admin/carta', action: 'Precio, agotado, nota alimentaria, orden de categorías, historial', entity: 'MenuItem (versión)', admin: '/admin/carta', scenarios: 'S07, S08', automations: '—' },
  { id: 'M09', name: 'Inventario y recetas', route: '/admin/stock', action: 'Reservar/consumir/liberar, reponer, ajustar, merma, unidades', entity: 'Ingredient, Recipe, StockMovement', admin: '/admin/stock', scenarios: 'S07, S21, S22', automations: 'AU06' },
  { id: 'M10', name: 'Clientes', route: '/admin/clientes/:id', action: 'Ficha, consentimientos separados, unir duplicados con confirmación', entity: 'CustomerDemo', admin: '/admin/clientes', scenarios: 'S34, S37', automations: 'AU10' },
  { id: 'M11', name: 'WhatsApp y voz', route: '/:perfil/simulador · /:perfil/ayuda', action: 'Chat determinista, llamada por botones, derivación humana', entity: 'Conversation, Message, CallSession, HumanReviewTask', admin: '/admin/resumen (tareas)', scenarios: 'S27–S35', automations: 'AU07' },
  { id: 'M12', name: 'Automatizaciones', route: '/admin/automatizaciones', action: 'Activar/pausar, vista previa, reintentar, fallo inyectado, log', entity: 'AutomationRule, AutomationRun', admin: '/admin/automatizaciones', scenarios: 'S36, S37', automations: 'AU01–AU10' },
  { id: 'M13', name: 'Pasaporte y exploración', route: '/:perfil/explorar · /:perfil/pasaporte', action: 'Tres tarjetas, reintento sin penalización, insignia, sellos', entity: 'Passport, Visit, Redemption', admin: '/admin/clientes/:id', scenarios: 'S38, S39', automations: 'AU08' },
  { id: 'M14', name: 'Catas', route: '/:perfil/catas', action: 'Inscripción única, lista de espera, cancelación libera una vez', entity: 'TastingEvent, EventBooking', admin: '/admin/reportes', scenarios: 'S40', automations: 'AU09' },
  { id: 'M15', name: 'Resumen, reportes y configuración', route: '/admin/resumen · /admin/reportes · /admin/configuracion', action: 'Indicadores derivados, filtros, reglas, reinicio y diagnóstico', entity: 'Selectores (pedidos/caja/stock/eventos)', admin: '/admin/reportes', scenarios: 'S41, S45, S46', automations: '—' },
]
