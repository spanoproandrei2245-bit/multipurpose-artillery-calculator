
import { useEffect, useState } from 'react'

import { Header } from './components/Header'
import { Navigation, type PageId } from './components/Navigation'

import { DashboardPage } from './pages/DashboardPage'
import { ModelsPage } from './pages/ModelsPage'
import { SettingsPage } from './pages/SettingsPage'
import { SyncPage } from './pages/SyncPage'

import { models, type ModelId } from './data/models'
import { onHotkey, toggleOverlay } from './lib/desktop'
import { readInvite } from './lib/sync'
import { useWakeLock } from './lib/useWakeLock'
import type { Language, Theme } from './types/settings'

function App() {
  // Выбранная игровая модель
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    const savedModel = localStorage.getItem('selectedModel')

    if (
      savedModel &&
      Object.prototype.hasOwnProperty.call(models, savedModel)
    ) {
      return savedModel as ModelId
    }

    return 'mk6'
  })

  // Активная страница; по ссылке-приглашению стрелка — сразу «Связка»
  const [activePage, setActivePage] = useState<PageId>(() =>
    readInvite(window.location.search) ? 'sync' : 'dashboard'
  )

  // Язык приложения
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem('language')

    return savedLanguage === 'ru' ? 'ru' : 'en'
  })

  // НОВОЕ: Тема приложения
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme')

    return savedTheme === 'light' ? 'light' : 'dark'
  })

  // Не гасить экран (телефон у орудия)
  const [keepAwake, setKeepAwake] = useState(() => {
    try {
      return localStorage.getItem('keepAwake') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('keepAwake', String(keepAwake))
    } catch {
      // Хранилище недоступно — настройка живёт до перезагрузки.
    }
  }, [keepAwake])

  useWakeLock(keepAwake)

  // Программа для ПК: Ctrl+Alt+O показывает и скрывает оверлей
  useEffect(
    () =>
      onHotkey((action) => {
        if (action === 'overlay') void toggleOverlay()
      }),
    []
  )

  // Экспериментальный ввод по координатам сетки
  const [gridInput, setGridInput] = useState(() => {
    try {
      return localStorage.getItem('experimentalGrid') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('experimentalGrid', String(gridInput))
    } catch {
      // Хранилище недоступно — настройка живёт до перезагрузки.
    }
  }, [gridInput])

  // Экспериментальная карта с высотами
  const [mapInput, setMapInput] = useState(() => {
    try {
      return localStorage.getItem('experimentalMap') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('experimentalMap', String(mapInput))
    } catch {
      // Хранилище недоступно — настройка живёт до перезагрузки.
    }
  }, [mapInput])

  // Сохраняем выбранную модель
  useEffect(() => {
    localStorage.setItem('selectedModel', selectedModel)
  }, [selectedModel])

  // Сохраняем язык
  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

  // НОВОЕ: Применяем и сохраняем тему
  useEffect(() => {
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark'
    )

    localStorage.setItem('theme', theme)
  }, [theme])

  // Выбор модели со страницы Models
  function handleModelSelect(id: ModelId) {
    setSelectedModel(id)
    setActivePage('dashboard')
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <Header language={language} />

      <Navigation
        activePage={activePage}
        onPageChange={setActivePage}
        language={language}
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {activePage === 'dashboard' && (
          <DashboardPage
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            language={language}
            gridInput={gridInput}
            mapInput={mapInput}
          />
        )}

        {activePage === 'sync' && <SyncPage language={language} />}

        {activePage === 'models' && (
          <ModelsPage
            onSelectModel={handleModelSelect}
            language={language}
          />
        )}

        {activePage === 'settings' && (
          <SettingsPage
            language={language}
            onLanguageChange={setLanguage}
            theme={theme}
            onThemeChange={setTheme}
            gridInput={gridInput}
            onGridInputChange={setGridInput}
            mapInput={mapInput}
            onMapInputChange={setMapInput}
            keepAwake={keepAwake}
            onKeepAwakeChange={setKeepAwake}
          />
        )}
      </main>
    </div>
  )
}

export default App
