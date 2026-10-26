import { t } from '../i18n'
import {
  isBlocked,
  MUZZLE_HEIGHT,
  shellHeightAt,
  type Clearance,
  type TerrainProfile,
} from '../lib/terrainClearance'
import { FieldIcon } from './FieldIcon'

const W = 320
const H = 96

/**
 * Предупреждение о рельефе по пути снаряда: текст и профиль (земля и дуга).
 * Красное — снаряд упрётся, жёлтое — пройдёт впритык над бугром.
 */
export function TerrainWarning({
  terrain,
  hit,
  elevationMil,
  alternative,
}: {
  terrain: TerrainProfile
  hit: Clearance
  elevationMil: number
  // Чем стрелять вместо: «навесная, заряд 2»; null — подходящего нет
  alternative: string | null
}) {
  const unitM = t('unit.m')
  const blocked = isBlocked(hit)
  const m = (value: number) => `${Math.round(value)} ${unitM}`

  return (
    <div
      role="alert"
      className={[
        'rounded-md px-3 py-2.5 text-[13.5px]',
        blocked ? 'bg-danger-soft text-danger' : 'bg-app-raised text-warn',
      ].join(' ')}
    >
      <p className="flex items-start gap-2">
        <FieldIcon name="mountain" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {blocked
            ? t('terrain.blocked', m(hit.at), m(hit.terrain), m(hit.shell))
            : t('terrain.tight', m(Math.max(0, hit.min)), m(hit.at))}
          {blocked && (
            <>
              {' '}
              {alternative ? t('terrain.use-instead', alternative) : t('terrain.none-clear')}
            </>
          )}
        </span>
      </p>
      <ProfileChart terrain={terrain} hit={hit} elevationMil={elevationMil} blocked={blocked} />
      <p className="mt-1 text-[12px] text-app-muted">{t('terrain.note')}</p>
    </div>
  )
}

/**
 * Профиль: рельеф по прямой от орудия к цели и дуга снаряда. Дуга видна
 * целиком, но график не выше четырёх перепадов рельефа: у навесной дуги
 * вершина уходит за край, зато гребень не сплющивается в линию.
 */
function ProfileChart({
  terrain,
  hit,
  elevationMil,
  blocked,
}: {
  terrain: TerrainProfile
  hit: Clearance
  elevationMil: number
  blocked: boolean
}) {
  const { distance, heights } = terrain
  const n = heights.length - 1
  const gunHeight = heights[0] + MUZZLE_HEIGHT
  const targetHeight = heights[n]
  const points = 80
  const arcHeights = Array.from({ length: points + 1 }, (_, i) =>
    shellHeightAt((i / points) * distance, distance, gunHeight, targetHeight, elevationMil)
  )
  const low = Math.min(...heights)
  const high = Math.max(...heights, hit.shell)
  const relief = Math.max(20, high - low)
  const top = Math.max(high, Math.min(Math.max(...arcHeights), low + relief * 4)) + relief * 0.15
  const bottom = low - relief * 0.1
  const sx = (x: number) => (x / distance) * W
  const sy = (h: number) => H - ((h - bottom) / (top - bottom)) * H

  const ground = heights.map((h, i) => `${sx((i / n) * distance).toFixed(1)},${sy(h).toFixed(1)}`)
  const arc = arcHeights.map((h, i) => `${sx((i / points) * distance).toFixed(1)},${sy(h).toFixed(1)}`)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t('terrain.profile')}
      className="mt-2 block h-24 w-full overflow-hidden rounded-md bg-app-surface"
      preserveAspectRatio="none"
    >
      <polygon points={`0,${H} ${ground.join(' ')} ${W},${H}`} fill="var(--color-muted)" fillOpacity=".35" />
      <polyline points={ground.join(' ')} fill="none" stroke="var(--color-muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <polyline
        points={arc.join(' ')}
        fill="none"
        stroke={blocked ? 'var(--color-danger)' : 'var(--color-warn)'}
        strokeWidth="2"
        strokeDasharray="5 3"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={sx(hit.at)} cy={sy(hit.terrain)} r="4" fill={blocked ? 'var(--color-danger)' : 'var(--color-warn)'} />
      <circle cx="3" cy={sy(gunHeight)} r="3.5" fill="var(--color-gun)" />
      <circle cx={W - 3} cy={sy(targetHeight)} r="3.5" fill="var(--color-target)" />
    </svg>
  )
}
