import { useState } from 'react'

import { artilleryRegistry } from '../data/artillery/registry'
import { categoryLabels } from '../data/categories'
import { models, type ModelId } from '../data/models'
import { t } from '../i18n'
import { useFavorites } from '../lib/favorites'
import { ArtilleryIcon } from './ArtilleryIcon'
import { Dropdown, type DropdownOption } from './Dropdown'
import { FieldIcon } from './FieldIcon'
import { MapRequests } from './MapRequests'
import { PickerDialog } from './PickerDialog'

interface ModelSelectorProps {
  value: ModelId
  onChange: (value: ModelId) => void
}

const modelIds = Object.keys(models) as ModelId[]

/** Орудия из ванили (Arma 3) — в списке; остальные — в окне с поиском. */
const isVanilla = (id: ModelId) => models[id].mod.startsWith('Arma 3')

const MODS = '__mods__'

// Проверка таблиц в игре: значок в углу плитки орудия (подробности в подсказке)
const statusOf = (id: ModelId) => artilleryRegistry[id].source.status

/**
 * Выбор орудия: значок класса отдельно от списка. В списке — ванильные
 * орудия (и выбранное модовое), модовые ищутся в окне «Модовые орудия».
 */
export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [picking, setPicking] = useState(false)
  // Окно «Предложить орудие»
  const [suggesting, setSuggesting] = useState(false)
  const [favorites, toggleFavorite] = useFavorites('favModels')
  const current = models[value]

  // В списке: избранные (в том числе модовые), ванильные и выбранное модовое
  const isFav = (id: ModelId) => favorites.includes(id)
  const listed = [
    ...modelIds.filter(isFav),
    ...modelIds.filter((id) => !isFav(id) && isVanilla(id)),
    ...modelIds.filter((id) => !isFav(id) && !isVanilla(id) && id === value),
  ]
  const options: DropdownOption<string>[] = [
    ...listed.map((id) => ({
      value: id as string,
      label: models[id].name,
      description: models[id].mod,
      group: isFav(id)
        ? t('picker.favourites')
        : isVanilla(id)
          ? t('picker.vanilla')
          : t('picker.current'),
      icon: <ArtilleryIcon category={models[id].category} status={statusOf(id)} />,
      trailing: (
        <button
          type="button"
          tabIndex={-1}
          aria-label={isFav(id) ? t('picker.unfavourite') : t('picker.favourite')}
          title={isFav(id) ? t('picker.unfavourite') : t('picker.favourite')}
          onClick={(event) => {
            event.stopPropagation()
            toggleFavorite(id)
          }}
          className={[
            'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-app-raised-hover',
            isFav(id) ? 'text-warn' : 'text-app-faint',
          ].join(' ')}
        >
          <FieldIcon name={isFav(id) ? 'starFilled' : 'star'} className="h-4 w-4" />
        </button>
      ),
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
      <ArtilleryIcon category={current.category} status={statusOf(value)} />
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
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          items={modelIds.map((id) => ({
            id,
            title: models[id].name,
            subtitle: `${models[id].mod} · ${t(categoryLabels[models[id].category])}`,
            group: isVanilla(id) ? t('picker.vanilla') : models[id].mod,
            source: isVanilla(id) ? undefined : /\bDLC\b/i.test(models[id].mod) ? ('dlc' as const) : ('mod' as const),
            keywords: models[id].notes,
            icon: <ArtilleryIcon category={models[id].category} size="md" status={statusOf(id)} />,
          }))}
          onPick={(id) => {
            setPicking(false)
            onChange(id as ModelId)
          }}
          onClose={() => setPicking(false)}
          footer={
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPicking(false)
                setSuggesting(true)
              }}
            >
              <FieldIcon name="plus" className="h-[18px] w-[18px]" />
              {t('picker.suggest-weapon')}
            </button>
          }
        />
      )}
      {suggesting && (
        <MapRequests kind="weapon" onClose={() => setSuggesting(false)} />
      )}
    </div>
  )
}
