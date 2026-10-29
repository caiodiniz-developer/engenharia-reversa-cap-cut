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
    const dds = stats.locator('dd');
    await expect(dds).toHaveCount(6);
    // os valores finais (lidos do código do editor) estão no atributo; o número visível sobe até eles ao aparecer
    const finals = await dds.evaluateAll((els) => els.map((e) => e.getAttribute('data-value')));
    for (const v of finals) expect(Number(v)).toBeGreaterThan(0);
    await stats.scrollIntoViewIfNeeded();
    for (let i = 0; i < 6; i++) await expect(dds.nth(i)).toHaveText(finals[i]!, { timeout: 5_000 });
  });

  test('os números começam em zero e só sobem quando a faixa aparece', async ({ page }) => {
    await page.goto('/');
    const first = page.getByTestId('stats').locator('dd').first();
    // no topo da página a faixa ainda não foi vista
    await expect(first).toHaveText('0');
    await page.getByTestId('stats').scrollIntoViewIfNeeded();
    await expect(first).not.toHaveText('0', { timeout: 5_000 });
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

test.describe('landing: animações do topo e dos cartões', () => {
  test('a palavra da chamada alterna sozinha', async ({ page }) => {
    await page.goto('/');
    const word = page.getByTestId('rotating-word');
    await expect(word).toHaveText('legendas');
    await expect(word).not.toHaveText('legendas', { timeout: 6_000 });
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      seen.add((await word.textContent())!.trim());
      await page.waitForTimeout(2400);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  test('com menos movimento a palavra fica parada', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const word = page.getByTestId('rotating-word');
    await expect(word).toHaveText('legendas');
    await page.waitForTimeout(3000);
    await expect(word).toHaveText('legendas');
  });

  test('a faixa de efeitos lista nomes reais, duplicados só para a animação (invisíveis a leitores de tela)', async ({ page }) => {
    await page.goto('/');
    const lists = page.getByTestId('marquee').locator('ul');
    await expect(lists).toHaveCount(2);
    await expect(lists.nth(1)).toHaveAttribute('aria-hidden', 'true');
    await expect(lists.first().getByRole('listitem').filter({ hasText: 'Brilho' })).toHaveCount(1);
    await expect(lists.first().getByRole('listitem').filter({ hasText: 'Dissolver' })).toHaveCount(1);
    const run = await page.getByTestId('marquee').locator('.marquee-track').evaluate((el) => getComputedStyle(el).animationName);
    expect(run).toBe('marquee-run');
  });

  test('o cartão de recurso acompanha o cursor com a luz', async ({ page }) => {
    await page.goto('/');
    const card = page.getByTestId('features').getByTestId('feature-card').first();
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 30);
    await page.mouse.move(box.x + 120, box.y + 70);
    // o cartão sobe alguns pixels ao receber o mouse, então a posição é aproximada
    const pos = (v: string) => card.evaluate((el, name) => parseFloat((el as HTMLElement).style.getPropertyValue(name)), v);
    await expect.poll(async () => Math.abs((await pos('--mx')) - 120), { timeout: 3_000 }).toBeLessThan(8);
    expect(Math.abs((await pos('--my')) - 70)).toBeLessThan(8);
  });

  test('a ilustração do hero inclina com o mouse e volta ao centro', async ({ page }) => {
    await page.goto('/');
    const mock = page.getByTestId('product-mock');
    await mock.scrollIntoViewIfNeeded();
    const box = (await mock.boundingBox())!;
    const tilt = page.getByTestId('tilt');
    const matrix = () => tilt.evaluate((el) => getComputedStyle(el).transform);
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1);
    await expect.poll(matrix, { timeout: 3_000 }).not.toBe('none');
    await page.mouse.move(2, 2);
    // ao sair, a inclinação volta a zero: sem transformação ou matriz identidade nos eixos X e Y
    await expect
      .poll(async () => {
        const m = await matrix();
        return m === 'none' || /^matrix3d\(1, 0, 0, 0, 0, 1, /.test(m);
      }, { timeout: 4_000 })
      .toBe(true);
  });
});

test.describe('landing: laboratório interativo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('lab').scrollIntoViewIfNeeded();
  });

  test('revisão ao vivo: 3 problemas reais, correção em um clique e a nota sobe até 100', async ({ page }) => {
    const issues = page.getByTestId('demo-issue');
    await expect(issues).toHaveCount(3);
    const score = page.getByTestId('demo-score');
    await expect(score).toHaveAttribute('data-value', '85');
    await expect(score).toHaveText('85', { timeout: 5_000 });

    const lefts = () => page.getByTestId('demo-clip').evaluateAll((els) => els.map((e) => (e as HTMLElement).style.left));
    const before = await lefts();
    await page.getByTestId('demo-fix-gap').click();
    await expect(issues).toHaveCount(2);
    await expect(score).toHaveAttribute('data-value', '90');
    await expect(score).toHaveText('90', { timeout: 5_000 });
    await expect.poll(async () => JSON.stringify(await lefts()), { timeout: 5_000 }).not.toBe(JSON.stringify(before)); // os clipes deslizaram

    await page.getByTestId('demo-fix-hidden-has-clips').click();
    await page.getByTestId('demo-fix-caption-fast').click();
    await expect(issues).toHaveCount(0);
    await expect(page.getByTestId('demo-clean')).toBeVisible();
    await expect(score).toHaveText('100', { timeout: 5_000 });

    await page.getByTestId('demo-reset').click();
    await expect(issues).toHaveCount(3);
    await expect(score).toHaveAttribute('data-value', '85');
  });

  test('abas: clique e setas trocam a demonstração e atualizam a dica', async ({ page }) => {
    const tab = (id: string) => page.getByTestId('lab-tab-' + id);
    await expect(tab('revisao')).toHaveAttribute('aria-selected', 'true');
    await tab('revisao').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab('zonas')).toHaveAttribute('aria-selected', 'true');
    await expect(tab('zonas')).toBeFocused();
    await expect(page.getByTestId('demo-safe')).toBeVisible();
    await expect(page.getByTestId('demo-review')).toHaveCount(0);
    await page.keyboard.press('End');
    await expect(tab('visao')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('lab-hint')).toContainText('mesma paleta');
    await page.keyboard.press('ArrowRight'); // dá a volta
    await expect(tab('revisao')).toHaveAttribute('aria-selected', 'true');
    await tab('ritmo').click();
    await expect(page.getByTestId('demo-pacing')).toBeVisible();
  });

  test('zonas seguras: a legenda começa coberta, a sugestão a põe na área livre e o veredito muda', async ({ page }) => {
    await page.getByTestId('lab-tab-zonas').click();
    const caption = page.getByTestId('demo-caption');
    await expect(caption).toHaveAttribute('data-inside', 'false');
    await expect(page.getByTestId('demo-verdict')).toContainText('Coberta pela interface');
    await page.getByTestId('demo-suggest').click();
    await expect(caption).toHaveAttribute('data-inside', 'true');
    await expect(page.getByTestId('demo-verdict')).toContainText('Dentro da zona segura');
    // arrastar o controle para a base volta a cobrir
    await page.getByTestId('demo-y').fill('0.47');
    await expect(caption).toHaveAttribute('data-inside', 'false');
    // trocar de plataforma mantém um veredito coerente com a nova zona
    await page.getByRole('tab', { name: 'Stories' }).click();
    await expect(page.getByTestId('demo-phone')).toContainText('Stories');
  });

  test('daltonismo: as cores mudam e Erro × Sucesso fica difícil de distinguir em deuteranopia', async ({ page }) => {
    await page.getByTestId('lab-tab-visao').click();
    const swatches = page.getByTestId('demo-swatch');
    await expect(swatches).toHaveCount(6); // espera a transição entre abas terminar
    const shown = () => swatches.evaluateAll((els) => els.map((e) => e.getAttribute('data-shown')));
    const normal = await shown();
    expect(normal[0]).toBe('#e11d48');
    await expect(page.getByTestId('demo-vision-verdict')).toContainText('Escolha um tipo de visão');

    await page.getByRole('tab', { name: /Deuteranopia/ }).click();
    const deut = await shown();
    expect(deut).not.toEqual(normal);
    expect(deut[5]).toBeTruthy();
    await expect(page.getByTestId('demo-confused').filter({ hasText: 'Erro × Sucesso' })).toHaveCount(1);

    await page.getByRole('tab', { name: /Acromatopsia/ }).click();
    for (const hex of await shown()) expect(hex!.slice(1, 3) === hex!.slice(3, 5) && hex!.slice(3, 5) === hex!.slice(5, 7)).toBe(true);
    await page.getByRole('tab', { name: /normal/ }).click();
    expect(await shown()).toEqual(normal);
  });

  test('ritmo: o rótulo vai de Frenético a Contemplativo e os planos diminuem', async ({ page }) => {
    await page.getByTestId('lab-tab-ritmo').click();
    const label = page.getByTestId('demo-pacing-label');
    const shots = async () => Number(await page.getByTestId('demo-shots').textContent());
    await page.getByTestId('demo-avg').fill('0.9');
    await expect(label).toHaveText('Frenético');
    const many = await shots();
    await page.getByTestId('demo-avg').fill('9');
    await expect(label).toHaveText('Contemplativo');
    await expect(page.getByTestId('demo-avg-value')).toHaveText('9 s');
    expect(await shots()).toBeLessThan(many / 4);
  });

  test('paleta: digita sozinha, para quando você clica e busca nos comandos reais', async ({ page }) => {
    await page.getByTestId('lab-tab-paleta').click();
    const input = page.getByTestId('demo-palette-input');
    const items = page.getByTestId('demo-palette-item');
    await expect(items.first()).toBeVisible();
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      seen.add(await input.inputValue());
      await page.waitForTimeout(350);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3); // o texto está mudando sozinho

    await input.click();
    const frozen = await input.inputValue();
    await page.waitForTimeout(600);
    expect(await input.inputValue()).toBe(frozen); // parou de digitar sozinho

    await input.fill('dividir');
    await expect(items.first()).toContainText('Dividir clipe');
    await expect(page.locator('[data-testid="demo-palette-item"][data-id="split"]')).toHaveCount(1);
    await input.fill('exportação');
    await expect(page.locator('[data-testid="demo-palette-item"][data-id="export"]')).toHaveCount(1);
    await input.fill('zzzz-nada');
    await expect(page.getByTestId('demo-palette-empty')).toBeVisible();
    await input.fill('');
    await expect(items).toHaveCount(6); // sem texto, os mais populares
  });

  test('com menos movimento o laboratório responde sem animação', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.getByTestId('lab').scrollIntoViewIfNeeded();
    await page.getByTestId('demo-fix-gap').click();
    await expect(page.getByTestId('demo-issue')).toHaveCount(2);
    await expect(page.getByTestId('demo-score')).toHaveText('90', { timeout: 2_000 });
  });

  test('o item Experimente do menu leva ao laboratório', async ({ page }) => {
    await page.getByTestId('landing').evaluate((el) => el.scrollTo(0, 0));
    await page.getByTestId('landing-header').getByRole('button', { name: 'Experimente' }).click();
    await expect.poll(() => page.locator('#experimente').evaluate((el) => el.getBoundingClientRect().top), { timeout: 5_000 }).toBeLessThan(160);
  });
});

test.describe('landing: animações ligadas à rolagem', () => {
  test('barra de progresso acompanha a leitura e o botão de topo volta ao início', async ({ page }) => {
    await page.goto('/');
    const scale = () => page.getByTestId('scroll-progress').evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
    expect(await scale()).toBeLessThan(0.05);
    await expect(page.getByTestId('back-to-top')).toHaveCount(0);

    await page.getByTestId('landing').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect.poll(scale, { timeout: 5_000 }).toBeGreaterThan(0.9);
    const back = page.getByTestId('back-to-top');
    await expect(back).toBeVisible();
    await back.click();
    await expect.poll(async () => page.getByTestId('landing').evaluate((el) => el.scrollTop), { timeout: 5_000 }).toBeLessThan(5);
    await expect(back).toHaveCount(0);
    await expect.poll(scale, { timeout: 5_000 }).toBeLessThan(0.05);
  });

  test('a barra de cadastro do celular não existe no computador', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('landing').evaluate((el) => el.scrollTo(0, 1500));
    await expect(page.getByTestId('mobile-cta')).toBeHidden();
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

  test('a barra de cadastro aparece depois de rolar e leva ao cadastro', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('mobile-cta')).toHaveCount(0);
    await page.getByTestId('landing').evaluate((el) => el.scrollTo(0, 1500));
    const bar = page.getByTestId('mobile-cta');
    await expect(bar).toBeVisible();
    await bar.getByRole('link', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/modo=cadastro/);
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
