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
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  // орудие на карте: синяя точка с кольцом
  gun: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="8" />
    </>
  ),
  // цель: перекрестие
  target: (
    <>
      <circle cx="12" cy="12" r="6" />
      <path d="M12 2.5v4.5M12 17v4.5M2.5 12H7M17 12h4.5" />
    </>
  ),
  // метка: булавка
  marker: (
    <>
      <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11 6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  // огневая линия: ломаная с точками
  line: (
    <>
      <path d="M4 18 10 9l5 6 5-9" />
      <circle cx="4" cy="18" r="1.3" />
      <circle cx="20" cy="6" r="1.3" />
    </>
  ),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  fire: (
    <>
      <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.3 2-4.5.3 1.2.9 2 1.8 2.5C10.6 8 10.8 5.5 12 3z" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  soundOff: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </>
  ),
  // Боевой экран: монитор с прицелом (не путать с «Вся» — рамкой по углам)
  combat: (
    <>
      <rect x="3" y="4.5" width="18" height="12.5" rx="2" />
      <circle cx="12" cy="10.75" r="3" />
      <path d="M12 7.5v1.2M12 12.8V14M8.75 10.75H10M14 10.75h1.25M8 20.5h8M12 17v3.5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  import: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  export: <path d="M12 15V4M7 9l5-5 5 5M5 20h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  undo: <path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 9h6v6H9z" />,
  map: (
    <>
      <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  weather: (
    <path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5a4.8 4.8 0 0 1 0 9.5z" />
  ),
  table: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 10h17M3.5 15h17M9.5 4.5v15" />
    </>
  ),
  journal: (
    <>
      <path d="M6 3.5h12v17H6z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  stack: (
    <>
      <path d="m12 4 9 4.5-9 4.5-9-4.5z" />
      <path d="m3 13 9 4.5 9-4.5M3 17l9 4.5 9-4.5" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  flare: (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />,
  starFilled: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="currentColor" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9M12 16.8h.01" />
    </>
  ),
  desktop: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M9 20.5h6M12 16.5v4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" />
    </>
  ),
  steam: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="15.2" cy="9.4" r="2.4" />
      <circle cx="9.2" cy="14.6" r="1.8" />
      <path d="m10.6 13.5 3-2.4" />
    </>
  ),
  // Лучший заряд: весы — золотая середина между скоростью и точностью
  balance: (
    <>
      <path d="M12 4v16M7 20h10M5 7.5h14" />
      <path d="M7.5 7.5 4.5 14h6zM16.5 7.5 13.5 14h6z" />
    </>
  ),
  // Траектории: навесная — крутая дуга, настильная — пологая, авто — обе
  trajectoryHigh: <path d="M3 19C6 4.5 18 4.5 21 19" />,
  trajectoryLow: <path d="M3 18c4-6 14-6 18 0" />,
  trajectoryAuto: (
    <>
      <path d="M3 19C6 5 18 5 21 19" />
      <path d="M6.5 18.5c3-5 8-5 11 0" strokeDasharray="2 2.4" />
    </>
  ),
  // Обучение
  book: (
    <>
      <path d="M12 6.5C10.5 5 8 4.5 4.5 4.5v13c3.5 0 6 .5 7.5 2 1.5-1.5 4-2 7.5-2v-13C16 4.5 13.5 5 12 6.5z" />
      <path d="M12 6.5v13" />
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
