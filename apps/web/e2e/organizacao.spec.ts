import { expect, test, type Page } from '@playwright/test';
import { clipsOf, makeMedia, newProject, projectOf, seek, signup, uploadAndWait, type Media } from './helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

async function withClip(page: Page) {
  await signup(page);
  await newProject(page, 'Organização');
  const card = await uploadAndWait(page, media.red);
  await card.dblclick();
  await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  const [c] = await clipsOf(page);
  await page.locator(`[data-clip-id="${c!.id}"]`).click();
  return c!;
}

/** Abre a paleta, busca e executa o comando; só devolve quando a paleta fechou (os atalhos são ignorados enquanto ela existe). */
async function runCommand(page: Page, query: string, name: RegExp) {
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Buscar comandos' });
  await expect(input).toBeFocused();
  await input.fill(query);
  await page.getByRole('option', { name }).first().click();
  await expect(input).toBeHidden();
}

test.describe('novas ferramentas de edição pela paleta', () => {
  test('dividir em 4 partes iguais e juntar de volta (o inverso de dividir)', async ({ page }) => {
    await withClip(page);
    await runCommand(page, 'dividir em 4 partes', /Dividir o clipe em 4 partes iguais/);
    await expect.poll(async () => (await clipsOf(page)).map((c) => c.duration)).toEqual([1, 1, 1, 1]);
    expect((await clipsOf(page)).map((c) => c.start)).toEqual([0, 1, 2, 3]);
    await runCommand(page, 'juntar pedaços', /Juntar pedaços contínuos da faixa/);
    await expect.poll(async () => (await clipsOf(page)).length).toBe(1);
    expect((await clipsOf(page))[0]).toMatchObject({ start: 0, duration: 4 });
    await expect(page.getByText(/3 junções feitas/)).toBeVisible();
  });

  test('desfazer volta o que o comando fez', async ({ page }) => {
    await withClip(page);
    await runCommand(page, 'dividir em 2 partes', /Dividir o clipe em 2 partes iguais/);
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(1);
  });

  test('Ken Burns cria keyframes de escala e o volume em lote muda o áudio do clipe', async ({ page }) => {
    const c = await withClip(page);
    await runCommand(page, 'ken burns aproximar', /Efeito Ken Burns: aproximar devagar/);
    await expect
      .poll(async () => {
        const p = await projectOf(page);
        const clip = p.tracks.flatMap((t) => t.clips).find((x) => x.id === c.id) as { keyframes: { scale?: Array<{ value: number }> } };
        return clip.keyframes.scale?.map((k) => k.value);
      })
      .toEqual([1, 1.15]);
    await runCommand(page, 'volume da seleção 50', /Volume da seleção: 50%/);
    await expect
      .poll(async () => {
        const p = await projectOf(page);
        return (p.tracks.flatMap((t) => t.clips).find((x) => x.id === c.id) as { audio: { volume: number } }).audio.volume;
      })
      .toBe(0.5);
  });

  test('título entra na cabeça de reprodução e fica selecionado', async ({ page }) => {
    await withClip(page);
    await seek(page, 1);
    await runCommand(page, 'adicionar título', /Adicionar título na cabeça de reprodução/);
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.type === 'text').map((c) => [c.start, c.duration])).toEqual([[1, 3]]);
    const [title] = (await clipsOf(page)).filter((c) => c.type === 'text');
    await expect.poll(() => page.evaluate(() => window.__editor.getState().selection)).toEqual([title!.id]);
  });

  test('marcar a cada 5 s não cabe num projeto de 4 s: avisa, sem marcadores, e o aviso traz a barra de tempo', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('palette-button').click();
    await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('marcar a cada');
    await expect(page.getByRole('option', { name: /Marcar a cada 5 s/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox', { name: 'Buscar comandos' })).toBeHidden();
    // projeto de 4 s: nenhum marcador cabe a cada 5 s
    await runCommand(page, 'marcar a cada 5', /Marcar a cada 5 s/);
    await expect(page.getByText(/Nenhum marcador novo/)).toBeVisible();
    // o aviso traz a barrinha de tempo e some sozinho (3,5 s)
    await expect(page.getByTestId('toast-timer')).toBeVisible();
    await expect(page.getByText(/Nenhum marcador novo/)).toBeHidden({ timeout: 8_000 });
    expect((await projectOf(page)).markers).toHaveLength(0);
  });
});

test.describe('diálogos novos', () => {
  test('Estatísticas do projeto mostra os números e seleciona o clipe mais longo', async ({ page }) => {
    const c = await withClip(page);
    await page.keyboard.press('Escape');
    await runCommand(page, 'estatísticas do projeto', /Estatísticas do projeto/);
    const stats = page.getByTestId('stats');
    await expect(stats).toBeVisible();
    await expect(stats).toContainText('00:00:04:00');
    await expect(stats).toContainText('Mídia usada');
    await expect(page.getByTestId('stats-kinds')).toContainText('Vídeo');
    await page.getByTestId('stats-longest').click();
    await expect(stats).toBeHidden();
    await expect.poll(async () => (await page.evaluate(() => window.__editor.getState().selection))[0]).toBe(c.id);
  });

  test('Substituir mídia troca o arquivo nos clipes e mantém tudo o mais', async ({ page }) => {
    const c = await withClip(page);
    await uploadAndWait(page, media.blue);
    await runCommand(page, 'substituir uma mídia', /Substituir uma mídia por outra/);
    await expect(page.getByTestId('replace-media-from')).toContainText('vermelho.mp4');
    await page.getByTestId('replace-media-to').selectOption({ label: 'azul.mp4 (0:04)' });
    await page.getByTestId('replace-media-run').click();
    await expect(page.getByTestId('replace-media-run')).toBeHidden();
    const p = await projectOf(page);
    const clip = p.tracks.flatMap((t) => t.clips).find((x) => x.id === c.id) as { mediaId: string; start: number; duration: number };
    expect(p.media[clip.mediaId]!.name).toBe('azul.mp4');
    expect(clip).toMatchObject({ start: 0, duration: 4 });
  });

  test('Legendas a partir de um roteiro: resumo ao vivo, criação e aviso de falas rápidas', async ({ page }) => {
    await withClip(page);
    await page.keyboard.press('Escape');
    await runCommand(page, 'legendas a partir de um roteiro', /Criar legendas a partir de um roteiro/);
    await expect(page.getByTestId('script-summary')).toContainText('Escreva ou cole o roteiro');
    await expect(page.getByTestId('script-run')).toBeDisabled();
    await page.getByTestId('script-text').fill('Olá, pessoal! Hoje vamos editar um vídeo.');
    await expect(page.getByTestId('script-summary')).toContainText('2 legendas');
    // intervalo curto demais: 2 falas em 0,4 s dá 0,2 s cada
    await page.getByTestId('script-end').fill('0.4');
    await expect(page.getByTestId('script-summary')).toContainText('Rápido demais');
    await expect(page.getByTestId('script-run')).toBeDisabled();
    await page.getByTestId('script-end').fill('4');
    await page.getByTestId('script-run').click();
    await expect(page.getByTestId('script-run')).toBeHidden();
    const captions = (await clipsOf(page)).filter((x) => x.type === 'caption');
    expect(captions).toHaveLength(2);
    expect(captions[0]!.start).toBe(0);
    expect(captions[0]!.start + captions[0]!.duration).toBeCloseTo(captions[1]!.start, 5);
    expect(captions[1]!.start + captions[1]!.duration).toBeCloseTo(4, 5);
  });
});


test.describe('aviso com Desfazer', () => {
  test('marcar o início do clipe cria um marcador e o botão Desfazer do aviso o remove', async ({ page }) => {
    await withClip(page);
    await runCommand(page, 'marcar o início de cada clipe', /Marcar o início de cada clipe/);
    await expect(page.getByText(/1 marcador criado/)).toBeVisible();
    expect((await projectOf(page)).markers).toHaveLength(1);
    await page.getByTestId('toast-action').click();
    await expect.poll(async () => (await projectOf(page)).markers.length).toBe(0);
  });
});
