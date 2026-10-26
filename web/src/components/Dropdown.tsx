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
  // Справа в строке: превью, кнопка «в избранное»
  trailing?: ReactNode
  // Линия над строкой (отделяет действия от выбора)
  divider?: boolean
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
  // field — поле с фоном; ghost — как значение в строке списка, фон при наведении
  variant?: 'field' | 'ghost' | 'icon'
  // Для обучения: подсвечиваемый элемент
  tourId?: string
  // Кнопка занимает всю ширину контейнера, шеврон — справа
  fullWidth?: boolean
  // Список раскрывается вверх (у нижнего края страницы)
  up?: boolean
  // Дополнительные классы кнопки (размер, фон на телефоне)
  buttonClassName?: string
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
  placeholder = '-',
  disabled = false,
  alignLeft = false,
  buttonLabel,
  className = '',
  variant = 'field',
  fullWidth = false,
  up: upProp = false,
  tourId,
  buttonClassName = '',
}: DropdownProps<T>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  // Раскрытие вверх: явно или когда снизу не хватает места
  const [flipUp, setFlipUp] = useState(false)
  // Высота списка по свободному месту, чтобы он не раздувал страницу
  const [maxHeight, setMaxHeight] = useState(320)
  const up = upProp || flipUp
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
    // Не раздувать страницу: если снизу тесно, а сверху просторнее — раскрыть вверх
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      const below = window.innerHeight - rect.bottom
      const up = below < 280 && rect.top > below
      setFlipUp(up)
      setMaxHeight(Math.max(140, Math.min(320, (up ? rect.top : below) - 16)))
    }
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
    <div ref={rootRef} data-tour={tourId} className={`relative ${className}`}>
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
        className={[
          fullWidth
            ? 'flex w-full cursor-pointer items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50'
            : 'flex w-auto max-w-[16rem] cursor-pointer items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'ghost'
            ? 'min-h-9 rounded-md py-1 pr-1.5 pl-2 text-app-text transition-colors hover:bg-app-raised-hover'
            : variant === 'icon'
              ? 'btn px-2.5'
              : 'field min-h-9 h-auto py-1 pr-2',
          buttonClassName,
        ].join(' ')}
      >
        <span className="min-w-0 flex-1 leading-tight break-words whitespace-normal">
          {buttonLabel ?? current?.label ?? placeholder}
        </span>
        {variant !== 'icon' && (
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
        )}
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
          style={{ maxHeight }}
          className={[
            'absolute z-30 min-w-full w-max max-w-[min(20rem,calc(100vw-2rem))] overflow-auto rounded-lg bg-app-raised p-1 shadow-xl shadow-black/50 outline-none',
            up ? 'bottom-full mb-1' : 'mt-1',
            alignLeft ? 'left-0' : 'right-0',
          ].join(' ')}
        >
          {options.map((option, index) => {
            const selected = index === selectedIndex
            const showGroup =
              !!option.group &&
              option.group !== options[index - 1]?.group

            return (
              <li key={option.value} role="presentation">
                {option.divider && <div className="mx-1 my-1 h-px bg-app-border" />}
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
                        'block leading-snug break-words',
                        selected
                          ? 'font-semibold text-app-text'
                          : 'text-app-text-2',
                      ].join(' ')}
                    >
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="block text-[12.5px] leading-snug break-words text-app-muted">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {option.trailing}
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
