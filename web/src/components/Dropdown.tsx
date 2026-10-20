import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export interface DropdownOption<T extends string> {
  value: T
  label: ReactNode
  // Вторая строка мелким шрифтом (автор карты, пояснение)
  description?: ReactNode
  // Слева: значок или цветная метка
  icon?: ReactNode
  // Заголовок группы: выводится перед первой опцией с таким заголовком
  group?: string
  disabled?: boolean
}

interface DropdownProps<T extends string> {
  value: T
  options: readonly DropdownOption<T>[]
  onChange: (value: T) => void
  label: string
  // Что показать на кнопке, если выбранного значения нет в списке
  placeholder?: string
  disabled?: boolean
  // Список раскрывается к левому краю кнопки (по умолчанию — к правому)
  alignLeft?: boolean
  // Подпись на кнопке вместо подписи выбранной опции
  buttonLabel?: ReactNode
  className?: string
}

/**
 * Выпадающий список в стиле интерфейса: вместо системного <select>.
 * Кнопка + listbox, управление стрелками, Home/End, Enter, Escape.
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  label,
  placeholder = '—',
  disabled = false,
  alignLeft = false,
  buttonLabel,
  className = '',
}: DropdownProps<T>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedIndex = options.findIndex((o) => o.value === value)
  const [active, setActive] = useState(selectedIndex)
  const current = options[selectedIndex]

  useEffect(() => {
    if (!open) return
    function handlePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    return () => document.removeEventListener('pointerdown', handlePointer)
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  // Активная строка всегда в поле зрения
  useEffect(() => {
    if (open) {
      document
        .getElementById(`${id}-opt-${active}`)
        ?.scrollIntoView({ block: 'nearest' })
    }
  }, [open, active, id])

  function openList() {
    if (disabled) return
    setActive(Math.max(0, selectedIndex))
    setOpen(true)
  }

  function choose(index: number) {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  function move(step: 1 | -1) {
    let next = active
    do {
      next += step
    } while (options[next]?.disabled)
    if (next >= 0 && next < options.length) setActive(next)
  }

  function handleListKey(event: React.KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(options.length - 1)
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

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openList()
          }
        }}
        className="field flex w-auto max-w-[16rem] cursor-pointer items-center gap-2 pr-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 truncate">
          {buttonLabel ?? current?.label ?? placeholder}
        </span>
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
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={handleListKey}
          className={[
            'absolute z-30 mt-1 max-h-80 min-w-full w-max max-w-[min(20rem,calc(100vw-2rem))] overflow-auto rounded-lg bg-app-raised p-1 shadow-xl shadow-black/50 outline-none',
            alignLeft ? 'left-0' : 'right-0',
          ].join(' ')}
        >
          {options.map((option, index) => {
            const selected = index === selectedIndex
            const showGroup =
              option.group !== undefined &&
              option.group !== options[index - 1]?.group

            return (
              <li key={option.value} role="presentation">
                {showGroup && (
                  <div className="px-2 pt-2 pb-1 text-[11.5px] font-semibold tracking-wide text-app-faint uppercase">
                    {option.group}
                  </div>
                )}
                <div
                  id={`${id}-opt-${index}`}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={option.disabled}
                  onPointerEnter={() => !option.disabled && setActive(index)}
                  onClick={() => choose(index)}
                  className={[
                    'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left',
                    option.disabled
                      ? 'cursor-not-allowed opacity-40'
                      : 'cursor-pointer',
                    index === active && !option.disabled
                      ? 'bg-app-raised-hover'
                      : '',
                  ].join(' ')}
                >
                  {option.icon}
                  <span className="min-w-0 flex-1">
                    <span
                      className={[
                        'block truncate',
                        selected
                          ? 'font-semibold text-app-text'
                          : 'text-app-text-2',
                      ].join(' ')}
                    >
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="block truncate text-[12.5px] text-app-muted">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {selected && (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-accent"
                    >
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
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
