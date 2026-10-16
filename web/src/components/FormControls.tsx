import type { ReactNode } from 'react'

import { isInvalid } from '../lib/input'

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
}: FieldProps) {
  const invalid = validate && isInvalid(value)

  return (
    <div className={className}>
      {/* Фиксированная высота строки подписи: поля в соседних
          колонках выравниваются, даже если у одного есть переключатель. */}
      <div className="mb-1.5 flex min-h-7 items-center justify-between gap-2">
        <label htmlFor={id} className="label">
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
  options: readonly { value: T; label: string; disabled?: boolean }[]
  onChange: (value: T) => void
  label: string
}

export function Toggle<T extends string>({
  value,
  options,
  onChange,
  label,
}: ToggleProps<T>) {
  return (
    <div role="group" aria-label={label} className="seg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
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
        'flex items-start gap-3',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
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
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-solid',
          checked ? 'bg-accent-solid' : 'bg-app-raised-hover',
        ].join(' ')}
      >
        <span
          className={[
            'absolute h-4 w-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-[2px]',
          ].join(' ')}
        />
      </span>
      <span>
        <span className="block text-sm text-app-text">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-app-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}

/** Строка списка «подпись — значение» (внутри <dl>). */
export function Row({
  label,
  htmlFor,
  children,
}: {
  label: ReactNode
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="row">
      <dt className="min-w-0">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
      </dt>
      <dd className="flex min-w-0 items-center justify-end gap-2">{children}</dd>
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
}: {
  id: string
  value: string
  onChange: (value: string) => void
  unit?: string
  placeholder?: string
  // Подпись для экранного диктора, если строка без <label>
  label?: string
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
        className="field field-inline"
      />
      {unit && <span className="w-7 text-left text-app-muted">{unit}</span>}
    </>
  )
}
