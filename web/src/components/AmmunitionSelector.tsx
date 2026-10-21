import { t } from '../i18n'
import type { Ammunition } from '../types/artillery'
import { Dropdown } from './Dropdown'

import type { ArtilleryCategory } from '../types/gameModel'
import { ShellIcon } from './ShellIcon'

type AmmunitionOption = Pick<Ammunition, 'id' | 'designation' | 'type'>

interface AmmunitionSelectorProps {
  ammunition: readonly AmmunitionOption[]
  selectedId: string
  onSelect: (id: string) => void
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
  category,
}: AmmunitionSelectorProps) {

  if (ammunition.length === 0) {
    return (
      <span className="text-app-muted">
        {t('ammunitionSelector.no-data')}
      </span>
    )
  }


  const selected =
    ammunition.find((item) => item.id === selectedId) ?? ammunition[0]

  return (
    <>
      <ShellIcon category={category} type={selected.type} size="sm" />
      <Dropdown
      label={t('ammunitionSelector.shell')}
      value={selected.id}
      onChange={onSelect}
      fullWidth
      className="min-w-0 flex-1"
      options={ammunition.map((item) => ({
        value: item.id,
        label: formatLabel(item),
        icon: <ShellIcon category={category} type={item.type} />,
      }))}
    />
    </>
  )
}
