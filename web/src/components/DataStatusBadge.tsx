import { t } from '../i18n'
import { DATA_STATUS_HINTS as HINTS, dataStatusLabel } from '../lib/dataStatus'
import type { DataStatus } from '../types/artillery'
import { FieldIcon } from './FieldIcon'

/**
 * Значок проверки таблиц орудия стрельбой в игре: зелёный щит — проверено,
 * жёлтый треугольник — ещё нет (возможны промахи). Подробности — в подсказке.
 */
export function DataStatusBadge({
  status,
  compact = false,
}: {
  status: DataStatus
  // Только значок (подпись — в подсказке)
  compact?: boolean
}) {
  const ok = status === 'verified'
  const label = dataStatusLabel(status)
  return (
    <span
      role="img"
      data-status={status}
      title={`${label}. ${t(HINTS[status])}`}
      aria-label={`${label}. ${t(HINTS[status])}`}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-full text-[11.5px] font-medium',
        compact ? 'h-5 w-5 justify-center' : 'px-2 py-0.5',
        ok ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn',
      ].join(' ')}
    >
      <FieldIcon name={ok ? 'shieldCheck' : 'warning'} className="h-3.5 w-3.5" />
      {!compact && label}
    </span>
  )
}
