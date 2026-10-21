import { useEffect, useLayoutEffect, useState } from 'react'

import {
  advancedTourDone,
  markAdvancedTourDone,
  markTourDone,
  setPanel,
  tourDone,
  usePanel,
} from '../lib/uiPanels'
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
// Целиком блок строк (дистанция, азимут, высота цели): подсвечиваются все
const blockOf = (id: string) => () =>
  document.getElementById(id)?.closest('dl') ?? null
const byLabel = (ru: string, en: string) => () =>
  document.querySelector(`[aria-label="${ru}"], [aria-label="${en}"]`)

const BASIC: Step[] = [
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
      ru: 'ЛКМ — положение орудия, ПКМ — цель. Карту можно двигать мышью и масштабировать колесом. На телефоне, что ставит касание, выбирают кнопками справа.',
      en: 'Left-click places the gun, right-click the target. Drag to pan, scroll to zoom. On a phone use the buttons on the right to choose what a tap places.',
    },
  },
  {
    target: blockOf('calc-distance'),
    title: { ru: 'Дистанция, азимут, высота цели', en: 'Distance, bearing, target height' },
    text: {
      ru: 'Эти три поля заполняются с карты сами. Без карты введите их вручную — установки посчитаются сразу.',
      en: 'These three fields fill in from the map. Without a map, type them in — the solution updates instantly.',
    },
  },
  {
    target: () => byLabel('Выбор заряда', 'Charge choice')()?.closest('.row') ?? null,
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
      ru: 'Кнопка (или клавиша F) запускает таймер и анимацию полёта. По связке отсчёт идёт у всех сразу.',
      en: 'The button (or the F key) starts the timer and the flight animation. Over the link everyone’s countdown starts together.',
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

const ADVANCED: Step[] = [
  {
    target: null,
    title: { ru: 'Продвинутое обучение', en: 'Advanced tutorial' },
    text: {
      ru: 'Карты, огневая линия, значки орудий, связка и мелочи интерфейса. Тоже можно пропустить.',
      en: 'Maps, the fire line, weapon icons, the link and interface details. Skippable too.',
    },
  },
  {
    target: byLabel('Карта', 'Map'),
    title: { ru: 'Выбор карты', en: 'Choosing a map' },
    text: {
      ru: 'Звёздочка у карты — в избранное, избранные идут сверху. Справа маленькое превью. Свою карту добавляют пунктом «Добавить свою карту…» внизу списка.',
      en: 'The star adds a map to favourites, which sit on top. A small preview is on the right. Add your own map with “Add your own map…” at the bottom of the list.',
    },
  },
  {
    target: byTour('tools'),
    title: { ru: 'Огневая линия', en: 'Fire line' },
    text: {
      ru: 'Выберите «линию» и расставьте точки по лесополосе или дороге. Приложение разложит по ней точки прицеливания по радиусу поражения (миномёт 15 м, артиллерия 50 м, реактивная 75–100 м) — стреляйте по ним по очереди.',
      en: 'Pick “line” and drop points along a tree line or road. The app lays aim points along it by kill radius (mortar 15 m, artillery 50 m, rocket 75–100 m) — fire at them one by one.',
    },
  },
  {
    target: byTour('tools'),
    title: { ru: 'Закрепление орудия', en: 'Pinning the gun' },
    text: {
      ru: 'Подержите курсор (или палец) на кнопке «орудие» — слева появится замок. Закреплённое орудие не двигается касаниями карты, а его высота закрепляется сама.',
      en: 'Hold the cursor (or a finger) on the “gun” button and a lock appears on the left. A pinned gun ignores taps on the map and its height is pinned too.',
    },
  },
  {
    target: rowOf('calc-own-height'),
    title: { ru: 'Значки орудий и снарядов', en: 'Weapon and shell icons' },
    text: {
      ru: 'Цветная точка в углу значка — класс: зелёная — миномёт, жёлтая — артиллерия, фиолетовая — реактивные системы. Форма снаряда тоже зависит от класса.',
      en: 'The coloured dot marks the class: green — mortar, yellow — artillery, purple — rocket systems. The shell shape follows the class too.',
    },
  },
  {
    target: byTour('settings'),
    title: { ru: 'Разделы под себя', en: 'Sections your way' },
    text: {
      ru: 'В настройках включаются корректировка огня, погода, огонь по времени, журнал целей и таблица. Там же можно выключить подсказки.',
      en: 'Settings turn on fire adjustment, weather, time on target, the target journal and the range table. You can switch hints off there too.',
    },
  },
  {
    target: byTour('link'),
    title: { ru: 'Связка', en: 'Link' },
    text: {
      ru: 'Наводчик и стрелки соединяются по коду комнаты: наводчик отправляет готовые установки (с поправками и временем разрыва), у всех одновременно идёт отсчёт.',
      en: 'The FDC and gunners connect by room code: the FDC sends ready settings (with corrections and impact time) and everyone’s countdown runs together.',
    },
  },
  {
    target: byTour('help'),
    title: { ru: 'Справка', en: 'Help' },
    text: {
      ru: 'Здесь обучение, список горячих клавиш (F — огонь, B — боевой экран, 0–9 — заряд, N / P — цели; список открывает и клавиша «?») и ссылка на программу для ПК.',
      en: 'Tutorials, the list of shortcuts (F — fire, B — combat screen, 0–9 — charge, N / P — targets; the “?” key opens it too) and the desktop app link.',
    },
  },
  {
    target: byTour('theme'),
    title: { ru: 'Тема', en: 'Theme' },
    text: {
      ru: 'Светлая или тёмная — одним нажатием.',
      en: 'Light or dark in one tap.',
    },
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
export function Tour({ language }: { language: Language }) {
  const ru = language === 'ru'
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
            {ru ? 'Базовое обучение пройдено' : 'Basic tutorial complete'}
          </h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-app-text-2">
            {ru
              ? 'Хотите продвинутое? Оно про карты, огневую линию, значки орудий, связку и мелочи интерфейса.'
              : 'Want the advanced one? It covers maps, the fire line, weapon icons, the link and interface details.'}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost text-app-muted" onClick={() => setOffer(false)}>
              {ru ? 'Не сейчас' : 'Not now'}
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
              {ru ? 'Показать' : 'Show me'}
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
      aria-label={ru ? 'Обучение' : 'Tutorial'}
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
        <div key={`${advancedOpen ? 'a' : 'b'}:${step.title.en}`} className="tour-fade">
          <p className="label mb-1">
            {advancedOpen ? (ru ? 'Продвинутое · ' : 'Advanced · ') : ''}
            {index + 1} / {available.length}
          </p>
          <h2 className="text-lg font-semibold text-app-text">{step.title[language]}</h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-app-text-2">
            {step.text[language]}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="btn btn-ghost text-app-muted" onClick={() => finish(false)}>
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
              onClick={() => (last ? finish(true) : setIndex(index + 1))}
            >
              {last ? (ru ? 'Готово' : 'Done') : ru ? 'Далее' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
