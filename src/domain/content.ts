import type { BusinessId } from './types'

// Contenido educativo de MUESTRA (ficticio). Cada tarjeta: 20–30 s de lectura + pregunta opcional.
export interface PassportCard {
  id: string
  businessId: BusinessId
  axis: string
  title: string
  body: string
  question: string
  options: { id: string; text: string; correct: boolean }[]
  explanation: string
}

export const PASSPORT_CARDS: PassportCard[] = [
  {
    id: 'PC-metodo',
    businessId: 'ritual-cafe',
    axis: 'Método',
    title: 'El cono de papel (V60)',
    body: 'En el V60 el agua atraviesa el café molido y un filtro de papel. El papel retiene aceites y finos: la taza queda limpia y con notas más claras.',
    question: '¿Qué efecto tiene el filtro de papel en la taza?',
    options: [
      { id: 'a', text: 'Resalta notas limpias porque retiene aceites y finos', correct: true },
      { id: 'b', text: 'Agrega cuerpo y aceites a la taza', correct: false },
      { id: 'c', text: 'No cambia nada en el sabor', correct: false },
    ],
    explanation: 'El papel atrapa aceites y partículas finas. Por eso el V60 suele sentirse más liviano y brillante que una prensa francesa.',
  },
  {
    id: 'PC-origen',
    businessId: 'ritual-cafe',
    axis: 'Origen',
    title: 'Etiopía · Guji',
    body: 'Los cafés de zonas altas como Guji maduran despacio. Suelen mostrar notas florales y de fruta, y una acidez delicada.',
    question: '¿Qué notas se asocian a un café de altura como Guji?',
    options: [
      { id: 'a', text: 'Chocolate amargo y tostado intenso', correct: false },
      { id: 'b', text: 'Florales y de fruta', correct: true },
      { id: 'c', text: 'Nuez tostada y caramelo oscuro', correct: false },
    ],
    explanation: 'La altura y la maduración lenta suman complejidad aromática: flores, frutas y una acidez que se siente fresca.',
  },
  {
    id: 'PC-perfil',
    businessId: 'ritual-cafe',
    axis: 'Perfil',
    title: 'La acidez no es “agrio”',
    body: 'En café, acidez describe frescura: una chispa brillante, como la de una fruta cítrica. El amargo y lo agrio son otra cosa.',
    question: '¿A qué se parece una buena acidez en la taza?',
    options: [
      { id: 'a', text: 'A un sabor agrio que arruga la boca', correct: false },
      { id: 'b', text: 'A una frescura brillante, como una fruta cítrica', correct: true },
      { id: 'c', text: 'A un gusto salado', correct: false },
    ],
    explanation: 'La acidez bien lograda se percibe como jugosidad y frescura. Si arruga la boca, probablemente la extracción no fue pareja.',
  },
  {
    id: 'PB-ingrediente',
    businessId: 'mesa-clara',
    axis: 'Ingrediente',
    title: 'Provolone, el queso que se estira',
    body: 'El provolone es un queso de pasta hilada: al calentarlo se funde y forma hebras. Por eso la provoleta se hace a la parrilla.',
    question: '¿Qué le pasa al provolone cuando se calienta?',
    options: [
      { id: 'a', text: 'Se derrite y se estira en hebras', correct: true },
      { id: 'b', text: 'Se endurece como una piedra', correct: false },
      { id: 'c', text: 'Se separa en líquido y sólido', correct: false },
    ],
    explanation: 'La pasta hilada tiene proteínas alineadas que se estiran al fundir. Con calor parejo queda cremoso por dentro y dorado por fuera.',
  },
  {
    id: 'PB-preparacion',
    businessId: 'mesa-clara',
    axis: 'Preparación',
    title: 'Ñoquis livianos',
    body: 'Para unos ñoquis livianos conviene usar papas secas y harinosas, y amasar lo justo. Cuanta menos harina, más suaves.',
    question: '¿Qué ayuda a que los ñoquis queden livianos?',
    options: [
      { id: 'a', text: 'Amasar mucho tiempo con harina extra', correct: false },
      { id: 'b', text: 'Usar papas secas y amasar lo justo', correct: true },
      { id: 'c', text: 'Hervirlos hasta que se deshagan', correct: false },
    ],
    explanation: 'La papa húmeda obliga a sumar harina, y el exceso de amasado vuelve la masa gomosa. Seca y justa: liviana.',
  },
  {
    id: 'PB-historia',
    businessId: 'mesa-clara',
    axis: 'Historia (ficticia)',
    title: 'El bodegón de la esquina',
    body: 'Relato ficticio de la demo: los bodegones nacieron como almacenes donde se servía comida casera a precio justo. La mesa compartida era parte del oficio.',
    question: '¿Qué ofrecía, en este relato, el bodegón?',
    options: [
      { id: 'a', text: 'Comida casera en una mesa compartida', correct: true },
      { id: 'b', text: 'Solo bebidas para llevar', correct: false },
      { id: 'c', text: 'Únicamente postres', correct: false },
    ],
    explanation: 'El relato destaca lo casero y lo compartido. Es una historia inventada para la demo, no una cita histórica.',
  },
]

export const PASSPORT_PICKS: Record<BusinessId, { id: string; label: string }[]> = {
  'ritual-cafe': [
    { id: 'RC-07', label: 'V60 filtrado' },
    { id: 'RC-04', label: 'Flat white' },
    { id: 'RC-09', label: 'Cold brew' },
  ],
  'mesa-clara': [
    { id: 'MC-01', label: 'Provoleta a la parrilla' },
    { id: 'MC-07', label: 'Ñoquis de papa' },
    { id: 'MC-12', label: 'Milanesa de ternera' },
  ],
}

export const STAMPS_FOR_BADGE = 5
