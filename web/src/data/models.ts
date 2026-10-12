export const models = {
  mk6: {
    name: 'Mk6',
    mod: 'Arma 3 / ACE3',
    mode: 'HIGH',
  },

  m252: {
    name: 'M252',
    mod: 'RHSUSAF / ACE3',
    mode: 'HIGH',
  },
} as const

export type ModelId = keyof typeof models
