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
  corner = false,
}: {
  status: DataStatus
  // Только значок (подпись — в подсказке)
  compact?: boolean
  // Маленький значок в правом нижнем углу плитки орудия
  corner?: boolean
}) {
  const ok = status === 'verified'
  const label = dataStatusLabel(status)
  const text = `${label}. ${t(HINTS[status])}`
  if (corner) {
    return (
      <span
        role="img"
        data-status={status}
        title={text}
        aria-label={text}
        className={[
          'absolute right-0.5 bottom-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-black/80',
          ok ? 'bg-ok' : 'bg-warn',
        ].join(' ')}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-2.5 w-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ok ? <path d="m6.5 12.5 3.6 3.6L17.5 8.5" /> : <path d="M12 5.5v8M12 18.5v.01" />}
        </svg>
      </span>
    )
  }
  return (
    <span
      role="img"
      data-status={status}
      title={text}
      aria-label={text}
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
