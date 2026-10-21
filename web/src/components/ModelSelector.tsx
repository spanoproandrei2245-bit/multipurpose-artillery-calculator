import { useState } from 'react'

import { categoryLabels } from '../data/categories'
import { models, type ModelId } from '../data/models'
import { t } from '../i18n'
import { ArtilleryIcon } from './ArtilleryIcon'
import { Dropdown, type DropdownOption } from './Dropdown'
import { FieldIcon } from './FieldIcon'
import { PickerDialog } from './PickerDialog'

interface ModelSelectorProps {
  value: ModelId
  onChange: (value: ModelId) => void
}

const modelIds = Object.keys(models) as ModelId[]

/** Орудия из ванили (Arma 3) — в списке; остальные — в окне с поиском. */
const isVanilla = (id: ModelId) => models[id].mod.startsWith('Arma 3')

const MODS = '__mods__'

/**
 * Выбор орудия: значок класса отдельно от списка. В списке — ванильные
 * орудия (и выбранное модовое), модовые ищутся в окне «Модовые орудия».
 */
export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [picking, setPicking] = useState(false)
  const current = models[value]

  const listed = modelIds.filter((id) => isVanilla(id) || id === value)
  const options: DropdownOption<string>[] = [
    ...listed.map((id) => ({
      value: id as string,
      label: models[id].name,
      description: models[id].mod,
      icon: <ArtilleryIcon category={models[id].category} />,
    })),
    {
      value: MODS,
      label: t('picker.mod-weapons'),
      description: String(modelIds.filter((id) => !isVanilla(id)).length),
      icon: (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-app-raised-hover text-app-text">
          <FieldIcon name="search" className="h-[18px] w-[18px]" />
        </span>
      ),
      divider: true,
    },
  ]

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <ArtilleryIcon category={current.category} />
      <Dropdown
        fullWidth
        className="min-w-0 flex-1"
        label={t('modelSelector.label')}
        value={value as string}
        options={options}
        onChange={(next) => {
          if (next === MODS) setPicking(true)
          else onChange(next as ModelId)
        }}
      />
      {picking && (
        <PickerDialog
          title={t('picker.weapons-title')}
          placeholder={t('picker.search-weapons')}
          selectedId={value}
          items={modelIds.map((id) => ({
            id,
            title: models[id].name,
            subtitle: `${models[id].mod} · ${t(categoryLabels[models[id].category])}`,
            group: isVanilla(id) ? t('picker.vanilla') : models[id].mod,
            keywords: models[id].notes,
            icon: <ArtilleryIcon category={models[id].category} size="md" />,
          }))}
          onPick={(id) => {
            setPicking(false)
            onChange(id as ModelId)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
