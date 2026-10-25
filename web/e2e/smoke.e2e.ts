import { expect, test, type Page } from '@playwright/test'

/**
 * Смоук-тесты собранного сайта: главное работает от начала до конца.
 * Ошибки в консоли и необработанные исключения роняют тест.
 */

async function open(page: Page, path = '/', storage: Record<string, string> = {}) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.addInitScript((values) => {
    // Без обучения при первом запуске; язык и карта — заданные тестом
    localStorage.setItem('tourDone', 'yes')
    localStorage.setItem('tourAdvancedDone', 'yes')
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
  }, { language: 'en', mapWorld: 'builtin:stratis', ...storage })
  await page.goto(path)
  return errors
}

test('главная открывается без ошибок', async ({ page }) => {
  // MQTT (~330 КБ) нужен только для связки — при обычном открытии не грузится
  const scripts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url())
  })
  const errors = await open(page)
  await expect(page.getByText('Elevation', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Fire/ }).first()).toBeVisible()
  await expect(page.locator('#calc-distance')).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(scripts.filter((url) => /mqtt/i.test(url))).toEqual([])
  expect(errors).toEqual([])
})

test('расчёт по введённой дистанции даёт возвышение', async ({ page }) => {
  const errors = await open(page, '/', { selectedModel: 'mk6' })
  await page.locator('#calc-distance').fill('1000')
  const elevation = page.locator('.row', { hasText: 'Elevation' }).first()
  // Число в мил появляется (анимация цифр — ждём, пока не станет числом)
  await expect(elevation).toContainText(/\d{3,4}/, { timeout: 10_000 })
  expect(errors).toEqual([])
})

test('карта загружается, клики ставят орудие и цель', async ({ page, isMobile }) => {
  test.skip(isMobile, 'правая кнопка мыши — только на компьютере')
  const errors = await open(page)
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('no gun', { exact: false })).toBeVisible()
  const box = (await canvas.boundingBox())!
  // Stratis: остров в середине карты
  await canvas.click({ position: { x: box.width * 0.45, y: box.height * 0.5 } })
  await canvas.click({ position: { x: box.width * 0.55, y: box.height * 0.45 }, button: 'right' })
  await expect(page.locator('#calc-distance')).not.toHaveValue('', { timeout: 10_000 })
  const distance = Number(await page.locator('#calc-distance').inputValue())
  expect(distance).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('смена языка переводит интерфейс', async ({ page }) => {
  const errors = await open(page)
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('option', { name: /Deutsch/ }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByText('Erhöhung', { exact: false }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('настройки открываются и возвращают назад', async ({ page }) => {
  const errors = await open(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('switch').first()).toBeVisible()
  await page.getByRole('button', { name: /Back/ }).click()
  await expect(page.locator('#calc-distance')).toBeVisible()
  expect(errors).toEqual([])
})

test('сбой приложения — экран ошибки вместо белой страницы', async ({ page }) => {
  await open(page, '/?crashtest=app')
  await expect(page.getByRole('alert')).toContainText('Something broke')
  await expect(page.getByRole('button', { name: /Reload/ })).toBeVisible()
})

test('сбой карты не ломает калькулятор', async ({ page }) => {
  await open(page, '/?crashtest=map')
  await expect(page.getByRole('alert')).toContainText('The map did not open')
  await expect(page.locator('#calc-distance')).toBeVisible()
})

test('у орудия виден статус проверки таблиц', async ({ page }) => {
  const errors = await open(page)
  const badge = page.locator('[data-status]').first()
  await expect(badge).toBeVisible()
  await expect(badge).toHaveAttribute('aria-label', /verified in game/)
  expect(errors).toEqual([])
})

test('панель рисования и слой карты на месте', async ({ page }) => {
  const errors = await open(page)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Drawing' }).click()
  await expect(page.getByRole('button', { name: 'Pencil' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Straight line' })).toBeVisible()
  await page.getByRole('button', { name: 'Show the topographic map' }).click()
  await expect(page.getByRole('button', { name: 'Show the satellite image' })).toBeVisible()
  expect(errors).toEqual([])
})

test('справка открывается из меню «Обучение»', async ({ page }) => {
  const errors = await open(page)
  await page.getByRole('button', { name: /Tutorial/ }).click()
  await page.getByRole('option', { name: /Help and FAQ/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Help' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Why did the shell miss?')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(errors).toEqual([])
})
