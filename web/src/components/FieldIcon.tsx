import type { ReactNode } from 'react'

/**
 * Значки-подсказки у полей ввода: сразу видно, что вводится, чтобы
 * не перепутать (дистанцию с высотой, азимут с возвышением).
 * Линейные, сетка 24×24, наследуют цвет текста.
 */
const paths = {
  // линейка: расстояние до цели
  distance: (
    <>
      <path d="M3 8.5h18v7H3z" />
      <path d="M7 8.5v3M11 8.5v2M15 8.5v3M19 8.5v2" />
    </>
  ),
  // компас: азимут
  azimuth: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  // возвышение: угол ствола над горизонтом
  elevation: (
    <>
      <path d="M3 19h18" />
      <path d="M5 19 17 8" />
      <path d="M11 19a6 6 0 0 0-1.6-4.1" />
    </>
  ),
  // секундомер: время полёта
  time: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V9.5M10 3h4" />
    </>
  ),
  // заряд: гильза
  charge: (
    <>
      <path d="M9 3.5h6v3.5l1.2 2.2V20H7.8V9.2L9 7z" />
      <path d="M7.8 16h8.4" />
    </>
  ),
  // навесная траектория: дуга
  trajectory: (
    <>
      <path d="M3 19c3-12 15-12 18 0" />
      <circle cx="3" cy="19" r="0.8" />
      <circle cx="21" cy="19" r="0.8" />
    </>
  ),
  // орудие на холме: высота позиции
  gunHeight: (
    <>
      <path d="M2.5 20.5 8.5 11l3.5 5 2.5-3.2 6.5 7.7z" />
      <path d="M13 6.5 19 3.5" />
      <circle cx="12" cy="7" r="1.3" />
    </>
  ),
  // цель на холме: высота цели
  targetHeight: (
    <>
      <path d="M2.5 20.5 8.5 11l3.5 5 2.5-3.2 6.5 7.7z" />
      <circle cx="16.5" cy="6.5" r="3.2" />
      <path d="M16.5 2.5v2M16.5 8.5v2M12.5 6.5h2M18.5 6.5h2" />
    </>
  ),
  // орудие
  weapon: (
    <>
      <path d="M4 17.5 16.5 6.5l2.2 2.4L7.5 19.5z" />
      <path d="M2.5 20.5h8" />
      <path d="M17.5 5.5 20.5 3" />
    </>
  ),
  // снаряд
  shell: (
    <>
      <path d="M12 2.5c3 2.5 4 5.5 4 8.5v8.5H8V11c0-3 1-6 4-8.5z" />
      <path d="M8 15.5h8" />
    </>
  ),
  // ветер
  wind: (
    <>
      <path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M3 13.5h15a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M3 18h7" />
    </>
  ),
  // направление ветра: стрелка по кругу
  windDirection: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 17V7M8.5 10.5 12 7l3.5 3.5" />
    </>
  ),
  temperature: (
    <>
      <path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z" />
      <path d="M12 9v7" />
    </>
  ),
  pressure: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m12 12 3.5-3.5" />
      <path d="M7.5 15.5h9" />
    </>
  ),
  // карта: координаты сетки
  grid: (
    <>
      <path d="M3.5 3.5h17v17h-17z" />
      <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" />
    </>
  ),
  // поправка: смещение разрыва
  correction: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
    </>
  ),
  // наблюдатель
  observer: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 7.7-1.5" />
    </>
  ),
  // дистанция между выстрелами / перезарядка
  reload: (
    <>
      <path d="M20 11a8 8 0 1 0-1.6 5.6" />
      <path d="M20.5 4.5V11H14" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type FieldIconName = keyof typeof paths

export function FieldIcon({
  name,
  className = 'h-4 w-4',
}: {
  name: FieldIconName
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {paths[name]}
    </svg>
  )
}
