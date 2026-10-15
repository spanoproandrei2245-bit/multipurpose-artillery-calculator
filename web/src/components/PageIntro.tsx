import type { ReactNode } from 'react'

/**
 * Шапка страницы: индекс и раздел моноширинным капсом,
 * крупный тонкий заголовок и пояснение.
 */
export function PageIntro({
  index,
  eyebrow,
  title,
  children,
  aside,
}: {
  index: string
  eyebrow: string
  title: ReactNode
  children?: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 pb-2">
      <div className="max-w-3xl">
        <p className="flex items-center gap-3">
          <span className="index">[{index}]</span>
          <span className="label">{eyebrow}</span>
        </p>
        <h2 className="mt-3 text-[clamp(2rem,5vw,3.25rem)] leading-[1.02] font-light tracking-[-0.03em] text-app-text">
          {title}
        </h2>
        {children && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-app-muted">
            {children}
          </p>
        )}
      </div>
      {aside}
    </div>
  )
}
