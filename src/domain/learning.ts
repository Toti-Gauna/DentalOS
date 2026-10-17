// Colección educativa voluntaria "Tu primera visita, con claridad". Contenido administrativo, nunca clínico.
// Reglas: 3 tarjetas, 2–3 opciones, explicación sin castigo, reintento libre, sello privado al comprender,
// progreso por cardId, completar de nuevo no suma, guía completa accesible sin jugar.
export interface LearningOption { id: string; label: string; correct: boolean; feedback: string }
export interface LearningCard {
  id: string; title: string; situation: string; question: string; options: LearningOption[]; explanation: string; guide: string[];
}

export const LEARNING_CARDS: LearningCard[] = [
  {
    id: 'ayuda',
    title: 'Pedir ayuda',
    situation: 'Escribís por WhatsApp a la clínica porque te molesta una muela y no sabés qué hacer.',
    question: '¿Cuál es el mejor próximo paso?',
    options: [
      { id: 'a', label: 'Pedirle al asistente que me diga qué tengo.', correct: false, feedback: 'Es entendible querer una respuesta rápida, pero el asistente es administrativo: no diagnostica, no receta y no evalúa gravedad. Probá otra opción.' },
      { id: 'b', label: 'Pedir hablar con recepción para que una persona me contacte.', correct: true, feedback: 'Así es. El asistente explica su límite y, si aceptás, deja una tarea para recepción. Una persona del equipo toma el caso; la demo no promete un tiempo de respuesta.' },
      { id: 'c', label: 'Esperar a que el sistema me confirme un turno automáticamente.', correct: false, feedback: 'Nada se confirma solo: un turno o una derivación existen cuando vos lo pedís y queda registrado. Probá otra opción.' },
    ],
    explanation: 'Ante síntomas o medicación, el canal automático solo informa su alcance y ofrece derivarte a una persona. La tarea para recepción se crea únicamente si aceptás.',
    guide: ['El asistente no diagnostica, no receta ni clasifica urgencias.', 'Podés pedir “hablar con recepción” en cualquier momento.', 'La derivación queda como tarea con responsable; no hay confirmaciones automáticas.'],
  },
  {
    id: 'cambio',
    title: 'Cambiar un turno',
    situation: 'Querés mover tu control. El primer horario que pedís ya está ocupado.',
    question: '¿Qué conviene hacer?',
    options: [
      { id: 'a', label: 'Cancelar primero el turno y después buscar otro.', correct: false, feedback: 'Cancelar primero libera tu lugar y podrías quedarte sin turno. No hace falta: el cambio se hace en un solo paso. Probá otra opción.' },
      { id: 'b', label: 'Revisar la alternativa propuesta y confirmarla; mientras tanto mi turno original sigue reservado.', correct: true, feedback: 'Correcto. Tu turno original se conserva hasta que confirmás una alternativa válida. Si algo falla, no se pierde.' },
    ],
    explanation: 'Un cambio es un solo paso: se guarda completo, con el mismo número de turno y una versión nueva, o no cambia nada. El recordatorio anterior se anula y se programa uno nuevo.',
    guide: ['Mirá el antes y el después antes de confirmar.', 'Volver, cerrar o quedarte en silencio nunca confirma.', 'Dentro de las 12 h previas, el cambio lo revisa recepción.'],
  },
  {
    id: 'datos',
    title: 'Entender los datos de muestra',
    situation: 'En la demo ves un presupuesto en estado “aceptado”.',
    question: '¿Qué significa?',
    options: [
      { id: 'a', label: 'Que ya se cobró: aceptado es lo mismo que pagado.', correct: false, feedback: 'Es una confusión común, pero no: aceptar un presupuesto no registra ningún pago ni marca un tratamiento como hecho. Probá otra opción.' },
      { id: 'b', label: 'Que se aceptó, pero eso no registra ningún pago: la caja es aparte y ficticia.', correct: true, feedback: 'Exacto. La aceptación y los movimientos de caja son cosas distintas, y en esta demo todo es de muestra.' },
    ],
    explanation: 'Clínica Brisa es ficticia. Personas, importes y movimientos son de muestra, se guardan solo en este dispositivo y nunca salen de él. Un movimiento simulado se registra aparte, y una reversión deja una contrapartida visible.',
    guide: ['Aceptado ≠ cobrado ≠ tratamiento realizado.', 'Los importes son ficticios y en unidades enteras.', 'Podés restablecer la demo cuando quieras.'],
  },
];
