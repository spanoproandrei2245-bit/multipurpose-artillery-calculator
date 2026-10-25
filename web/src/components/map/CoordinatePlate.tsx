import { t } from '../../i18n'
import { toGridReference, type MapPoint } from '../../lib/heightmap'
import type { FlightShot } from '../FlightCanvas'
import { FlightTrack } from '../FlightTrack'

/** Снизу по центру карты: координаты и высоты орудия и цели, полёт снаряда между ними. */
export function CoordinatePlate({
  gun,
  gunHeight,
  target,
  targetHeight,
  unit,
  flight,
}: {
  gun: MapPoint | null
  gunHeight: number | null
  target: MapPoint | null
  targetHeight: number | null
  unit: string
  flight: readonly FlightShot[]
}) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 flex max-w-[calc(100%-6rem)] -translate-x-1/2 items-center gap-3 rounded-lg bg-black/70 px-3 py-2 text-[12.5px] leading-none whitespace-nowrap text-white/90 tabular-nums shadow-lg backdrop-blur-sm">
      <span className="flex items-center gap-2">
        <span className="block h-2 w-2 shrink-0 rounded-full bg-gun" />
        <span>
          {gun ? `${toGridReference(gun, 8)} · ${Math.round(gunHeight ?? 0)} ${unit}` : t('mapPicker.no-gun')}
        </span>
      </span>
      <FlightTrack shots={flight} />
      <span className="flex items-center gap-2">
        <span>
          {target
            ? `${toGridReference(target, 8)} · ${Math.round(targetHeight ?? 0)} ${unit}`
            : t('mapPicker.no-target')}
        </span>
        <span className="block h-2 w-2 shrink-0 rounded-full bg-target" />
      </span>
    </div>
  )
}
