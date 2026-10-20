import { useEffect } from 'react'

import { GLOBAL_HOTKEYS, isDesktop } from '../lib/desktop'
import { setPanel, usePanel } from '../lib/uiPanels'
import type { Language } from '../types/settings'
import { translations } from '../i18n/translations'
import { FieldIcon } from './FieldIcon'
import { SectionHeading } from './FormControls'

/** Справка по горячим клавишам: открывается из футера или клавишей «?». */
export function HotkeysDialog({ language }: { language: Language }) {
  const ru = language === 'ru'
  const open = usePanel('hotkeys')

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setPanel('hotkeys', false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const keys = [
    ['F', ru ? 'Огонь — запустить таймер' : 'Fire — start the timer'],
    ['B', ru ? 'Боевой экран' : 'Combat screen'],
    ['M', ru ? 'Режим HIGH / LOW' : 'HIGH / LOW mode'],
    ['N / P', ru ? 'Следующая / предыдущая цель' : 'Next / previous target'],
    ['Esc', ru ? 'Остановить таймер, выйти из поля' : 'Stop the timer, leave a field'],
    ['0 – 9', ru ? 'Выбрать заряд' : 'Select a charge'],
    ['D', ru ? 'К полю дистанции' : 'Go to distance'],
    ['A', ru ? 'К полю азимута' : 'Go to azimuth'],
    ['C', ru ? 'К корректировке огня' : 'Go to fire adjustment'],
    ['Enter', ru ? 'В поле доклада — учесть разрыв' : 'In a report field — apply'],
    ['?', ru ? 'Показать / скрыть эту справку' : 'Show / hide this help'],
  ]
  const t = translations[language].settings

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ru ? 'Горячие клавиши' : 'Keyboard shortcuts'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => setPanel('hotkeys', false)}
    >
      <div
        className="panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <SectionHeading
          title={ru ? 'Горячие клавиши' : 'Keyboard shortcuts'}
          aside={
            <button
              type="button"
              className="btn btn-ghost px-2"
              aria-label={ru ? 'Закрыть' : 'Close'}
              onClick={() => setPanel('hotkeys', false)}
            >
              <FieldIcon name="close" className="h-5 w-5" />
            </button>
          }
        />
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {keys.map(([key, text]) => (
            <div key={key} className="flex items-baseline gap-3">
              <dt className="min-w-12">
                <kbd className="kbd">{key}</kbd>
              </dt>
              <dd className="text-app-muted">{text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13px] text-app-muted">
          {ru
            ? 'Клавиши работают в любой раскладке, когда курсор не в поле ввода.'
            : 'Shortcuts work in any keyboard layout when no input field is focused.'}
        </p>

        {isDesktop && (
          <>
            <h3 className="mt-5 font-semibold text-app-text">
              {ru ? 'Поверх игры (программа для ПК)' : 'Over the game (desktop app)'}
            </h3>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {GLOBAL_HOTKEYS.map(({ keys: combo, action }) => (
                <div key={action} className="flex items-baseline gap-3">
                  <dt className="min-w-32">
                    <kbd className="kbd">{combo}</kbd>
                  </dt>
                  <dd className="text-app-muted">{t.hotkeys[action]}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </div>
  )
}
