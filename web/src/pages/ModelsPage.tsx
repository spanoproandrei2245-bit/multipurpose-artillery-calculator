
import { models, type ModelId } from '../data/models'
import { translations } from '../i18n/translations'
import type { Language } from '../types/settings'

interface ModelsPageProps {
  onSelectModel: (id: ModelId) => void
  language: Language
}

export function ModelsPage({
  onSelectModel,
  language,
}: ModelsPageProps) {
  const modelIds = Object.keys(models) as ModelId[]
  const t = translations[language].modelsPage

  return (
    <section>
      <h2 className="text-2xl font-bold">
        {t.title}
      </h2>

      <p className="mt-2 text-slate-400">
        {t.description}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modelIds.map((id) => {
          const model = models[id]

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectModel(id)}
              className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900 p-6 text-left transition-colors hover:border-emerald-500 hover:bg-slate-800"
            >
              <h3 className="text-xl font-semibold">
                {model.name}
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                {model.mod}
              </p>

              <p className="mt-4 text-sm text-slate-300">
                {t.modes}: {model.modes.join(', ')}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {t.source}: {model.source}
              </p>

              <p className="mt-4 text-sm font-medium text-emerald-400">
                {t.openDashboard} →
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
