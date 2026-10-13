import { useEffect, useId, useRef, useState } from 'react'

import { models, type ModelId } from '../data/models'
import { translations } from '../i18n/translations'
import type { Language } from '../types/settings'
import { ArtilleryIcon } from './ArtilleryIcon'

interface ModelSelectorProps {
  value: ModelId
  onChange: (value: ModelId) => void
  language: Language
}

const modelIds = Object.keys(models) as ModelId[]

/**
 * Выпадающий список моделей с иконками.
 * Обычный <select> не умеет показывать картинки, поэтому список
 * свой: кнопка + listbox, управление стрелками, Enter, Escape.
 */
export function ModelSelector({
  value,
  onChange,
  language,
}: ModelSelectorProps) {
  const t = translations[language].modelSelector
  const id = useId()
  const listId = `${id}-list`

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => modelIds.indexOf(value))

  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Закрытие по клику вне списка
  useEffect(() => {
    if (!open) return

    function handlePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointer)
    return () => document.removeEventListener('pointerdown', handlePointer)
  }, [open])

  // Фокус на список при открытии
  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  function openList() {
    setActive(modelIds.indexOf(value))
    setOpen(true)
  }

  function choose(index: number) {
    onChange(modelIds[index])
    setOpen(false)
    buttonRef.current?.focus()
  }

  function handleListKey(event: React.KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive((i) => Math.min(i + 1, modelIds.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(modelIds.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        choose(active)
        break
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  const current = models[value]

  return (
    <div ref={rootRef} className="relative">
      <label
        id={`${id}-label`}
        htmlFor={`${id}-button`}
        className="mb-2 block text-sm font-medium text-app-muted"
      >
        {t.label}
      </label>

      <button
        ref={buttonRef}
        id={`${id}-button`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openList()
          }
        }}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg border border-app-border bg-app-bg px-3 py-2 text-left text-app-text outline-none focus:border-emerald-500"
      >
        <ArtilleryIcon category={current.category} language={language} />

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{current.name}</span>
          <span className="block truncate text-xs text-app-muted">
            {current.mod}
          </span>
        </span>

        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={[
            'h-5 w-5 shrink-0 fill-current text-app-muted transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
        >
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={handleListKey}
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-app-border bg-app-surface p-1 shadow-lg outline-none"
        >
          {modelIds.map((modelId, index) => {
            const model = models[modelId]
            const selected = modelId === value

            return (
              <li
                key={modelId}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(index)}
                onClick={() => choose(index)}
                className={[
                  'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-app-text',
                  index === active ? 'bg-app-bg' : '',
                  selected ? 'font-semibold' : '',
                ].join(' ')}
              >
                <ArtilleryIcon category={model.category} language={language} />

                <span className="min-w-0 flex-1">
                  <span className="block truncate">{model.name}</span>
                  <span className="block truncate text-xs font-normal text-app-muted">
                    {model.mod}
                  </span>
                </span>

                {selected && (
                  <span
                    aria-hidden="true"
                    className="text-emerald-600 dark:text-emerald-400"
                  >
                    ✓
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
