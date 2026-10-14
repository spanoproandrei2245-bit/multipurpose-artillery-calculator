export type GameMode = 'HIGH' | 'LOW'

// Класс орудия: определяет иконку и цвет рамки в интерфейсе.
//   mortar — миномёт, towed — буксируемое орудие (пушка, гаубица),
//   spg — самоходная артиллерийская установка, mlrs — РСЗО.
export type ArtilleryCategory = 'mortar' | 'towed' | 'spg' | 'mlrs'

export interface GameModel {
  name: string
  mod: string
  category: ArtilleryCategory
  modes: readonly GameMode[]
  notes: string
}
