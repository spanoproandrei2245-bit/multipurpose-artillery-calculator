
import { artilleryRegistry } from '../data/artillery/registry'

import type { ModelId } from '../data/models'
import type { Language } from '../types/settings'
import type { DataStatus } from '../types/artillery'

interface Props {
  modelId: ModelId
  language: Language
}

const statusLabels: Record<
  DataStatus,
  { ru: string; en: string }
> = {
  pending: {
    ru: 'Ожидает заполнения',
    en: 'Pending',
  },
  'in-progress': {
    ru: 'В процессе',
    en: 'In progress',
  },
  verified: {
    ru: 'Проверено',
    en: 'Verified',
  },
}

export function ArtilleryReferencePanel({
  modelId,
  language,
}: Props) {
  const data = artilleryRegistry[modelId]
  const ru = language === 'ru'

  const ammunition = data.ammunition ?? []
  const verifiedCount = ammunition.filter(
    (item) => item.verified
  ).length

  const status = statusLabels[data.source.status]

  return (
    <section className="mt-6 rounded-xl border border-app-border bg-app-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-app-text">
          {ru ? 'Игровой справочник' : 'Game Reference'}
        </h2>

        <span className="rounded-md border border-app-border px-3 py-1 text-xs text-app-muted">
          v0.4
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-app-border bg-app-bg p-4">
          <p className="text-xs text-app-muted">
            {ru ? 'Модель' : 'Model'}
          </p>
          <p className="mt-1 font-semibold text-app-text">
            {data.name}
          </p>
          <p className="text-sm text-app-muted">
            {data.modification}
          </p>
        </div>

        <div className="rounded-lg border border-app-border bg-app-bg p-4">
          <p className="text-xs text-app-muted">
            {ru ? 'Статус данных' : 'Data status'}
          </p>
          <p className="mt-1 font-semibold text-app-text">
            {ru ? status.ru : status.en}
          </p>
          <p className="text-sm text-app-muted">
            {data.source.name}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="font-semibold text-app-text">
          {ru ? 'Боеприпасы в базе' : 'Ammunition in database'}
        </h3>

        <p className="mt-1 text-sm text-app-muted">
          {ru ? 'Записей:' : 'Entries:'} {ammunition.length}
          {' · '}
          {ru ? 'Проверено:' : 'Verified:'} {verifiedCount}
        </p>

        {ammunition.length === 0 ? (
          <p className="mt-3 rounded-lg border border-app-border bg-app-bg p-4 text-sm text-app-muted">
            {ru
              ? 'Записи о боеприпасах пока не внесены.'
              : 'No ammunition records have been added yet.'}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {ammunition.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-app-border bg-app-bg p-3"
              >
                <div>
                  <p className="font-medium text-app-text">
                    {item.designation} [{item.type}]
                  </p>
                  <p className="text-xs text-app-muted">
                    ID: {item.id}
                  </p>
                </div>

                <span className="text-xs text-app-muted">
                  {item.verified
                    ? ru ? 'Проверено' : 'Verified'
                    : ru ? 'Не проверено' : 'Unverified'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 border-t border-app-border pt-4">
        <p className="text-sm text-app-muted">
          {ru ? 'Скриншотов-источников:' : 'Source screenshots:'}
          {' '}
          {data.screenshots.length}
        </p>

        <p className="mt-1 text-xs text-app-muted">
          JSON ID: {data.id}
          {' · '}
          Schema v{data.schemaVersion}
        </p>
      </div>
    </section>
  )
}
