import type { Language } from './languages'
import { en, ru } from './messages'
import { de } from './messages.de'
import { fr } from './messages.fr'
import { ja } from './messages.ja'
import { uk } from './messages.uk'
import { zh } from './messages.zh'

export type MessageKey = keyof typeof ru

export { LANGUAGES, LANGUAGE_IDS, detectLanguage, isLanguage, localeOf } from './languages'
export type { Language } from './languages'

const dictionaries: Record<Language, Record<MessageKey, string>> = {
  ru,
  en,
  uk,
  de,
  fr,
  ja,
  zh,
}

// Текущий язык интерфейса. Его задаёт App при каждой отрисовке, а смена
// языка перерисовывает всё приложение, поэтому t() можно звать откуда угодно.
let current: Language = 'ru'

export function setLanguage(language: Language) {
  current = language
}

export function getLanguage(): Language {
  return current
}

/** Все словари — для проверок и инструментов. */
export function dictionaryOf(language: Language): Record<MessageKey, string> {
  return dictionaries[language]
}

/** Текст на языке по ключу; {0}, {1} заменяются аргументами. */
export function translate(
  language: Language,
  key: MessageKey,
  ...args: readonly (string | number)[]
): string {
  const template = dictionaries[language][key] ?? en[key]
  return template.replace(/\{(\d+)\}/g, (_, index: string) =>
    String(args[Number(index)] ?? '')
  )
}

/** Текст на текущем языке. */
export function t(key: MessageKey, ...args: readonly (string | number)[]): string {
  return translate(current, key, ...args)
}
