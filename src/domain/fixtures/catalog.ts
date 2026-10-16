import type { BusinessId, FoodNote, Ingredient, MenuItem, ModifierGroup, Recipe, RecipeLine } from '../types'
import type { Unit } from '../units'

// Todos los datos son FICTICIOS (ilustrativos). Precios ARS de muestra, no investigados de ningún prospecto.

const T0 = 0 // createdAt real lo fija el seed con el reloj simulado

const mg = (businessId: BusinessId, g: Omit<ModifierGroup, 'businessId'>): ModifierGroup => ({ businessId, ...g })

export function buildModifierGroups(): ModifierGroup[] {
  const mc: BusinessId = 'mesa-clara'
  const rc: BusinessId = 'ritual-cafe'
  return [
    mg(mc, {
      id: 'MG-guarnicion',
      name: 'Guarnición',
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: 'gu-papas-fritas', name: 'Papas fritas', deltaCents: 0, consumes: { ingredientId: 'I-02', qty: 250, unit: 'g' } },
        { id: 'gu-pure', name: 'Puré de papa', deltaCents: 0, consumes: { ingredientId: 'I-02', qty: 300, unit: 'g' } },
        { id: 'gu-ensalada', name: 'Ensalada mixta', deltaCents: 0 },
        { id: 'gu-papas-horno', name: 'Papas al horno', deltaCents: 150000, consumes: { ingredientId: 'I-02', qty: 300, unit: 'g' } },
      ],
    }),
    mg(mc, {
      id: 'MG-salsa-extra',
      name: 'Salsa extra (máximo 1)',
      required: false,
      min: 0,
      max: 1,
      options: [
        { id: 'se-chimichurri', name: 'Chimichurri', deltaCents: 50000 },
        { id: 'se-criolla', name: 'Salsa criolla', deltaCents: 50000, incompatibleWith: ['gu-pure'] },
        { id: 'se-mayo', name: 'Mayonesa casera', deltaCents: 40000 },
      ],
    }),
    mg(mc, {
      id: 'MG-salsa-pasta',
      name: 'Salsa',
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: 'sp-fileto', name: 'Fileto', deltaCents: 0, consumes: { ingredientId: 'I-06', qty: 150, unit: 'ml' } },
        { id: 'sp-bolognesa', name: 'Bolognesa', deltaCents: 120000 },
        { id: 'sp-4quesos', name: 'Cuatro quesos', deltaCents: 180000 },
        { id: 'sp-crema', name: 'Crema y champiñones', deltaCents: 160000 },
      ],
    }),
    mg(mc, {
      id: 'MG-extras-pasta',
      name: 'Extras (hasta 2)',
      required: false,
      min: 0,
      max: 2,
      options: [
        { id: 'ep-queso', name: 'Queso rallado extra', deltaCents: 60000 },
        { id: 'ep-aceite', name: 'Aceite de oliva picante', deltaCents: 40000 },
        { id: 'ep-pan', name: 'Pan de campo', deltaCents: 50000 },
      ],
    }),
    mg(mc, {
      id: 'MG-coccion',
      name: 'Punto de cocción',
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: 'co-jugoso', name: 'Jugoso', deltaCents: 0 },
        { id: 'co-punto', name: 'A punto', deltaCents: 0 },
        { id: 'co-cocido', name: 'Bien cocido', deltaCents: 0 },
      ],
    }),
    mg(mc, {
      id: 'MG-vino',
      name: 'Variedad',
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: 'vi-tinto', name: 'Tinto de la casa', deltaCents: 0 },
        { id: 'vi-blanco', name: 'Blanco de la casa', deltaCents: 0 },
      ],
    }),
    mg(rc, {
      id: 'MG-tamano',
      name: 'Tamaño',
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: 'ta-chico', name: 'Chico', deltaCents: 0 },
        { id: 'ta-mediano', name: 'Mediano', deltaCents: 80000 },
      ],
    }),
    mg(rc, {
      id: 'MG-leche',
      name: 'Leche',
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: 'le-entera', name: 'Entera', deltaCents: 0, consumes: { ingredientId: 'I-12', qty: 180, unit: 'ml' } },
        { id: 'le-descremada', name: 'Descremada', deltaCents: 0 },
        { id: 'le-vegetal', name: 'Vegetal (avena)', deltaCents: 70000, consumes: { ingredientId: 'I-13', qty: 200, unit: 'ml' } },
      ],
    }),
    mg(rc, {
      id: 'MG-extras-cafe',
      name: 'Extras (hasta 2)',
      required: false,
      min: 0,
      max: 2,
      options: [
        { id: 'ec-shot', name: 'Shot extra', deltaCents: 120000 },
        { id: 'ec-vainilla', name: 'Jarabe de vainilla', deltaCents: 60000 },
        { id: 'ec-crema', name: 'Crema batida', deltaCents: 50000 },
      ],
    }),
    mg(rc, {
      id: 'MG-origen',
      name: 'Origen del grano',
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: 'or-huila', name: 'Colombia · Huila', deltaCents: 0 },
        { id: 'or-guji', name: 'Etiopía · Guji', deltaCents: 90000 },
        { id: 'or-cerrado', name: 'Brasil · Cerrado', deltaCents: 0 },
      ],
    }),
    mg(rc, {
      id: 'MG-calentar',
      name: 'Presentación',
      required: false,
      min: 0,
      max: 1,
      options: [{ id: 'ca-calentado', name: 'Calentado', deltaCents: 0 }],
    }),
  ]
}

const complete = (allergens: string[], note = 'Anotación de muestra aportada por el negocio ficticio.'): FoodNote => ({
  status: 'completa',
  allergens,
  note,
})
const pending: FoodNote = { status: 'pendiente', allergens: [], note: '' }

type Seed = Omit<MenuItem, 'businessId' | 'createdAt' | 'version' | 'imageUrl' | 'soldOut' | 'history' | 'locationIds' | 'hours' | 'maxQty' | 'tags'> & {
  tags?: string[]
  hours?: MenuItem['hours']
  locationIds?: string[] | null
  maxQty?: number
}

function items(businessId: BusinessId, list: Seed[]): MenuItem[] {
  return list.map((i) => ({
    businessId,
    createdAt: T0,
    version: 1,
    imageUrl: null,
    soldOut: false,
    history: [],
    locationIds: i.locationIds ?? null,
    hours: i.hours ?? null,
    maxQty: i.maxQty ?? 6,
    tags: i.tags ?? [],
    ...i,
  }))
}
const ARS = (n: number) => n * 100

export function buildMenu(): MenuItem[] {
  const g = ['MG-guarnicion', 'MG-salsa-extra']
  const bodegon = items('mesa-clara', [
    { id: 'MC-01', name: 'Provoleta a la parrilla', description: 'Provolone fundido con orégano y aceite de oliva.', category: 'Entradas', priceCents: ARS(12500), modifierGroupIds: [], station: 'cocina', foodNote: complete(['lácteos']) },
    { id: 'MC-02', name: 'Empanadas de carne (x2)', description: 'Cortadas a cuchillo, horno de barro.', category: 'Entradas', priceCents: ARS(8400), modifierGroupIds: [], station: 'cocina', foodNote: complete(['gluten', 'huevo']) },
    { id: 'MC-03', name: 'Tortilla de papas', description: 'Jugosa, con cebolla confitada.', category: 'Entradas', priceCents: ARS(9800), modifierGroupIds: [], station: 'cocina', foodNote: complete(['huevo']) },
    { id: 'MC-04', name: 'Ensalada de rúcula y parmesano', description: 'Con tomates asados y limón.', category: 'Entradas', priceCents: ARS(9200), modifierGroupIds: [], station: 'cocina', foodNote: complete(['lácteos']), tags: ['vegetariano'] },
    { id: 'MC-05', name: 'Mollejas crocantes', description: 'Con limón y sal gruesa.', category: 'Entradas', priceCents: ARS(16900), modifierGroupIds: [], station: 'cocina', foodNote: complete([]) },
    { id: 'MC-06', name: 'Sorrentinos de jamón y queso', description: 'Pasta fresca casera con la salsa que elijas.', category: 'Pastas', priceCents: ARS(16500), modifierGroupIds: ['MG-salsa-pasta', 'MG-extras-pasta'], station: 'cocina', foodNote: complete(['gluten', 'lácteos', 'huevo']) },
    { id: 'MC-07', name: 'Ñoquis de papa', description: 'Amasados cada mañana.', category: 'Pastas', priceCents: ARS(14800), modifierGroupIds: ['MG-salsa-pasta', 'MG-extras-pasta'], station: 'cocina', foodNote: complete(['gluten', 'huevo']), tags: ['pasta'] },
    { id: 'MC-08', name: 'Ravioles de verdura', description: 'Relleno de espinaca y ricota.', category: 'Pastas', priceCents: ARS(15200), modifierGroupIds: ['MG-salsa-pasta', 'MG-extras-pasta'], station: 'cocina', foodNote: complete(['gluten', 'lácteos', 'huevo']), tags: ['vegetariano', 'pasta'] },
    { id: 'MC-09', name: 'Tallarines caseros', description: 'Al huevo, cortados a mano.', category: 'Pastas', priceCents: ARS(13900), modifierGroupIds: ['MG-salsa-pasta', 'MG-extras-pasta'], station: 'cocina', foodNote: complete(['gluten', 'huevo']), tags: ['pasta'] },
    { id: 'MC-10', name: 'Lasagna boloñesa', description: 'Capas finas, bechamel y gratinado.', category: 'Pastas', priceCents: ARS(17400), modifierGroupIds: [], station: 'cocina', foodNote: complete(['gluten', 'lácteos', 'huevo']), tags: ['pasta'] },
    { id: 'MC-11', name: 'Canelones de verdura y ricota', description: 'Con salsa a elección.', category: 'Pastas', priceCents: ARS(16100), modifierGroupIds: ['MG-salsa-pasta'], station: 'cocina', foodNote: complete(['gluten', 'lácteos', 'huevo']), tags: ['vegetariano', 'pasta'] },
    { id: 'MC-12', name: 'Milanesa de ternera', description: 'Clásica, con guarnición a elección.', category: 'Minutas y carnes', priceCents: ARS(18500), modifierGroupIds: g, station: 'cocina', foodNote: complete(['gluten', 'huevo']) },
    { id: 'MC-13', name: 'Milanesa napolitana', description: 'Jamón, salsa y muzzarella gratinada.', category: 'Minutas y carnes', priceCents: ARS(20200), modifierGroupIds: g, station: 'cocina', foodNote: complete(['gluten', 'huevo', 'lácteos']) },
    { id: 'MC-14', name: 'Suprema de pollo', description: 'Rebozada fina, guarnición a elección.', category: 'Minutas y carnes', priceCents: ARS(17200), modifierGroupIds: g, station: 'cocina', foodNote: complete(['gluten', 'huevo']) },
    { id: 'MC-15', name: 'Bife de chorizo', description: '350 g a la parrilla.', category: 'Minutas y carnes', priceCents: ARS(24900), modifierGroupIds: ['MG-coccion', 'MG-guarnicion'], station: 'cocina', foodNote: complete([]) },
    { id: 'MC-16', name: 'Asado de tira', description: 'Cocción lenta, cortado grueso.', category: 'Minutas y carnes', priceCents: ARS(23500), modifierGroupIds: ['MG-coccion', 'MG-guarnicion'], station: 'cocina', foodNote: complete([]) },
    { id: 'MC-17', name: 'Pollo al horno con papas', description: 'Medio pollo, hierbas y ajo.', category: 'Minutas y carnes', priceCents: ARS(19100), modifierGroupIds: [], station: 'cocina', foodNote: complete([]) },
    { id: 'MC-18', name: 'Matambre a la pizza', description: 'Con salsa, jamón y muzzarella.', category: 'Minutas y carnes', priceCents: ARS(21300), modifierGroupIds: ['MG-guarnicion'], station: 'cocina', foodNote: complete(['lácteos']) },
    { id: 'MC-19', name: 'Revuelto Gramajo', description: 'Jamón, papas fritas y huevo.', category: 'Minutas y carnes', priceCents: ARS(15400), modifierGroupIds: [], station: 'cocina', foodNote: complete(['huevo']), hours: { fromMin: 12 * 60, toMin: 15 * 60 + 30 } },
    { id: 'MC-20', name: 'Merluza a la romana', description: 'Rebozada, con guarnición.', category: 'Pescados', priceCents: ARS(18800), modifierGroupIds: ['MG-guarnicion'], station: 'cocina', foodNote: complete(['gluten', 'huevo', 'pescado']) },
    { id: 'MC-21', name: 'Salmón rosado a la plancha', description: 'Con vegetales de estación.', category: 'Pescados', priceCents: ARS(26500), modifierGroupIds: [], station: 'cocina', foodNote: complete(['pescado']) },
    { id: 'MC-22', name: 'Flan casero con dulce de leche', description: 'Con crema chantilly.', category: 'Postres', priceCents: ARS(7900), modifierGroupIds: [], station: 'cocina', foodNote: complete(['huevo', 'lácteos']) },
    { id: 'MC-23', name: 'Tiramisú', description: 'Mascarpone, café y cacao.', category: 'Postres', priceCents: ARS(8600), modifierGroupIds: [], station: 'cocina', foodNote: complete(['gluten', 'huevo', 'lácteos']) },
    { id: 'MC-24', name: 'Vigilante de queso y dulce', description: 'Queso fresco y dulce de batata.', category: 'Postres', priceCents: ARS(7200), modifierGroupIds: [], station: 'cocina', foodNote: complete(['lácteos']) },
    { id: 'MC-25', name: 'Panqueque con dulce de leche', description: 'Flambeado en mesa.', category: 'Postres', priceCents: ARS(7500), modifierGroupIds: [], station: 'cocina', foodNote: complete(['gluten', 'huevo', 'lácteos']) },
    { id: 'MC-26', name: 'Agua mineral', description: 'Sin gas o con gas.', category: 'Bebidas', priceCents: ARS(3200), modifierGroupIds: [], station: 'barra', foodNote: complete([]) },
    { id: 'MC-27', name: 'Gaseosa línea cola', description: 'Botella individual.', category: 'Bebidas', priceCents: ARS(3900), modifierGroupIds: [], station: 'barra', foodNote: complete([]) },
    { id: 'MC-28', name: 'Vino de la casa (copa)', description: 'Etiqueta ficticia de muestra. Solo mayores de 18.', category: 'Bebidas', priceCents: ARS(5400), modifierGroupIds: ['MG-vino'], station: 'barra', foodNote: complete(['sulfitos']) },
  ])

  const cafeBase = ['MG-tamano', 'MG-leche', 'MG-extras-cafe']
  const cafe = items('ritual-cafe', [
    { id: 'RC-01', name: 'Espresso', description: 'Un shot, molienda del día.', category: 'Café de barra', priceCents: ARS(4500), modifierGroupIds: ['MG-origen'], station: 'barra', foodNote: complete([]) },
    { id: 'RC-02', name: 'Doble espresso', description: 'Dos shots, cuerpo y dulzor.', category: 'Café de barra', priceCents: ARS(5200), modifierGroupIds: ['MG-origen'], station: 'barra', foodNote: complete([]) },
    { id: 'RC-03', name: 'Cortado', description: 'Espresso con un toque de leche.', category: 'Café de barra', priceCents: ARS(5100), modifierGroupIds: ['MG-leche'], station: 'barra', foodNote: complete(['lácteos (según leche elegida)']) },
    { id: 'RC-04', name: 'Flat white', description: 'Doble espresso con leche texturizada.', category: 'Café de barra', priceCents: ARS(5800), modifierGroupIds: cafeBase, station: 'barra', foodNote: complete(['lácteos (según leche elegida)']), tags: ['favorito-casa'] },
    { id: 'RC-05', name: 'Cappuccino', description: 'Espuma densa, cacao opcional.', category: 'Café de barra', priceCents: ARS(5900), modifierGroupIds: cafeBase, station: 'barra', foodNote: complete(['lácteos (según leche elegida)']) },
    { id: 'RC-06', name: 'Latte', description: 'Suave y cremoso.', category: 'Café de barra', priceCents: ARS(6000), modifierGroupIds: cafeBase, station: 'barra', foodNote: complete(['lácteos (según leche elegida)']) },
    { id: 'RC-07', name: 'V60 filtrado', description: 'Método de goteo, notas florales.', category: 'Métodos', priceCents: ARS(6800), modifierGroupIds: ['MG-origen'], station: 'barra', foodNote: complete([]), locationIds: ['L-RC-centro'], tags: ['método'] },
    { id: 'RC-08', name: 'Chemex (2 tazas)', description: 'Para compartir, limpio y brillante.', category: 'Métodos', priceCents: ARS(9500), modifierGroupIds: ['MG-origen'], station: 'barra', foodNote: complete([]), locationIds: ['L-RC-centro'], tags: ['método'] },
    { id: 'RC-09', name: 'Cold brew', description: 'Infusión en frío, 16 horas.', category: 'Métodos', priceCents: ARS(6400), modifierGroupIds: ['MG-tamano'], station: 'barra', foodNote: complete([]), tags: ['método'] },
    { id: 'RC-10', name: 'Roll de canela', description: 'Glaseado de queso crema.', category: 'Pastelería', priceCents: ARS(6200), modifierGroupIds: ['MG-calentar'], station: 'barra', foodNote: complete(['gluten', 'lácteos', 'huevo']) },
    { id: 'RC-11', name: 'Medialuna de manteca', description: 'Hojaldrada, del día.', category: 'Pastelería', priceCents: ARS(2200), modifierGroupIds: ['MG-calentar'], station: 'barra', foodNote: complete(['gluten', 'lácteos', 'huevo']) },
    { id: 'RC-12', name: 'Muffin de arándanos', description: 'Con crumble.', category: 'Pastelería', priceCents: ARS(5400), modifierGroupIds: ['MG-calentar'], station: 'barra', foodNote: pending },
    { id: 'RC-13', name: 'Tostado de jamón y queso', description: 'Pan de molde artesanal.', category: 'Salado', priceCents: ARS(9900), modifierGroupIds: [], station: 'cocina', foodNote: complete(['gluten', 'lácteos']) },
    { id: 'RC-14', name: 'Budín de limón', description: 'Porción, con glaseado.', category: 'Pastelería', priceCents: ARS(4800), modifierGroupIds: ['MG-calentar'], station: 'barra', foodNote: complete(['gluten', 'huevo', 'lácteos']) },
  ])
  return [...bodegon, ...cafe]
}

// ---- Insumos y recetas -----------------------------------------------------
type IngSeed = [id: string, businessId: BusinessId, name: string, unit: 'g' | 'ml' | 'u', onHand: number, low: number]
const ING: IngSeed[] = [
  ['I-01', 'mesa-clara', 'Carne de ternera', 'g', 12000, 3000],
  ['I-02', 'mesa-clara', 'Papas', 'g', 30000, 5000],
  ['I-03', 'mesa-clara', 'Huevos', 'u', 60, 12],
  ['I-04', 'mesa-clara', 'Pan rallado', 'g', 4000, 800],
  ['I-05', 'mesa-clara', 'Sorrentinos (porción)', 'u', 40, 8],
  ['I-06', 'mesa-clara', 'Salsa fileto', 'ml', 8000, 1500],
  ['I-07', 'mesa-clara', 'Provolone', 'g', 900, 1000], // bajo
  ['I-08', 'mesa-clara', 'Bife de chorizo', 'g', 6000, 1500],
  ['I-09', 'mesa-clara', 'Mascarpone', 'g', 1500, 400],
  ['I-10', 'mesa-clara', 'Dulce de leche', 'g', 5000, 1000],
  ['I-11', 'ritual-cafe', 'Café en grano', 'g', 4200, 1000],
  ['I-12', 'ritual-cafe', 'Leche entera', 'ml', 20000, 4000],
  ['I-13', 'ritual-cafe', 'Leche de avena', 'ml', 700, 1500], // bajo
  ['I-14', 'ritual-cafe', 'Roll de canela (unidad)', 'u', 0, 4], // agotado
  ['I-15', 'ritual-cafe', 'Medialunas (unidad)', 'u', 48, 10],
  ['I-16', 'mesa-clara', 'Harina 000', 'g', 25000, 5000],
]
export function buildIngredients(): Ingredient[] {
  return ING.map(([id, businessId, name, unit, onHand, low]) => ({
    id,
    businessId,
    createdAt: T0,
    version: 1,
    name,
    unit,
    onHand,
    reserved: 0,
    lowThreshold: low,
    epoch: 0,
    alertState: onHand <= 0 ? 'agotado' : onHand <= low ? 'bajo' : 'ok',
  }))
}

const R = (itemId: string, businessId: BusinessId, lines: [string, number, Unit][]): Recipe => ({
  id: `RCP-${itemId}`,
  businessId,
  createdAt: T0,
  version: 1,
  itemId,
  lines: lines.map(([ingredientId, qty, unit]): RecipeLine => ({ ingredientId, qty, unit })),
})
export function buildRecipes(): Recipe[] {
  return [
    R('MC-01', 'mesa-clara', [['I-07', 200, 'g']]),
    R('MC-06', 'mesa-clara', [['I-05', 1, 'u']]),
    R('MC-07', 'mesa-clara', [['I-16', 0.25, 'kg'], ['I-02', 200, 'g']]),
    R('MC-12', 'mesa-clara', [['I-01', 0.22, 'kg'], ['I-03', 1, 'u'], ['I-04', 60, 'g']]),
    R('MC-13', 'mesa-clara', [['I-01', 220, 'g'], ['I-03', 1, 'u'], ['I-04', 60, 'g'], ['I-07', 80, 'g']]),
    R('MC-15', 'mesa-clara', [['I-08', 350, 'g']]),
    R('MC-23', 'mesa-clara', [['I-09', 80, 'g']]),
    // Receta con unidad incompatible a propósito (dulce de leche medido en ml): práctica de M09/AU06.
    R('MC-22', 'mesa-clara', [['I-10', 60, 'ml'], ['I-03', 1, 'u']]),
    R('RC-01', 'ritual-cafe', [['I-11', 9, 'g']]),
    R('RC-02', 'ritual-cafe', [['I-11', 18, 'g']]),
    R('RC-04', 'ritual-cafe', [['I-11', 18, 'g']]),
    R('RC-05', 'ritual-cafe', [['I-11', 18, 'g']]),
    R('RC-06', 'ritual-cafe', [['I-11', 18, 'g']]),
    R('RC-10', 'ritual-cafe', [['I-14', 1, 'u']]),
    R('RC-11', 'ritual-cafe', [['I-15', 1, 'u']]),
  ]
}

export const SECTORS_NOTE = 'El stock de un ítem sin receta no se controla (alcance de muestra).'
