
import type { Language } from '../types/settings'

type Translation = {
  header: {
    title: string
    subtitle: string
    status: string
  }
  navigation: {
    dashboard: string
    models: string
    settings: string
  }
  modelsPage: {
    title: string
    description: string
    modes: string
    openDashboard: string
  }
  modelSelector: {
    label: string
  }
  settings: {
    title: string
    description: string
    preferences: string
    language: string
    autoSave: string
    theme: string
    light: string
    dark: string
    experimental: string
    experimentalDescription: string
    gridInput: string
    gridInputDescription: string
    keepAwake: string
    keepAwakeDescription: string
    keepAwakeUnsupported: string
    openOnPhone: string
    openOnPhoneDescription: string
  }
}

export const translations: Record<Language, Translation> = {
  en: {
    header: {
      title: 'Multipurpose Artillery Calculator',
      subtitle: 'made by Heis',
      status: 'Alpha',
    },
    navigation: {
      dashboard: 'Dashboard',
      models: 'Models',
      settings: 'Settings',
    },
    modelsPage: {
      title: 'Game Models',
      description: 'Select a model to open its dashboard.',
      modes: 'Modes',
      openDashboard: 'Open Dashboard',
    },
    modelSelector: {
      label: 'Game Model',
    },
    settings: {
      title: 'Settings',
      description: 'Customize your application.',
      preferences: 'Preferences',
      language: 'Interface language',
      autoSave: 'Your preferences are saved automatically.',
      theme: 'Appearance',
      light: 'Light',
      dark: 'Dark',
      experimental: 'Experimental features',
      experimentalDescription: 'May change or be removed in future versions.',
      gridInput: 'Grid coordinate input',
      gridInputDescription:
        'Distance and azimuth from the gun and target grid references (6, 8 or 10 digits).',
      keepAwake: 'Keep the screen on',
      keepAwakeDescription:
        'While the app is open — handy for a phone next to the keyboard. The combat screen always keeps it on.',
      keepAwakeUnsupported: 'Not supported by this browser.',
      openOnPhone: 'Open on a phone',
      openOnPhoneDescription:
        'Scan the code to open the calculator on your phone. It can be installed as an app and works offline.',
    },
  },

  ru: {
    header: {
      title: 'Multipurpose Artillery Calculator',
      subtitle: 'made by Heis',
      status: 'Альфа',
    },
    navigation: {
      dashboard: 'Главная',
      models: 'Модели',
      settings: 'Настройки',
    },
    modelsPage: {
      title: 'Игровые модели',
      description: 'Выберите модель, чтобы открыть её панель.',
      modes: 'Режимы',
      openDashboard: 'Открыть панель',
    },
    modelSelector: {
      label: 'Игровая модель',
    },
    settings: {
      title: 'Настройки',
      description: 'Настройте приложение под себя.',
      preferences: 'Основные настройки',
      language: 'Язык интерфейса',
      autoSave: 'Настройки сохраняются автоматически.',
      theme: 'Тема оформления',
      light: 'Светлая',
      dark: 'Тёмная',
      experimental: 'Экспериментальные функции',
      experimentalDescription: 'Могут измениться или исчезнуть в следующих версиях.',
      gridInput: 'Ввод по координатам сетки',
      gridInputDescription:
        'Дистанция и азимут по координатам орудия и цели (6, 8 или 10 цифр).',
      keepAwake: 'Не гасить экран',
      keepAwakeDescription:
        'Пока приложение открыто — удобно для телефона рядом с клавиатурой. Боевой экран не даёт экрану гаснуть всегда.',
      keepAwakeUnsupported: 'Этот браузер не поддерживает.',
      openOnPhone: 'Открыть на телефоне',
      openOnPhoneDescription:
        'Отсканируйте код, чтобы открыть калькулятор на телефоне. Его можно установить как приложение — работает без интернета.',
    },
  },
}
