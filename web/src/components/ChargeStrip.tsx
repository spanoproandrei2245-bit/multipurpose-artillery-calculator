import { t } from '../i18n'
import { pickCharge, type ChargeResult } from '../lib/ballistics'
import type { ArtilleryMode } from '../types/artillery'
import { FieldIcon } from './FieldIcon'

export interface ChargeGroup {
  mode: ArtilleryMode
  // Подпись траектории («Навесная»), когда режимов больше одного
  label: string
  results: readonly ChargeResult[]
}

interface Props {
  groups: readonly ChargeGroup[]
  activeMode: ArtilleryMode
  activeCharge: number | null
  onPick: (mode: ArtilleryMode, charge: number) => void
  // Не показывать заряды, которые не достают до цели
  hideUnfit?: boolean
}

/**
 * Все способы выстрела по текущей дистанции: каждый заряд (и каждая
 * траектория) — карточкой с возвышением и временем полёта. Видно сразу,
 * какой брать и какие есть альтернативы: ⚡ — быстрее всех, ◎ — точнее всех.
 */
export function ChargeStrip({
  groups,
  activeMode,
  activeCharge,
  onPick,
  hideUnfit = false,
}: Props) {
  const unitMil = t('unit.mil')
  const unitS = t('unit.s')

  return (
    <div className="space-y-2.5" aria-label={t('chargeStrip.ways-to-fire')}>
      {groups.map((group) => {
        const visible = hideUnfit
          ? group.results.filter((r) => r.solution !== null)
          : group.results
        // Траектория, по которой до цели не достать, при скрытии пропадает целиком
        if (visible.length === 0) return null
        const lowest = pickCharge(group.results, 'lowest')?.charge
        const fastest = pickCharge(group.results, 'fastest')?.charge
        const precise = pickCharge(group.results, 'precise')?.charge
        const several = group.results.filter((r) => r.solution !== null).length > 1
        return (
          <div key={group.mode}>
            {groups.length > 1 && (
              <p className="label mb-1.5">{group.label}</p>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8.25rem,1fr))] gap-1.5">
              {visible.map((result) => {
                const solution = result.solution
                const usable = solution !== null
                const active =
                  usable && group.mode === activeMode && result.charge === activeCharge
                return (
                  <button
                    key={result.charge}
                    type="button"
                    disabled={!usable}
                    aria-pressed={active}
                    onClick={() => onPick(group.mode, result.charge)}
                    title={
                      usable
                        ? result.metersPerMil !== null
                          ? `1 ${unitMil} ≈ ${result.metersPerMil.toFixed(1)} ${t('unit.m')}`
                          : undefined
                        : `${result.minRange}–${result.maxRange} ${t('unit.m')}`
                    }
                    className={[
                      'relative flex flex-col items-start rounded-lg px-2.5 py-1.5 text-left transition-all duration-200',
                      active
                        ? 'bg-accent-soft ring-1 ring-accent'
                        : 'bg-app-raised',
                      usable
                        ? 'cursor-pointer hover:bg-app-raised-hover'
                        : 'cursor-not-allowed opacity-35',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-1.5">
                      <b className="text-lg leading-none text-app-text tabular-nums">
                        {result.charge}
                      </b>
                      {usable && several && result.charge === lowest && (
                        <span title={t('chargeStrip.lowest-charge')} className="text-app-muted">
                          <FieldIcon name="lowCharge" className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {usable && several && result.charge === fastest && (
                        <span title={t('chargeStrip.fastest')} className="text-warn">
                          <FieldIcon name="fire" className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {usable && several && result.charge === precise && (
                        <span title={t('chargeStrip.most-precise')} className="text-info">
                          <FieldIcon name="correction" className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 text-[12px] whitespace-nowrap text-app-muted tabular-nums">
                      {usable
                        ? `${Math.round(solution.elevation)} ${unitMil} · ${solution.tof.toFixed(1)} ${unitS}`
                        : `${result.minRange}–${result.maxRange} ${t('unit.m')}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
