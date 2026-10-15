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

/** Заголовок раздела: [02] ЦЕЛЬ ─────── (справа — необязательный элемент). */
export function SectionHeading({
  index,
  title,
  aside,
  as: Tag = 'h3',
}: {
  index?: string
  title: string
  aside?: ReactNode
  as?: 'h2' | 'h3' | 'h4'
}) {
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-2">
      {index && <span className="index">[{index}]</span>}
      <Tag className="label text-app-text">{title}</Tag>
      <span className="hidden h-px min-w-6 flex-1 bg-app-border sm:block" />
      {aside}
    </div>
  )
}

/**
 * Сегментная шкала: progress 0…1 зажигает сегменты слева направо.
 * alert — красные сегменты (сплэш, разрыв).
 */
export function SegmentBar({
  progress,
  count = 40,
  alert = false,
  className = '',
}: {
  progress: number
  count?: number
  alert?: boolean
  className?: string
}) {
  const lit = Math.round(Math.min(1, Math.max(0, progress)) * count)
  return (
    <div
      className={`segments ${className}`}
      data-alert={alert}
      role="presentation"
    >
      {Array.from({ length: count }, (_, i) => (
        <span key={i} data-on={i < lit} />
      ))}
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
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center border transition-colors peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          checked ? 'border-accent bg-accent-soft' : 'border-app-line-strong',
        ].join(' ')}
      >
        <span
          className={[
            'absolute h-3 w-3 transition-all',
            checked ? 'left-[19px] bg-accent' : 'left-[3px] bg-app-muted',
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
