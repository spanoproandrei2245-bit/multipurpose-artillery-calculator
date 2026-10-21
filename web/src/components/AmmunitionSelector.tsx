import type { Ammunition } from '../types/artillery'
import { Dropdown } from './Dropdown'
import type { Language } from '../types/settings'

import type { ArtilleryCategory } from '../types/gameModel'
import { ShellIcon } from './ShellIcon'

type AmmunitionOption = Pick<Ammunition, 'id' | 'designation' | 'type'>

interface AmmunitionSelectorProps {
  ammunition: readonly AmmunitionOption[]
  selectedId: string
  onSelect: (id: string) => void
  language: Language
  // Класс орудия — форма значка снаряда
  category: ArtilleryCategory
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
  category,
}: AmmunitionSelectorProps) {
  const ru = language === 'ru'

  if (ammunition.length === 0) {
    return (
      <span className="text-app-muted">
        {ru ? 'нет данных' : 'no data'}
      </span>
    )
  }


  const selected =
    ammunition.find((item) => item.id === selectedId) ?? ammunition[0]

  return (
    <Dropdown
      label={ru ? 'Снаряд' : 'Shell'}
      value={selected.id}
      onChange={onSelect}
      fullWidth
      className="min-w-0 flex-1"
      options={ammunition.map((item) => ({
        value: item.id,
        label: formatLabel(item),
        icon: <ShellIcon category={category} type={item.type} language={language} />,
      }))}
      buttonLabel={
        <span className="flex items-center gap-2">
          <ShellIcon category={category} type={selected.type} language={language} />
          {formatLabel(selected)}
        </span>
      }
    />
  )
}
