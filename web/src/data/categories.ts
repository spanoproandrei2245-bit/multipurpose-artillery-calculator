import type { ArtilleryCategory } from '../types/gameModel'
import type { Language } from '../types/settings'

export const categoryLabels: Record<
  ArtilleryCategory,
  Record<Language, string>
> = {
  mortar: { ru: 'Миномёт', en: 'Mortar' },
  towed: { ru: 'Артиллерийское орудие', en: 'Towed gun' },
  spg: { ru: 'САУ', en: 'Self-propelled gun' },
  mlrs: { ru: 'РСЗО', en: 'Rocket artillery' },
}

// Класс орудия — цветная точка в левом верхнем углу значка:
// миномёт — зелёная, артиллерия (буксируемая и САУ) — жёлтая,
// реактивная (особая) — фиолетовая.
export const categoryMarks: Record<ArtilleryCategory, string> = {
  mortar: 'bg-ok',
  towed: 'bg-warn',
  spg: 'bg-warn',
  mlrs: 'bg-special',
}
