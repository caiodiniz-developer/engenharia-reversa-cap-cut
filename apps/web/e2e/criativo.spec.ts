import { expect, test, type Page } from '@playwright/test';
import { clipsOf, makeMedia, near, newProject, previewPixel, projectOf, seek, signup, uploadAndWait, type Media } from './helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

async function runCommand(page: Page, query: string, name: RegExp) {
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Buscar comandos' });
  await expect(input).toBeFocused();
  await input.fill(query);
  await page.getByRole('option', { name }).first().click();
  await expect(input).toBeHidden();
}

async function twoClips(page: Page, overlay: boolean) {
  await signup(page);
  await newProject(page, 'Criativo');
  const red = await uploadAndWait(page, media.red);
  const blue = await uploadAndWait(page, media.blue);
  await red.dblclick();
  await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  if (overlay) {
    // o clipe azul entra numa faixa acima, no mesmo instante, para os dois aparecerem juntos
    await page.evaluate(() => {
      const st = window.__editor.getState() as unknown as { media: Record<string, { name: string }>; addToTimeline(id: string, o: { overlay: boolean; at: number }): void };
      const id = Object.keys(st.media).find((k) => st.media[k]!.name === 'azul.mp4')!;
      st.addToTimeline(id, { overlay: true, at: 0 });
    });
  } else await blue.dblclick();
  await expect(page.locator('[data-clip-id]')).toHaveCount(2);
}

test.describe('ferramentas criativas pela paleta', () => {
  test('tela dividida lado a lado: o primeiro clipe (faixa de cima, azul) fica à esquerda e o outro (vermelho) à direita', async ({ page }) => {
    await twoClips(page, true);
    await page.evaluate(() => {
      const st = window.__editor.getState() as unknown as { select(ids: string[]): void; project: { tracks: Array<{ clips: Array<{ id: string }> }> } };
      st.select(st.project.tracks.flatMap((t) => t.clips.map((c) => c.id)));
    });
    await runCommand(page, 'tela dividida lado a lado', /Tela dividida: dois clipes lado a lado/);
    await seek(page, 1);
    await expect.poll(async () => near(await previewPixel(page, 0.25, 0.5), [0, 0, 255], 60) && near(await previewPixel(page, 0.75, 0.5), [255, 0, 0], 60), { timeout: 8_000 }).toBe(true);
  });

  test('rampa de velocidade divide o clipe em 6 trechos, com velocidades crescentes, e desfazer volta', async ({ page }) => {
    await twoClips(page, false);
    const [first] = await clipsOf(page);
    await page.locator(`[data-clip-id="${first!.id}"]`).click();
    await runCommand(page, 'rampa de velocidade lenta', /Rampa de velocidade: câmera lenta → normal/);
    await expect.poll(async () => (await clipsOf(page)).length).toBe(7); // 6 trechos + o clipe azul
    const p = await projectOf(page);
    const speeds = p.tracks[0]!.clips.filter((c) => c.type === 'media').slice(0, 6).map((c) => (c as { speed: number }).speed);
    expect(speeds[0]).toBeLessThan(speeds[5]!);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
  });

  test('transição em todos os cortes aplica o dissolver e a remoção devolve as posições', async ({ page }) => {
    await twoClips(page, false);
    const [first] = await clipsOf(page);
    await page.locator(`[data-clip-id="${first!.id}"]`).click();
    await runCommand(page, 'transição em todos os cortes dissolver', /Transição em todos os cortes da faixa: dissolver/);
    await expect(page.getByText(/1 transição aplicada/)).toBeVisible();
    await expect.poll(async () => (await clipsOf(page))[1]!.start).toBeCloseTo(3.5, 3);
    await runCommand(page, 'remover todas as transições', /Remover todas as transições da faixa/);
    await expect.poll(async () => (await clipsOf(page))[1]!.start).toBeCloseTo(4, 3);
  });

  test('seleção por critério avisa quando não há e seleciona quando há', async ({ page }) => {
    await twoClips(page, false);
    await runCommand(page, 'selecionar clipes invertidos', /Selecionar clipes invertidos/);
    await expect(page.getByText(/Nenhum clipe invertido/)).toBeVisible();
    await runCommand(page, 'selecionar clipes mais longos que 5', /mais longos que 5 s/);
    await expect(page.getByText(/Nenhum clipe mais longo que 5 s/)).toBeVisible();
    await runCommand(page, 'selecionar clipes mais curtos que 1', /mais curtos que 1 s/);
    await expect(page.getByText(/Nenhum clipe mais curto que 1 s/)).toBeVisible();
    await runCommand(page, 'inverter a seleção', /Inverter a seleção/);
    // o último clipe adicionado já vem selecionado: a inversão seleciona o outro
    await expect(page.getByText(/1 clipe selecionado/)).toBeVisible();
  });

  test('boomerang acrescenta a volta em reverso logo depois do clipe', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Boomerang');
    const card = await uploadAndWait(page, media.red);
    await card.dblclick();
    const [c] = await clipsOf(page);
    await page.locator(`[data-clip-id="${c!.id}"]`).click();
    await runCommand(page, 'duração de 2 s', /Duração de 2 s para a seleção/);
    await runCommand(page, 'boomerang', /Boomerang/);
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    const p = await projectOf(page);
    const reversed = p.tracks[0]!.clips.map((x) => (x as { reverse?: boolean }).reverse);
    expect(reversed).toEqual([false, true]);
  });
});
