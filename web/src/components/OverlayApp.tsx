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

// Предупреждение «сплэш» за столько секунд до разрыва (как в FireTimer)
const SPLASH_WARNING_S = 5
const IMPACT_HOLD_MS = 4000

// Размер окна: только установки / с панелью ввода
const WIDTH = 340
const COMPACT_HEIGHT = 250
const EDITING_HEIGHT = 500

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
      className="flex h-screen select-none flex-col overflow-y-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 text-white"
    >
      <div data-tauri-drag-region className="flex items-start gap-2">
        <p
          data-tauri-drag-region
          className="min-w-0 flex-1 truncate text-sm font-semibold"
        >
          {state ? (state.targetName ?? state.title) : ru ? 'Нет данных' : 'No data'}
        </p>
        {state?.readOnly ? (
          <span className="rounded bg-sky-500/20 px-1.5 text-xs text-sky-300">
            {ru ? 'от наводчика' : 'from FDC'}
          </span>
        ) : (
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          aria-pressed={editing}
          title={ru ? 'Ввод (Ctrl+Alt+D)' : 'Input (Ctrl+Alt+D)'}
          className={[
            'cursor-pointer rounded px-1.5 text-xs',
            editing
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:bg-white/10 hover:text-white',
          ].join(' ')}
        >
          {ru ? 'Ввод' : 'Input'}
        </button>
        )}
        <button
          type="button"
          onClick={() => void hideCurrentWindow()}
          aria-label={ru ? 'Скрыть оверлей' : 'Hide overlay'}
          className="cursor-pointer rounded px-1.5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>

      {solution ? (
        <div
          data-tauri-drag-region
          className={[
            'mt-1 grid grid-cols-2 content-center gap-x-4 gap-y-1',
            canEdit ? '' : 'flex-1',
          ].join(' ')}
        >
          <div data-tauri-drag-region>
            <p className="text-xs text-white/60">
              {ru ? 'Возвышение, мил' : 'Elevation, mil'}
            </p>
            <p className="text-4xl font-bold leading-tight tabular-nums">
              {Math.round(solution.elevation)}
            </p>
          </div>
          <div data-tauri-drag-region>
            <p className="text-xs text-white/60">
              {ru ? 'Азимут' : 'Azimuth'}
              {solution.azimuth !== null && `, ${solution.azimuthUnit}`}
            </p>
            <p className="text-4xl font-bold leading-tight tabular-nums">
              {solution.azimuth ?? '—'}
            </p>
          </div>
          <p className="text-sm text-white/80">
            {ru ? 'Заряд' : 'Charge'} {solution.charge}
            {solution.mode === 'LOW' && (
              <span className="ml-1 text-amber-300">LOW</span>
            )}
          </p>
          <p className="text-sm text-white/80 tabular-nums">
            {ru ? 'Полёт' : 'Flight'} {solution.tof.toFixed(1)}{' '}
            {ru ? 'с' : 's'}
          </p>
        </div>
      ) : (
        <p
          data-tauri-drag-region
          className={[
            'flex items-center py-2 text-sm text-white/60',
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

      {left !== null && shot && (
        <div className="mt-1">
          <p
            className={[
              'text-sm font-semibold tabular-nums',
              left <= SPLASH_WARNING_S ? 'text-red-400' : 'text-white',
            ].join(' ')}
          >
            {left <= 0
              ? ru
                ? 'Разрыв!'
                : 'Impact!'
              : `${ru ? 'До разрыва' : 'Impact in'} ${left.toFixed(1)} ${ru ? 'с' : 's'}`}
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={
                left <= SPLASH_WARNING_S
                  ? 'h-full bg-red-500'
                  : 'h-full bg-emerald-500'
              }
              style={{
                width: `${Math.min(100, Math.max(0, (1 - left / shot.tof) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {canEdit && (
        <div className="mt-2 flex flex-1 flex-col gap-2 border-t border-white/10 pt-2">
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map((field) => (
              <label key={field} className="block">
                <span className="text-[11px] text-white/60">
                  {labels[field]}
                </span>
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
                  className={[
                    'mt-0.5 w-full rounded border bg-black/40 px-2 py-1 text-base tabular-nums outline-none focus:border-emerald-400',
                    isInvalid(draft[field])
                      ? 'border-red-500'
                      : 'border-white/15',
                  ].join(' ')}
                />
              </label>
            ))}
          </div>

          <ChargeRow state={state} ru={ru} />

          <SpotReport state={state} ru={ru} />
        </div>
      )}

      <p data-tauri-drag-region className="mt-1 text-[10px] text-white/40">
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
      <span className="mr-1 text-[11px] text-white/60">
        {ru ? 'Заряд' : 'Charge'}
      </span>
      {state.charges.map((charge) => (
        <button
          key={charge}
          type="button"
          onClick={() => sendOverlayCommand({ type: 'charge', charge })}
          className={[
            'min-w-7 cursor-pointer rounded px-1.5 py-0.5 text-sm tabular-nums',
            state.solution?.charge === charge
              ? 'bg-emerald-500 text-black'
              : 'bg-white/10 hover:bg-white/20',
          ].join(' ')}
        >
          {charge}
        </button>
      ))}
      {state.modes.length > 1 && (
        <button
          type="button"
          onClick={() => sendOverlayCommand({ type: 'mode' })}
          className="ml-auto cursor-pointer rounded bg-white/10 px-2 py-0.5 text-sm hover:bg-white/20"
        >
          {state.mode === 'LOW' ? (
            <span className="text-amber-300">LOW</span>
          ) : (
            'HIGH'
          )}
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
      <p className="text-[11px] text-white/60">
        {ru ? 'Разрыв (по линии орудия)' : 'Impact (gun–target line)'}
      </p>
      <div className="mt-0.5 grid grid-cols-2 gap-2">
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
          className="cursor-pointer rounded bg-emerald-500 px-2 py-0.5 text-sm font-semibold text-black disabled:cursor-default disabled:opacity-40"
        >
          {ru ? 'Учесть' : 'Apply'}
        </button>
        <button
          type="button"
          onClick={() => sendOverlayCommand({ type: 'undo-adjust' })}
          disabled={adjust.count === 0}
          className="cursor-pointer rounded bg-white/10 px-2 py-0.5 text-sm hover:bg-white/20 disabled:cursor-default disabled:opacity-40"
        >
          {ru ? 'Отменить' : 'Undo'}
        </button>
        <p className="min-w-0 flex-1 truncate text-right text-[11px] text-white/60 tabular-nums">
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
        className={[
          'w-full rounded border bg-black/40 px-2 py-1 text-base tabular-nums outline-none focus:border-emerald-400',
          isInvalid(value) ? 'border-red-500' : 'border-white/15',
        ].join(' ')}
      />
      <div className="mt-1 flex gap-1">
        {sides.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onSide(id)}
            className={[
              'flex-1 cursor-pointer rounded px-1 py-0.5 text-[11px]',
              side === id ? 'bg-white/25' : 'bg-white/5 hover:bg-white/10',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
