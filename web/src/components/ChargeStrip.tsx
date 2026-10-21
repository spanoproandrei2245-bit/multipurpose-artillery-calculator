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
  // Только заряды, чем-то хорошие: лучший, самый быстрый, самый точный (и выбранный)
  onlyGood?: boolean
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
  onlyGood = false,
}: Props) {
  const unitMil = t('unit.mil')
  const unitS = t('unit.s')

  return (
    <div className="space-y-2.5" aria-label={t('chargeStrip.ways-to-fire')}>
      {groups.map((group) => {
        const fastestCharge = pickCharge(group.results, 'fastest')?.charge
        const preciseCharge = pickCharge(group.results, 'precise')?.charge
        const bestCharge = pickCharge(group.results, 'best')?.charge
        const usableOnly = hideUnfit || onlyGood
        const visible = group.results.filter((r) => {
          if (usableOnly && r.solution === null) return false
          if (!onlyGood) return true
          const selected = group.mode === activeMode && r.charge === activeCharge
          return (
            selected ||
            r.charge === bestCharge ||
            r.charge === fastestCharge ||
            r.charge === preciseCharge
          )
        })
        // Траектория, по которой до цели не достать, при скрытии пропадает целиком
        if (visible.length === 0) return null
        const best = pickCharge(group.results, 'best')?.charge
        const fastest = pickCharge(group.results, 'fastest')?.charge
        const precise = pickCharge(group.results, 'precise')?.charge
        const several = group.results.filter((r) => r.solution !== null).length > 1
        return (
          <div key={group.mode}>
            {groups.length > 1 && (
              <p className="label mb-1.5 flex items-center gap-1.5">
                <FieldIcon
                  name={group.mode === 'HIGH' ? 'trajectoryHigh' : 'trajectoryLow'}
                  className="h-4 w-4"
                />
                {group.label}
              </p>
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
                      {usable && several && result.charge === best && (
                        <span title={t('chargeStrip.best-charge')} className="text-accent">
                          <FieldIcon name="balance" className="h-3.5 w-3.5" />
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
