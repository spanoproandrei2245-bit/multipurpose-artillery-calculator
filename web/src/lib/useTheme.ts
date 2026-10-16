import { useSyncExternalStore } from 'react'

function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}

const isDark = () => document.documentElement.classList.contains('dark')

/** Включена ли тёмная тема; меняется вместе с классом на <html>. */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => true)
}

/** Значение CSS-переменной темы (например, --color-accent) для холста. */
export function themeColor(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}
