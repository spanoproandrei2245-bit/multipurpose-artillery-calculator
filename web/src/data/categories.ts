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
