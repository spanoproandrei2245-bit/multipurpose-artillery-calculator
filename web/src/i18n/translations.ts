
import type { Language } from '../types/settings'

export const translations = {
  en: {
    settings: {
      title: 'Settings',
      description: 'Customize your application.',
      preferences: 'Preferences',
      language: 'Interface language',
      autoSave: 'Your preferences are saved automatically.',
    },
  },

  ru: {
    settings: {
      title: 'Настройки',
      description: 'Настройте приложение под себя.',
      preferences: 'Основные настройки',
      language: 'Язык интерфейса',
      autoSave: 'Настройки сохраняются автоматически.',
    },
  },
} satisfies Record<Language, {
  settings: {
    title: string
    description: string
    preferences: string
    language: string
    autoSave: string
  }
}>
