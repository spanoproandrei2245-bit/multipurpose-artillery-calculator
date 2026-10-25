import { useEffect, useState } from 'react'

import { t, type MessageKey } from '../../i18n'
import type { MarkerColor } from '../../lib/markers'
import { ColorField } from '../ColorWheel'
import { FieldIcon, type FieldIconName } from '../FieldIcon'
import { colorName } from './mapLabels'

export type DrawTool = 'pen' | 'draw-line' | 'eraser'

const TOOLS: { id: DrawTool; icon: FieldIconName; label: MessageKey }[] = [
  { id: 'pen', icon: 'pen', label: 'mapPicker.draw-pen' },
  { id: 'draw-line', icon: 'drawLine', label: 'mapPicker.draw-line' },
  { id: 'eraser', icon: 'eraser', label: 'mapPicker.draw-eraser' },
]

/**
 * Рисование на карте: одна кнопка-карандаш, по нажатию — полоса инструментов
 * (карандаш, прямая, ластик, цвет, отмена, стереть всё по двойному нажатию).
 */
export function DrawToolbar({
  tool,
  onTool,
  open,
  onOpenChange,
  color,
  onColor,
  canUndo,
  onUndo,
  onClear,
}: {
  // Выбранный инструмент рисования или null, если карта в обычном режиме
  tool: DrawTool | null
  // null — выйти из рисования (касание снова ставит цель)
  onTool: (tool: DrawTool | null) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  color: MarkerColor
  onColor: (color: MarkerColor) => void
  canUndo: boolean
  onUndo: () => void
  onClear: () => void
}) {
  // «Стереть всё» срабатывает со второго нажатия в течение 3 с
  const [clearArmed, setClearArmed] = useState(false)
  useEffect(() => {
    if (!clearArmed) return
    const timer = window.setTimeout(() => setClearArmed(false), 3000)
    return () => window.clearTimeout(timer)
  }, [clearArmed])

  return (
    <div
      role="toolbar"
      aria-label={t('mapPicker.draw-tools')}
      className="flex flex-row-reverse gap-1 rounded-lg bg-black/70 p-1 shadow-lg backdrop-blur-sm"
    >
      <button
        type="button"
        aria-expanded={open}
        title={t('mapPicker.draw-tools')}
        aria-label={t('mapPicker.draw-tools')}
        onClick={() => {
          if (open && tool) onTool(null)
          onOpenChange(!open)
        }}
        className={[
          'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors',
          open || tool ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15',
        ].join(' ')}
      >
        <FieldIcon name={open ? 'close' : 'pen'} className="h-5 w-5" />
      </button>
      {open && (
        <div className="flex gap-1">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tool === item.id}
              title={t(item.label)}
              aria-label={t(item.label)}
              onClick={() => onTool(tool === item.id ? null : item.id)}
              className={[
                'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors',
                tool === item.id ? 'bg-accent-solid text-white' : 'text-white/80 hover:bg-white/15',
              ].join(' ')}
            >
              <FieldIcon name={item.icon} className="h-5 w-5" />
            </button>
          ))}
          <ColorField compact placement="bottom" value={color} onChange={onColor} names={colorName} />
          <button
            type="button"
            disabled={!canUndo}
            title={t('mapPicker.draw-undo')}
            aria-label={t('mapPicker.draw-undo')}
            onClick={onUndo}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-white/80 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <FieldIcon name="undo" className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={!canUndo}
            title={t('mapPicker.draw-clear')}
            aria-label={t('mapPicker.draw-clear')}
            onClick={() => {
              if (clearArmed) {
                setClearArmed(false)
                onClear()
              } else setClearArmed(true)
            }}
            className={[
              'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-35',
              clearArmed ? 'bg-danger text-white' : 'text-white/80 hover:bg-white/15',
            ].join(' ')}
          >
            <FieldIcon name="trash" className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  )
}
