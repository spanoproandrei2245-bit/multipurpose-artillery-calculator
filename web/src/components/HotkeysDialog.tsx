import { t, type MessageKey } from '../i18n'
import { useEffect } from 'react'

import { GLOBAL_HOTKEYS, isDesktop } from '../lib/desktop'
import { setPanel, usePanel } from '../lib/uiPanels'
import { FieldIcon } from './FieldIcon'
import { SectionHeading } from './FormControls'

/** Справка по горячим клавишам: открывается из футера или клавишей «?». */
export function HotkeysDialog() {
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
    ['F', t('hotkeysDialog.fire-start-the-timer')],
    ['B', t('artilleryCalculator.combat-screen')],
    ['M', t('hotkeysDialog.high-low-mode')],
    ['N / P', t('hotkeysDialog.next-previous-target')],
    ['Esc', t('hotkeysDialog.stop-the-timer-leave-a')],
    ['0 – 9', t('hotkeysDialog.select-a-charge')],
    ['D', t('hotkeysDialog.go-to-distance')],
    ['A', t('hotkeysDialog.go-to-azimuth')],
    ['C', t('hotkeysDialog.go-to-fire-adjustment')],
    ['Enter', t('hotkeysDialog.in-a-report-field-apply')],
    ['?', t('hotkeysDialog.show-hide-this-help')],
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('footer.keyboard-shortcuts')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => setPanel('hotkeys', false)}
    >
      <div
        className="panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <SectionHeading
          title={t('footer.keyboard-shortcuts')}
          aside={
            <button
              type="button"
              className="btn btn-ghost px-2"
              aria-label={t('combatScreen.close')}
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
          {t('hotkeysDialog.shortcuts-work-in-any-keyboard')}
        </p>

        {isDesktop && (
          <>
            <h3 className="mt-5 font-semibold text-app-text">
              {t('hotkeysDialog.over-the-game-desktop-app')}
            </h3>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {GLOBAL_HOTKEYS.map(({ keys: combo, action }) => (
                <div key={action} className="flex items-baseline gap-3">
                  <dt className="min-w-32">
                    <kbd className="kbd">{combo}</kbd>
                  </dt>
                  <dd className="text-app-muted">{t(`settings.hotkeys.${action}` as MessageKey)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </div>
  )
}
