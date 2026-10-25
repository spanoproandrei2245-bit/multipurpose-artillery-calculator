import { useEffect } from 'react'

import { t, type MessageKey } from '../i18n'
import { setPanel, usePanel } from '../lib/uiPanels'
import { FieldIcon } from './FieldIcon'
import { SectionHeading } from './FormControls'

const ISSUES_URL =
  'https://github.com/spanoproandrei2245-bit/multipurpose-artillery-calculator/issues/new/choose'

// Вопрос и ответ: help.q<n> / help.a<n>
const ITEMS = [1, 2, 3, 4, 5, 6, 7, 8] as const

/** Справка: короткие ответы на частые вопросы, ссылка «сообщить о проблеме». */
export function HelpDialog() {
  const open = usePanel('help')

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setPanel('help', false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('help.title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => setPanel('help', false)}
    >
      <div
        className="panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <SectionHeading
          title={t('help.title')}
          aside={
            <button
              type="button"
              className="btn btn-ghost px-2"
              aria-label={t('combatScreen.close')}
              onClick={() => setPanel('help', false)}
            >
              <FieldIcon name="close" className="h-5 w-5" />
            </button>
          }
        />
        <div className="mt-3 space-y-2">
          {ITEMS.map((n, i) => (
            <details key={n} className="disclosure rounded-lg bg-app-raised px-4 py-3" open={i === 0}>
              <summary className="cursor-pointer font-medium text-app-text">
                {t(`help.q${n}` as MessageKey)}
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-line text-app-text-2">
                {t(`help.a${n}` as MessageKey)}
              </p>
            </details>
          ))}
        </div>
        <a href={ISSUES_URL} target="_blank" rel="noreferrer" className="btn mt-4">
          <FieldIcon name="help" className="h-[18px] w-[18px]" />
          {t('errorBoundary.report')}
        </a>
      </div>
    </div>
  )
}
