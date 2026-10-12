
import type { Language } from '../types/settings'
import type { ModelId } from '../data/models'

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
  dashboard: {
    title: string
    description: string
  }
  modelsPage: {
    title: string
    description: string
    modes: string
    source: string
    openDashboard: string
  }
  modelSelector: {
    label: string
  }
  modelDetails: {
    modification: string
    availableModes: string
    dataSource: string
    importStatus: string
    screenshots: string
    verified: string
  }
  modelNotes: Record<ModelId, string>
  settings: {
    title: string
    description: string
    preferences: string
    language: string
    autoSave: string
  }
}

export const translations: Record<Language, Translation> = {
  en: {
    header: {
      title: 'Multipurpose Artillery Calculator',
      subtitle: 'Game Companion',
      status: 'Alpha',
    },
    navigation: {
      dashboard: 'Dashboard',
      models: 'Models',
      settings: 'Settings',
    },
    dashboard: {
      title: 'Dashboard',
      description: 'Select a game model to view its information.',
    },
    modelsPage: {
      title: 'Game Models',
      description: 'Select a model to open its dashboard.',
      modes: 'Modes',
      source: 'Source',
      openDashboard: 'Open Dashboard',
    },
    modelSelector: {
      label: 'Game Model',
    },
    modelDetails: {
      modification: 'Modification',
      availableModes: 'Available modes',
      dataSource: 'Data source',
      importStatus: 'Import status',
      screenshots: 'Screenshots collected',
      verified: 'Verified',
    },
    modelNotes: {
      mk6: 'Vanilla 82mm mortar.',
      m252: 'RHSUSAF 81mm mortar.',
    },
    settings: {
      title: 'Settings',
      description: 'Customize your application.',
      preferences: 'Preferences',
      language: 'Interface language',
      autoSave: 'Your preferences are saved automatically.',
    },
  },

  ru: {
    header: {
      title: 'Multipurpose Artillery Calculator',
      subtitle: 'Игровой помощник',
      status: 'Альфа',
    },
    navigation: {
      dashboard: 'Главная',
      models: 'Модели',
      settings: 'Настройки',
    },
    dashboard: {
      title: 'Главная панель',
      description: 'Выберите игровую модель для просмотра информации.',
    },
    modelsPage: {
      title: 'Игровые модели',
      description: 'Выберите модель, чтобы открыть её панель.',
      modes: 'Режимы',
      source: 'Источник',
      openDashboard: 'Открыть панель',
    },
    modelSelector: {
      label: 'Игровая модель',
    },
    modelDetails: {
      modification: 'Модификация',
      availableModes: 'Доступные режимы',
      dataSource: 'Источник данных',
      importStatus: 'Статус импорта',
      screenshots: 'Скриншоты получены',
      verified: 'Проверено',
    },
    modelNotes: {
      mk6: 'Стандартный 82-мм миномёт.',
      m252: '81-мм миномёт из RHSUSAF.',
    },
    settings: {
      title: 'Настройки',
      description: 'Настройте приложение под себя.',
      preferences: 'Основные настройки',
      language: 'Язык интерфейса',
      autoSave: 'Настройки сохраняются автоматически.',
    },
  },
}
