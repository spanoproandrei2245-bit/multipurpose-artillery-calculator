import { models, type ModelId } from '../data/models'
import { artilleryRegistry } from '../data/artillery/registry'
import { translations } from '../i18n/translations'
import type { Language } from '../types/settings'
import { ArtilleryIcon } from '../components/ArtilleryIcon'
import { PageIntro } from '../components/PageIntro'
import { categoryLabels } from '../data/categories'

interface ModelsPageProps {
  onSelectModel: (id: ModelId) => void
  language: Language
}

/** Дальности и число зарядов — прямо из таблиц орудия. */
function tableStats(id: ModelId) {
  const reference = artilleryRegistry[id]
  let min = Infinity
  let max = 0
  const charges = new Set<string>()

  for (const profile of Object.values(reference.profiles ?? {})) {
    for (const tables of Object.values(profile.modes)) {
      for (const [charge, rows] of Object.entries(tables ?? {})) {
        charges.add(charge)
        for (const row of rows) {
          min = Math.min(min, row[0])
          max = Math.max(max, row[0])
        }
      }
    }
  }

  return {
    min: Number.isFinite(min) ? min : null,
    max: max > 0 ? max : null,
    charges: charges.size,
    verified: reference.source.status === 'verified',
  }
}

/** «70–4 750 м» → «0.07–4.8 км»: одна единица на всю дальность. */
function formatRange(min: number, max: number, ru: boolean): string {
  if (max < 1000) return `${min}–${max} ${ru ? 'м' : 'm'}`
  const km = (value: number) => (value / 1000).toFixed(value < 1000 ? 2 : 1)
  return `${km(min)}–${km(max)} ${ru ? 'км' : 'km'}`
}

export function ModelsPage({ onSelectModel, language }: ModelsPageProps) {
  const ru = language === 'ru'
  const modelIds = Object.keys(models) as ModelId[]
  const t = translations[language].modelsPage

  return (
    <section className="space-y-4">
      <PageIntro index="03" eyebrow={t.title} title={t.description} />

      <div className="grid gap-px border border-app-border bg-app-border sm:grid-cols-2 lg:grid-cols-3">
        {modelIds.map((id, index) => {
          const model = models[id]
          const stats = tableStats(id)

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectModel(id)}
              className="group relative flex cursor-pointer flex-col bg-app-surface p-5 text-left transition-colors hover:bg-app-raised"
            >
              <span className="absolute inset-x-0 top-0 h-px bg-transparent transition-colors group-hover:bg-accent" />

              <div className="flex items-start justify-between gap-4">
                <ArtilleryIcon
                  category={model.category}
                  size="md"
                  language={language}
                />
                <span className="readout text-5xl text-app-faint transition-colors group-hover:text-accent">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>

              <h3 className="mt-5 text-2xl font-light tracking-[-0.02em] text-app-text">
                {model.name}
              </h3>
              <p className="label mt-1">
                {categoryLabels[model.category][language]} · {model.mod}
              </p>

              <dl className="mt-5 grid grid-cols-3 gap-px border border-app-border bg-app-border">
                <div className="bg-app-surface px-2 py-1.5 group-hover:bg-app-raised">
                  <dt className="label text-[9px]">{ru ? 'Дальность' : 'Range'}</dt>
                  <dd className="mono-num mt-0.5 text-[12px] text-app-text">
                    {stats.min !== null && stats.max !== null
                      ? formatRange(stats.min, stats.max, ru)
                      : '—'}
                  </dd>
                </div>
                <div className="bg-app-surface px-2 py-1.5 group-hover:bg-app-raised">
                  <dt className="label text-[9px]">{ru ? 'Заряды' : 'Charges'}</dt>
                  <dd className="mono-num mt-0.5 text-[12px] text-app-text">
                    {stats.charges || '—'}
                  </dd>
                </div>
                <div className="bg-app-surface px-2 py-1.5 group-hover:bg-app-raised">
                  <dt className="label text-[9px]">{t.modes}</dt>
                  <dd className="mono-num mt-0.5 text-[12px] text-app-text">
                    {model.modes.join(' / ')}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex items-center justify-between gap-2">
                <span className={`tag ${stats.verified ? 'tag-ok' : ''}`}>
                  {stats.verified
                    ? ru
                      ? 'проверено в игре'
                      : 'verified in game'
                    : ru
                      ? 'ждёт проверки'
                      : 'not verified yet'}
                </span>
                <span className="label text-app-text transition-colors group-hover:text-accent">
                  {t.openDashboard} →
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
