
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
    <section className="mt-6 border-t border-slate-700 pt-5">
      <h3 className="text-xl font-semibold text-white">
        {model.name}
      </h3>

      <dl className="mt-5 space-y-4">
        <div>
          <dt className="text-sm text-slate-400">
            {t.modification}
          </dt>
          <dd className="mt-1 text-white">
            {model.mod}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-400">
            {t.availableModes}
          </dt>
          <dd className="mt-1 text-white">
            {model.modes.join(', ')}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-400">
            {t.dataSource}
          </dt>
          <dd className="mt-1 text-white">
            {model.source}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-400">
            {t.importStatus}
          </dt>

          <dd className="mt-1">
            <span className="inline-block rounded-md bg-amber-500/10 px-3 py-1 text-sm text-amber-400">
              {model.importStatus === 'verified'
                ? t.verified
                : t.screenshots}
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-6 text-sm text-slate-400">
        {notes}
      </p>
    </section>
  )
}
