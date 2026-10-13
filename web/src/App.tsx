
import { useEffect, useState } from 'react'

import { Header } from './components/Header'
import { Navigation, type PageId } from './components/Navigation'

import { DashboardPage } from './pages/DashboardPage'
import { ModelsPage } from './pages/ModelsPage'
import { SettingsPage } from './pages/SettingsPage'

import { models, type ModelId } from './data/models'
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

  // Активная страница
  const [activePage, setActivePage] =
    useState<PageId>('dashboard')

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
          />
        )}

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
          />
        )}
      </main>
    </div>
  )
}

export default App
