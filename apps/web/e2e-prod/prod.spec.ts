import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { framePixel, makeMedia, near, newProject, probeMedia, signup, uploadAndWait, type Media } from '../e2e/helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

declare global {
  interface Window {
    __csp: string[];
  }
}

/** Registra violações de CSP e erros de console durante o teste. */
async function watch(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} → ${e.blockedURI}`));
  });
  return errors;
}

test.describe('build de produção com cabeçalhos de segurança', () => {
  test('servidor entrega a CSP e demais cabeçalhos; assets são imutáveis; SPA tem fallback', async ({ request }) => {
    const index = await request.get('/');
    expect(index.status()).toBe(200);
    const h = index.headers();
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['cache-control']).toBe('no-cache');

    const html = await index.text();
    const asset = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
    expect(asset).toBeTruthy();
    const js = await request.get(asset!);
    expect(js.headers()['cache-control']).toContain('immutable');
    expect(js.headers()['content-security-policy']).toBeTruthy();

    const deep = await request.get('/p/qualquer-coisa');
    expect(deep.status()).toBe(200);
    expect(await deep.text()).toContain('<div id="root">');
    expect((await request.get('/assets/nao-existe.js')).status()).toBe(404);
  });

  test('o app inteiro funciona sob a CSP: cadastro, upload em worker, preview, reprodução e exportação', async ({ page }) => {
    const errors = await watch(page);
    await signup(page, 'Produção');
    await newProject(page, 'Build de produção');

    const card = await uploadAndWait(page, media.red); // usa o Web Worker de upload
    await card.dblclick();
    await expect(page.locator('[data-clip-id]')).toHaveCount(1);

    // preview desenha o vídeo no canvas (mídia servida pela API via proxy, mesma origem)
    const canvas = page.getByTestId('preview-canvas');
    await expect
      .poll(
        () =>
          canvas.evaluate((c: HTMLCanvasElement) => {
            const d = c.getContext('2d')!.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
            return d[0]! > 200 && d[1]! < 60 && d[2]! < 60;
          }),
        { timeout: 30_000 },
      )
      .toBe(true);

    // reprodução avança o cronômetro
    const timecode = page.getByTestId('timecode');
    const before = await timecode.innerText();
    await page.keyboard.press('Space');
    await expect.poll(async () => (await timecode.innerText()) !== before, { timeout: 10_000 }).toBe(true);
    await page.keyboard.press('Space');

    // divide o clipe e exporta pelo servidor
    await page.keyboard.press('s');
    await page.getByTestId('export-button').click();
    const dialog = page.getByRole('dialog', { name: 'Exportar vídeo' });
    await dialog.getByLabel('Resolução').selectOption('480');
    await dialog.getByTestId('start-export').click();
    await expect(dialog.getByTestId('export-status')).toContainText('Exportação concluída', { timeout: 120_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('download-button').click()]);
    const file = path.join(await mkdtemp(path.join(os.tmpdir(), 'e2e-prod-')), download.suggestedFilename());
    await download.saveAs(file);
    const info = await probeMedia(file);
    expect(info.duration).toBeGreaterThan(3.5);
    expect(info.hasAudio).toBe(true);
    expect(near(await framePixel(file, 1), [255, 0, 0], 50)).toBe(true);

    // gravação local também funciona sob a CSP (blob: em media/worker)
    const [draft] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), dialog.getByTestId('record-local').click()]);
    expect(draft.suggestedFilename()).toMatch(/\.webm$/);

    expect(await page.evaluate(() => window.__csp), 'violações de CSP').toEqual([]);
    expect(errors.filter((e) => !/favicon/i.test(e)), 'erros de console').toEqual([]);
  });

  test('WebSocket de progresso funciona através do proxy de produção', async ({ page }) => {
    const errors = await watch(page);
    await signup(page);
    await newProject(page, 'WS');
    await uploadAndWait(page, media.blue);
    await page.getByTestId('jobs-button').click();
    await expect(page.getByText('ao vivo')).toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(() => window.__csp)).toEqual([]);
    expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
  });
});
