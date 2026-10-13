
import { useId } from 'react'

import type { Ammunition } from '../types/artillery'
import type { Language } from '../types/settings'

type AmmunitionOption = Pick<
  Ammunition,
  'id' | 'designation' | 'type'
>

interface AmmunitionSelectorProps {
  ammunition: readonly AmmunitionOption[]
  selectedId: string
  onSelect: (id: string) => void

  showFullNames: boolean
  onShowFullNamesChange: (value: boolean) => void

  language: Language
}

export function AmmunitionSelector({
  ammunition,
  selectedId,
  onSelect,
  showFullNames,
  onShowFullNamesChange,
  language,
}: AmmunitionSelectorProps) {
  const selectId = useId()
  const ru = language === 'ru'

  const selected =
    ammunition.find((item) => item.id === selectedId) ??
    ammunition[0]

  function formatLabel(item: AmmunitionOption): string {
    if (showFullNames) {
      return `${item.designation} [${item.type}]`
    }

    const sameType = ammunition.filter(
      (other) => other.type === item.type
    )

    if (sameType.length === 1) {
      return `[${item.type}]`
    }

    const index =
      sameType.findIndex((other) => other.id === item.id) + 1

    return `[${item.type} #${index}]`
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={selectId}
        className="block text-sm font-medium text-app-muted"
      >
        {ru ? 'Боеприпас' : 'Ammunition'}
      </label>

      {ammunition.length === 0 ? (
        <p className="text-sm text-app-muted">
          {ru
            ? 'Нет данных о боеприпасах'
            : 'No ammunition data'}
        </p>
      ) : ammunition.length === 1 ? (
        <div className="rounded-lg border border-app-border bg-app-bg px-4 py-3 text-app-text">
          {formatLabel(ammunition[0])}
        </div>
      ) : (
        <select
          id={selectId}
          value={selected?.id ?? ''}
          onChange={(event) => onSelect(event.target.value)}
          className="w-full rounded-lg border border-app-border bg-app-bg px-4 py-3 text-app-text"
        >
          {ammunition.map((item) => (
            <option key={item.id} value={item.id}>
              {formatLabel(item)}
            </option>
          ))}
        </select>
      )}

      {ammunition.length > 0 && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-app-muted">
          <input
            type="checkbox"
            checked={showFullNames}
            onChange={(event) =>
              onShowFullNamesChange(event.target.checked)
            }
          />

          {ru
            ? 'Показывать полные названия'
            : 'Show full names'}
        </label>
      )}
    </div>
  )
}
