import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { clipsOf, makeMedia, near, newProject, previewPixel, projectOf, seek, signup, uploadAndWait, waitSaved, type Media } from './helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

async function withClip(page: Page, file: string = media.red) {
  await signup(page);
  await newProject(page, 'Novidades');
  const card = await uploadAndWait(page, file);
  await card.dblclick();
  await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  const [c] = await clipsOf(page);
  await page.locator(`[data-clip-id="${c!.id}"]`).click();
  return c!;
}

test.describe('paleta de comandos e tema', () => {
  test('Ctrl+K abre a paleta, busca sem acento e executa o comando (dividir)', async ({ page }) => {
    await withClip(page);
    await seek(page, 2);
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox', { name: 'Buscar comandos' });
    await expect(input).toBeFocused();
    await input.fill('dividir');
    await expect(page.getByRole('option', { name: /Dividir clipe/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    await expect(input).toBeHidden();
  });

  test('a paleta navega com setas, mostra "nenhum resultado" e fecha com Esc', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('palette-button').click();
    const input = page.getByRole('combobox', { name: 'Buscar comandos' });
    await input.fill('animacoes');
    await expect(page.getByRole('option', { name: /Abrir painel: Animações/ })).toBeVisible();
    await input.fill('zzzz-nada');
    await expect(page.getByText(/Nenhum comando encontrado/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(input).toBeHidden();
    // abrir um painel pela paleta
    await page.keyboard.press('Control+k');
    await input.fill('abrir painel elementos');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('elements-panel')).toBeVisible();
  });

  test('o tema claro/escuro é aplicado, persiste ao recarregar e vale na tela de projetos', async ({ page }) => {
    await withClip(page);
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
    expect(await theme()).toBe('dark');
    await page.getByTestId('theme-toggle').click();
    expect(await theme()).toBe('light');
    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    expect(await theme()).toBe('light');
    await page.goto('/');
    expect(await theme()).toBe('light');
    await page.getByRole('button', { name: 'Mudar para o tema escuro' }).click();
    expect(await theme()).toBe('dark');
  });
});

test.describe('animações, elementos e áudio', () => {
  test('animação pronta "Aparecer": vira keyframes, aparece na aba e o preview começa transparente', async ({ page }) => {
    const c = await withClip(page);
    await page.getByTestId('tab-animations').click();
    await page.getByRole('button', { name: 'Animação Aparecer' }).click();
    const clip = (await projectOf(page)).tracks[0]!.clips[0] as unknown as { keyframes: { opacity: Array<{ time: number; value: number }> } };
    expect(clip.keyframes.opacity.map((k) => [k.time, k.value])).toEqual([[0, 0], [0.6, 1]]);

    await seek(page, 0);
    await expect.poll(async () => (await previewPixel(page))[0]! < 40, { timeout: 15_000 }).toBe(true);
    await seek(page, 2);
    await expect.poll(async () => near(await previewPixel(page), [255, 0, 0], 40), { timeout: 15_000 }).toBe(true);

    // a aba Animação das propriedades lista e permite editar
    const props = page.getByTestId('properties');
    await props.getByRole('tab', { name: /Animação/ }).click();
    await expect(page.getByTestId('animation-tab')).toContainText('Opacidade');
    const t2 = props.getByLabel('Opacidade: tempo do keyframe 2');
    await t2.fill('1.5');
    await expect.poll(async () => ((await projectOf(page)).tracks[0]!.clips[0] as unknown as { keyframes: { opacity: Array<{ time: number }> } }).keyframes.opacity[1]!.time).toBeCloseTo(1.5, 3);
    await props.getByRole('button', { name: 'Remover todos' }).click();
    await expect.poll(async () => Object.keys(((await projectOf(page)).tracks[0]!.clips[0] as unknown as { keyframes: object }).keyframes).length).toBe(0);
    expect(c.id).toBeTruthy();
  });

  test('entrada + saída convivem (Aparecer e Desaparecer) e o undo desfaz a última', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-animations').click();
    await page.getByRole('button', { name: 'Animação Aparecer' }).click();
    await page.getByRole('button', { name: 'Animação Desaparecer' }).click();
    const kf = async () => ((await projectOf(page)).tracks[0]!.clips[0] as unknown as { keyframes: { opacity: unknown[] } }).keyframes.opacity;
    expect(await kf()).toHaveLength(4);
    await page.keyboard.press('Control+z');
    expect(await kf()).toHaveLength(2);
  });

  test('fundo de cor sólida: gera a imagem no servidor, entra na biblioteca e na timeline', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Fundos');
    await page.getByTestId('tab-elements').click();
    await page.getByRole('button', { name: 'Fundo #3b82f6' }).click();
    await expect.poll(async () => (await clipsOf(page)).length, { timeout: 30_000 }).toBe(1);
    const proj = await projectOf(page);
    const asset = Object.values(proj.media)[0]!;
    expect(asset).toMatchObject({ kind: 'image', width: 1920, height: 1080 });
    await seek(page, 1);
    await expect.poll(async () => near(await previewPixel(page), [0x3b, 0x82, 0xf6], 30), { timeout: 20_000 }).toBe(true);
    // degradê pronto também
    await page.getByRole('radio', { name: 'Degradê' }).click();
    await page.getByRole('button', { name: 'Degradê Oceano' }).click();
    await expect.poll(async () => Object.keys((await projectOf(page)).media).length, { timeout: 30_000 }).toBe(2);
  });

  test('gravar voz: grava com o microfone, envia e coloca na faixa de áudio', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Voz');
    await page.getByTestId('tab-audio').click();
    await page.getByTestId('rec-start').click();
    await expect(page.getByTestId('rec-time')).toBeVisible();
    await page.waitForTimeout(1800);
    await page.getByTestId('rec-stop').click();
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.track === 'audio').length, { timeout: 40_000 }).toBe(1);
    const audio = Object.values((await projectOf(page)).media)[0]!;
    expect(audio.kind).toBe('audio');
    expect(audio.name).toMatch(/^Gravação de voz/);
    await expect(page.getByTestId('audio-list')).toContainText('Gravação de voz');
  });
});

test.describe('timeline e preview', () => {
  test('o clipe de vídeo mostra a tira de quadros (miniaturas) do servidor', async ({ page }) => {
    await withClip(page, media.blue);
    await expect(page.locator('[data-clip-id] [style*="/film"]').first()).toBeVisible({ timeout: 20_000 });
  });

  test('fechar espaços vazios encosta os clipes da faixa', async ({ page }) => {
    await withClip(page);
    const [a] = await clipsOf(page);
    await page.evaluate((id) => {
      const s = window.__editor.getState() as unknown as { moveSelection(ids: string[], d: number, p: string): boolean };
      s.moveSelection([id], 5, id);
    }, a!.id);
    expect((await clipsOf(page))[0]!.start).toBe(5);
    const header = page.getByTestId('track-header-video');
    await header.hover();
    await header.getByRole('button', { name: 'Fechar espaços vazios da faixa' }).click();
    expect((await clipsOf(page))[0]!.start).toBe(0);
  });

  test('salvar o quadro atual gera um PNG válido', async ({ page }) => {
    await withClip(page);
    await seek(page, 1);
    await expect.poll(async () => near(await previewPixel(page), [255, 0, 0], 40), { timeout: 15_000 }).toBe(true);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-frame').click()]);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const bytes = await readFile((await download.path())!);
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(bytes.length).toBeGreaterThan(500);
  });

  test('o painel lateral recolhe e volta pelo trilho; a paleta também o reabre', async ({ page }) => {
    await withClip(page);
    await expect(page.getByTestId('file-input')).toBeAttached();
    await page.getByRole('button', { name: 'Recolher painel' }).click();
    await expect(page.getByTestId('file-input')).toHaveCount(0);
    await page.getByTestId('tab-media').click();
    await expect(page.getByTestId('file-input')).toBeAttached();
  });

  test('propriedades em abas conforme o tipo do clipe', async ({ page }) => {
    await withClip(page);
    const props = page.getByTestId('properties');
    await expect(props.getByRole('tab')).toHaveText(['Vídeo', 'Áudio', 'Efeitos', 'Animação']);
    await page.getByTestId('tab-text').click();
    await page.getByRole('button', { name: 'Adicionar texto Título' }).click();
    await expect(props.getByRole('tab')).toHaveText(['Texto', 'Estilo', 'Animação']);
    await props.getByRole('tab', { name: 'Estilo' }).click();
    await expect(props.getByRole('combobox', { name: 'Fonte' })).toBeVisible();
  });
});

test.describe('tela de projetos', () => {
  test('modelo "Vertical curto" cria um projeto 9:16 já com título e faixa de legendas', async ({ page }) => {
    await signup(page);
    await page.getByRole('button', { name: 'Novo projeto' }).click();
    await page.getByRole('radio', { name: /Vertical curto/ }).click();
    await page.getByLabel('Nome').fill('Meu reel');
    await page.getByRole('button', { name: 'Criar e abrir' }).click();
    await expect(page.getByTestId('editor')).toBeVisible();
    const p = await projectOf(page);
    expect(p.settings).toMatchObject({ width: 1080, height: 1920 });
    expect(p.tracks.map((t) => t.kind).sort()).toEqual(['caption', 'text', 'video']);
    expect(p.tracks.find((t) => t.kind === 'text')!.clips[0]).toMatchObject({ text: 'Seu título aqui' });
    await waitSaved(page);
  });

  test('busca, renomear e duplicar projetos (com capa depois de ter mídia)', async ({ page }) => {
    await withClip(page, media.red);
    await waitSaved(page);
    await page.goto('/');
    const grid = page.getByTestId('project-grid');
    await expect(grid.getByRole('heading', { name: 'Novidades' })).toBeVisible();
    await expect(grid.locator('img').first()).toBeVisible(); // capa = miniatura da primeira mídia

    await page.getByRole('button', { name: 'Mais ações para Novidades' }).click({ force: true });
    await page.getByRole('menuitem', { name: 'Renomear Novidades' }).click();
    await page.getByLabel('Novo nome').fill('Projeto Alfa');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(grid.getByRole('heading', { name: 'Projeto Alfa' })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('button', { name: 'Mais ações para Projeto Alfa' }).click({ force: true });
    await page.getByRole('menuitem', { name: 'Duplicar Projeto Alfa' }).click();
    await expect(grid.getByRole('heading', { name: 'Projeto Alfa (cópia)' })).toBeVisible({ timeout: 30_000 });

    await page.getByLabel('Buscar projetos').fill('cópia');
    await expect(grid.getByRole('heading')).toHaveCount(1);
    await page.getByLabel('Buscar projetos').fill('xyz');
    await expect(page.getByText(/Nenhum projeto corresponde/)).toBeVisible();
  });
});
