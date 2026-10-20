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
      <button
        ref={buttonRef}
        id={`${id}-button`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t.label}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openList()
          }
        }}
        className="flex h-9 w-auto max-w-[17rem] cursor-pointer items-center gap-2 rounded-md pr-1.5 pl-1.5 text-left text-app-text transition-colors hover:bg-app-raised-hover"
      >
        <ArtilleryIcon category={current.category} size="xs" language={language} />
        <span className="min-w-0 truncate">{current.name}</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-app-muted"
        >
          <path
            d="m7 15 5 5 5-5M7 9l5-5 5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={t.label}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={handleListKey}
          className="absolute right-0 z-30 mt-1 max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-auto rounded-lg bg-app-raised p-1 shadow-xl shadow-black/50 outline-none"
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
                  'flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left',
                  index === active ? 'bg-app-raised-hover' : '',
                ].join(' ')}
              >
                <ArtilleryIcon category={model.category} language={language} />

                <span className="min-w-0 flex-1">
                  <span
                    className={[
                      'block truncate',
                      selected ? 'font-semibold text-app-text' : 'text-app-text-2',
                    ].join(' ')}
                  >
                    {model.name}
                  </span>
                  <span className="block truncate text-[12.5px] text-app-muted">
                    {model.mod}
                  </span>
                </span>

                {selected && (
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-accent">
                    <path
                      d="m5 12 5 5L20 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
