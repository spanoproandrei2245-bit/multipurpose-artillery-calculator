import { lazy, Suspense, useEffect, useState } from 'react'

import { Header } from './components/Header'
import { Navigation, type PageId } from './components/Navigation'
import { DashboardPage } from './pages/DashboardPage'

import { isModelId, type ModelId } from './data/models'
import { onHotkey, toggleOverlay } from './lib/desktop'
import { readInvite } from './lib/sync'
import { usePersistentState } from './lib/usePersistentState'
import { useWakeLock } from './lib/useWakeLock'
import type { Language, Theme } from './types/settings'

// Второстепенные страницы грузятся по требованию: главный экран
// открывается быстрее, особенно на телефоне.
const SyncPage = lazy(() =>
  import('./pages/SyncPage').then((m) => ({ default: m.SyncPage }))
)
const ModelsPage = lazy(() =>
  import('./pages/ModelsPage').then((m) => ({ default: m.ModelsPage }))
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

// Язык по умолчанию — как у системы
function defaultLanguage(): Language {
  return typeof navigator !== 'undefined' &&
    navigator.language.toLowerCase().startsWith('ru')
    ? 'ru'
    : 'en'
}

const parseFlag = (fallback: boolean) => (raw: string | null) =>
  raw === null ? fallback : raw === 'true'

function App() {
  const [selectedModel, setSelectedModel] = usePersistentState<ModelId>(
    'selectedModel',
    (raw) => (raw && isModelId(raw) ? raw : 'mk6')
  )

  // По ссылке-приглашению стрелка — сразу «Связка»
  const [activePage, setActivePage] = useState<PageId>(() =>
    readInvite(window.location.search) ? 'sync' : 'dashboard'
  )

  const [language, setLanguage] = usePersistentState<Language>(
    'language',
    (raw) => (raw === 'ru' || raw === 'en' ? raw : defaultLanguage())
  )
  const [theme, setTheme] = usePersistentState<Theme>('theme', (raw) =>
    raw === 'light' ? 'light' : 'dark'
  )
  // Не гасить экран (телефон у орудия)
  const [keepAwake, setKeepAwake] = usePersistentState(
    'keepAwake',
    parseFlag(false)
  )
  // Экспериментальный ввод по координатам сетки
  const [gridInput, setGridInput] = usePersistentState(
    'experimentalGrid',
    parseFlag(false)
  )
  // Карта с метками и высотами
  const [mapInput, setMapInput] = usePersistentState('showMap', parseFlag(true))

  useWakeLock(keepAwake)

  // Программа для ПК: Ctrl+Alt+O показывает и скрывает оверлей
  useEffect(
    () =>
      onHotkey((action) => {
        if (action === 'overlay') void toggleOverlay()
      }),
    []
  )

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#eceae4')
  }, [theme])

  // Выбор орудия со страницы «Орудия»
  function handleModelSelect(id: ModelId) {
    setSelectedModel(id)
    setActivePage('dashboard')
  }

  const ru = language === 'ru'

  return (
    <div className="flex min-h-screen flex-col text-app-text">
      <header className="sticky top-0 z-40 border-b border-app-border bg-app-bg/90 backdrop-blur-md">
        <Header language={language} />
        <Navigation
          activePage={activePage}
          onPageChange={setActivePage}
          language={language}
        />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {activePage === 'dashboard' && (
          <DashboardPage
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            language={language}
            gridInput={gridInput}
            mapInput={mapInput}
          />
        )}

        <Suspense
          fallback={
            <p className="label py-16 text-center">
              {ru ? 'Загрузка…' : 'Loading…'}
            </p>
          }
        >
          {activePage === 'sync' && <SyncPage language={language} />}

          {activePage === 'models' && (
            <ModelsPage onSelectModel={handleModelSelect} language={language} />
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
        </Suspense>
      </main>

      <footer className="border-t border-app-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-4">
          <span className="label">MAC · v{__APP_VERSION__}</span>
          <span className="label">Arma 3 · ACE3</span>
          <span className="label ml-auto">made by Heis</span>
        </div>
      </footer>
    </div>
  )
}

export default App
