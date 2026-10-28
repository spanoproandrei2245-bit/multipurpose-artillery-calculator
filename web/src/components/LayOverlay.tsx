import { useEffect, useState } from 'react'

import { t } from '../i18n'
import { setLanguage as setI18nLanguage } from '../i18n'
import { onLayState, placeLayWindow, requestSolution, type LayPublished } from '../lib/desktop'
import { formatLay, layGuidance } from '../lib/gunLay'

/**
 * Окно «выше / ниже» для стрельбы из танка: крупно, рядом с прицелом, без
 * кнопок и без отнятия фокуса у игры (окно пропускает клики). Угол ствола
 * считает основное окно по движению мыши, сюда приходит готовое состояние.
 * Пока слежение выключено, окно прозрачное и пустое.
 */
export function LayOverlay() {
  const [lay, setLay] = useState<LayPublished | null>(null)

  useEffect(() => {
    const stop = onLayState(setLay)
    requestSolution()
    return stop
  }, [])

  const overlayX = lay?.settings.overlayX
  const overlayY = lay?.settings.overlayY
  useEffect(() => {
    void placeLayWindow(overlayX ?? 150, overlayY ?? -50)
  }, [overlayX, overlayY])

  // Язык берётся из хранилища: основное окно хранит его строкой без JSON
  try {
    const saved = localStorage.getItem('language')
    if (saved) setI18nLanguage(saved as Parameters<typeof setI18nLanguage>[0])
  } catch {
    // Без хранилища остаётся русский.
  }

  if (!lay || (!lay.tracking && !lay.calibrating)) return null

  if (lay.calibrating) {
    return (
      <Plate>
        <p className="text-[15px] font-semibold text-app-text">{t('gunLay.calibrating')}</p>
      </Plate>
    )
  }

  if (lay.target === null) {
    return (
      <Plate>
        <p className="text-[14px] text-app-text-2">{t('gunLay.no-target')}</p>
      </Plate>
    )
  }

  const { settings } = lay
  const guidance = layGuidance(lay.elevation, lay.target, settings)
  // Сотые доли градуса: в игре виден один знак, но поправку удобнее вести точнее
  const digits = settings.degrees ? 2 : 0
  const amount = formatLay(Math.abs(guidance.error), settings, digits)
  const unit = settings.degrees ? '°' : ` ${t('unit.mil')}`

  const view = {
    ok: { arrow: '✓', tone: 'text-ok', text: t('gunLay.ok') },
    raise: { arrow: '▲', tone: 'text-warn', text: t('gunLay.raise', `${amount}${unit}`) },
    lower: { arrow: '▼', tone: 'text-warn', text: t('gunLay.lower', `${amount}${unit}`) },
    unreachable: { arrow: '✕', tone: 'text-danger', text: t('gunLay.unreachable') },
  }[guidance.verdict]

  return (
    <Plate>
      <p className={`flex items-baseline gap-3 font-semibold ${view.tone}`}>
        <span className="text-[44px] leading-none">{view.arrow}</span>
        <span className="text-[34px] leading-none tabular-nums">
          {guidance.verdict === 'raise' || guidance.verdict === 'lower'
            ? `${amount}${unit}`
            : formatLay(lay.elevation, settings, digits) + unit}
        </span>
      </p>
      <p className="mt-1 text-[13px] text-app-text-2">{view.text}</p>
      <p className="mt-0.5 text-[12px] text-app-muted tabular-nums">
        {t('gunLay.target')} {formatLay(lay.target, settings, digits)}
        {unit} · {t('gunLay.current')} {formatLay(lay.elevation, settings, digits)}
        {unit}
      </p>
    </Plate>
  )
}

function Plate({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-1 inline-block max-w-[272px] select-none rounded-xl bg-black/65 px-4 py-2.5">
      {children}
    </div>
  )
}
