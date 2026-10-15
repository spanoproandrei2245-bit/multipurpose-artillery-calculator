import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import {
  focusCurrentWindow,
  hideCurrentWindow,
  onHotkey,
  onOverlayShot,
  onSolution,
  requestSolution,
  resizeCurrentWindow,
  sendOverlayCommand,
  type OverlayField,
  type OverlayState,
} from '../lib/desktop'
import { formatSigned, isInvalid, parseNumber } from '../lib/input'
import { SegmentBar } from './FormControls'

// Предупреждение «сплэш» за столько секунд до разрыва (как в FireTimer)
const SPLASH_WARNING_S = 5
const IMPACT_HOLD_MS = 4000

// Размер окна: только установки / с панелью ввода
const WIDTH = 340
const COMPACT_HEIGHT = 250
const EDITING_HEIGHT = 580

const FIELDS: readonly OverlayField[] = [
  'distance',
  'azimuth',
  'ownHeight',
  'targetHeight',
]

const EMPTY_FIELDS: Record<OverlayField, string> = {
  distance: '',
  azimuth: '',
  ownHeight: '',
  targetHeight: '',
}

interface Shot {
  firedAt: number
  tof: number
}

/**
 * Окно поверх игры: возвышение, азимут, заряд и отсчёт до разрыва.
 * Панель ввода меняет вводные основного окна, не переключаясь на него:
 * основное окно считает и присылает новое решение.
 * Огонь — по глобальной клавише, звук подаёт основное окно.
 */
export function OverlayApp() {
  const [state, setState] = useState<OverlayState | null>(null)
  const [shot, setShot] = useState<Shot | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [editing, setEditing] = useState(false)
  // Счётчик запросов «курсор в поле дистанции» (Ctrl+Alt+D)
  const [focusRequest, setFocusRequest] = useState(0)

  // Свои значения полей: пока поле в фокусе, ответ основного окна
  // не перебивает то, что набирается.
  const [draft, setDraft] = useState(EMPTY_FIELDS)
  const inputsRef = useRef<Partial<Record<OverlayField, HTMLInputElement>>>(
    {}
  )

  // Последнее состояние для обработчика клавиши «огонь»
  const stateRef = useRef<OverlayState | null>(null)

  // Панель ввода — только для своих вводных, не для данных по связке
  const canEdit = editing && state !== null && !state.readOnly

  useEffect(() => {
    const stop = onSolution((next) => {
      stateRef.current = next
      setState(next)
      setDraft((previous) => {
        const focused = FIELDS.find(
          (field) => inputsRef.current[field] === document.activeElement
        )
        return focused
          ? { ...next.fields, [focused]: previous[focused] }
          : next.fields
      })
    })
    requestSolution()
    return stop
  }, [])

  useEffect(() => {
    void resizeCurrentWindow(
      WIDTH,
      canEdit ? EDITING_HEIGHT : COMPACT_HEIGHT
    )
  }, [canEdit])

  useEffect(
    () =>
      onHotkey((action) => {
        if (action === 'input') {
          setEditing(true)
          setFocusRequest((value) => value + 1)
          return
        }
        const solution = stateRef.current?.solution
        if (action !== 'fire' || !solution) return
        const firedAt = Date.now()
        setNow(firedAt)
        setShot({ firedAt, tof: solution.tof })
      }),
    []
  )

  // Поле появляется только после отрисовки панели ввода
  useEffect(() => {
    if (focusRequest === 0) return
    void focusCurrentWindow().then(() => {
      const field = inputsRef.current.distance
      field?.focus()
      field?.select()
    })
  }, [focusRequest])

  // Выстрел из основного окна или по связке
  useEffect(
    () =>
      onOverlayShot(() => {
        const solution = stateRef.current?.solution
        if (!solution) return
        const firedAt = Date.now()
        setNow(firedAt)
        setShot({ firedAt, tof: solution.tof })
      }),
    []
  )

  useEffect(() => {
    if (!shot) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      if (current - shot.firedAt > shot.tof * 1000 + IMPACT_HOLD_MS) {
        setShot(null)
        return
      }
      setNow(current)
    }, 100)
    return () => window.clearInterval(interval)
  }, [shot])

  // Огонь по времени: отсчёт до выстрела
  const fireAt = state?.fireAt ?? null
  useEffect(() => {
    if (fireAt === null) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current - fireAt > 4000) window.clearInterval(interval)
    }, 100)
    return () => window.clearInterval(interval)
  }, [fireAt])
  const totLeft = fireAt === null ? null : (fireAt - now) / 1000

  const ru = (state?.language ?? 'ru') === 'ru'
  const solution = state?.solution ?? null
  const left = shot ? shot.tof - (now - shot.firedAt) / 1000 : null

  function changeField(field: OverlayField, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }))
    sendOverlayCommand({ type: 'field', field, value })
  }

  // Enter — к следующему полю, Escape — убрать курсор
  function handleFieldKey(
    event: KeyboardEvent<HTMLInputElement>,
    field: OverlayField
  ) {
    if (event.key === 'Escape') {
      event.currentTarget.blur()
      return
    }
    if (event.key !== 'Enter') return
    const next = FIELDS[FIELDS.indexOf(field) + 1]
    const target = next ? inputsRef.current[next] : null
    if (target) {
      target.focus()
      target.select()
    } else {
      event.currentTarget.blur()
    }
  }

  const labels: Record<OverlayField, string> = {
    distance: ru ? 'Дистанция, м' : 'Distance, m',
    azimuth: `${ru ? 'Азимут' : 'Azimuth'}, ${state?.azimuthUnit ?? ''}`,
    ownHeight: ru ? 'Высота орудия' : 'Gun height',
    targetHeight: ru ? 'Высота цели' : 'Target height',
  }

  return (
    <div
      data-tauri-drag-region
      className="ticks ticks-accent flex h-screen select-none flex-col overflow-y-auto border border-white/10 bg-[#0a0a0a]/85 p-3 text-app-text"
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <span data-tauri-drag-region className="h-1.5 w-1.5 shrink-0 bg-accent" />
        <p
          data-tauri-drag-region
          className="label min-w-0 flex-1 truncate text-app-text"
        >
          {state ? (state.targetName ?? state.title) : ru ? 'Нет данных' : 'No data'}
        </p>
        {state?.readOnly ? (
          <span className="tag tag-info">{ru ? 'от наводчика' : 'from FDC'}</span>
        ) : (
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            aria-pressed={editing}
            title={ru ? 'Ввод (Ctrl+Alt+D)' : 'Input (Ctrl+Alt+D)'}
            className={[
              'btn btn-sm min-h-6 px-2',
              editing ? 'border-accent text-accent' : 'border-white/15',
            ].join(' ')}
          >
            {ru ? 'Ввод' : 'Input'}
          </button>
        )}
        <button
          type="button"
          onClick={() => void hideCurrentWindow()}
          aria-label={ru ? 'Скрыть оверлей' : 'Hide overlay'}
          className="cursor-pointer px-1.5 font-mono text-app-muted hover:text-accent"
        >
          ×
        </button>
      </div>

      {solution ? (
        <div
          data-tauri-drag-region
          className={[
            'mt-2 grid grid-cols-2 content-center gap-x-4 gap-y-2',
            canEdit ? '' : 'flex-1',
          ].join(' ')}
        >
          <div data-tauri-drag-region>
            <p className="label">
              {ru ? 'Возвышение' : 'Elevation'} · {ru ? 'мил' : 'mil'}
            </p>
            <p className="readout mt-1 text-5xl font-normal">
              {Math.round(solution.elevation)}
            </p>
          </div>
          <div data-tauri-drag-region>
            <p className="label">
              {ru ? 'Азимут' : 'Azimuth'}
              {solution.azimuth !== null && ` · ${solution.azimuthUnit}`}
            </p>
            <p
              className={[
                'readout mt-1 text-5xl font-normal',
                solution.azimuth === null ? 'text-app-faint' : '',
              ].join(' ')}
            >
              {solution.azimuth ?? '——'}
            </p>
          </div>
          <p className="mono-num flex items-center gap-2 text-[13px] text-app-text">
            <span className="label">{ru ? 'Заряд' : 'Charge'}</span>
            {String(solution.charge).padStart(2, '0')}
            {solution.mode === 'LOW' && <span className="tag tag-warn">LOW</span>}
          </p>
          <p className="mono-num flex items-center gap-2 text-[13px] text-app-text">
            <span className="label">{ru ? 'Полёт' : 'Flight'}</span>
            {solution.tof.toFixed(1)} {ru ? 'с' : 's'}
          </p>
        </div>
      ) : (
        <p
          data-tauri-drag-region
          className={[
            'label flex items-center py-2',
            canEdit ? '' : 'flex-1',
          ].join(' ')}
        >
          {state?.readOnly
            ? ru
              ? 'Ждём установки от наводчика.'
              : 'Waiting for the fire direction data.'
            : ru
              ? 'Введите дистанцию — здесь (Ввод) или в основном окне.'
              : 'Enter a distance — here (Input) or in the main window.'}
        </p>
      )}

      {totLeft !== null && totLeft > -3 && !shot && (
        <p
          className={[
            'mt-2 flex items-baseline justify-between border px-2 py-1',
            totLeft <= 5 ? 'border-accent text-accent' : 'border-white/15',
          ].join(' ')}
        >
          <span className="label text-current">
            {totLeft <= 0
              ? ru
                ? 'Огонь!'
                : 'Fire!'
              : ru
                ? 'Выстрел по времени'
                : 'Fire on time'}
          </span>
          <span className="mono-num text-lg">
            T−{Math.max(0, totLeft).toFixed(1)}
          </span>
        </p>
      )}

      {left !== null && shot && (
        <div className="mt-2">
          <p
            className={[
              'flex items-baseline justify-between',
              left <= SPLASH_WARNING_S ? 'text-danger' : 'text-app-text',
            ].join(' ')}
          >
            <span className="label text-current">
              {left <= 0
                ? ru
                  ? 'Разрыв'
                  : 'Impact'
                : left <= SPLASH_WARNING_S
                  ? ru
                    ? 'Сплэш'
                    : 'Splash'
                  : ru
                    ? 'До разрыва'
                    : 'Impact in'}
            </span>
            <span className="mono-num text-lg">
              T−{Math.max(0, left).toFixed(1)}
            </span>
          </p>
          <SegmentBar
            progress={1 - left / shot.tof}
            alert={left <= SPLASH_WARNING_S}
            count={32}
            className="mt-1 h-2"
          />
        </div>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-1 flex-col gap-2.5 border-t border-white/10 pt-3">
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map((field) => (
              <label key={field} className="block">
                <span className="label text-[9.5px]">{labels[field]}</span>
                <input
                  ref={(element) => {
                    if (element) inputsRef.current[field] = element
                  }}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft[field]}
                  onChange={(event) => changeField(field, event.target.value)}
                  onKeyDown={(event) => handleFieldKey(event, field)}
                  aria-invalid={isInvalid(draft[field])}
                  className="field mt-1 border-white/15 bg-black/50 px-2 py-1 text-base tabular-nums"
                />
              </label>
            ))}
          </div>

          <ChargeRow state={state} ru={ru} />

          <SpotReport state={state} ru={ru} />
        </div>
      )}

      <p data-tauri-drag-region className="mt-2 font-mono text-[9.5px] leading-relaxed text-app-faint">
        Ctrl+Alt+F — {ru ? 'огонь' : 'fire'} · Ctrl+Alt+D —{' '}
        {ru ? 'ввод' : 'input'} · Ctrl+Alt+O — {ru ? 'скрыть' : 'hide'} ·
        Ctrl+Alt+M — HIGH/LOW · Ctrl+Alt+N/P — {ru ? 'цели' : 'targets'}
      </p>
    </div>
  )
}

/** Заряды, которыми можно достать цель, и режим HIGH/LOW. */
function ChargeRow({ state, ru }: { state: OverlayState; ru: boolean }) {
  if (state.charges.length === 0 && state.modes.length < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="label mr-1 text-[9.5px]">{ru ? 'Заряд' : 'Charge'}</span>
      {state.charges.map((charge) => (
        <button
          key={charge}
          type="button"
          onClick={() => sendOverlayCommand({ type: 'charge', charge })}
          className={[
            'mono-num min-w-7 cursor-pointer border px-1.5 py-0.5 text-[13px]',
            state.solution?.charge === charge
              ? 'border-accent bg-accent text-on-accent'
              : 'border-white/15 hover:border-accent hover:text-accent',
          ].join(' ')}
        >
          {charge}
        </button>
      ))}
      {state.modes.length > 1 && (
        <button
          type="button"
          onClick={() => sendOverlayCommand({ type: 'mode' })}
          className="btn btn-sm ml-auto min-h-6 border-white/15 px-2"
        >
          {state.mode === 'LOW' ? <span className="text-warn">LOW</span> : 'HIGH'}
        </button>
      )}
    </div>
  )
}

/** Доклад о разрыве по линии орудие — цель. */
function SpotReport({ state, ru }: { state: OverlayState; ru: boolean }) {
  const [range, setRange] = useState('')
  const [rangeSide, setRangeSide] = useState<'over' | 'short'>('over')
  const [lateral, setLateral] = useState('')
  const [lateralSide, setLateralSide] = useState<'left' | 'right'>('left')

  const rangeValue = Math.abs(parseNumber(range) ?? 0)
  const lateralValue = Math.abs(parseNumber(lateral) ?? 0)
  const canAdd =
    (rangeValue > 0 || lateralValue > 0) &&
    !isInvalid(range) &&
    !isInvalid(lateral)

  function add() {
    if (!canAdd) return
    sendOverlayCommand({
      type: 'spot',
      over: rangeSide === 'over' ? rangeValue : -rangeValue,
      right: lateralSide === 'right' ? lateralValue : -lateralValue,
    })
    setRange('')
    setLateral('')
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') add()
    if (event.key === 'Escape') event.currentTarget.blur()
  }

  const { adjust } = state
  const unitM = ru ? 'м' : 'm'

  return (
    <div>
      <p className="label text-[9.5px]">
        {ru ? 'Разрыв · по линии орудия' : 'Impact · gun–target line'}
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <SpotInput
          value={range}
          onChange={setRange}
          onKeyDown={handleKey}
          sides={[
            ['over', ru ? 'Перелёт' : 'Over'],
            ['short', ru ? 'Недолёт' : 'Short'],
          ]}
          side={rangeSide}
          onSide={setRangeSide}
        />
        <SpotInput
          value={lateral}
          onChange={setLateral}
          onKeyDown={handleKey}
          sides={[
            ['left', ru ? 'Левее' : 'Left'],
            ['right', ru ? 'Правее' : 'Right'],
          ]}
          side={lateralSide}
          onSide={setLateralSide}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="btn btn-primary btn-sm min-h-6 px-2"
        >
          {ru ? 'Учесть' : 'Apply'}
        </button>
        <button
          type="button"
          onClick={() => sendOverlayCommand({ type: 'undo-adjust' })}
          disabled={adjust.count === 0}
          className="btn btn-sm min-h-6 border-white/15 px-2"
        >
          {ru ? 'Отменить' : 'Undo'}
        </button>
        <p className="mono-num min-w-0 flex-1 truncate text-right text-[11px] text-app-muted">
          {adjust.count === 0
            ? ru
              ? 'без поправок'
              : 'no corrections'
            : `${ru ? 'дальн.' : 'range'} ${formatSigned(adjust.range, 0)} · ${
                ru ? 'напр.' : 'lat.'
              } ${formatSigned(adjust.lateral, 0)} ${unitM}`}
        </p>
      </div>
    </div>
  )
}

function SpotInput<T extends string>({
  value,
  onChange,
  onKeyDown,
  sides,
  side,
  onSide,
}: {
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  sides: readonly [[T, string], [T, string]]
  side: T
  onSide: (side: T) => void
}) {
  return (
    <div>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        aria-invalid={isInvalid(value)}
        className="field border-white/15 bg-black/50 px-2 py-1 text-base tabular-nums"
      />
      <div className="mt-1 flex gap-1">
        {sides.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onSide(id)}
            className={[
              'flex-1 cursor-pointer border px-1 py-0.5 font-mono text-[10px] tracking-[0.06em] uppercase',
              side === id
                ? 'border-accent text-accent'
                : 'border-white/10 text-app-muted hover:text-app-text',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
