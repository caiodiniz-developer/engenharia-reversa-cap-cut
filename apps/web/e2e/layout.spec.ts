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
    // a classe dura só 350 ms: um observador registra se ela apareceu, sem depender do instante da asserção
    await page.evaluate(() => {
      const w = window as unknown as { __fadeSeen: boolean };
      w.__fadeSeen = false;
      new MutationObserver(() => {
        if (document.documentElement.classList.contains('theme-fade')) w.__fadeSeen = true;
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
    await page.getByTestId('landing-theme').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __fadeSeen: boolean }).__fadeSeen)).toBe(true);
    await expect(html).not.toHaveClass(/theme-fade/, { timeout: 3_000 });
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


test.describe('novidades do editor', () => {
  test('lista as novidades e Experimentar fecha o diálogo e abre a ferramenta', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Novidades');
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox', { name: 'Buscar comandos' });
    await input.fill('novidades do editor');
    await page.getByRole('option', { name: /Novidades do editor/ }).first().click();
    await expect(input).toBeHidden();
    const news = page.getByTestId('news');
    await expect(news).toBeVisible();
    expect(await news.getByTestId('news-item').count()).toBeGreaterThan(10);
    await expect(news.getByRole('heading', { name: /Ferramentas criativas/ })).toBeVisible();
    await news.getByTestId('news-item').filter({ hasText: 'Estatísticas do projeto' }).getByTestId('news-try').click();
    await expect(news).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Estatísticas do projeto' })).toBeVisible();
  });
});


test.describe('biblioteca de mídia', () => {
  test('alterna entre grade e lista e lembra a escolha', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Biblioteca');
    await uploadAndWait(page, media.red);
    await uploadAndWait(page, media.blue);
    const list = page.getByTestId('media-list');
    await expect(list).toHaveAttribute('data-view', 'grid');
    const gridWidth = (await list.locator('> li').first().boundingBox())!.width;
    await page.getByTestId('media-view-list').click();
    await expect(list).toHaveAttribute('data-view', 'list');
    await expect(page.getByTestId('media-view-list')).toHaveAttribute('aria-pressed', 'true');
    const row = (await list.locator('> li').first().boundingBox())!;
    expect(row.width).toBeGreaterThan(gridWidth * 1.5); // a linha ocupa a largura toda
    expect(row.height).toBeLessThan(70);
    await page.reload();
    await expect(page.getByTestId('media-list')).toHaveAttribute('data-view', 'list');
    // continua dando para adicionar à timeline com dois cliques
    await page.getByRole('button', { name: /^vermelho\.mp4/ }).dblclick();
    await expect(page.locator('[data-clip-id]')).toHaveCount(1);
    await page.getByTestId('media-view-grid').click();
    await expect(page.getByTestId('media-list')).toHaveAttribute('data-view', 'grid');
  });
});


test.describe('exportação', () => {
  test('a predefinição escolhida volta na próxima abertura, mesmo depois de recarregar', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Exportar');
    await page.getByRole('button', { name: 'Exportar' }).first().click();
    const preset = page.getByLabel('Predefinição');
    await expect(preset).toBeVisible();
    await preset.selectOption({ label: 'WhatsApp · leve' });
    await expect(preset).toHaveValue('whatsapp');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    await page.getByRole('button', { name: 'Exportar' }).first().click();
    await expect(page.getByLabel('Predefinição')).toHaveValue('whatsapp');
  });
});


test.describe('login: lembrar de mim', () => {
  test('o e-mail volta preenchido depois de sair, e deixa de voltar se a opção for desmarcada', async ({ page }) => {
    const { email, password } = await signup(page);
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.goto('/login');
    await expect(page.getByLabel('E-mail')).toHaveValue('');
    await expect(page.getByTestId('remember-me')).not.toBeChecked();
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByTestId('remember-me').check();
    await page.getByRole('button', { name: 'Entrar' }).last().click();
    await expect(page.getByRole('heading', { name: 'Seus projetos' })).toBeVisible();
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.goto('/login');
    await expect(page.getByLabel('E-mail')).toHaveValue(email);
    await expect(page.getByTestId('remember-me')).toBeChecked();
    await expect(page.getByLabel('Senha')).toHaveValue(''); // a senha nunca é lembrada
    await page.getByLabel('Senha').fill(password);
    await page.getByTestId('remember-me').uncheck();
    await page.getByRole('button', { name: 'Entrar' }).last().click();
    await expect(page.getByRole('heading', { name: 'Seus projetos' })).toBeVisible();
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.goto('/login');
    await expect(page.getByLabel('E-mail')).toHaveValue('');
  });
});


test.describe('biblioteca: busca', () => {
  test('a contagem acompanha o filtro e o botão e o Esc limpam a busca', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Busca');
    await uploadAndWait(page, media.red);
    await uploadAndWait(page, media.blue);
    await expect(page.getByTestId('media-count')).toHaveText('2 itens');
    const search = page.getByLabel('Buscar na biblioteca');
    await search.fill('verm');
    await expect(page.getByTestId('media-count')).toHaveText('1 de 2 itens');
    await page.getByTestId('clear-media-search').click();
    await expect(search).toHaveValue('');
    await expect(page.getByTestId('media-count')).toHaveText('2 itens');
    await search.fill('azu');
    await expect(page.getByTestId('media-count')).toHaveText('1 de 2 itens');
    await search.press('Escape');
    await expect(search).toHaveValue('');
  });
});

test.describe('landing: rodapé', () => {
  test('mostra a nota de projeto independente e o link volta ao topo', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByTestId('landing-footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toContainText('projeto independente, sem código nem recursos de terceiros');
    await expect(footer).toContainText(String(new Date().getFullYear()));
    expect(await page.getByTestId('landing').evaluate((el) => el.scrollTop)).toBeGreaterThan(500);
    await page.getByTestId('footer-top').click();
    await expect.poll(() => page.getByTestId('landing').evaluate((el) => el.scrollTop), { timeout: 5_000 }).toBeLessThan(5);
  });
});


test.describe('paleta: @grupo e favoritos', () => {
  test('@áudio lista só o grupo e favoritar põe o comando no topo, mesmo depois de recarregar', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Paleta');
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox', { name: 'Buscar comandos' });
    await input.fill('@áudio');
    const groups = await page.getByTestId('command-list').locator('li[role="option"] span.rounded').allTextContents();
    expect(groups.length).toBeGreaterThan(5);
    expect(groups.every((g) => g === 'Áudio')).toBe(true);
    await input.fill('@audio fade');
    await expect(page.getByTestId('palette-count')).not.toHaveText('0 comandos');
    // favoritar um comando comum
    await input.fill('tema claro');
    await page.getByTestId('fav-theme').click();
    await expect(page.getByTestId('fav-theme')).toHaveAttribute('aria-pressed', 'true');
    await expect(input).toBeVisible(); // clicar na estrela não executa nem fecha
    await input.fill('');
    await expect(page.getByTestId('command-list').locator('li[role="option"]').first()).toContainText('Alternar tema claro/escuro');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-list').locator('li[role="option"]').first()).toContainText('Alternar tema claro/escuro');
    await expect(page.getByTestId('fav-theme')).toHaveAttribute('aria-pressed', 'true');
  });
});
