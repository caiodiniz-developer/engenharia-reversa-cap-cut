import { expect, test } from '@playwright/test';
import { PASSWORD, signup, uniqueEmail } from './helpers';

test.describe('landing page', () => {
  test('visitante vê a landing na raiz (e não a tela de login)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('sem instalar nada');
    await expect(page.getByRole('tab', { name: 'Entrar' })).toHaveCount(0);
    await expect(page).toHaveTitle(/Editor de Vídeo/);
    // seções principais presentes
    for (const id of ['recursos', 'diferenciais', 'como-funciona', 'perguntas']) await expect(page.locator(`#${id}`)).toBeAttached();
    await expect(page.getByTestId('features').getByTestId('feature-card')).toHaveCount(9);
    await expect(page.getByTestId('differentials').getByTestId('feature-card')).toHaveCount(8);
    await expect(page.getByTestId('product-mock')).toBeVisible();
  });

  test('mostra as plataformas conferidas pela revisão e define a descrição da página', async ({ page }) => {
    await page.goto('/');
    const chips = page.getByTestId('platform-chip');
    await expect(chips).toHaveCount(7);
    await expect(chips.filter({ hasText: 'YouTube Shorts' })).toContainText('9:16');
    await expect(chips.filter({ hasText: 'YouTube (horizontal)' })).toContainText('16:9');
    await expect(chips.filter({ hasText: 'Feed quadrado' })).toContainText('1:1');
    await expect(chips.filter({ hasText: 'Feed retrato' })).toContainText('4:5');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Editor de vídeo no navegador/);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'pt_BR');
  });

  test('"Criar conta" abre a tela de login já na aba de cadastro; "Já tenho conta" abre em Entrar', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('hero-signup').click();
    await expect(page).toHaveURL(/\/login\?modo=cadastro/);
    await expect(page.getByRole('tab', { name: 'Criar conta' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Nome')).toBeVisible();

    await page.goto('/');
    await page.getByTestId('hero-login').click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('tab', { name: 'Entrar' })).toHaveAttribute('aria-selected', 'true');
  });

  test('cabeçalho e chamada final levam ao cadastro e ao login', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('header-login').click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goBack();
    await page.getByTestId('header-signup').click();
    await expect(page).toHaveURL(/modo=cadastro/);
    await page.goBack();
    await page.getByTestId('cta-signup').scrollIntoViewIfNeeded();
    await page.getByTestId('cta-signup').click();
    await expect(page).toHaveURL(/modo=cadastro/);
  });

  test('"Voltar ao início" da tela de login retorna à landing', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('back-home').click();
    await expect(page.getByTestId('landing')).toBeVisible();
  });

  test('menu de seções rola até a seção escolhida', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('landing-header').getByRole('button', { name: 'Perguntas' }).click();
    const top = async () => page.locator('#perguntas').evaluate((el) => el.getBoundingClientRect().top);
    await expect.poll(top, { timeout: 5_000 }).toBeLessThan(160);
    await expect(page.locator('#perguntas')).toBeInViewport();
    await expect(page.locator('#perguntas')).toBeFocused();
  });

  test('perguntas frequentes: abre uma por vez', async ({ page }) => {
    await page.goto('/');
    const faq = page.getByTestId('faq');
    const q = (i: number) => faq.locator(`#faq-q-${i}`);
    await faq.scrollIntoViewIfNeeded();
    await expect(q(0)).toHaveAttribute('aria-expanded', 'true');
    await q(1).click();
    await expect(q(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(q(0)).toHaveAttribute('aria-expanded', 'false');
    await expect(faq.locator('#faq-1')).toBeVisible();
    await expect(faq.locator('#faq-0')).toBeHidden();
    await q(1).click();
    await expect(q(1)).toHaveAttribute('aria-expanded', 'false');
  });

  test('números reais do editor aparecem na faixa de estatísticas', async ({ page }) => {
    await page.goto('/');
    const stats = page.getByTestId('stats');
    await expect(stats).toContainText('efeitos de imagem');
    await expect(stats).toContainText('verificações na revisão');
    const values = await stats.locator('dd').allTextContents();
    expect(values).toHaveLength(6);
    for (const v of values) expect(Number(v)).toBeGreaterThan(0);
  });

  test('tema claro/escuro vale na landing e é lembrado', async ({ page }) => {
    await page.goto('/');
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
    expect(await theme()).toBe('dark');
    await page.getByTestId('landing-theme').click();
    expect(await theme()).toBe('light');
    await page.reload();
    await expect(page.getByTestId('landing')).toBeVisible();
    expect(await theme()).toBe('light');
  });

  test('"Pular para o conteúdo" aparece com o teclado', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });

  test('com menos movimento, o conteúdo aparece sem depender de animação', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByTestId('features').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('features').getByTestId('feature-card').first()).toHaveCSS('opacity', '1');
  });
});

test.describe('landing no celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sem rolagem horizontal; o menu abre, navega e fecha', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.getByTestId('landing').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('hero-signup')).toBeVisible();

    await expect(page.getByTestId('landing-menu')).toHaveCount(0);
    await page.getByTestId('landing-menu-button').click();
    const menu = page.getByTestId('landing-menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Recursos' }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.locator('#recursos')).toBeInViewport();
  });
});

test.describe('landing e sessão', () => {
  test('quem já entrou vê os projetos na raiz, não a landing', async ({ page }) => {
    await signup(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Seus projetos' })).toBeVisible();
    await expect(page.getByTestId('landing')).toHaveCount(0);
  });

  test('fluxo completo: da landing ao cadastro e aos projetos', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('hero-signup').click();
    await page.getByLabel('Nome').fill('Visitante');
    await page.getByLabel('E-mail').fill(uniqueEmail());
    await page.getByLabel('Senha').fill(PASSWORD);
    await page.getByRole('button', { name: 'Criar conta' }).last().click();
    await expect(page.getByRole('heading', { name: 'Seus projetos' })).toBeVisible();
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page.getByTestId('landing')).toBeVisible();
  });
});
