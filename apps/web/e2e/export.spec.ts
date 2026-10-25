import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { clipsOf, framePixel, makeMedia, near, newProject, previewPixel, probeMedia, seek, signup, uploadAndWait, waitSaved, type Media } from './helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

async function sequence(page: Page) {
  await signup(page);
  await newProject(page, 'Exportação');
  const red = await uploadAndWait(page, media.red);
  await red.dblclick();
  const blue = await uploadAndWait(page, media.blue);
  await blue.dblclick();
  await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
  await waitSaved(page);
}

async function exportAndDownload(page: Page, opts: { codec?: string; res?: string } = {}) {
  await page.getByTestId('export-button').click();
  const dialog = page.getByRole('dialog', { name: 'Exportar vídeo' });
  await expect(dialog).toBeVisible();
  if (opts.codec) await dialog.getByLabel('Formato').selectOption(opts.codec);
  await dialog.getByLabel('Resolução').selectOption(opts.res ?? '720');
  await dialog.getByTestId('start-export').click();
  await expect(dialog.getByTestId('export-status')).toContainText('Exportação concluída', { timeout: 120_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('download-button').click()]);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'e2e-dl-'));
  const file = path.join(dir, download.suggestedFilename());
  await download.saveAs(file);
  return { file, name: download.suggestedFilename(), dialog };
}

test.describe('exportação pelo navegador', () => {
  test('exporta somente o áudio em MP3 pelo diálogo e o arquivo não tem vídeo', async ({ page }) => {
    await sequence(page);
    await page.getByTestId('export-button').click();
    const dialog = page.getByRole('dialog', { name: 'Exportar vídeo' });
    await dialog.getByRole('radio', { name: 'Somente áudio' }).click();
    await expect(dialog.getByLabel('Resolução')).toHaveCount(0);
    await dialog.getByLabel('Formato do áudio').selectOption('mp3');
    await dialog.getByTestId('start-export').click();
    await expect(dialog.getByTestId('export-status')).toContainText('Exportação concluída', { timeout: 120_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('download-button').click()]);
    expect(download.suggestedFilename()).toMatch(/.mp3$/);
    const dir = await mkdtemp(path.join(os.tmpdir(), 'e2e-dl-'));
    const file = path.join(dir, download.suggestedFilename());
    await download.saveAs(file);
    const info = await probeMedia(file);
    expect(info.kind).toBe('audio');
    expect(info.videoCodec).toBeUndefined();
    expect(info.duration).toBeGreaterThan(7.8);
    expect(info.duration).toBeLessThan(8.4);
  });

  test('exporta no servidor, baixa o arquivo e ele coincide com o preview', async ({ page }) => {
    await sequence(page);
    const { file, name } = await exportAndDownload(page);
    expect(name).toMatch(/Export.*\.mp4$/);

    const info = await probeMedia(file);
    expect(info.width).toBe(1280);
    expect(info.height).toBe(720);
    expect(info.hasAudio).toBe(true);
    expect(info.duration).toBeGreaterThan(7.8);
    expect(info.duration).toBeLessThan(8.3);

    // Paridade: cor do preview em cada instante ≈ cor do arquivo exportado no mesmo instante.
    for (const [t, expected] of [[1, [255, 0, 0]], [6, [0, 0, 255]]] as const) {
      await seek(page, t);
      await expect.poll(async () => near(await previewPixel(page), expected as unknown as number[], 50), { timeout: 20_000 }).toBe(true);
      const prev = await previewPixel(page);
      const out = await framePixel(file, t);
      expect(near(prev, out, 45), `preview ${prev} vs export ${out} em t=${t}`).toBe(true);
    }
  });

  test('efeito de saturação aparece igual no preview e na exportação', async ({ page }) => {
    await sequence(page);
    const [first] = await clipsOf(page);
    await page.evaluate((id) => {
      const s = window.__editor.getState() as unknown as { addEffect(id: string, t: string): void; updateEffect(id: string, fx: string, p: Record<string, number>): void; project: { tracks: Array<{ clips: Array<{ id: string; effects?: Array<{ id: string }> }> }> } };
      s.addEffect(id, 'saturation');
      const fx = (window.__editor.getState() as unknown as typeof s).project.tracks.flatMap((t) => t.clips).find((c) => c.id === id)!.effects![0]!;
      (window.__editor.getState() as unknown as typeof s).updateEffect(id, fx.id, { amount: 0.2 });
    }, first!.id);
    await seek(page, 1);
    await expect.poll(async () => (await previewPixel(page))[0]! < 200, { timeout: 15_000 }).toBe(true);
    const prev = await previewPixel(page);
    const { file } = await exportAndDownload(page);
    const out = await framePixel(file, 1);
    expect(near(prev, out, 40), `preview ${prev} vs export ${out}`).toBe(true);
    expect(out[0]).toBeLessThan(230); // dessaturado em relação ao vermelho puro
    expect(out[1]).toBeGreaterThan(20);
  });

  test('exporta em WebM/VP9 e permite cancelar uma exportação em andamento', async ({ page }) => {
    await sequence(page);
    const { file, dialog } = await exportAndDownload(page, { codec: 'vp9', res: '480' });
    expect((await probeMedia(file)).videoCodec).toBe('vp9');

    // O diálogo continua aberto: inicia outra exportação (4K H.265, lenta) e cancela.
    await dialog.getByLabel('Resolução').selectOption('2160');
    await dialog.getByLabel('Formato').selectOption('h265');
    await dialog.getByTestId('start-export').click();
    await expect(dialog.getByTestId('export-status')).toContainText(/Na fila|Renderizando/, { timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog.getByTestId('export-status')).toContainText('cancelada', { timeout: 30_000 });
    await expect(dialog.getByTestId('download-button')).toHaveCount(0);
  });

  test('projeto vazio não pode ser exportado', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Vazio');
    await page.getByTestId('export-button').click();
    const dialog = page.getByRole('dialog', { name: 'Exportar vídeo' });
    await expect(dialog.getByTestId('start-export')).toBeDisabled();
    await expect(dialog).toContainText('Adicione clipes');
  });
});
