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
  const shot = (name: string) => page.screenshot({ path: path.join(OUT!, `${name}.png`) });
  await page.setViewportSize({ width: 1600, height: 960 });
  await signup(page, 'Caio');
  await shot('01-projetos-vazio');

  await newProject(page, 'Meu primeiro vídeo');
  await shot('02-editor-vazio');

  const red = await uploadAndWait(page, media.red);
  await red.dblclick();
  const blue = await uploadAndWait(page, media.blue);
  await blue.dblclick();
  await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
  const [first] = await clipsOf(page);
  await page.locator(`[data-clip-id="${first!.id}"]`).click();
  await seek(page, 1);
  await page.waitForTimeout(1200);
  await shot('03-editor-clipes');

  await page.getByTestId('tab-animations').click();
  await page.waitForTimeout(400);
  await shot('04-animacoes');
  await page.getByTestId('tab-effects').click();
  await shot('05-efeitos');
  await page.getByTestId('tab-text').click();
  await shot('06-texto');
  await page.getByTestId('tab-elements').click();
  await shot('07-elementos');
  await page.getByTestId('tab-audio').click();
  await shot('08-audio');
  await page.getByTestId('tab-ai').click();
  await shot('09-ia');

  await page.getByRole('tab', { name: 'Áudio' }).last().click();
  await shot('10-propriedades-audio');
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  await shot('11-paleta');
  await page.keyboard.press('Escape');

  await page.getByTestId('theme-toggle').click();
  await page.waitForTimeout(300);
  await shot('12-tema-claro');

  await page.goto('/');
  await page.waitForTimeout(800);
  await shot('13-projetos-tema-claro');
  await page.getByRole('button', { name: 'Novo projeto' }).click();
  await page.waitForTimeout(400);
  await shot('14-novo-projeto');
});
