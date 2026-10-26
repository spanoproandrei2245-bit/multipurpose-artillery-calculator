import { setLanguage as setI18nLanguage, t } from '../i18n'
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
import { ProgressBar } from './FormControls'

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

  // Оверлей — отдельное окно: язык приходит вместе с состоянием
  setI18nLanguage(state?.language ?? 'ru')
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
    distance: t('overlayApp.distance-m'),
    azimuth: `${t('artilleryCalculator.azimuth')}, ${state?.azimuthUnit ?? ''}`,
    ownHeight: t('artilleryCalculator.gun-height'),
    targetHeight: t('artilleryCalculator.target-height'),
  }

  return (
    <div
      data-tauri-drag-region
      className="flex h-screen select-none flex-col overflow-y-auto rounded-xl bg-black/80 p-3 text-app-text-2"
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <span data-tauri-drag-region className="h-2 w-2 shrink-0 rounded-full bg-gun" />
        <p
          data-tauri-drag-region
          className="min-w-0 flex-1 break-words text-[15px] font-semibold text-app-text"
        >
          {state ? (state.targetName ?? state.title) : t('overlayApp.no-data')}
        </p>
        {state?.readOnly ? (
          <span className="tag tag-info">{t('overlayApp.from-fdc')}</span>
        ) : (
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            aria-pressed={editing}
            title={t('overlayApp.input-ctrl-alt-d')}
            className={[
              'btn btn-sm min-h-7 px-2.5',
              editing ? 'bg-app-raised-hover text-app-text' : '',
            ].join(' ')}
          >
            {t('overlayApp.input')}
          </button>
        )}
        <button
          type="button"
          onClick={() => void hideCurrentWindow()}
          aria-label={t('overlayApp.hide-overlay')}
          className="cursor-pointer rounded-md px-2 text-lg leading-none text-app-muted hover:bg-app-raised hover:text-app-text"
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
              {t('artilleryCalculator.elevation')} · {t('unit.mil')}
            </p>
            <p className="readout mt-1 text-5xl font-semibold">
              {Math.round(solution.elevation)}
            </p>
          </div>
          <div data-tauri-drag-region>
            <p className="label">
              {t('artilleryCalculator.azimuth')}
              {solution.azimuth !== null && ` · ${solution.azimuthUnit}`}
            </p>
            <p
              className={[
                'readout mt-1 text-5xl font-semibold',
                solution.azimuth === null ? 'text-app-faint' : '',
              ].join(' ')}
            >
              {solution.azimuth ?? '-'}
            </p>
          </div>
          <p className="flex items-center gap-2 text-[15px] text-app-text tabular-nums">
            <span className="label">{t('artilleryCalculator.charge')}</span>
            {String(solution.charge).padStart(2, '0')}
            {solution.mode === 'LOW' && <span className="tag tag-warn">LOW</span>}
          </p>
          <p className="flex items-center gap-2 text-[15px] text-app-text tabular-nums">
            <span className="label">{t('combatScreen.flight')}</span>
            {solution.tof.toFixed(1)} {t('unit.s')}
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
            ? t('overlayApp.waiting-for-the-fire-direction')
            : t('overlayApp.enter-a-distance-here-input')}
        </p>
      )}

      {totLeft !== null && totLeft > -3 && !shot && (
        <p
          className={[
            'mt-2 flex items-baseline justify-between rounded-lg px-3 py-1.5',
            totLeft <= 5 ? 'bg-accent-solid text-white' : 'bg-app-raised',
          ].join(' ')}
        >
          <span className="text-[13px] font-medium">
            {totLeft <= 0
              ? t('overlayApp.fire')
              : t('overlayApp.fire-on-time')}
          </span>
          <span className="text-lg font-semibold tabular-nums">
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
            <span className="text-[13px] font-medium">
              {left <= 0
                ? t('fireTimer.impact')
                : left <= SPLASH_WARNING_S
                  ? t('fireTimer.splash')
                  : t('overlayApp.impact-in')}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              T−{Math.max(0, left).toFixed(1)}
            </span>
          </p>
          <ProgressBar
            progress={1 - left / shot.tof}
            alert={left <= SPLASH_WARNING_S}
            className="mt-1.5"
          />
        </div>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-1 flex-col gap-2.5 border-t border-app-line-strong pt-3">
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map((field) => (
              <label key={field} className="block">
                <span className="label">{labels[field]}</span>
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
                  className="field mt-1 px-2 py-1 text-base"
                />
              </label>
            ))}
          </div>

          <ChargeRow state={state} />

          <SpotReport state={state} />
        </div>
      )}

      <p data-tauri-drag-region className="mt-2 text-[11.5px] leading-relaxed text-app-faint">
        Ctrl+Alt+F: {t('combatScreen.fire')} · Ctrl+Alt+D:{' '}
        {t('overlayApp.input-2')} · Ctrl+Alt+O: {t('overlayApp.hide')} ·
        Ctrl+Alt+M: HIGH/LOW · Ctrl+Alt+N/P: {t('overlayApp.targets')}
      </p>
    </div>
  )
}

/** Заряды, которыми можно достать цель, и режим HIGH/LOW. */
function ChargeRow({ state }: { state: OverlayState }) {
  if (state.charges.length === 0 && state.modes.length < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="label mr-1">{t('artilleryCalculator.charge')}</span>
      {state.charges.map((charge) => (
        <button
          key={charge}
          type="button"
          onClick={() => sendOverlayCommand({ type: 'charge', charge })}
          className={[
            'min-w-8 cursor-pointer rounded-md px-2 py-0.5 text-[14px] tabular-nums',
            state.solution?.charge === charge
              ? 'bg-accent-solid text-white'
              : 'bg-app-raised hover:bg-app-raised-hover',
          ].join(' ')}
        >
          {charge}
        </button>
      ))}
      {state.modes.length > 1 && (
        <button
          type="button"
          onClick={() => sendOverlayCommand({ type: 'mode' })}
          className="btn btn-sm ml-auto min-h-7 px-2.5"
        >
          {state.mode === 'LOW' ? <span className="text-warn">LOW</span> : 'HIGH'}
        </button>
      )}
    </div>
  )
}

/** Доклад о разрыве по линии орудие — цель. */
function SpotReport({ state }: { state: OverlayState }) {
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
  const unitM = t('unit.m')

  return (
    <div>
      <p className="label">
        {t('overlayApp.impact-gun-target-line')}
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <SpotInput
          value={range}
          onChange={setRange}
          onKeyDown={handleKey}
          sides={[
            ['over', t('overlayApp.over')],
            ['short', t('overlayApp.short')],
          ]}
          side={rangeSide}
          onSide={setRangeSide}
        />
        <SpotInput
          value={lateral}
          onChange={setLateral}
          onKeyDown={handleKey}
          sides={[
            ['left', t('overlayApp.left')],
            ['right', t('overlayApp.right')],
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
          className="btn btn-primary btn-sm min-h-7 px-2.5"
        >
          {t('overlayApp.apply')}
        </button>
        <button
          type="button"
          onClick={() => sendOverlayCommand({ type: 'undo-adjust' })}
          disabled={adjust.count === 0}
          className="btn btn-sm min-h-7 px-2.5"
        >
          {t('overlayApp.undo')}
        </button>
        <p className="min-w-0 flex-1 break-words text-right text-[12.5px] text-app-muted tabular-nums">
          {adjust.count === 0
            ? t('overlayApp.no-corrections')
            : `${t('overlayApp.range')} ${formatSigned(adjust.range, 0)} · ${
                t('overlayApp.lat')
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
        className="field px-2 py-1 text-base"
      />
      <div className="mt-1 flex gap-1">
        {sides.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onSide(id)}
            className={[
              'flex-1 cursor-pointer rounded-md px-1 py-0.5 text-[12.5px] font-medium',
              side === id
                ? 'bg-app-raised-hover text-app-text'
                : 'bg-app-raised text-app-muted hover:text-app-text',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
