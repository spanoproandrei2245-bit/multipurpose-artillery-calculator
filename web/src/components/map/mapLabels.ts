import { t, type MessageKey } from '../../i18n'
import type { MapMarker, MarkerColor, PresetColor } from '../../lib/markers'

const COLOR_NAMES: Record<PresetColor, MessageKey> = {
  red: 'mapPicker.red',
  orange: 'mapPicker.orange',
  yellow: 'mapPicker.yellow',
  green: 'mapPicker.green',
  blue: 'mapPicker.blue',
  purple: 'mapPicker.purple',
  black: 'mapPicker.black',
}

/** Название цвета для подписи; у своего цвета — «Цвет». */
export function colorName(color: MarkerColor): string {
  return color.startsWith('#') ? t('mapPicker.colour') : t(COLOR_NAMES[color as PresetColor])
}

/** Подпись метки: её текст или «Метка (цвет)». */
export function markerTitle(marker: MapMarker): string {
  return marker.label || `${t('mapPicker.marker')} (${colorName(marker.color)})`
}
