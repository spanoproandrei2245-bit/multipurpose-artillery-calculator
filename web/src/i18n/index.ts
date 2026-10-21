import type { Language } from '../types/settings'
import { en, ru } from './messages'

export type MessageKey = keyof typeof ru

// Текущий язык интерфейса. Его задаёт App при каждой отрисовке, а смена
// языка перерисовывает всё приложение, поэтому t() можно звать откуда угодно.
let current: Language = 'ru'

export function setLanguage(language: Language) {
  current = language
}

export function getLanguage(): Language {
  return current
}

/** Текст на языке по ключу; {0}, {1} заменяются аргументами. */
export function translate(
  language: Language,
  key: MessageKey,
  ...args: readonly (string | number)[]
): string {
  const template: string = language === 'ru' ? ru[key] : en[key]
  return template.replace(/\{(\d+)\}/g, (_, index: string) =>
    String(args[Number(index)] ?? '')
  )
}

/** Текст на текущем языке. */
export function t(key: MessageKey, ...args: readonly (string | number)[]): string {
  return translate(current, key, ...args)
}
