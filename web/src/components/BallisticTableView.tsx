import { t, type MessageKey } from '../i18n'
import { FieldIcon } from './FieldIcon'
import { useState } from 'react'

import type {
  ArtilleryMode,
  BallisticProfile,
  BallisticRow,
} from '../types/artillery'

interface Props {
  profile: BallisticProfile
  mode: ArtilleryMode
  onModeChange: (mode: ArtilleryMode) => void
  charges: readonly number[] | undefined
  // Заряд текущего решения: таблица переключается на него
  activeCharge: number | null
  // Дальность текущего решения: соседние строки подсвечиваются
  highlightRange: number | null
}

interface Column {
  label: MessageKey
  unit: MessageKey
}

const MODES: readonly ArtilleryMode[] = ['HIGH', 'LOW']

const m = 'unit.m'
const mil = 'unit.mil'
const s = 'unit.s'

// Заголовки повторяют столбцы игровой таблицы ACE3.
const COLUMNS: Column[] = [
  { label: 'ballisticTableView.range', unit: m },
  { label: 'ballisticTableView.elev', unit: mil },
  { label: 'ballisticTableView.d-elev-100-m', unit: mil },
  { label: 'ballisticTableView.d-tof-100-m', unit: s },
  { label: 'ballisticTableView.tof', unit: s },
  { label: 'ballisticTableView.az-cross-1-m-s', unit: mil },
  { label: 'ballisticTableView.wind-head', unit: m },
  { label: 'ballisticTableView.wind-tail', unit: m },
  { label: 'ballisticTableView.temp-dec', unit: m },
  { label: 'ballisticTableView.temp-inc', unit: m },
  { label: 'ballisticTableView.dens-dec', unit: m },
  { label: 'ballisticTableView.dens-inc', unit: m },
]

function formatCell(value: number | null, column: number): string {
  if (value === null) return '-'
  // Дальность и возвышение в игре — целые.
  if (column <= 1) return String(value)
  // Большие погодные поправки игра округляет до целых («21»).
  return column >= 5 && Number.isInteger(value) && Math.abs(value) >= 10
    ? String(value)
    : value.toFixed(1)
}

/** Индексы двух строк, между которыми лежит дальность. */
function bracket(
  rows: readonly BallisticRow[],
  range: number | null
): Set<number> {
  const result = new Set<number>()
  if (range === null) return result

  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i][0] === range) {
      result.add(i)
      return result
    }
    if (i > 0 && rows[i - 1][0] < range && range < rows[i][0]) {
      result.add(i - 1)
      result.add(i)
      return result
    }
  }
  return result
}

export function BallisticTableView({
  profile,
  mode,
  onModeChange,
  charges,
  activeCharge,
  highlightRange,
}: Props) {
  const tables = profile.modes[mode] ?? {}

  const available = Object.keys(tables)
    .map(Number)
    .filter((c) => charges === undefined || charges.includes(c))
    .sort((a, b) => a - b)

  // null — следовать за зарядом текущего решения
  const [picked, setPicked] = useState<number | null>(null)

  const shown =
    picked !== null && available.includes(picked)
      ? picked
      : activeCharge !== null && available.includes(activeCharge)
        ? activeCharge
        : available[0]

  if (shown === undefined) return null

  const rows = tables[String(shown)] ?? []
  const width = rows[0]?.length ?? 5
  const highlighted =
    shown === activeCharge ? bracket(rows, highlightRange) : new Set()

  return (
    <details className="disclosure panel p-4 sm:p-5">
      <summary>
        <span className="inline-flex items-center gap-2 text-app-text">
          <FieldIcon name="table" className="h-5 w-5 text-app-muted" />
          {t('ballisticTableView.in-game-range-table')}
        </span>
      </summary>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <div
        role="group"
        aria-label={t('ballisticTableView.table-charge')}
        className="seg flex-wrap"
      >
        {available.map((charge) => (
          <button
            key={charge}
            type="button"
            aria-pressed={charge === shown}
            onClick={() => setPicked(charge)}
          >
            {t('artilleryCalculator.charge')} {charge}
          </button>
        ))}
      </div>

      {/* Режимы HIGH / LOW: без данных режим недоступен */}
      <div
        role="group"
        aria-label={t('ballisticTableView.table-mode')}
        className="seg"
      >
        {MODES.map((item) => {
          const exists = profile.modes[item] !== undefined
          return (
            <button
              key={item}
              type="button"
              disabled={!exists}
              aria-pressed={item === mode}
              title={
                exists
                  ? undefined
                  : t('ballisticTableView.no-data-for-this-mode')
              }
              onClick={() => onModeChange(item)}
            >
              {item}
            </button>
          )
        })}
      </div>
      </div>

      <div className="mt-3 max-h-96 overflow-auto rounded-lg">
        <table className="w-full border-collapse text-right text-[12.5px] tabular-nums">
          <thead className="sticky top-0 bg-app-raised">
            <tr>
              {COLUMNS.slice(0, width).map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className="border-b border-app-line-strong px-2 py-2 align-bottom font-medium text-app-muted"
                >
                  <span className="block whitespace-nowrap text-[12.5px]">
                    {t(column.label)}
                  </span>
                  <span className="block font-normal text-app-faint">
                    {t(column.unit)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row[0]}
                className={
                  highlighted.has(index)
                    ? 'bg-accent-soft text-accent'
                    : 'text-app-text odd:bg-app-raised/60'
                }
              >
                {row.map((value, column) => (
                  <td
                    key={column}
                    className={[
                      'whitespace-nowrap px-2 py-1',
                      column === 0 ? 'font-semibold' : '',
                    ].join(' ')}
                  >
                    {formatCell(value, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-app-muted">
        {t('ballisticTableView.transcribed-from-in-game-screenshots')}
      </p>
    </details>
  )
}
