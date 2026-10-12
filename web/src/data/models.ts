import type { GameModel } from '../types/gameModel'

export const models = {
  mk6: {
    name: 'Mk6',
    mod: 'Arma 3 / ACE3',
    modes: ['HIGH'],
    source: 'ACE Interaction Menu',
    importStatus: 'screenshots',
    notes: 'Vanilla 82mm mortar.',
  },

  m252: {
    name: 'M252',
    mod: 'RHSUSAF / ACE3',
    modes: ['HIGH'],
    source: 'ACE Interaction Menu',
    importStatus: 'screenshots',
    notes: 'RHSUSAF 81mm mortar.',
  },
} as const satisfies Record<string, GameModel>

export type ModelId = keyof typeof models
