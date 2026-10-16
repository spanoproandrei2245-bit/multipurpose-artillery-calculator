import type { ReactNode } from 'react'

/** Вводный абзац экрана: короткая мысль и пояснение под ней. */
export function PageIntro({
  title,
  children,
}: {
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-lg font-medium text-app-text">{title}</p>
      {children && (
        <p className="mt-2 text-[15px] leading-relaxed text-app-muted">
          {children}
        </p>
      )}
    </div>
  )
}
