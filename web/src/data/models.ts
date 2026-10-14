import type { GameModel } from '../types/gameModel'

export const models = {
  mk6: {
    name: 'Mk6 (82 mm)',
    mod: 'Arma 3',
    category: 'mortar',
    modes: ['HIGH'],
    notes: 'Vanilla 82mm mortar.',
  },

  m252: {
    name: 'M252 (81 mm)',
    mod: 'RHSUSAF',
    category: 'mortar',
    modes: ['HIGH'],
    notes: 'RHSUSAF 81mm mortar.',
  },

  m29: {
    name: 'M29 (81 mm)',
    mod: 'S.O.G. Prairie Fire (Vietnam DLC)',
    category: 'mortar',
    modes: ['HIGH'],
    notes: 'S.O.G. Prairie Fire 81mm mortar.',
  },

  m2: {
    name: 'M2 (60 mm)',
    mod: 'S.O.G. Prairie Fire (Vietnam DLC)',
    category: 'mortar',
    modes: ['HIGH'],
    notes: 'S.O.G. Prairie Fire 60mm mortar.',
  },

  m101: {
    name: 'M101 (105 mm)',
    mod: 'S.O.G. Prairie Fire (Vietnam DLC)',
    category: 'towed',
    modes: ['HIGH'],
    notes: 'S.O.G. Prairie Fire 105mm howitzer.',
  },

  seara: {
    name: 'Seara (227 mm)',
    mod: 'Arma 3 · M5 Sandstorm MLRS',
    category: 'mlrs',
    modes: ['HIGH', 'LOW'],
    notes:
      'Vanilla M5 Sandstorm MLRS, M269 launcher, 227 mm HE rockets (ACE realistic name: Seara).',
  },
} as const satisfies Record<string, GameModel>

export type ModelId = keyof typeof models

export function isModelId(value: string): value is ModelId {
  return Object.prototype.hasOwnProperty.call(models, value)
}
