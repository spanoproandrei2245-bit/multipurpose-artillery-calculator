
import { ModelSelector } from '../components/ModelSelector'
import { ModelDetails } from '../components/ModelDetails'
import { models, type ModelId } from '../data/models'

interface DashboardPageProps {
  selectedModel: ModelId
  onModelChange: (model: ModelId) => void
}

export function DashboardPage({
  selectedModel,
  onModelChange,
}: DashboardPageProps) {
  const model = models[selectedModel]

  return (
    <section>
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <p className="mt-2 text-slate-400">
        Select a game model to view its information.
      </p>

      <div className="mt-8 max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6">
        <ModelSelector
          value={selectedModel}
          onChange={onModelChange}
        />

        <ModelDetails model={model} />
      </div>
    </section>
  )
}
