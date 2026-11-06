import { expect, test, type Page } from '@playwright/test';
import { clipsOf, makeMedia, newProject, projectOf, seek, signup, uploadAndWait, type Media } from './helpers';

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

async function withClip(page: Page) {
  await signup(page);
  await newProject(page, 'Pro');
  const card = await uploadAndWait(page, media.red);
  await card.dblclick();
  await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  const [c] = await clipsOf(page);
  await page.locator('[data-clip-id="' + c!.id + '"]').click();
  return c!;
}

test.describe('edição profissional pela paleta', () => {
  test('encerramento suave põe fade de imagem e de áudio no clipe que termina com o projeto', async ({ page }) => {
    const c = await withClip(page);
    await runCommand(page, 'encerramento suave', /Encerramento suave: tudo o que termina o projeto some em 1 s/);
    await expect(page.getByText(/1 clipe suavizado/)).toBeVisible();
    const clip = (await projectOf(page)).tracks.flatMap((t) => t.clips).find((x) => x.id === c.id) as { keyframes: { opacity?: unknown[] }; audio: { fadeOut: number } };
    expect(clip.keyframes.opacity?.length).toBeGreaterThan(1);
    expect(clip.audio.fadeOut).toBe(1);
    await page.getByTestId('toast-action').click(); // Desfazer
    await expect.poll(async () => ((await projectOf(page)).tracks.flatMap((t) => t.clips).find((x) => x.id === c.id) as { keyframes: { opacity?: unknown[] } }).keyframes.opacity).toBeUndefined();
  });

  test('Alt+H segura o último quadro e empurra a duração do projeto', async ({ page }) => {
    await withClip(page);
    await page.keyboard.press('Alt+h');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    const clips = await clipsOf(page);
    expect(clips[1]).toMatchObject({ start: 4, duration: 2 });
    expect((await projectOf(page)).tracks[0]!.clips.map((x) => (x as { freeze?: boolean }).freeze)).toEqual([false, true]);
  });

  test('título vira legenda e volta a ser texto, mantendo o tempo', async ({ page }) => {
    await withClip(page);
    await seek(page, 1);
    await runCommand(page, 'adicionar título', /Adicionar título na cabeça de reprodução/);
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.type === 'text').length).toBe(1);
    await runCommand(page, 'converter textos em legendas', /Converter textos selecionados em legendas/);
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.type === 'caption').length).toBe(1);
    expect((await clipsOf(page)).some((c) => c.type === 'text')).toBe(false);
    const cap = (await clipsOf(page)).find((c) => c.type === 'caption')!;
    expect(cap).toMatchObject({ start: 1, duration: 3 });
    await runCommand(page, 'converter legendas em textos', /Converter legendas selecionadas em textos/);
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.type === 'text').length).toBe(1);
  });

  test('mover para a faixa de cima cria a faixa e remover faixas vazias limpa a antiga', async ({ page }) => {
    await withClip(page);
    await runCommand(page, 'mover a seleção para a faixa de cima', /Mover a seleção para a faixa de cima/);
    await expect.poll(async () => (await projectOf(page)).tracks.length).toBe(2);
    expect((await projectOf(page)).tracks[0]!.clips).toHaveLength(1);
    await runCommand(page, 'remover as faixas vazias', /Remover as faixas vazias/);
    await expect.poll(async () => (await projectOf(page)).tracks.length).toBe(1);
  });

  test('igualar a duração ao clipe mais curto', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Duração');
    const red = await uploadAndWait(page, media.red);
    const blue = await uploadAndWait(page, media.blue);
    await red.dblclick();
    await blue.dblclick();
    await expect(page.locator('[data-clip-id]')).toHaveCount(2);
    const [first] = await clipsOf(page);
    await page.locator('[data-clip-id="' + first!.id + '"]').click();
    await runCommand(page, 'duração de 2 s', /Duração de 2 s para a seleção/);
    await page.evaluate(() => {
      const st = window.__editor.getState() as unknown as { select(ids: string[]): void; project: { tracks: Array<{ clips: Array<{ id: string }> }> } };
      st.select(st.project.tracks.flatMap((t) => t.clips.map((c) => c.id)));
    });
    await runCommand(page, 'igualar a duração ao mais curto', /Igualar a duração dos clipes selecionados à duração do mais curto/);
    await expect.poll(async () => (await clipsOf(page)).map((c) => c.duration)).toEqual([2, 2]);
  });
});
