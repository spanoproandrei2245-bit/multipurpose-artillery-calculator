import { t, type MessageKey } from '../i18n'
import { useEffect, useLayoutEffect, useState } from 'react'

import {
  advancedTourDone,
  markAdvancedTourDone,
  markTourDone,
  setPanel,
  tourDone,
  usePanel,
} from '../lib/uiPanels'

interface Step {
  // Элемент, который подсвечивается; null — шаг по центру экрана
  target: (() => Element | null) | null
  title: MessageKey
  text: MessageKey
}

const byTour = (name: string) => () =>
  document.querySelector(`[data-tour="${name}"]`)
const rowOf = (id: string) => () =>
  document.getElementById(id)?.closest('.row') ?? null
// Целиком блок строк (дистанция, азимут, высота цели): подсвечиваются все
const blockOf = (id: string) => () =>
  document.getElementById(id)?.closest('dl') ?? null

const BASIC: Step[] = [
  {
    target: null,
    title: 'tour.welcome',
    text: 'tour.a-short-tour-of-where',
  },
  {
    target: byTour('map'),
    title: 'mapPicker.map',
    text: 'tour.left-click-places-the-gun',
  },
  {
    target: blockOf('calc-distance'),
    title: 'tour.distance-bearing-target-height',
    text: 'tour.these-three-fields-fill-in',
  },
  {
    target: byTour('charge'),
    title: 'artilleryCalculator.charge',
    text: 'tour.fast-picks-the-shortest-flight',
  },
  {
    target: rowOf('calc-own-height'),
    title: 'artilleryCalculator.gun-height',
    text: 'tour.the-lock-keeps-the-height',
  },
  {
    target: byTour('fire'),
    title: 'fireTimer.fire',
    text: 'tour.the-button-or-the-f',
  },
  {
    target: byTour('settings'),
    title: 'settings.title',
    text: 'tour.optional-sections-live-here-fire',
  },
]

const ADVANCED: Step[] = [
  {
    target: null,
    title: 'footer.advanced-tutorial',
    text: 'tour.maps-the-fire-line-weapon',
  },
  {
    target: byTour('map-select'),
    title: 'tour.choosing-a-map',
    text: 'tour.the-star-adds-a-map',
  },
  {
    target: byTour('tools'),
    title: 'mapPicker.fire-line',
    text: 'tour.pick-line-and-drop-points',
  },
  {
    target: byTour('tools'),
    title: 'tour.pinning-the-gun',
    text: 'tour.hold-the-cursor-or-a',
  },
  {
    target: rowOf('calc-own-height'),
    title: 'tour.weapon-and-shell-icons',
    text: 'tour.the-coloured-dot-marks-the',
  },
  {
    target: byTour('settings'),
    title: 'tour.sections-your-way',
    text: 'tour.settings-turn-on-fire-adjustment',
  },
  {
    target: byTour('link'),
    title: 'footer.link',
    text: 'tour.the-fdc-and-gunners-connect',
  },
  {
    target: byTour('help'),
    title: 'footer.help',
    text: 'tour.tutorials-the-list-of-shortcuts',
  },
  {
    target: byTour('theme'),
    title: 'tour.theme',
    text: 'tour.light-or-dark-in-one',
  },
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 6
const CARD_MAX = 352
const GAP = 12

/**
 * Обучение: базовое при первом запуске, продвинутое — после базового.
 * Подсвечивает элементы, любой тур можно пропустить. Подсветка и карточка
 * плавно переезжают от шага к шагу.
 */
export function Tour() {
  const basicOpen = usePanel('tour')
  const advancedOpen = usePanel('tourAdvanced')
  const open = basicOpen || advancedOpen
  const steps = advancedOpen ? ADVANCED : BASIC

  const [index, setIndex] = useState(0)
  // Последняя измеренная подсветка: при смене шага остаётся, пока не придёт новая
  const [measured, setMeasured] = useState<Rect | null>(null)
  const [cardH, setCardH] = useState(200)
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === 'undefined' ? 1200 : window.innerWidth,
    h: typeof window === 'undefined' ? 800 : window.innerHeight,
  }))
  // Предложение продвинутого обучения после базового
  const [offer, setOffer] = useState(false)
  const [cardNode, setCardNode] = useState<HTMLDivElement | null>(null)

  // При первом запуске базовое обучение открывается само
  useEffect(() => {
    if (tourDone()) return
    const timer = window.setTimeout(() => setPanel('tour', true), 800)
    return () => window.clearTimeout(timer)
  }, [])

  // Шаги, у которых нет элемента на экране (карта выключена, нет решения), пропускаются
  const available = open
    ? steps.filter((s) => s.target === null || s.target() !== null)
    : []
  const step = available[Math.min(index, available.length - 1)]

  function finish(completed: boolean) {
    const advanced = advancedOpen
    if (advanced) markAdvancedTourDone()
    else markTourDone()
    setPanel('tour', false)
    setPanel('tourAdvanced', false)
    setIndex(0)
    setMeasured(null)
    // Базовое пройдено до конца — предлагаем продвинутое
    if (completed && !advanced && !advancedTourDone()) setOffer(true)
  }

  useEffect(() => {
    if (!open && !offer) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (offer) setOffer(false)
      else finish(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Высота карточки — чтобы ставить её над или под подсветкой точными координатами
  useEffect(() => {
    if (!cardNode) return
    const observer = new ResizeObserver(() => setCardH(cardNode.offsetHeight))
    observer.observe(cardNode)
    return () => observer.disconnect()
  }, [cardNode])

  // Подсветка: прокрутить к элементу и следить за его положением
  useLayoutEffect(() => {
    if (!open || !step) return
    const element = step.target?.() ?? null
    element?.scrollIntoView({ block: 'center', behavior: 'instant' })
    function measure() {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
      if (!element) {
        setMeasured(null)
        return
      }
      const r = element.getBoundingClientRect()
      setMeasured({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step])

  if (offer && !open) {
    return (
      <div
        className="tour-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="panel w-full max-w-sm p-5 shadow-2xl">
          <h2 className="text-lg font-semibold text-app-text">
            {t('tour.basic-tutorial-complete')}
          </h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-app-text-2">
            {t('tour.want-the-advanced-one-it')}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost text-app-muted" onClick={() => setOffer(false)}>
              {t('tour.not-now')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setOffer(false)
                setIndex(0)
                setPanel('tourAdvanced', true)
              }}
            >
              {t('tour.show-me')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!open || !step) return null

  const last = index >= available.length - 1
  const cardW = Math.min(CARD_MAX, viewport.w - 32)

  // Подсветка: без элемента — схлопнутая точка в центре (затемнение остаётся)
  const spot = measured ?? {
    top: viewport.h / 2,
    left: viewport.w / 2,
    width: 0,
    height: 0,
  }
  const pad = measured ? PAD : 0

  // Карточка: под подсветкой, если влезает, иначе над; без элемента — по центру
  let cardTop: number
  let cardLeft: number
  if (measured) {
    const below = measured.top + measured.height + PAD + GAP
    cardTop =
      below + cardH + 12 <= viewport.h
        ? below
        : measured.top - PAD - GAP - cardH
    cardTop = Math.min(Math.max(12, cardTop), viewport.h - cardH - 12)
    cardLeft = Math.min(Math.max(16, measured.left), viewport.w - cardW - 16)
  } else {
    cardTop = (viewport.h - cardH) / 2
    cardLeft = (viewport.w - cardW) / 2
  }

  const move =
    'transition-[top,left,width,height,opacity] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none'

  return (
    <div
      className="tour-fade fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={t('footer.tutorial')}
    >
      <div
        className={`pointer-events-none absolute rounded-lg ${measured ? 'ring-2 ring-accent' : ''} ${move}`}
        style={{
          top: spot.top - pad,
          left: spot.left - pad,
          width: spot.width + pad * 2,
          height: spot.height + pad * 2,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
        }}
      />

      <div
        ref={setCardNode}
        className={`panel absolute p-4 shadow-2xl ${move}`}
        style={{ width: cardW, top: cardTop, left: cardLeft }}
      >
        {/* Текст меняется с коротким появлением, карточка при этом переезжает */}
        <div key={`${advancedOpen ? 'a' : 'b'}:${step.title}`} className="tour-fade">
          <p className="label mb-1">
            {advancedOpen ? (t('tour.advanced')) : ''}
            {index + 1} / {available.length}
          </p>
          <h2 className="text-lg font-semibold text-app-text">{t(step.title)}</h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-app-text-2">
            {t(step.text)}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="btn btn-ghost text-app-muted" onClick={() => finish(false)}>
            {t('tour.skip')}
          </button>
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <button type="button" className="btn" onClick={() => setIndex(index - 1)}>
                {t('app.back')}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (last ? finish(true) : setIndex(index + 1))}
            >
              {last ? (t('tour.done')) : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
