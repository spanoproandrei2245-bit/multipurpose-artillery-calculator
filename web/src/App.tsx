
import { useEffect, useState } from 'react'

import { Header } from './components/Header'
import { ModelSelector } from './components/ModelSelector'
import { ModelDetails } from './components/ModelDetails'

import { models, type ModelId } from './data/models'

function App() {
  // Загружаем ранее выбранную модель
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

  // Сохраняем выбор при изменении модели
  useEffect(() => {
    localStorage.setItem('selectedModel', selectedModel)
  }, [selectedModel])

  const model = models[selectedModel]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-2xl font-bold">
          Dashboard
        </h2>

        <p className="mt-2 text-slate-400">
          Select a game model to view its information.
        </p>

        <div className="mt-8 max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6">
          <ModelSelector
            value={selectedModel}
            onChange={setSelectedModel}
          />

          <ModelDetails model={model} />
        </div>
      </main>
    </div>
  )
}

export default App
