import { expect, test } from '@playwright/test';
import { PASSWORD, makeMedia, newProject, signup, uploadAndWait, type Media } from './helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

test.describe('login: senha e Caps Lock', () => {
  test('o botão mostra e oculta o que foi digitado, sem atrapalhar o rótulo "Senha"', async ({ page }) => {
    await page.goto('/login');
    const field = page.getByLabel('Senha');
    await expect(field).toHaveAttribute('type', 'password');
    await field.fill(PASSWORD);
    const toggle = page.getByTestId('reveal-password');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(field).toHaveAttribute('type', 'text');
    await expect(field).toHaveValue(PASSWORD);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(field).toHaveAttribute('type', 'password');
  });

  test('avisa quando o Caps Lock está ligado e some quando desliga', async ({ page }) => {
    await page.goto('/login');
    const field = page.getByLabel('Senha');
    await expect(page.getByTestId('caps-warning')).toHaveCount(0);
    await field.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, modifierCapsLock: true })));
    await expect(page.getByTestId('caps-warning')).toBeVisible();
    await field.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true, modifierCapsLock: false })));
    await expect(page.getByTestId('caps-warning')).toHaveCount(0);
  });

  test('trocar de tema liga a transição suave por um instante e depois a retira', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await page.getByTestId('landing-theme').click();
    await expect(html).toHaveClass(/theme-fade/);
    await expect(html).not.toHaveClass(/theme-fade/, { timeout: 2_000 });
    await expect(html).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('editor: paleta e barra de estado', () => {
  test('a paleta destaca o termo buscado, mostra os atalhos e a contagem', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Layout');
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox', { name: 'Buscar comandos' });
    await expect(page.getByTestId('palette-count')).toContainText('comandos');
    const total = Number(((await page.getByTestId('palette-count').textContent()) ?? '').split(' ')[0]);
    await input.fill('exportar');
    await expect(page.getByTestId('command-list').locator('mark').first()).toHaveText(/exportar/i);
    const filtered = Number(((await page.getByTestId('palette-count').textContent()) ?? '').split(' ')[0]);
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
    await expect(page.getByRole('dialog', { name: 'Paleta de comandos' }).getByText('navegar')).toBeVisible();
    await input.fill('zzzz-nada');
    await expect(page.getByTestId('palette-count')).toHaveText('0 comandos');
    await page.keyboard.press('Escape');
    await expect(input).toBeHidden();
  });

  test('com vários clipes selecionados a barra de estado soma o tempo e mostra o intervalo coberto', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Seleção');
    const red = await uploadAndWait(page, media.red);
    const blue = await uploadAndWait(page, media.blue);
    await red.dblclick();
    await blue.dblclick();
    await expect(page.locator('[data-clip-id]')).toHaveCount(2);
    await page.evaluate(() => {
      const st = window.__editor.getState() as unknown as { select(ids: string[]): void; project: { tracks: Array<{ clips: Array<{ id: string }> }> } };
      st.select(st.project.tracks.flatMap((t) => t.clips.map((c) => c.id)));
    });
    await expect(page.getByTestId('status-selected')).toContainText('2 selecionados');
    await expect(page.getByTestId('status-selected')).toContainText('8,0 s em 8,0 s');
  });
});
