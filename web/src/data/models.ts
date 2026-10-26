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

  d44: {
    name: 'D-44 (85 mm)',
    mod: 'S.O.G. Prairie Fire (Vietnam DLC)',
    category: 'towed',
    modes: ['HIGH', 'LOW'],
    notes: 'S.O.G. Prairie Fire 85mm divisional gun.',
  },

  h12: {
    name: 'H-12 (107 mm)',
    mod: 'S.O.G. Prairie Fire (Vietnam DLC)',
    category: 'mlrs',
    modes: ['HIGH', 'LOW'],
    notes: 'S.O.G. Prairie Fire 107mm multiple rocket launcher.',
  },

  kamaz: {
    name: 'KamAZ MRL',
    mod: 'Arma 3 · Zamak MRL',
    category: 'mlrs',
    modes: ['HIGH', 'LOW'],
    notes: 'Vanilla Zamak MRL (ACE realistic name: KamAZ MRL). Same in-game HIGH tables as Seara.',
  },

  m109a6: {
    name: 'M109A6 (155 mm)',
    mod: 'RHSUSAF',
    category: 'spg',
    modes: ['HIGH', 'LOW'],
    notes: 'RHSUSAF 155mm self-propelled howitzer.',
  },

  m119a2: {
    name: 'M119A2 (105 mm)',
    mod: 'RHSUSAF',
    category: 'towed',
    modes: ['HIGH', 'LOW'],
    notes: 'RHSUSAF 105mm towed howitzer.',
  },

  m777: {
    name: 'M777 (155 mm)',
    mod: 'SOD M777 155mm Howitzer',
    category: 'towed',
    modes: ['HIGH', 'LOW'],
    notes: 'SOD M777 155mm towed howitzer (Steam Workshop 3820553505).',
  },

  sholef: {
    name: 'Sholef (155 mm)',
    mod: 'Arma 3 · M4 Scorcher',
    category: 'spg',
    modes: ['HIGH', 'LOW'],
    notes: 'Vanilla M4 Scorcher 155mm self-propelled howitzer (ACE realistic name: Sholef).',
  },

  sochor: {
    name: '2S9 Sochor (155 mm)',
    mod: 'Arma 3 · 2S9 Sochor',
    category: 'spg',
    modes: ['HIGH', 'LOW'],
    notes: 'Vanilla 2S9 Sochor 155mm self-propelled howitzer.',
  },

  type53: {
    name: 'Type 53 (82 mm)',
    mod: 'S.O.G. Prairie Fire (Vietnam DLC)',
    category: 'mortar',
    modes: ['HIGH'],
    notes: 'S.O.G. Prairie Fire 82mm mortar.',
  },
} as const satisfies Record<string, GameModel>

export type ModelId = keyof typeof models

export function isModelId(value: string): value is ModelId {
  return Object.prototype.hasOwnProperty.call(models, value)
}
