export type GameMode = 'HIGH' | 'LOW'

export type ImportStatus = 'screenshots' | 'verified'

export interface GameModel {
  name: string
  mod: string
  modes: readonly GameMode[]
  source: string
  importStatus: ImportStatus
  notes: string
}
