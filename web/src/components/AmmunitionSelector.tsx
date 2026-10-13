
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

  language: Language
}

export function AmmunitionSelector({
  ammunition,
  selectedId,
  onSelect,
  language,
}: AmmunitionSelectorProps) {
  const selectId = useId()
  const ru = language === 'ru'

  const selected =
    ammunition.find((item) => item.id === selectedId) ??
    ammunition[0]

  function formatLabel(item: AmmunitionOption): string {
    return `${item.designation} [${item.type}]`
  }

  return (
    <div>
      <label
        htmlFor={selectId}
        className="mb-2 block text-sm font-medium text-app-muted"
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
        <div className="flex min-h-14 items-center rounded-lg border border-app-border bg-app-bg px-4 text-app-text">
          {formatLabel(ammunition[0])}
        </div>
      ) : (
        <select
          id={selectId}
          value={selected?.id ?? ''}
          onChange={(event) => onSelect(event.target.value)}
          className="min-h-14 w-full rounded-lg border border-app-border bg-app-bg px-4 text-app-text"
        >
          {ammunition.map((item) => (
            <option key={item.id} value={item.id}>
              {formatLabel(item)}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
