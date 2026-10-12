
import { ModelSelector } from '../components/ModelSelector'
import { ModelDetails } from '../components/ModelDetails'
import { models, type ModelId } from '../data/models'
import { translations } from '../i18n/translations'
import type { Language } from '../types/settings'

interface DashboardPageProps {
  selectedModel: ModelId
  onModelChange: (model: ModelId) => void
  language: Language
}

export function DashboardPage({
  selectedModel,
  onModelChange,
  language,
}: DashboardPageProps) {
  const model = models[selectedModel]
  const t = translations[language].dashboard

  return (
    <section>
      <h2 className="text-2xl font-bold">
        {t.title}
      </h2>

      <p className="mt-2 text-slate-400">
        {t.description}
      </p>

      <div className="mt-8 max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6">
        <ModelSelector
          value={selectedModel}
          onChange={onModelChange}
          language={language}
        />

        <ModelDetails
          model={model}
          modelId={selectedModel}
          language={language}
        />
      </div>
    </section>
  )
}
