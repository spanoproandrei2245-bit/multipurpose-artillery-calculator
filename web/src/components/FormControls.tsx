import type { ReactNode } from 'react'

import { isInvalid } from '../lib/input'

export const inputClass =
  'w-full rounded-lg border border-app-border bg-app-bg px-4 py-3 text-lg text-app-text outline-none focus:border-emerald-500'

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
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
  validate = true,
}: FieldProps) {
  const invalid = validate && isInvalid(value)

  return (
    <div className={className}>
      {/* Фиксированная высота строки подписи: поля в соседних
          колонках выравниваются, даже если у одного есть переключатель. */}
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm text-app-muted">
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
        placeholder={placeholder}
        aria-invalid={invalid}
        className={[inputClass, invalid ? 'border-red-500' : ''].join(' ')}
      />

      {hint && <p className="mt-2 text-xs text-app-muted">{hint}</p>}
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
    <div
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-lg border border-app-border"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={[
            'whitespace-nowrap px-2.5 py-1 text-xs',
            option.value === value
              ? 'bg-emerald-600 text-white'
              : 'bg-app-bg text-app-text',
            option.disabled
              ? 'cursor-not-allowed opacity-40'
              : 'cursor-pointer',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
