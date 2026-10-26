import { t } from '../../i18n'
import { FieldIcon } from '../FieldIcon'

/** Карта снята из игры без grad_meh: предупреждение, как у непроверенного орудия. */
export function MapQualityBadge() {
  const text = `${t('mapQuality.low')}. ${t('mapQuality.low-hint')}`
  return (
    <span
      role="img"
      data-quality="low"
      title={text}
      aria-label={text}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warn/15 text-warn"
    >
      <FieldIcon name="warning" className="h-3.5 w-3.5" />
    </span>
  )
}
