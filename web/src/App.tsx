
import { useState } from 'react'
import { Header } from './components/Header'
import { ModelSelector } from './components/ModelSelector'
import { models, type ModelId } from './data/models'

function App() {
  const [selectedModel, setSelectedModel] =
    useState<ModelId>('mk6')

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

        <section className="mt-8 max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6">
          <ModelSelector
            value={selectedModel}
            onChange={setSelectedModel}
          />

          <div className="mt-6 space-y-3 border-t border-slate-700 pt-5">
            <h3 className="text-lg font-semibold">
              {model.name}
            </h3>

            <p className="text-sm text-slate-400">
              Mod: {model.mod}
            </p>

            <p className="text-sm text-slate-400">
              Available mode: {model.mode}
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
