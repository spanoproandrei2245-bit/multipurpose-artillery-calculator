import { Component, useState, type ErrorInfo, type ReactNode } from 'react'

import { t } from '../i18n'
import { errorReport, recordError, type ErrorEntry } from '../lib/errorLog'
import { FieldIcon } from './FieldIcon'

const ISSUES_URL =
  'https://github.com/spanoproandrei2245-bit/multipurpose-artillery-calculator/issues/new'

interface Props {
  // Где стоит граница: попадает в отчёт
  area: string
  // page — вся страница вместо приложения; inline — карточка на месте блока
  variant?: 'page' | 'inline'
  children: ReactNode
}

interface State {
  entry: ErrorEntry | null
}

/**
 * Ошибка внутри блока не роняет всё приложение: вместо белого экрана —
 * понятное сообщение, перезагрузка и отчёт об ошибке.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { entry: null }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    // Сразу показать запасной экран; полная запись — в componentDidCatch
    return {
      entry: {
        time: new Date().toISOString(),
        area: '',
        message: error instanceof Error ? error.message : String(error),
      },
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState({ entry: recordError(this.props.area, error, info.componentStack ?? undefined) })
  }

  render() {
    const { entry } = this.state
    if (!entry) return this.props.children
    return (
      <ErrorCard
        entry={entry}
        variant={this.props.variant ?? 'page'}
        onRetry={() => this.setState({ entry: null })}
      />
    )
  }
}

function ErrorCard({
  entry,
  variant,
  onRetry,
}: {
  entry: ErrorEntry
  variant: 'page' | 'inline'
  onRetry: () => void
}) {
  const [copied, setCopied] = useState(false)
  const report = errorReport(entry)
  const issueUrl = `${ISSUES_URL}?title=${encodeURIComponent(`Error: ${entry.message.slice(0, 80)}`)}&body=${encodeURIComponent(
    `\`\`\`\n${report.slice(0, 1800)}\n\`\`\``
  )}`
  const page = variant === 'page'

  return (
    <div
      role="alert"
      className={
        page
          ? 'mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 py-16'
          : 'flex flex-col gap-3 rounded-lg bg-app-surface p-5 ring-1 ring-app-line-strong'
      }
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger/15 text-danger">
          <FieldIcon name="warning" className="h-5 w-5" />
        </span>
        <h1 className={page ? 'text-xl font-semibold text-app-text' : 'text-base font-semibold text-app-text'}>
          {page ? t('errorBoundary.title') : t('errorBoundary.map-title')}
        </h1>
      </div>
      <p className="text-[14px] text-app-text-2">
        {page ? t('errorBoundary.text') : t('errorBoundary.map-text')}
      </p>
      <p className="rounded-md bg-app-raised px-3 py-2 font-mono break-all text-[12.5px] text-app-muted">
        {entry.message}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => (page ? location.reload() : onRetry())}
        >
          <FieldIcon name="reload" className="h-[18px] w-[18px]" />
          {page ? t('errorBoundary.reload') : t('errorBoundary.retry')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(report)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }}
        >
          <FieldIcon name="save" className="h-[18px] w-[18px]" />
          {copied ? t('errorBoundary.copied') : t('errorBoundary.copy')}
        </button>
        <a href={issueUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
          <FieldIcon name="help" className="h-[18px] w-[18px]" />
          {t('errorBoundary.report')}
        </a>
      </div>
    </div>
  )
}

/**
 * Проверка экрана ошибки: ?crashtest=<область> роняет этот блок. Нужна
 * смоук-тестам сборки; без параметра ничего не делает.
 */
export function CrashProbe({ area }: { area: string }) {
  if (new URLSearchParams(location.search).get('crashtest') === area) {
    throw new Error(`crashtest: ${area}`)
  }
  return null
}
