export type ShellKind = 'he' | 'illum' | 'smoke'

/** Вид снаряда по обозначению типа из таблиц: HE, ILLUM, SMOKE… */
export function shellKind(type: string): ShellKind {
  if (/ill|flare|star|освет/i.test(type)) return 'illum'
  if (/smoke|smk|\bwp\b|\bhc\b|дым/i.test(type)) return 'smoke'
  return 'he'
}
