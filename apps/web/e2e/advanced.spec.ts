import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { clipsOf, framePixel, makeMedia, near, newProject, previewPixel, probeMedia, projectOf, seek, signup, uploadAndWait, waitSaved, type Media } from './helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

async function withClip(page: Page, file: string = media.red) {
  await signup(page);
  await newProject(page, 'Avançado');
  const card = await uploadAndWait(page, file);
  await card.dblclick();
  await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  const [c] = await clipsOf(page);
  await page.locator(`[data-clip-id="${c!.id}"]`).click();
  return c!;
}

/** LUT 3D 2×2×2 que troca os canais R e B (formato .cube). */
const SWAP_RB_CUBE = ['TITLE "Troca R-B"', 'LUT_3D_SIZE 2', ...[0, 1].flatMap((b) => [0, 1].flatMap((g) => [0, 1].map((r) => `${b} ${g} ${r}`)))].join('\n');

async function exportTo(page: Page) {
  await page.getByTestId('export-button').click();
  const dialog = page.getByRole('dialog', { name: 'Exportar vídeo' });
  await dialog.getByLabel('Resolução').selectOption('480');
  await dialog.getByTestId('start-export').click();
  await expect(dialog.getByTestId('export-status')).toContainText('Exportação concluída', { timeout: 120_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('download-button').click()]);
  const file = path.join(await mkdtemp(path.join(os.tmpdir(), 'e2e-dl-')), download.suggestedFilename());
  await download.saveAs(file);
  return { file, dialog };
}

test.describe('LUTs, estabilização e gravação local', () => {
  test('LUT embutida: aplica pelo painel, aparece nas propriedades e a exportação coincide com a prévia', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-effects').click();
    await page.getByRole('tab', { name: 'LUTs' }).click();
    await page.getByRole('button', { name: 'Preto e branco contrastado' }).click();
    await expect(page.getByTestId('properties')).toContainText('LUT: Preto e branco contrastado');
    await seek(page, 1);
    await expect
      .poll(async () => {
        const [r, g, b] = await previewPixel(page);
        return Math.max(r, g, b) - Math.min(r, g, b) < 10 && r < 120;
      }, { timeout: 15_000 })
      .toBe(true);
    const prev = await previewPixel(page);
    const { file } = await exportTo(page);
    const out = await framePixel(file, 1);
    expect(near(prev, out, 40), `preview ${prev} vs exportação ${out}`).toBe(true);
    expect(Math.max(...out) - Math.min(...out)).toBeLessThan(25);
  });

  test('importa uma LUT .cube, aplica (R↔B) e valida o que é inválido', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-effects').click();
    await page.getByRole('tab', { name: 'LUTs' }).click();
    await page.getByTestId('lut-input').setInputFiles({ name: 'ruim.cube', mimeType: 'text/plain', buffer: Buffer.from('LUT_3D_SIZE 2\n0 0 0\n') });
    await expect(page.getByText(/contém/)).toBeVisible();
    expect(Object.keys((await projectOf(page)).luts ?? {})).toHaveLength(0);

    await page.getByTestId('lut-input').setInputFiles({ name: 'troca.cube', mimeType: 'text/plain', buffer: Buffer.from(SWAP_RB_CUBE) });
    await expect(page.getByTestId('project-luts')).toContainText('troca');
    await page.getByTestId('project-luts').getByRole('button', { name: 'troca', exact: true }).click();
    await seek(page, 1);
    await expect.poll(async () => near(await previewPixel(page), [0, 0, 255], 50), { timeout: 15_000 }).toBe(true);

    // a LUT é parte do projeto: sobrevive ao salvamento e ao recarregamento
    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect.poll(async () => Object.keys((await projectOf(page)).luts ?? {}).length).toBe(1);
    await seek(page, 1);
    await expect.poll(async () => near(await previewPixel(page), [0, 0, 255], 50), { timeout: 20_000 }).toBe(true);

    // exportada, a LUT troca o vermelho por azul no arquivo final
    await page.getByTestId('tab-effects').click();
    const { file } = await exportTo(page);
    expect(near(await framePixel(file, 1), [0, 0, 255], 50)).toBe(true);
  });

  test('estabilização: configurada nas propriedades e processada na exportação do servidor', async ({ page }) => {
    const c = await withClip(page, media.blue);
    const section = page.getByTestId('properties').getByRole('button', { name: /Estabilização/ });
    await section.click();
    const field = page.getByTestId('properties').getByRole('textbox', { name: /Suavização/ });
    await field.fill('12');
    await field.press('Enter');
    await expect.poll(async () => ((await projectOf(page)).tracks[0]!.clips[0] as unknown as { stabilize: number }).stabilize).toBe(12);
    expect(c.id).toBeTruthy();
    const { file } = await exportTo(page);
    const info = await probeMedia(file);
    expect(info.duration).toBeGreaterThan(3.7);
    expect(near(await framePixel(file, 1), [0, 0, 255], 50)).toBe(true);
  });

  test('gravação local do rascunho (WebM) sem usar o servidor de renderização', async ({ page }) => {
    await withClip(page, media.blue);
    await page.getByTestId('export-button').click();
    const dialog = page.getByRole('dialog', { name: 'Exportar vídeo' });
    await expect(dialog.getByTestId('local-draft')).toBeVisible();
    const jobsBefore = await page.evaluate(() => fetch('/api/jobs', { headers: { Authorization: `Bearer ${localStorage.getItem('editor.token')}` } }).then((r) => r.json()));
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), dialog.getByTestId('record-local').click()]);
    expect(download.suggestedFilename()).toMatch(/rascunho\.webm$/);
    const file = path.join(await mkdtemp(path.join(os.tmpdir(), 'e2e-rec-')), download.suggestedFilename());
    await download.saveAs(file);
    const info = await probeMedia(file);
    expect(['vp8', 'vp9']).toContain(info.videoCodec);
    expect(info.width).toBeGreaterThan(100);
    expect(near(await framePixel(file, 1), [0, 0, 255], 60)).toBe(true);
    // nenhuma exportação foi criada no servidor
    const jobsAfter = await page.evaluate(() => fetch('/api/jobs', { headers: { Authorization: `Bearer ${localStorage.getItem('editor.token')}` } }).then((r) => r.json()));
    expect(jobsAfter.jobs.filter((j: { type: string }) => j.type === 'export')).toHaveLength(jobsBefore.jobs.filter((j: { type: string }) => j.type === 'export').length);
  });

  test('mostra o consumo de memória do navegador nas tarefas', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('jobs-button').click();
    await expect(page.getByTestId('memory')).toContainText('Memória do navegador');
  });
});
