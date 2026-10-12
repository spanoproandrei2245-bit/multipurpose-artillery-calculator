
import { useEffect, useState } from 'react'

import { Header } from './components/Header'
import { Navigation, type PageId } from './components/Navigation'

import { DashboardPage } from './pages/DashboardPage'
import { ModelsPage } from './pages/ModelsPage'
import { SettingsPage } from './pages/SettingsPage'

import { models, type ModelId } from './data/models'
import type { Language } from './types/settings'

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

  // НОВОЕ: язык приложения
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem('language')

    return savedLanguage === 'ru' ? 'ru' : 'en'
  })

  // Сохранение выбранной модели
  useEffect(() => {
    localStorage.setItem('selectedModel', selectedModel)
  }, [selectedModel])

  // НОВОЕ: сохранение языка
  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

  // Выбор модели со страницы Models
  function handleModelSelect(id: ModelId) {
    setSelectedModel(id)
    setActivePage('dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
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
          />
        )}
      </main>
    </div>
  )
}

export default App
