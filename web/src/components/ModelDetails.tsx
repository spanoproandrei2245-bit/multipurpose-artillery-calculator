
import type { GameModel } from '../types/gameModel'
import type { Language } from '../types/settings'
import type { ModelId } from '../data/models'
import { translations } from '../i18n/translations'

interface ModelDetailsProps {
  model: GameModel
  modelId: ModelId
  language: Language
}

export function ModelDetails({
  model,
  modelId,
  language,
}: ModelDetailsProps) {
  const t = translations[language].modelDetails
  const notes = translations[language].modelNotes[modelId]

  return (
    <section className="mt-6 border-t border-app-border pt-5">
      <h3 className="text-xl font-semibold text-app-text">
        {model.name}
      </h3>

      <dl className="mt-5 space-y-4">
        <div>
          <dt className="text-sm text-app-muted">
            {t.modification}
          </dt>
          <dd className="mt-1 text-app-text">
            {model.mod}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-app-muted">
            {t.availableModes}
          </dt>
          <dd className="mt-1 text-app-text">
            {model.modes.join(', ')}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-app-muted">
            {t.dataSource}
          </dt>
          <dd className="mt-1 text-app-text">
            {model.source}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-app-muted">
            {t.importStatus}
          </dt>

          <dd className="mt-1">
            <span className="inline-block rounded-md bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-400">
              {model.importStatus === 'verified'
                ? t.verified
                : t.screenshots}
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-6 text-sm text-app-muted">
        {notes}
      </p>
    </section>
  )
}
