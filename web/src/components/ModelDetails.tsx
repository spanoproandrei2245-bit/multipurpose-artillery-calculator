import type { GameModel } from '../types/gameModel'

type ModelDetailsProps = {
  model: GameModel
}

export function ModelDetails({ model }: ModelDetailsProps) {
  return (
    <section className="mt-6 border-t border-slate-700 pt-5">
      <h3 className="text-xl font-semibold text-white">
        {model.name}
      </h3>

      <dl className="mt-5 space-y-4">
        <div>
          <dt className="text-sm text-slate-400">
            Modification
          </dt>
          <dd className="mt-1 text-white">
            {model.mod}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-400">
            Available modes
          </dt>
          <dd className="mt-1 text-white">
            {model.modes.join(', ')}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-400">
            Data source
          </dt>
          <dd className="mt-1 text-white">
            {model.source}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-400">
            Import status
          </dt>

          <dd className="mt-1">
            <span className="inline-block rounded-md bg-amber-500/10 px-3 py-1 text-sm text-amber-400">
              {model.importStatus === 'verified'
                ? 'Verified'
                : 'Screenshots collected'}
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-6 text-sm text-slate-400">
        {model.notes}
      </p>
    </section>
  )
}
