# Выпуск новой версии

1. **Версия.** Поднять версию в `web/package.json`, `web/package-lock.json` (`npm version <x.y.z> --no-git-tag-version` в `web/`)
   и `web/src-tauri/Cargo.toml`. Версия попадает в кэш service worker — без неё телефоны не получат обновление.
2. **CHANGELOG.** Добавить раздел `## [x.y.z] — дата` в `CHANGELOG.md`.
3. **Проверки локально** (в `web/`):
   ```bash
   npm run lint
   npm run tables:check
   npm test
   npm run build
   npm run test:e2e
   ```
4. **Карты.** Если карты менялись: `npm run maps:publish` (заменяет ветку `maps`). CI и сайт берут карты оттуда.
5. **PR в `main`.** Ветка → PR, дождаться зелёного «Web CI» (линт, тесты, сборка, смоук-тесты). Слить.
6. **Сайт.** «Deploy to GitHub Pages» запускается сам после слияния и повторяет тесты и смоук-тесты. Проверить сайт (Ctrl+F5).
7. **Программа для ПК.** Один раз: в GitHub → Settings → Secrets and variables → Actions добавить секрет
   `TAURI_SIGNING_PRIVATE_KEY` — содержимое файла `C:\Users\Heis\.tauri\artillery-calculator.key` (приватный ключ подписи
   обновлений, в репозиторий не кладётся; потеряете — установленные программы не смогут обновиться).
   Публичный ключ уже в `web/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). Поставить тег `vx.y.z` на `main` — «Desktop app» соберёт установщик и опубликует GitHub Release
   (с файлами автообновления, если задан секрет `TAURI_SIGNING_PRIVATE_KEY`).
8. **Таблицы.** Орудие, прошедшее проверку стрельбой (серии B и C, см. `TESTING.md`), получает `"status": "verified"`
   в `web/src/data/artillery/<id>.json` — в приложении значок станет зелёным.
