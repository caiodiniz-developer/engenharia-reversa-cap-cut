import { expect, test, type Page } from '@playwright/test';
import { clipsOf, makeMedia, near, newProject, previewPixel, seek, signup, state, uploadAndWait, waitSaved, type Media } from './helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

async function openEditorWithRed(page: Page) {
  await signup(page);
  await newProject(page, 'Edição');
  const card = await uploadAndWait(page, media.red);
  await card.dblclick();
  await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  return card;
}

test.describe('editor: importação, timeline e preview', () => {
  test('importa vídeo, gera miniatura e mostra o quadro no preview', async ({ page }) => {
    await openEditorWithRed(page);
    const clips = await clipsOf(page);
    expect(clips[0]).toMatchObject({ track: 'video', start: 0 });
    expect(clips[0]!.duration).toBeGreaterThan(3.9);

    await seek(page, 1);
    await expect.poll(async () => near(await previewPixel(page), [255, 0, 0], 50), { timeout: 20_000 }).toBe(true);
  });

  test('reproduz e pausa com Espaço, o cursor avança e para no fim', async ({ page }) => {
    await openEditorWithRed(page);
    await seek(page, 0);
    await page.keyboard.press('Space');
    await expect.poll(async () => (await state(page)).playhead, { timeout: 10_000 }).toBeGreaterThan(0.5);
    expect((await state(page)).playing).toBe(true);
    await page.keyboard.press('Space');
    const stopped = (await state(page)).playhead;
    await page.waitForTimeout(400);
    expect((await state(page)).playhead).toBeCloseTo(stopped, 1);
    expect((await state(page)).playing).toBe(false);
  });

  test('divide com S, desfaz e refaz; excluir com ripple fecha o espaço', async ({ page }) => {
    await openEditorWithRed(page);
    await seek(page, 2);
    await page.keyboard.press('s');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    const [a, b] = await clipsOf(page);
    expect(a!.duration).toBeCloseTo(2, 2);
    expect(b!.start).toBeCloseTo(2, 2);
    expect(b!.sourceIn).toBeCloseTo(2, 2);

    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(1);
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);

    // seleciona o primeiro pedaço e remove fechando o espaço
    await page.locator(`[data-clip-id="${a!.id}"]`).click();
    await page.keyboard.press('Shift+Delete');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(1);
    expect((await clipsOf(page))[0]!.start).toBeCloseTo(0, 3);
  });

  test('arrasta o clipe com o mouse com snap e impede sobreposição', async ({ page }) => {
    await openEditorWithRed(page);
    await page.getByTestId('tab-media').click();
    await page.getByRole('button', { name: /^azul\.mp4/ }).or(page.getByTestId('file-input')).first();
    await uploadAndWait(page, media.blue);
    await page.getByRole('button', { name: /^azul\.mp4/ }).dblclick();
    await expect(page.locator('[data-clip-id]')).toHaveCount(2);
    const before = await clipsOf(page);
    expect(before[1]!.start).toBeCloseTo(before[0]!.duration, 2);

    // arrasta o segundo clipe 400px para a direita (zoom 60px/s → ~6,6s)
    const box = (await page.locator(`[data-clip-id="${before[1]!.id}"]`).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 8 });
    await page.mouse.move(box.x + box.width / 2 + 400, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const after = await clipsOf(page);
    expect(after[1]!.start).toBeGreaterThan(before[1]!.start + 3);

    // arrastar o primeiro por cima do segundo é bloqueado: o início permanece válido (sem sobreposição)
    const first = (await page.locator(`[data-clip-id="${after[0]!.id}"]`).boundingBox())!;
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(first.x + first.width / 2 + 500, first.y + first.height / 2, { steps: 12 });
    await page.mouse.up();
    const end = await clipsOf(page);
    const [x, y] = end;
    expect(x!.start + x!.duration).toBeLessThanOrEqual(y!.start + 1e-3);

    // um passo de undo desfaz o arrasto inteiro
    await page.keyboard.press('Control+z');
    const undone = await clipsOf(page);
    expect(undone[0]!.start).toBeCloseTo(after[0]!.start, 2);
  });

  test('trim pelas bordas ajusta duração e origem', async ({ page }) => {
    await openEditorWithRed(page);
    const [c] = await clipsOf(page);
    const el = page.locator(`[data-clip-id="${c!.id}"]`);
    const box = (await el.boundingBox())!;
    // alça esquerda: encurta 1,5s (≈90px)
    await page.mouse.move(box.x + 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 3 + 90, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    const [t] = await clipsOf(page);
    expect(t!.start).toBeGreaterThan(1);
    expect(t!.sourceIn).toBeCloseTo(t!.start, 1);
    expect(t!.duration).toBeLessThan(c!.duration - 1);
  });

  test('salva automaticamente e recupera o projeto idêntico ao recarregar', async ({ page }) => {
    await openEditorWithRed(page);
    await seek(page, 1.5);
    await page.keyboard.press('s');
    await waitSaved(page);
    const before = await clipsOf(page);
    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    expect(await clipsOf(page)).toEqual(before);
  });

  test('zoom e régua: clicar na régua move a cabeça de reprodução', async ({ page }) => {
    await openEditorWithRed(page);
    const ruler = page.getByTestId('ruler');
    const box = (await ruler.boundingBox())!;
    await page.mouse.click(box.x + 120, box.y + 14);
    const t = (await state(page)).playhead;
    expect(t).toBeGreaterThan(1.5);
    expect(t).toBeLessThan(2.5);
    await page.getByRole('button', { name: 'Aumentar zoom' }).click();
    await page.keyboard.press('Home');
    expect((await state(page)).playhead).toBe(0);
    await page.keyboard.press('ArrowRight');
    expect((await state(page)).playhead).toBeCloseTo(1 / 30, 3);
  });

  test('histórico lista as operações e permite voltar a um passo', async ({ page }) => {
    await openEditorWithRed(page);
    await seek(page, 1);
    await page.keyboard.press('s');
    await page.getByRole('button', { name: 'Histórico de operações' }).click();
    const list = page.getByTestId('history-list');
    await expect(list).toContainText('Dividir clipe');
    await list.getByRole('button', { name: /Adicionar vermelho/ }).click();
    await expect.poll(async () => (await clipsOf(page)).length).toBe(1);
  });
});
