
import { useEffect, useState } from 'react'

import { Header } from './components/Header'
import { Navigation, type PageId } from './components/Navigation'

import { DashboardPage } from './pages/DashboardPage'
import { ModelsPage } from './pages/ModelsPage'
import { SettingsPage } from './pages/SettingsPage'

import { models, type ModelId } from './data/models'

function App() {
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

  const [activePage, setActivePage] =
    useState<PageId>('dashboard')

  useEffect(() => {
    localStorage.setItem('selectedModel', selectedModel)
  }, [selectedModel])

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <Navigation
        activePage={activePage}
        onPageChange={setActivePage}
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {activePage === 'dashboard' && (
          <DashboardPage
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        )}

        {activePage === 'models' && <ModelsPage />}

        {activePage === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}

export default App
