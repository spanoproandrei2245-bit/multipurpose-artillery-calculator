/** Языки интерфейса. Названия — на самих языках (так их узнаёт любой). */
export const LANGUAGES = [
  { id: 'ru', name: 'Русский', locale: 'ru' },
  { id: 'en', name: 'English', locale: 'en' },
  { id: 'uk', name: 'Українська', locale: 'uk' },
  { id: 'de', name: 'Deutsch', locale: 'de' },
  { id: 'fr', name: 'Français', locale: 'fr' },
  { id: 'ja', name: '日本語', locale: 'ja' },
  { id: 'zh', name: '中文', locale: 'zh-CN' },
] as const

export type Language = (typeof LANGUAGES)[number]['id']

export const LANGUAGE_IDS: readonly Language[] = LANGUAGES.map((l) => l.id)

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGE_IDS as readonly string[]).includes(value)
}

/** Язык по умолчанию — как у системы (первый подходящий из списка языков браузера). */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split('-')[0]
    if (isLanguage(primary)) return primary
  }
  return 'en'
}

/** Код для lang у <html> и для Intl. */
export function localeOf(language: Language): string {
  return LANGUAGES.find((l) => l.id === language)?.locale ?? 'en'
}
