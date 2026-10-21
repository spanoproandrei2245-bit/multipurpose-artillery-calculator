import { useCallback, useState } from 'react'

function read(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
    return Array.isArray(value)
      ? value.filter((k): k is string => typeof k === 'string')
      : []
  } catch {
    return []
  }
}

/**
 * Избранное (карты, орудия): список идентификаторов в localStorage.
 * toggle добавляет или убирает идентификатор.
 */
export function useFavorites(storageKey: string) {
  const [favorites, setFavorites] = useState<string[]>(() => read(storageKey))

  const toggle = useCallback(
    (id: string) => {
      setFavorites((current) => {
        const next = current.includes(id)
          ? current.filter((k) => k !== id)
          : [...current, id]
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          // Список живёт до перезагрузки.
        }
        return next
      })
    },
    [storageKey]
  )

  return [favorites, toggle] as const
}
