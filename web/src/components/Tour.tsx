import { useEffect, useLayoutEffect, useState } from 'react'

import { markTourDone, setPanel, tourDone, usePanel } from '../lib/uiPanels'
import type { Language } from '../types/settings'

interface Step {
  // Элемент, который подсвечивается; null — шаг по центру экрана
  target: (() => Element | null) | null
  title: { ru: string; en: string }
  text: { ru: string; en: string }
}

const byTour = (name: string) => () =>
  document.querySelector(`[data-tour="${name}"]`)
const rowOf = (id: string) => () =>
  document.getElementById(id)?.closest('.row') ?? null

const STEPS: Step[] = [
  {
    target: null,
    title: { ru: 'Добро пожаловать', en: 'Welcome' },
    text: {
      ru: 'Короткий тур покажет, где что находится. Его можно пропустить в любой момент, а потом запустить снова кнопкой «Обучение» внизу.',
      en: 'A short tour of where things are. Skip it any time and run it again later with the “Tutorial” button at the bottom.',
    },
  },
  {
    target: byTour('map'),
    title: { ru: 'Карта', en: 'Map' },
    text: {
      ru: 'ЛКМ — положение орудия, ПКМ — цель. Карту можно двигать мышью и масштабировать колесом. На телефоне что ставить касанием — выбирают кнопками справа.',
      en: 'Left-click places the gun, right-click the target. Drag to pan, scroll to zoom. On a phone use the buttons on the right to choose what a tap places.',
    },
  },
  {
    target: byTour('tools'),
    title: { ru: 'Инструменты на карте', en: 'Map tools' },
    text: {
      ru: 'Орудие, цель, огневая линия. Подержите курсор на «орудии» — слева появится замок, он закрепляет орудие и его высоту.',
      en: 'Gun, target, fire line. Hold the cursor on “gun” and a lock appears on the left — it pins the gun and its height.',
    },
  },
  {
    target: rowOf('calc-distance'),
    title: { ru: 'Дистанция и азимут', en: 'Distance and bearing' },
    text: {
      ru: 'Если карта не нужна, введите дистанцию и азимут на цель вручную — установки посчитаются сразу.',
      en: 'No map? Type the distance and bearing in by hand — the solution updates instantly.',
    },
  },
  {
    target: () =>
      document
        .querySelector(
          '[aria-label="Выбор заряда"], [aria-label="Charge choice"]'
        )
        ?.closest('.row') ?? null,
    title: { ru: 'Заряд', en: 'Charge' },
    text: {
      ru: '«Быстрый» выбирает заряд с наименьшим временем полёта, «точный» — с наименьшей ошибкой на 1 мил. «Авто» берёт наименьший подходящий.',
      en: '“Fast” picks the shortest flight time, “precise” the smallest error per mil. “Auto” takes the lowest charge that fits.',
    },
  },
  {
    target: rowOf('calc-own-height'),
    title: { ru: 'Высота орудия', en: 'Gun height' },
    text: {
      ru: 'Замок рядом сохраняет высоту между запусками. Закрепление орудия на карте включает его само.',
      en: 'The lock keeps the height between sessions. Pinning the gun on the map turns it on automatically.',
    },
  },
  {
    target: byTour('fire'),
    title: { ru: 'Огонь', en: 'Fire' },
    text: {
      ru: 'Кнопка (или клавиша F) запускает таймер и анимацию полёта снаряда. По связке отсчёт идёт у всех сразу.',
      en: 'The button (or the F key) starts the timer and the shell flight animation. Over the link everyone’s countdown starts together.',
    },
  },
  {
    target: byTour('settings'),
    title: { ru: 'Настройки', en: 'Settings' },
    text: {
      ru: 'Здесь включаются необязательные разделы: корректировка огня, погода, огонь по времени, журнал целей, таблица стрельбы, метки. Наведите на любой — увидите короткую демонстрацию.',
      en: 'Optional sections live here: fire adjustment, weather, time on target, target journal, range table, markers. Hover any of them for a short demo.',
    },
  },
]

interface Rect {
  // Для какого шага измерено
  key: string
  top: number
  left: number
  width: number
  height: number
}

const PAD = 6

/** Обучение при первом запуске: подсвечивает элементы, можно пропустить. */
export function Tour({ language }: { language: Language }) {
  const ru = language === 'ru'
  const open = usePanel('tour')
  const [index, setIndex] = useState(0)
  const [measured, setMeasured] = useState<Rect | null>(null)

  // При первом запуске обучение открывается само
  useEffect(() => {
    if (tourDone()) return
    const timer = window.setTimeout(() => setPanel('tour', true), 800)
    return () => window.clearTimeout(timer)
  }, [])

  // Шаги, у которых нет элемента на экране (карта выключена, нет решения), пропускаются
  const available = open
    ? STEPS.filter((step) => step.target === null || step.target() !== null)
    : []
  const step = available[Math.min(index, available.length - 1)]

  function close() {
    markTourDone()
    setPanel('tour', false)
    setIndex(0)
  }

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Подсветка: прокрутить к элементу и следить за его положением
  useLayoutEffect(() => {
    if (!open || !step) return
    const element = step.target?.() ?? null
    if (!element) return
    const key = step.title.en
    element.scrollIntoView({ block: 'center', behavior: 'instant' })
    function measure() {
      const r = element!.getBoundingClientRect()
      setMeasured({ key, top: r.top, left: r.left, width: r.width, height: r.height })
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

  if (!open || !step) return null

  const rect = measured && measured.key === step.title.en ? measured : null

  const last = index >= available.length - 1
  const viewportH = window.innerHeight
  const cardBelow = rect ? rect.top + rect.height + 12 + 190 < viewportH : true

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={ru ? 'Обучение' : 'Tutorial'}>
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-accent transition-all"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/62" />
      )}

      <div
        className="panel absolute w-[min(22rem,calc(100vw-2rem))] p-4 shadow-2xl"
        style={
          rect
            ? {
                left: Math.min(
                  Math.max(16, rect.left),
                  window.innerWidth - Math.min(352, window.innerWidth - 32) - 16
                ),
                ...(cardBelow
                  ? { top: rect.top + rect.height + PAD + 12 }
                  : { bottom: viewportH - rect.top + PAD + 12 }),
              }
            : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
        }
      >
        <p className="label mb-1">
          {index + 1} / {available.length}
        </p>
        <h2 className="text-lg font-semibold text-app-text">
          {step.title[language]}
        </h2>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-app-text-2">
          {step.text[language]}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="btn btn-ghost text-app-muted" onClick={close}>
            {ru ? 'Пропустить' : 'Skip'}
          </button>
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <button type="button" className="btn" onClick={() => setIndex(index - 1)}>
                {ru ? 'Назад' : 'Back'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (last ? close() : setIndex(index + 1))}
            >
              {last ? (ru ? 'Готово' : 'Done') : ru ? 'Далее' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
