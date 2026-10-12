
import { models, type ModelId } from '../data/models'

type ModelSelectorProps = {
  value: ModelId
  onChange: (value: ModelId) => void
}

const modelIds = Object.keys(models) as ModelId[]

export function ModelSelector({
  value,
  onChange,
}: ModelSelectorProps) {
  return (
    <div>
      <label
        htmlFor="model"
        className="mb-2 block text-sm font-medium text-slate-300"
      >
        Game Model
      </label>

      <select
        id="model"
        value={value}
        onChange={(event) =>
          onChange(event.target.value as ModelId)
        }
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-emerald-500"
      >
        {modelIds.map((id) => (
          <option key={id} value={id}>
            {models[id].name}
          </option>
        ))}
      </select>
    </div>
  )
}
