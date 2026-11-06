import { expect, test, type Page } from '@playwright/test';
import { newProject, signup } from './helpers';

async function runCommand(page: Page, query: string, name: RegExp) {
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Buscar comandos' });
  await expect(input).toBeFocused();
  await input.fill(query);
  await page.getByRole('option', { name }).first().click();
  await expect(input).toBeHidden();
}
const blur = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).backdropFilter);
const accent = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());

test.describe('vidro e aparência', () => {
  test('botões, barra superior e diálogos têm desfoque de vidro de verdade', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Vidro');
    expect(await blur(page, '[data-testid="topbar"]')).toContain('blur');
    expect(await blur(page, '[data-testid="status-bar"]')).toContain('blur');
    expect(await blur(page, '.btn')).toContain('blur');
    await page.keyboard.press('Control+k');
    expect(await blur(page, '[role="dialog"][aria-label="Paleta de comandos"]')).toContain('blur');
    // o botão principal é um vidro tingido com a cor de destaque
    const bg = await page.locator('.btn-primary').first().evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('linear-gradient');
  });

  test('a cor de destaque muda na hora, vale nos dois temas e continua depois de recarregar', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Cor');
    expect(await accent(page)).toBe('53 208 196');
    await runCommand(page, 'cor de destaque violeta', /Cor de destaque: Violeta/);
    await expect.poll(() => accent(page)).toBe('167 139 250');
    await page.getByTestId('theme-toggle').click();
    await expect.poll(() => accent(page)).toBe('109 40 217'); // violeta do tema claro, com mais contraste
    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect.poll(() => accent(page)).toBe('109 40 217');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'violet');
    await runCommand(page, 'cor de destaque verde', /Cor de destaque: Verde-água/);
    await expect(page.locator('html')).not.toHaveAttribute('data-accent', /.+/);
  });

  test('o modo sólido tira o desfoque, avisa, e a escolha é lembrada', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Sólido');
    await runCommand(page, 'vidro superfícies sólidas', /Vidro: Superfícies sólidas/);
    await expect(page.getByText('Superfícies sólidas: ligado')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'solid');
    expect(await blur(page, '[data-testid="topbar"]')).toBe('none');
    expect(await blur(page, '.btn')).toBe('none');
    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'solid');
    await runCommand(page, 'vidro sempre ligado', /Vidro: Vidro sempre ligado/);
    await expect(page.locator('html')).not.toHaveAttribute('data-glass', /.+/);
    expect(await blur(page, '[data-testid="topbar"]')).toContain('blur');
  });

  test('"seguir o sistema" respeita o pedido de menos transparência; o padrão ignora', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Sistema');
    const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches);
    // padrão: vidro sempre, mesmo que o sistema peça menos transparência
    expect(await blur(page, '[data-testid="topbar"]')).toContain('blur');
    await runCommand(page, 'vidro seguir o sistema', /Vidro: Seguir o sistema/);
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'auto');
    if (reduced) expect(await blur(page, '[data-testid="topbar"]')).toBe('none');
    else expect(await blur(page, '[data-testid="topbar"]')).toContain('blur');
  });

  test('a regra de "reduzir transparência" do sistema está no CSS carregado', async ({ page }) => {
    // o Chrome ainda não permite emular prefers-reduced-transparency: confere que a regra existe de fato nas folhas de estilo
    await page.goto('/login');
    const hasRule = await page.evaluate(() => [...document.styleSheets].some((s) => [...s.cssRules].some((r) => r instanceof CSSMediaRule && r.conditionText.includes('prefers-reduced-transparency'))));
    expect(hasRule).toBe(true);
  });
});
