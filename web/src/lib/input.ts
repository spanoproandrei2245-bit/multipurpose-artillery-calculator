/** Разбор числа из поля ввода: допускаются запятая и знак «−». */
export function parseNumber(value: string): number | null {
  if (value.trim() === '') return null
  const number = Number(value.replace(',', '.').replace('−', '-'))
  return Number.isFinite(number) ? number : null
}

/** Поле заполнено, но число не распознано. */
export function isInvalid(value: string): boolean {
  return value.trim() !== '' && parseNumber(value) === null
}

export function formatSigned(value: number, digits = 1): string {
  const fixed = value.toFixed(digits)
  // −0.03 → «0.0», а не «-0.0»
  if (Number(fixed) === 0) return (0).toFixed(digits)
  return value > 0 ? `+${fixed}` : fixed
}

export function numberToField(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

export function readStored<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  try {
    const value = localStorage.getItem(key)
    return allowed.find((item) => item === value) ?? fallback
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Хранилище недоступно — настройка живёт до перезагрузки.
  }
}

/** Произвольная строка из хранилища (например, координата). */
export function readStoredText(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}
