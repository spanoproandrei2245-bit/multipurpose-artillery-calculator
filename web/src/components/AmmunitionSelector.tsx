import type { Ammunition } from '../types/artillery'
import type { Language } from '../types/settings'

type AmmunitionOption = Pick<Ammunition, 'id' | 'designation' | 'type'>

interface AmmunitionSelectorProps {
  ammunition: readonly AmmunitionOption[]
  selectedId: string
  onSelect: (id: string) => void
  language: Language
}

function formatLabel(item: AmmunitionOption): string {
  return `${item.designation} [${item.type}]`
}

/** Снаряд в строке списка: выбор, если вариантов несколько. */
export function AmmunitionSelector({
  ammunition,
  selectedId,
  onSelect,
  language,
}: AmmunitionSelectorProps) {
  const ru = language === 'ru'

  if (ammunition.length === 0) {
    return (
      <span className="text-app-muted">
        {ru ? 'нет данных' : 'no data'}
      </span>
    )
  }

  if (ammunition.length === 1) {
    return <span>{formatLabel(ammunition[0])}</span>
  }

  const selected =
    ammunition.find((item) => item.id === selectedId) ?? ammunition[0]

  return (
    <select
      aria-label={ru ? 'Снаряд' : 'Shell'}
      value={selected.id}
      onChange={(event) => onSelect(event.target.value)}
      className="field w-auto"
    >
      {ammunition.map((item) => (
        <option key={item.id} value={item.id}>
          {formatLabel(item)}
        </option>
      ))}
    </select>
  )
}
