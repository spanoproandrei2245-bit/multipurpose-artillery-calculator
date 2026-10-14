
import { models, type ModelId } from '../data/models'
import { translations } from '../i18n/translations'
import type { Language } from '../types/settings'
import { ArtilleryIcon } from '../components/ArtilleryIcon'
import { categoryLabels } from '../data/categories'

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
      <h2 className="text-2xl font-bold text-app-text">
        {t.title}
      </h2>

      <p className="mt-2 text-app-muted">
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
              className="cursor-pointer rounded-xl border border-app-border bg-app-surface p-6 text-left transition-colors hover:border-emerald-500 hover:bg-app-bg"
            >
              <div className="flex items-center gap-4">
                <ArtilleryIcon
                  category={model.category}
                  size="md"
                  language={language}
                />

                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-app-text">
                    {model.name}
                  </h3>

                  <p className="text-xs text-app-muted">
                    {categoryLabels[model.category][language]}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm text-app-muted">
                {model.mod}
              </p>

              <p className="mt-4 text-sm text-app-text">
                {t.modes}: {model.modes.join(', ')}
              </p>

              <p className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {t.openDashboard} →
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
