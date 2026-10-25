import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { clipsOf, makeMedia, newProject, seek, signup, uploadAndWait, type Media } from './helpers';

// Capturas de tela para revisão visual. Só rodam com SHOTS=<pasta>.
const OUT = process.env.SHOTS;
test.skip(!OUT, 'defina SHOTS=<pasta> para gerar as capturas');

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
  if (OUT) await mkdir(OUT, { recursive: true });
});

test('capturas da interface', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 960 });
  await signup(page, 'Caio');
  await page.screenshot({ path: path.join(OUT!, '01-projetos-vazio.png') });

  await newProject(page, 'Meu primeiro vídeo');
  await page.screenshot({ path: path.join(OUT!, '02-editor-vazio.png') });

  const red = await uploadAndWait(page, media.red);
  await red.dblclick();
  const blue = await uploadAndWait(page, media.blue);
  await blue.dblclick();
  await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
  const [first] = await clipsOf(page);
  await page.locator(`[data-clip-id="${first!.id}"]`).click();
  await seek(page, 1);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT!, '03-editor-clipes.png') });

  await page.getByTestId('tab-effects').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT!, '04-efeitos.png') });

  await page.getByTestId('tab-text').click();
  await page.getByRole('button', { name: 'Adicionar texto Título' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT!, '05-texto.png') });

  await page.goto('/');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT!, '06-projetos.png') });
});
