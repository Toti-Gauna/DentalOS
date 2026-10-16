// Colección educativa voluntaria "Tu primera visita, con claridad". Contenido administrativo, nunca clínico.
export interface LearningOption { id: string; label: string; correct: boolean; feedback: string }
export interface LearningCard {
  id: string; title: string; situation: string; question: string; options: LearningOption[]; explanation: string; guide: string[];
}

export const LEARNING_CARDS: LearningCard[] = [
  {
    id: 'ayuda',
    title: 'Pedir ayuda',
    situation: 'Escribís por WhatsApp a la clínica y contás que te molesta una muela. El asistente de la demo responde.',
    question: '¿Qué debería pasar?',
    options: [
      { id: 'a', label: 'El asistente te dice qué medicamento tomar.', correct: false, feedback: 'No. El asistente es administrativo: no receta ni evalúa síntomas.' },
      { id: 'b', label: 'El asistente explica su límite y te ofrece hablar con recepción.', correct: true, feedback: 'Así es. Una persona del equipo toma el caso; la demo no promete un tiempo de respuesta.' },
      { id: 'c', label: 'El asistente clasifica si es urgente.', correct: false, feedback: 'No. Clasificar gravedad es una decisión profesional, no del asistente.' },
    ],
    explanation: 'Ante síntomas o medicación, el canal automático solo informa su alcance y ofrece derivarte a una persona. Si aceptás, se crea una tarea para recepción.',
    guide: ['El asistente no diagnostica ni receta.', 'Podés pedir "hablar con recepción" en cualquier momento.', 'La derivación se registra como tarea con responsable.'],
  },
  {
    id: 'cambio',
    title: 'Cambiar un turno',
    situation: 'Pedís mover tu control y el primer horario que elegís ya está ocupado.',
    question: '¿Qué pasa con tu turno original?',
    options: [
      { id: 'a', label: 'Se pierde y tenés que pedir uno nuevo.', correct: false, feedback: 'No. Si el nuevo horario falla, se conserva tu turno anterior.' },
      { id: 'b', label: 'Sigue reservado hasta que confirmes una alternativa válida.', correct: true, feedback: 'Correcto. El cambio solo se guarda cuando confirmás explícitamente.' },
    ],
    explanation: 'Un cambio es un solo paso: o se guarda completo con el mismo número de turno y una nueva versión, o no cambia nada. El recordatorio viejo se anula y se programa uno nuevo.',
    guide: ['Ver el antes y el después antes de confirmar.', 'Volver o detener nunca confirma.', 'Dentro de las 12 h previas, el cambio lo revisa recepción.'],
  },
  {
    id: 'datos',
    title: 'Entender los datos de muestra',
    situation: 'Ves en la demo un presupuesto "aceptado" y un movimiento de caja.',
    question: '¿Qué significa?',
    options: [
      { id: 'a', label: 'Que pagaste y el tratamiento se hizo.', correct: false, feedback: 'No. Aceptar un presupuesto no es pagar ni haber hecho un tratamiento.' },
      { id: 'b', label: 'Que son datos ficticios: aceptar no es cobrar, y la caja es simulada.', correct: true, feedback: 'Exacto. Todo es de muestra y queda guardado solo en este dispositivo.' },
      { id: 'c', label: 'Que se envió una factura por email.', correct: false, feedback: 'No. La demo no envía emails, mensajes ni cobros reales.' },
    ],
    explanation: 'Clínica Brisa es ficticia. Las personas, importes y movimientos son de muestra, se guardan en este dispositivo y nunca salen de él.',
    guide: ['Importes en unidades menores enteras, siempre ficticios.', 'Una reversión se registra como contrapartida trazable.', 'Podés restablecer la demo cuando quieras.'],
  },
];
