// Punto de entrada del dominio. Importar chat registra sus handlers en el motor de comandos.
import './chat';
import './campaigns';

export * from './types';
export { execute, findSlots, nextId, isValidTooth, surfacesFor, PROCEDURES, APPLIANCE_IDS, TOGGLEABLE_RULES, validateNewPerson, type Command, type CommandInput, type NewPersonInput } from './commands';
export { createSeedState, LEARNING_CARD_IDS } from './seed';
export { PRESETS, presetById } from './presets';
export { LEARNING_CARDS } from './learning';
export { GREETING, activeReplies, detectIntent, normalize, parseDayTime } from './chat';
