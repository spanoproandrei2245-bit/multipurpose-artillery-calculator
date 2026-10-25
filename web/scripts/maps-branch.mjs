#!/usr/bin/env node
/**
 * Карты (public/maps, ~100 МБ) живут не в основной истории git, а в отдельной
 * ветке maps из одного коммита: при обновлении она перезаписывается целиком,
 * поэтому репозиторий не растёт от каждого переимпорта карт.
 *
 *   npm run maps:pull     — скачать карты из ветки maps в public/maps (после клонирования)
 *   npm run maps:publish  — заменить ветку maps содержимым public/maps
 *
 * Сборка сайта в CI берёт карты из этой ветки (см. .github/workflows).
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('..', import.meta.url))
const MAPS = join(WEB, 'public', 'maps')
const BRANCH = 'maps'

const git = (args, cwd = WEB) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const command = process.argv[2]

if (command === 'publish') {
  if (!existsSync(join(MAPS, 'index.json'))) {
    console.error('Нет public/maps/index.json — нечего публиковать.')
    process.exit(1)
  }
  const remote = git(['remote', 'get-url', 'origin'])
  const name = git(['config', 'user.name'])
  const email = git(['config', 'user.email'])
  const dir = mkdtempSync(join(tmpdir(), 'maps-branch-'))
  cpSync(MAPS, dir, { recursive: true })
  git(['init', '-q', '-b', BRANCH], dir)
  git(['add', '-A'], dir)
  git(['-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-q', '-m', `maps: ${readdirSync(MAPS).filter((f) => !f.includes('.')).length} maps`], dir)
  console.log(`публикую ветку ${BRANCH} в ${remote}…`)
  execFileSync('git', ['push', '--force', remote, `${BRANCH}:${BRANCH}`], { cwd: dir, stdio: 'inherit' })
  rmSync(dir, { recursive: true, force: true })
  console.log('готово')
} else if (command === 'pull') {
  // archive из подпапки web/ взял бы только web/… — запускаем от корня репозитория
  const root = git(['rev-parse', '--show-toplevel'])
  git(['fetch', '--depth=1', 'origin', BRANCH], root)
  const work = mkdtempSync(join(tmpdir(), 'maps-pull-'))
  const tar = join(work, 'maps.tar')
  const out = join(work, 'maps')
  git(['archive', '--format=tar', '-o', tar, 'FETCH_HEAD'], root)
  mkdirSync(out)
  // Относительные пути: GNU tar принимает «C:\…» за адрес удалённой машины
  execFileSync('tar', ['-xf', 'maps.tar', '-C', 'maps'], { cwd: work, stdio: 'inherit' })
  // Старые карты заменяются, только если новые действительно распаковались
  if (!existsSync(join(out, 'index.json'))) {
    console.error('В ветке maps нет index.json — public/maps не тронута.')
    process.exit(1)
  }
  rmSync(MAPS, { recursive: true, force: true })
  cpSync(out, MAPS, { recursive: true })
  rmSync(work, { recursive: true, force: true })
  console.log(`карты из ветки ${BRANCH} → ${MAPS}`)
} else {
  console.error('команды: pull | publish')
  process.exit(1)
}
