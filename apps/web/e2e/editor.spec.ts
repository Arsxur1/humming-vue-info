/**
 * Ворота Этапа 6 (docs/PLAN.md): собрать 3-сценный проект в редакторе
 * и отправить в рендер — через настоящий UI, api и worker.
 */
import { expect, test } from '@playwright/test';

const uniq = Date.now();
const EMAIL = `editor-${uniq}@example.com`;
const PASSWORD = 'editor-pass-123';

test('редактор: 3 сцены → разметка → рендер → готовое видео', async ({ page }) => {
  // Регистрация
  await page.goto('/login');
  await page.getByTestId('auth-toggle').click();
  await page.getByTestId('name-input').fill('Editor E2E');
  await page.getByTestId('email-input').fill(EMAIL);
  await page.getByTestId('password-input').fill(PASSWORD);
  await page.getByTestId('auth-submit').click();

  // Создание проекта
  await page.getByTestId('new-project-title').fill('Playwright проект');
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('editor-canvas')).toBeVisible({ timeout: 20_000 });

  // Три сцены со скриптами
  const scripts = [
    'Первая сцена нашего ролика.',
    'Вторая сцена с важным содержанием.',
    'Третья финальная сцена.',
  ];
  for (const [i, script] of scripts.entries()) {
    await page.getByTestId('add-scene').click();
    await page.getByTestId(`scene-item-${i}`).click();
    await page.getByTestId('script-input').fill(script);
  }

  // Director Markup кнопками: пауза + ударение на выделении
  await page.getByTestId('scene-item-0').click();
  const scriptInput = page.getByTestId('script-input');
  await scriptInput.focus();
  await page.keyboard.press('End');
  await page.getByTestId('markup-pause').click();
  await expect(scriptInput).toHaveValue(/\[pause:0\.5s\]/);
  await page.getByTestId('markup-breath').click();
  await expect(scriptInput).toHaveValue(/\[breath\]/);
  await expect(page.getByTestId('markup-error')).toHaveCount(0);

  // Текстовый слой на canvas
  await page.getByTestId('add-text-layer').click();
  await page.getByTestId('layer-text').fill('Заголовок ролика');

  // Мультиформат: переключение 9:16 и обратно
  await page.getByTestId('aspect-9x16').click();
  await expect(page.getByTestId('aspect-9x16')).not.toHaveClass(/ghost/);
  await page.getByTestId('aspect-16x9').click();

  // Ждём автосохранение
  await expect(page.getByTestId('save-state')).toHaveText('Сохранено', { timeout: 15_000 });

  // Превью одной сцены (бесплатно) → плеер
  await page.getByTestId('preview-scene').click();
  await expect(page.getByTestId('render-dialog')).toBeVisible();
  await expect(page.getByTestId('render-video')).toBeVisible({ timeout: 90_000 });
  await page.locator('.render-dialog button.ghost').click();

  // Полный рендер проекта
  await page.getByTestId('start-render').click();
  await expect(page.getByTestId('render-dialog')).toBeVisible();
  await expect(page.getByTestId('render-status')).toHaveText('done', { timeout: 120_000 });
  const video = page.getByTestId('render-video');
  await expect(video).toBeVisible();
  const src = await video.getAttribute('src');
  expect(src).toBeTruthy();
});
