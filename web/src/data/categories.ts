import type { ArtilleryCategory } from '../types/gameModel'
import type { MessageKey } from '../i18n'

export const categoryLabels: Record<ArtilleryCategory, MessageKey> = {
  mortar: 'mapPicker.mortar',
  towed: 'categories.towed-gun',
  spg: 'categories.self-propelled-gun',
  mlrs: 'categories.rocket-artillery',
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
