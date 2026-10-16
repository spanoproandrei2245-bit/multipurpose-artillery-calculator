
import type { Language } from '../types/settings'

type Translation = {
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
    mapInput: string
    mapInputDescription: string
    keepAwake: string
    keepAwakeDescription: string
    keepAwakeUnsupported: string
    openOnPhone: string
    openOnPhoneDescription: string
    desktop: string
    desktopDescription: string
    toggleOverlay: string
    hotkeys: Record<
      | 'fire'
      | 'overlay'
      | 'input'
      | 'screen-markers'
      | 'mode'
      | 'next-target'
      | 'previous-target',
      string
    >
    armaDisplayMode: string
  }
}

export const translations: Record<Language, Translation> = {
  en: {
    modelSelector: {
      label: 'Game Model',
    },
    settings: {
      title: 'Settings',
      description: 'Interface, sounds and devices.',
      preferences: 'Preferences',
      language: 'Interface language',
      autoSave: 'Your preferences are saved automatically.',
      theme: 'Appearance',
      light: 'Light',
      dark: 'Dark',
      experimental: 'Experimental features',
      experimentalDescription: 'May change or be removed in future versions.',
      mapInput: 'Map with markers and heights',
      mapInputDescription:
        'Export terrain heights from the game with a script, then click the gun and the target: distance, azimuth and both heights are filled in. Markers are shared with everyone in the link room.',
      gridInput: 'Grid coordinate input',
      gridInputDescription:
        'Distance and azimuth from the gun and target grid references (6, 8 or 10 digits).',
      keepAwake: 'Keep the screen on',
      keepAwakeDescription:
        'While the app is open — handy for a phone next to the keyboard. The combat screen always keeps it on.',
      keepAwakeUnsupported: 'Not supported by this browser.',
      desktop: 'Desktop app',
      desktopDescription:
        'An overlay window stays on top of the game; global shortcuts work while Arma is focused.',
      toggleOverlay: 'Show / hide overlay',
      hotkeys: {
        fire: 'Fire — start the timer',
        overlay: 'Show / hide the overlay',
        mode: 'Switch HIGH / LOW',
        'next-target': 'Next saved target',
        'previous-target': 'Previous saved target',
        input: 'Type in the overlay (distance field)',
        'screen-markers': 'Take the map markers from the screen',
      },
      armaDisplayMode:
        'In Arma 3 set Display Mode to "Fullscreen Window" or "Window": the overlay cannot be drawn over exclusive fullscreen.',
      openOnPhone: 'Open on a phone',
      openOnPhoneDescription:
        'Scan the code to open the calculator on your phone. It can be installed as an app and works offline.',
    },
  },

  ru: {
    modelSelector: {
      label: 'Игровая модель',
    },
    settings: {
      title: 'Настройки',
      description: 'Интерфейс, звуки и устройства.',
      preferences: 'Основные настройки',
      language: 'Язык интерфейса',
      autoSave: 'Настройки сохраняются автоматически.',
      theme: 'Тема оформления',
      light: 'Светлая',
      dark: 'Тёмная',
      experimental: 'Экспериментальные функции',
      experimentalDescription: 'Могут измениться или исчезнуть в следующих версиях.',
      mapInput: 'Карта с метками и высотами',
      mapInputDescription:
        'Выгрузите высоты карты скриптом из игры, затем кликните орудие и цель — дистанция, азимут и обе высоты подставятся сами. Метки видят все в комнате связки.',
      gridInput: 'Ввод по координатам сетки',
      gridInputDescription:
        'Дистанция и азимут по координатам орудия и цели (6, 8 или 10 цифр).',
      keepAwake: 'Не гасить экран',
      keepAwakeDescription:
        'Пока приложение открыто — удобно для телефона рядом с клавиатурой. Боевой экран не даёт экрану гаснуть всегда.',
      keepAwakeUnsupported: 'Этот браузер не поддерживает.',
      desktop: 'Программа для ПК',
      desktopDescription:
        'Окно-оверлей держится поверх игры, глобальные клавиши работают, пока в фокусе Arma.',
      toggleOverlay: 'Показать / скрыть оверлей',
      hotkeys: {
        fire: 'Огонь — запустить таймер',
        overlay: 'Показать / скрыть оверлей',
        mode: 'Переключить HIGH / LOW',
        'next-target': 'Следующая сохранённая цель',
        'previous-target': 'Предыдущая сохранённая цель',
        input: 'Ввод в оверлее (поле дистанции)',
        'screen-markers': 'Забрать метки с экрана карты',
      },
      armaDisplayMode:
        'В Arma 3 поставьте режим экрана «Полноэкранный в окне» (Fullscreen Window) или «Оконный»: поверх эксклюзивного полноэкранного режима оверлей не рисуется.',
      openOnPhone: 'Открыть на телефоне',
      openOnPhoneDescription:
        'Отсканируйте код, чтобы открыть калькулятор на телефоне. Его можно установить как приложение — работает без интернета.',
    },
  },
}
