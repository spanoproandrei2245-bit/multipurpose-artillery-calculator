import { t } from '../../i18n'
import { FieldIcon } from '../FieldIcon'

/** Карта снята из игры без grad_meh: предупреждение, как у непроверенного орудия. */
export function MapQualityBadge({ inline = false }: { inline?: boolean }) {
  const text = `${t('mapQuality.low')}. ${t('mapQuality.low-hint')}`
  // Внутри кнопки: значок как у остальных кнопок, без подложки
  if (inline) {
    return (
      <span role="img" data-quality="low" title={text} aria-label={text} className="inline-flex shrink-0 text-warn">
        <FieldIcon name="warning" className="h-[18px] w-[18px]" />
      </span>
    )
  }
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
