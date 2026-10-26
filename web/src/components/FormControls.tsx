import { useEffect, useRef, useState, type ReactNode } from 'react'

import { isInvalid } from '../lib/input'
import { FieldIcon, type FieldIconName } from './FieldIcon'

export const inputClass = 'field field-lg'

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  // Enter в поле (например, «Учесть разрыв»)
  onEnter?: () => void
  className?: string
  // Элемент справа от подписи (например, переключатель)
  aside?: ReactNode
  placeholder?: string
  hint?: ReactNode
  // Текстовое поле без проверки числа (например, координаты)
  inputMode?: 'decimal' | 'numeric'
  validate?: boolean
  // Значок-подсказка перед подписью
  icon?: FieldIconName
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  className,
  aside,
  placeholder = '0',
  hint,
  inputMode = 'decimal',
  onEnter,
  validate = true,
  icon,
}: FieldProps) {
  const invalid = validate && isInvalid(value)

  return (
    <div className={className}>
      {/* Фиксированная высота строки подписи: поля в соседних
          колонках выравниваются, даже если у одного есть переключатель. */}
      <div className="mb-1.5 flex min-h-7 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label htmlFor={id} className="label flex min-w-0 items-center gap-1.5">
          {icon && <FieldIcon name={icon} />}
          {label}
        </label>
        {aside}
      </div>

      <input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={
          onEnter
            ? (event) => {
                if (event.key === 'Enter') onEnter()
              }
            : undefined
        }
        placeholder={placeholder}
        aria-invalid={invalid}
        className={inputClass}
      />

      {hint && <p className="mt-1.5 text-xs text-app-muted">{hint}</p>}
    </div>
  )
}

interface ToggleProps<T extends string> {
  value: T
  options: readonly {
    value: T
    label: string
    disabled?: boolean
    icon?: FieldIconName
    // Подсказка при наведении (по умолчанию её нет)
    title?: string
  }[]
  onChange: (value: T) => void
  label: string
  className?: string
  // Только значки: подпись остаётся в подсказке и для экранного диктора
  iconOnly?: boolean
  // Кнопки одной ширины (сетка): не зависит от длины подписей на разных языках
  equal?: boolean
}

export function Toggle<T extends string>({
  value,
  options,
  onChange,
  label,
  className = '',
  iconOnly = false,
  equal = false,
}: ToggleProps<T>) {
  const ref = useRef<HTMLDivElement>(null)
  // Подвижная «таблетка» под выбранной кнопкой: переключение скользит
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  // Равные колонки: если подпись не влезает, сначала прячутся значки (1),
  // потом уменьшается шрифт (2), потом колонки делятся по длине подписей (3),
  // в крайнем случае подпись переносится (4). Многоточия нет: текст виден целиком.
  const [fit, setFit] = useState(0)
  const widthRef = useRef(0)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const measure = () => {
      if (equal) {
        // Стало шире — пробуем снова со значками
        if (root.clientWidth > widthRef.current + 8 && widthRef.current > 0) setFit(0)
        widthRef.current = root.clientWidth
        const overflow = [...root.querySelectorAll<HTMLElement>('button > span')].some(
          (span) => span.scrollWidth > span.clientWidth + 1
        )
        if (overflow) setFit((level) => Math.min(4, level + 1))
      }
      const el = root.querySelector<HTMLElement>('button[aria-pressed="true"]')
      setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null)
    }
    const frame = requestAnimationFrame(measure)
    // Ширины кнопок меняются, когда догружается шрифт или меняется язык
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    root.querySelectorAll('button').forEach((b) => observer.observe(b))
    void document.fonts?.ready.then(measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [value, options.length, equal, fit])

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-pill={pill ? '' : undefined}
      className={`seg ${equal ? `!grid grid-flow-col ${fit >= 3 ? 'auto-cols-auto' : 'auto-cols-fr'}` : ''} ${className}`}
    >
      {pill && (
        <span
          aria-hidden="true"
          className="seg-pill"
          style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
        />
      )}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          title={iconOnly ? option.label : option.title}
          aria-label={iconOnly ? option.label : undefined}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={
            equal
              ? `min-w-0 justify-center !px-1.5 ${fit >= 2 ? '!text-[12px] !tracking-tight' : ''}`
              : undefined
          }
        >
          {option.icon && !(equal && fit >= 1) && (
            <FieldIcon name={option.icon} className={iconOnly ? 'h-[18px] w-[18px]' : 'h-3.5 w-3.5'} />
          )}
          {!iconOnly && (
            <span
              className={
                equal
                  ? fit >= 4
                    ? 'min-w-0 leading-tight [overflow-wrap:anywhere]'
                    : 'min-w-0 overflow-hidden whitespace-nowrap'
                  : undefined
              }
            >
              {option.label}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/** Заголовок раздела (справа — необязательный элемент). */
export function SectionHeading({
  title,
  aside,
  as: Tag = 'h3',
}: {
  // Старый номер раздела больше не показывается
  index?: string
  title: string
  aside?: ReactNode
  as?: 'h2' | 'h3' | 'h4'
}) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <Tag className="font-semibold text-app-text">{title}</Tag>
      {aside}
    </div>
  )
}

/** Полоса прогресса 0…1; alert — красная (сплэш, разрыв). */
export function ProgressBar({
  progress,
  alert = false,
  className = '',
}: {
  progress: number
  alert?: boolean
  className?: string
}) {
  const percent = Math.min(1, Math.max(0, progress)) * 100
  return (
    <div className={`progress ${className}`} data-alert={alert} role="presentation">
      <span style={{ width: `${percent}%` }} />
    </div>
  )
}

/** Переключатель «вкл/выкл» с подписью и пояснением. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: ReactNode
  disabled?: boolean
}) {
  return (
    <label
      className={[
        'flex items-start justify-between gap-4',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      <span className="min-w-0">
        <span className="block text-[15px] leading-snug font-medium text-app-text">{label}</span>
        {description && (
          <span className="mt-1 block text-[13px] leading-relaxed text-app-muted">{description}</span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-solid',
          checked ? 'bg-accent-solid' : 'bg-app-raised-hover',
        ].join(' ')}
      >
        <span
          className={[
            'absolute h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[22px]' : 'left-[2px]',
          ].join(' ')}
        />
      </span>
    </label>
  )
}

/** Строка списка «подпись — значение» (внутри <dl>). */
export function Row({
  label,
  htmlFor,
  icon,
  control,
  unit,
  tourId,
  children,
}: {
  label: ReactNode
  htmlFor?: string
  icon?: FieldIconName
  // Единая ширина контролов справа: full — на всю ширину, unit — поле
  // с единицей справа (единицы выровнены в одну колонку)
  control?: 'full' | 'unit'
  unit?: string
  // Для обучения: подсвечиваемая строка
  tourId?: string
  children: ReactNode
}) {
  return (
    <div className="row" data-tour={tourId}>
      <dt className="flex min-w-0 items-center gap-2">
        {icon && <FieldIcon name={icon} className="h-[18px] w-[18px] text-app-muted" />}
        <span className="min-w-0">
          {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
        </span>
      </dt>
      <dd className="flex min-w-0 items-center justify-end gap-2">
        {control ? (
          <>
            <div
              className={[
                'flex min-w-0 items-center gap-2',
                control === 'unit'
                  ? 'w-[13.5rem] max-w-[calc(60vw-2.25rem)]'
                  : 'w-[15.75rem] max-w-[60vw]',
              ].join(' ')}
            >
              {children}
            </div>
            {control === 'unit' && (
              <span className="w-7 text-left text-app-muted">{unit}</span>
            )}
          </>
        ) : (
          children
        )}
      </dd>
    </div>
  )
}

/** Числовое поле прямо в строке списка, с единицами справа. */
export function InlineNumber({
  id,
  value,
  onChange,
  unit,
  placeholder = '0',
  label,
  readOnly = false,
  block = false,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  unit?: string
  placeholder?: string
  // Подпись для экранного диктора, если строка без <label>
  label?: string
  // Поле тянется на всю ширину контейнера (в строке с единой шириной)
  block?: boolean
  readOnly?: boolean
}) {
  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={isInvalid(value)}
        readOnly={readOnly}
        className={`field ${block ? 'h-9 min-w-0 flex-1 text-right' : 'field-inline'} ${readOnly ? 'opacity-60' : ''}`}
      />
      {unit && <span className="w-7 text-left text-app-muted">{unit}</span>}
    </>
  )
}
