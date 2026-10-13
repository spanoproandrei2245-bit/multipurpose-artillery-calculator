import { useEffect, useRef } from 'react'

/**
 * Клавиша → действие. Ключ — KeyboardEvent.code («KeyF», «Digit1»),
 * а не символ: так клавиши работают и в русской раскладке.
 */
export type HotkeyMap = Record<string, () => void>

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/**
 * Глобальные горячие клавиши. Не срабатывают, пока курсор в поле
 * ввода (кроме Escape — он снимает фокус с поля) и при зажатых
 * Ctrl / Alt / Meta, чтобы не мешать системным сочетаниям.
 */
export function useHotkeys(map: HotkeyMap, enabled = true) {
  // Последняя версия обработчиков без переподписки на каждый рендер
  const mapRef = useRef(map)
  useEffect(() => {
    mapRef.current = map
  })

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey) return
      if (event.repeat) return

      if (isTyping(event.target)) {
        if (event.code === 'Escape') (event.target as HTMLElement).blur()
        return
      }

      // «?» — Shift + «/»
      const code =
        event.code === 'Slash' && event.shiftKey ? 'Question' : event.code
      const action = mapRef.current[code]
      if (action) {
        event.preventDefault()
        action()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
