import { expect, test, type Page } from '@playwright/test';
import { clipsOf, makeMedia, newProject, projectOf, seek, signup, uploadAndWait, type Media } from './helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

async function withClip(page: Page, file: string = media.red) {
  await signup(page);
  await newProject(page, 'Mais recursos');
  const card = await uploadAndWait(page, file);
  await card.dblclick();
  await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  const [c] = await clipsOf(page);
  await page.locator(`[data-clip-id="${c!.id}"]`).click();
  return c!;
}

/** Executa um comando da paleta e espera ela fechar (atalhos só voltam a valer depois). */
async function palette(page: Page, query: string) {
  await page.keyboard.press('Control+k');
  const box = page.getByRole('combobox', { name: 'Buscar comandos' });
  await box.fill(query);
  await page.keyboard.press('Enter');
  await expect(box).toBeHidden();
}

const clipOf = async (page: Page, id: string) => (await projectOf(page)).tracks.flatMap((t) => t.clips).find((c) => c.id === id) as unknown as Record<string, any>;

test.describe('edição de clipes', () => {
  test('repetir o clipe 3 vezes cria cópias encostadas e seleciona todas', async ({ page }) => {
    const c = await withClip(page);
    await palette(page, 'repetir o clipe 3 vezes');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(4);
    const clips = await clipsOf(page);
    for (let i = 1; i < clips.length; i++) expect(clips[i]!.start).toBeCloseTo(clips[i - 1]!.start + clips[i - 1]!.duration, 3);
    expect(clips[0]!.id).toBe(c.id);
    expect(await page.evaluate(() => window.__editor.getState().selection.length)).toBe(4);
    await page.keyboard.press('Control+z');
    expect((await clipsOf(page)).length).toBe(1); // um único passo de desfazer
  });

  test('posicionar, preencher o quadro e girar', async ({ page }) => {
    const c = await withClip(page);
    await page.evaluate((id) => {
      const s = window.__editor.getState() as unknown as { patchClip(id: string, fn: (c: { transform: object }) => object, label: string): void };
      s.patchClip(id, (x) => ({ ...x, transform: { ...x.transform, scale: 0.5 } }), 'teste');
    }, c.id);
    await palette(page, 'posicionar canto superior esquerdo');
    await expect.poll(async () => (await clipOf(page, c.id)).transform.x).toBeCloseTo(-0.25, 3);
    expect((await clipOf(page, c.id)).transform.y).toBeCloseTo(-0.25, 3);

    await palette(page, 'preencher o quadro');
    await expect.poll(async () => (await clipOf(page, c.id)).transform.scale).toBeGreaterThan(0.99);
    expect((await clipOf(page, c.id)).transform).toMatchObject({ x: 0, y: 0 });

    await page.keyboard.press('Shift+R');
    await expect.poll(async () => (await clipOf(page, c.id)).transform.rotation).toBe(90);
    await palette(page, 'girar 90 para a esquerda');
    await expect.poll(async () => (await clipOf(page, c.id)).transform.rotation).toBe(0);
  });

  test('áudio e velocidade: volume, mudo, fades e 2×', async ({ page }) => {
    const c = await withClip(page);
    const before = (await clipOf(page, c.id)).duration as number;
    await palette(page, 'volume do clipe +10');
    await expect.poll(async () => (await clipOf(page, c.id)).audio.volume).toBeCloseTo(1.1, 3);
    await palette(page, 'silenciar reativar o som do clipe');
    await expect.poll(async () => (await clipOf(page, c.id)).audio.muted).toBe(true);
    await palette(page, 'silenciar reativar o som do clipe');
    await expect.poll(async () => (await clipOf(page, c.id)).audio.muted).toBe(false);
    await palette(page, 'fade de entrada e saida de 1 s');
    await expect.poll(async () => (await clipOf(page, c.id)).audio.fadeIn).toBe(1);
    expect((await clipOf(page, c.id)).audio.fadeOut).toBe(1);
    await palette(page, 'remover fades');
    await expect.poll(async () => (await clipOf(page, c.id)).audio.fadeIn).toBe(0);
    await palette(page, 'velocidade do clipe 2');
    await expect.poll(async () => (await clipOf(page, c.id)).duration).toBeCloseTo(before / 2, 3);
    expect((await clipOf(page, c.id)).speed).toBe(2);
  });

  test('estender o texto até a cabeça de reprodução', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-text').click();
    await page.getByRole('button', { name: 'Adicionar texto Título' }).click();
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.type === 'text').length).toBe(1);
    const text = (await clipsOf(page)).find((c) => c.type === 'text')!;
    // a cabeça de reprodução só vai até o fim do projeto (o vídeo), então estendemos até lá
    const target = Math.max(...(await clipsOf(page)).map((c) => c.start + c.duration));
    expect(target).toBeGreaterThan(text.start + text.duration + 0.5);
    await seek(page, target);
    await palette(page, 'estender o clipe ate a cabeca');
    await expect.poll(async () => (await clipOf(page, text.id)).duration + (await clipOf(page, text.id)).start).toBeCloseTo(target, 2);
  });

  test('zoom na seleção (Shift+F) aproxima a timeline do clipe', async ({ page }) => {
    await withClip(page);
    const zoom = () => page.evaluate(() => window.__editor.getState().zoom);
    await page.getByRole('button', { name: 'Diminuir zoom' }).click();
    await page.getByRole('button', { name: 'Diminuir zoom' }).click();
    const before = await zoom();
    await page.keyboard.press('Shift+F');
    expect(await zoom()).toBeGreaterThan(before * 1.2);
  });
});

test.describe('faixas, texto e marcadores', () => {
  test('bloquear/ocultar/silenciar todas as faixas e duplicar a faixa selecionada', async ({ page }) => {
    await withClip(page);
    await palette(page, 'bloquear desbloquear todas as faixas');
    await expect.poll(async () => (await projectOf(page)).tracks.every((t) => t.locked)).toBe(true);
    await palette(page, 'bloquear desbloquear todas as faixas');
    await expect.poll(async () => (await projectOf(page)).tracks.every((t) => !t.locked)).toBe(true);
    await palette(page, 'silenciar reativar o som de todas as faixas');
    await expect.poll(async () => (await projectOf(page)).tracks.filter((t) => t.kind === 'video' || t.kind === 'audio').every((t) => t.muted)).toBe(true);

    await page.getByTestId('track-header-video').first().click();
    await palette(page, 'duplicar a faixa selecionada');
    await expect.poll(async () => (await projectOf(page)).tracks.length).toBe(2);
    const proj = await projectOf(page);
    expect(proj.tracks[1]!.name).toMatch(/\(cópia\)$/);
    expect(proj.tracks[1]!.clips).toHaveLength(1);
    expect(proj.tracks[1]!.clips[0]!.id).not.toBe(proj.tracks[0]!.clips[0]!.id);
  });

  test('caixa do texto e localizar/substituir (inclusive só na seleção)', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-text').click();
    await page.getByRole('button', { name: 'Adicionar texto Título' }).click();
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.type === 'text').length).toBe(1);
    const text = (await clipsOf(page)).find((c) => c.type === 'text')!;
    const textOf = async () => (await clipOf(page, text.id)).text as string;
    expect(await textOf()).toBe('Título');

    await palette(page, 'texto maiusculas');
    await expect.poll(textOf).toBe('TÍTULO');
    await palette(page, 'texto minusculas');
    await expect.poll(textOf).toBe('título');
    await palette(page, 'cada palavra maiuscula');
    await expect.poll(textOf).toBe('Título');

    await palette(page, 'localizar e substituir');
    const dialog = page.getByRole('dialog', { name: 'Localizar e substituir' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('replace-run')).toBeDisabled();
    await dialog.getByLabel('Localizar').fill('tít');
    await dialog.getByLabel('Substituir por').fill('Ola');
    await dialog.getByTestId('replace-run').click();
    await expect(page.getByText('1 ocorrência trocada')).toBeVisible();
    await expect.poll(textOf).toBe('Olaulo');
    await expect(dialog).toBeHidden();
  });

  test('copiar capítulos dos marcadores para a área de transferência', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await withClip(page);
    await seek(page, 0);
    await page.keyboard.press('m');
    await seek(page, 3);
    await page.keyboard.press('m');
    await palette(page, 'copiar capitulos');
    await expect(page.getByText('1 capítulo copiado')).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe('0:00 Marcador 1'); // o 2º marcador está a menos de 10 s do primeiro e é omitido (regra do YouTube)
  });
});

test.describe('biblioteca', () => {
  test('renomear mídia: o nome muda na biblioteca, no projeto e continua após recarregar', async ({ page }) => {
    await withClip(page);
    const item = page.getByTestId('media-list').getByRole('listitem').first();
    await item.hover();
    await item.getByRole('button', { name: /^Renomear / }).click();
    const input = item.getByRole('textbox');
    await input.fill('Cena de abertura');
    await input.press('Enter');
    await expect(item).toContainText('Cena de abertura');
    await expect.poll(async () => Object.values((await projectOf(page)).media)[0]!.name).toBe('Cena de abertura');

    // Esc cancela sem alterar
    await item.hover();
    await item.getByRole('button', { name: /^Renomear / }).click();
    await item.getByRole('textbox').fill('Outro nome');
    await item.getByRole('textbox').press('Escape');
    await expect(item).toContainText('Cena de abertura');

    await expect.poll(async () => page.evaluate(() => window.__editor.getState().saveState)).toBe('saved');
    await page.reload();
    await expect(page.getByTestId('media-list')).toContainText('Cena de abertura');
  });
});

test.describe('paleta', () => {
  test('comandos usados aparecem primeiro, com a etiqueta Recente, e a ordem sobrevive ao recarregar', async ({ page }) => {
    await withClip(page);
    await palette(page, 'alternar tema');
    await palette(page, 'adicionar marcador');
    await page.keyboard.press('Control+k');
    const options = page.getByTestId('command-list').getByRole('option');
    await expect(options.nth(0)).toContainText('Adicionar marcador');
    await expect(options.nth(1)).toContainText('Alternar tema claro/escuro');
    await expect(page.getByTestId('recent-chip')).toHaveCount(2);
    // digitando, a lista volta à busca normal (sem etiqueta)
    await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('zoom');
    await expect(page.getByTestId('recent-chip')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-list').getByRole('option').nth(0)).toContainText('Adicionar marcador');
  });
});
