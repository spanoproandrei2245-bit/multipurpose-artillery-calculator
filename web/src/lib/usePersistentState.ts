import { useEffect, useState } from 'react'

/**
 * Состояние, которое переживает перезагрузку (localStorage).
 * parse получает сохранённую строку или null и решает, что взять.
 */
export function usePersistentState<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string = String
) {
  const [value, setValue] = useState<T>(() => {
    try {
      return parse(localStorage.getItem(key))
    } catch {
      return parse(null)
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, serialize(value))
    } catch {
      // Хранилище недоступно — значение живёт до перезагрузки.
    }
  }, [key, value, serialize])

  return [value, setValue] as const
}
