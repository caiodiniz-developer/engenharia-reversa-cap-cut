import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { clipsOf, makeMedia, newProject, projectOf, seek, signup, uploadAndWait, waitSaved, type Media } from './helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

async function withClip(page: Page, file: string = media.red) {
  await signup(page);
  await newProject(page, 'Diferenciais');
  const card = await uploadAndWait(page, file);
  await card.dblclick();
  await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  const [c] = await clipsOf(page);
  await page.locator(`[data-clip-id="${c!.id}"]`).click();
  return c!;
}

async function palette(page: Page, query: string) {
  await page.keyboard.press('Control+k');
  const box = page.getByRole('combobox', { name: 'Buscar comandos' });
  await box.fill(query);
  await page.keyboard.press('Enter');
  await expect(box).toBeHidden();
}

type Loose = { getState(): Record<string, any> };

/** Divide o clipe em 2 s e afasta a segunda metade 3 s, criando um espaço vazio. */
async function withGap(page: Page) {
  await withClip(page);
  await seek(page, 2);
  await page.keyboard.press('s');
  await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
  const [, b] = await clipsOf(page);
  await page.evaluate((id) => {
    const s = (window.__editor as unknown as Loose).getState() as unknown as { moveSelection(ids: string[], d: number, p: string): boolean };
    s.moveSelection([id], 3, id);
  }, b!.id);
  await expect.poll(async () => (await clipsOf(page))[1]!.start).toBeCloseTo(5, 2);
}

test.describe('revisão do projeto', () => {
  test('acha o espaço vazio, vai até ele e corrige com um clique', async ({ page }) => {
    await withGap(page);
    await page.getByTestId('tab-review').click();
    const gap = page.locator('[data-testid="issue"][data-rule="gap"]');
    await expect(gap).toHaveCount(1);
    await expect(gap).toContainText('3.0 s');
    await gap.getByRole('button', { name: /^Ir até/ }).click();
    expect(await page.evaluate(() => (window.__editor as unknown as Loose).getState().playhead)).toBeCloseTo(2, 2);

    const before = await page.getByTestId('score-quality').textContent();
    await gap.getByTestId('fix-close-gaps').click();
    await expect(page.locator('[data-testid="issue"][data-rule="gap"]')).toHaveCount(0);
    expect((await clipsOf(page))[1]!.start).toBeCloseTo(2, 2);
    expect(await page.getByTestId('score-quality').textContent()).not.toBe(before);
  });

  test('plataforma de destino: avisa o formato, corrige e mostra as zonas seguras no preview', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-review').click();
    await expect(page.locator('[data-rule="aspect"]')).toHaveCount(0); // sem plataforma, sem verificação de formato
    await page.getByLabel('Plataforma de destino').selectOption('shorts');
    const aspect = page.locator('[data-testid="issue"][data-rule="aspect"]');
    await expect(aspect).toContainText('1080×1920');
    await aspect.getByTestId('fix-set-platform-format').click();
    await expect.poll(async () => (await projectOf(page)).settings.height).toBe(1920);
    expect((await projectOf(page)).settings.width).toBe(1080);
    await expect(page.locator('[data-rule="aspect"]')).toHaveCount(0);

    await expect(page.getByTestId('safe-zones')).toHaveCount(0);
    await page.getByLabel('Mostrar zonas cobertas pela interface no preview').check();
    await expect(page.getByTestId('safe-zones')).toBeVisible();
    await expect(page.getByTestId('safe-zones')).toContainText('YouTube Shorts');
    await page.getByLabel('Plataforma de destino').selectOption('');
    await expect(page.getByTestId('safe-zones')).toHaveCount(0);
  });

  test('a plataforma escolhida é lembrada ao recarregar', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-review').click();
    await page.getByLabel('Plataforma de destino').selectOption('tiktok');
    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    await page.getByTestId('tab-review').click();
    await expect(page.getByLabel('Plataforma de destino')).toHaveValue('tiktok');
  });

  test('ritmo da edição: planos, média, histograma e mapa', async ({ page }) => {
    await withGap(page);
    await page.getByTestId('tab-review').click();
    await page.getByText('Ritmo da edição').click();
    const pacing = page.getByTestId('pacing');
    await expect(pacing).toBeVisible();
    await expect(pacing).toContainText('Planos');
    await expect(pacing.getByRole('img', { name: 'Mapa de ritmo' })).toBeVisible();
    await expect(pacing.getByTestId('pacing-label')).toHaveText(/Frenético|Dinâmico|Moderado|Contemplativo/);
  });

  test('tarefas de edição: criar na cabeça de reprodução, concluir e abrir o ponto', async ({ page }) => {
    await withClip(page);
    await seek(page, 1.5);
    await page.getByTestId('tab-review').click();
    await page.getByText('Tarefas de edição').click();
    await page.getByLabel('Nova tarefa de edição').fill('Trocar a música aqui');
    await page.getByTestId('tasks').getByRole('button', { name: 'Adicionar' }).click();
    await expect.poll(async () => (await projectOf(page)).markers[0]?.label).toBe('☐ Trocar a música aqui');
    expect((await projectOf(page)).markers[0]!.time).toBeCloseTo(1.5, 2);
    await expect(page.getByTestId('task-summary')).toHaveText('0 de 1 concluídas');
    await page.getByLabel('Concluir tarefa: Trocar a música aqui').check();
    await expect(page.getByTestId('task-summary')).toHaveText('1 de 1 concluídas');
    expect((await projectOf(page)).markers[0]!.label).toBe('☑ Trocar a música aqui');
    await seek(page, 0);
    await page.getByTestId('tasks').getByRole('button', { name: 'Trocar a música aqui' }).click();
    expect(await page.evaluate(() => (window.__editor as unknown as Loose).getState().playhead)).toBeCloseTo(1.5, 2);
  });
});

test.describe('listas e roteiros', () => {
  test('EDL, planilha CSV e roteiro baixam arquivos com o conteúdo do projeto', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-text').click();
    await page.getByRole('button', { name: 'Adicionar texto Título' }).click();
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.type === 'text').length).toBe(1);
    await page.getByTestId('tab-review').click();
    await page.getByText('Listas e roteiros').click();

    const grab = async (testId: string) => {
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()]);
      return { name: download.suggestedFilename(), text: (await readFile((await download.path())!, 'utf8')) };
    };
    const edl = await grab('export-edl');
    expect(edl.name).toMatch(/\.edl$/);
    expect(edl.text).toContain('TITLE: Diferenciais');
    expect(edl.text).toContain('FCM: NON-DROP FRAME');
    expect(edl.text).toContain('* FROM CLIP NAME: ');
    expect(edl.text).toMatch(/001  AX +V +C +00:00:00:00/);

    const csv = await grab('export-csv');
    expect(csv.name).toMatch(/-timeline\.csv$/);
    expect(csv.text.charCodeAt(0)).toBe(0xfeff); // BOM para o Excel reconhecer UTF-8
    expect(csv.text).toContain('Faixa;Tipo;Nome ou texto');
    expect(csv.text).toContain('Título');

    const script = await grab('export-script');
    expect(script.name).toMatch(/-roteiro\.txt$/);
    expect(script.text).toMatch(/^\[0:00–0:\d\d\] Título/);
  });

  test('copiar descrição: título, duração, capítulos e mídias usadas', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await withClip(page);
    await page.keyboard.press('Escape');
    await seek(page, 0);
    await page.keyboard.press('m');
    await page.getByTestId('tab-review').click();
    await page.getByText('Listas e roteiros').click();
    await page.getByTestId('copy-description').click();
    await expect(page.getByText('Descrição copiada')).toBeVisible();
    // a área de transferência do Windows troca LF por CRLF: normaliza antes de comparar
    const text = (await page.evaluate(() => navigator.clipboard.readText())).split('\r\n').join('\n');
    expect(text.split('\n')[0]).toBe('Diferenciais');
    expect(text).toContain('Capítulos\n0:00 Marcador 1');
    expect(text).toContain('Mídias usadas');
    expect(text).toMatch(/- vermelho\.mp4 \(0:00\)/);
  });
});

test.describe('roteiro visual e montagem', () => {
  test('reordenar planos, montar nos marcadores e encaixar na duração', async ({ page }) => {
    await withClip(page);
    await seek(page, 2);
    await page.keyboard.press('s');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    await page.getByTestId('tab-storyboard').click();
    const items = page.getByTestId('storyboard-item');
    await expect(items).toHaveCount(2);
    const [first, second] = await clipsOf(page);

    // trocar: o segundo plano passa a ser o primeiro
    await items.nth(1).getByRole('button', { name: /Mover plano 2 para antes/ }).click();
    await expect.poll(async () => (await clipsOf(page))[0]!.id).toBe(second!.id);
    expect((await clipsOf(page))[1]!.id).toBe(first!.id);
    await expect(items.nth(0)).toHaveAttribute('data-clip-id', second!.id);

    // montagem nos marcadores: 3 marcadores = 2 planos
    await expect(page.getByTestId('montage-run')).toBeDisabled();
    for (const t of [0, 1, 3]) {
      await seek(page, t);
      await page.keyboard.press('m');
    }
    await expect(page.getByTestId('montage-run')).toBeEnabled();
    await page.getByTestId('montage-run').click();
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    const shots = await clipsOf(page);
    expect(shots.map((s) => [s.start, s.duration])).toEqual([[0, 1], [1, 2]]);

    // encaixar: seleciona tudo e pede 2,4 s (3 s ÷ 1,25)
    await page.keyboard.press('Control+a');
    await page.getByLabel('Duração-alvo em segundos').fill('2.4');
    await page.getByTestId('fit-run').click();
    await expect.poll(async () => (await clipsOf(page)).reduce((n, c) => n + c.duration, 0)).toBeCloseTo(2.4, 2);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await clipsOf(page)).reduce((n, c) => n + c.duration, 0)).toBeCloseTo(3, 2);
  });
});

test.describe('simulador de daltonismo e replay', () => {
  test('simular visão aplica o filtro só no preview e a paleta volta ao normal', async ({ page }) => {
    await withClip(page);
    const canvas = page.getByTestId('preview-canvas');
    await expect(canvas).toHaveAttribute('data-vision', 'normal');
    await page.getByLabel('Simular visão').selectOption('protanopia');
    await expect(canvas).toHaveAttribute('data-vision', 'protanopia');
    await expect(canvas).toHaveCSS('filter', /vision-protanopia/);
    await expect(page.locator('filter#vision-protanopia feColorMatrix')).toHaveCount(1);
    expect((await projectOf(page)).settings).toBeTruthy(); // nada no projeto muda
    await palette(page, 'visao normal');
    await expect(canvas).toHaveAttribute('data-vision', 'normal');
  });

  test('replay do histórico passa pelos estados antigos e termina no estado atual sem salvar nada', async ({ page }) => {
    await withClip(page);
    await seek(page, 2);
    await page.keyboard.press('s');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    await seek(page, 1);
    await page.keyboard.press('m');
    await waitSaved(page);
    const revision = await page.evaluate(() => (window.__editor as unknown as Loose).getState().serverRevision as number);

    await palette(page, 'reproduzir o historico');
    await expect.poll(async () => page.evaluate(() => (window.__editor as unknown as Loose).getState().replaying as boolean), { timeout: 5_000 }).toBe(true);
    // durante o replay o projeto volta a ter 1 clipe e 0 marcadores em algum momento
    await expect.poll(async () => (await clipsOf(page)).length, { timeout: 10_000 }).toBe(1);
    await expect.poll(async () => page.evaluate(() => (window.__editor as unknown as Loose).getState().replaying as boolean), { timeout: 20_000 }).toBe(false);
    // no fim, tudo como estava: 2 clipes, 1 marcador, nada pendente de salvar e a mesma revisão no servidor
    expect((await clipsOf(page)).length).toBe(2);
    expect((await projectOf(page)).markers).toHaveLength(1);
    expect(await page.evaluate(() => (window.__editor as unknown as Loose).getState().saveState as string)).toBe('saved');
    expect(await page.evaluate(() => (window.__editor as unknown as Loose).getState().serverRevision as number)).toBe(revision);
  });
});

test.describe('comparar versões', () => {
  test('mostra o que mudou desde a versão salva e "nada mudou" quando está igual', async ({ page }) => {
    await withClip(page);
    await waitSaved(page);
    await palette(page, 'versoes do projeto');
    const dialog = page.getByRole('dialog', { name: 'Versões do projeto' });
    await dialog.getByLabel('Nome da versão').fill('Antes do corte');
    await dialog.getByTestId('save-version').click();
    await expect(dialog.getByTestId('version-list')).toContainText('Antes do corte');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // corta o clipe em 2 s: sobra 1 clipe novo e o original encurta
    await seek(page, 2);
    await page.keyboard.press('s');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    await palette(page, 'versoes do projeto');
    const row = dialog.getByRole('listitem').filter({ hasText: 'Antes do corte' });
    await row.getByRole('button', { name: /Comparar revisão/ }).click();
    const diff = row.getByTestId(/^diff-/);
    await expect(diff).toContainText('Desde esta versão');
    await expect(diff).toContainText('1 clipe adicionado');
    await expect(diff).toContainText('1 clipe com duração alterada');

    // salva uma versão agora e compara: nada mudou
    await dialog.getByLabel('Nome da versão').fill('Depois do corte');
    await dialog.getByTestId('save-version').click();
    const after = dialog.getByRole('listitem').filter({ hasText: 'Depois do corte' });
    await expect(after).toBeVisible();
    await after.getByRole('button', { name: /Comparar revisão/ }).click();
    await expect(after.getByTestId(/^diff-/)).toContainText('Nada mudou');
  });
});

test.describe('cores do quadro', () => {
  test('lê as cores do preview e aplica a escolhida ao texto selecionado', async ({ page }) => {
    await withClip(page, media.red);
    await seek(page, 1);
    await page.getByTestId('tab-text').click();
    await page.getByRole('button', { name: 'Adicionar texto Título' }).click();
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.type === 'text').length).toBe(1);
    const text = (await clipsOf(page)).find((c) => c.type === 'text')!;

    await page.getByTestId('read-colors').click();
    const chips = page.getByTestId('frame-color');
    await expect.poll(async () => chips.count(), { timeout: 15_000 }).toBeGreaterThan(0);
    // o vídeo é vermelho: a cor mais presente é um vermelho forte
    const first = (await chips.first().getAttribute('data-hex'))!;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(first.slice(i, i + 2), 16));
    expect(r!).toBeGreaterThan(180);
    expect(g!).toBeLessThan(80);
    expect(b!).toBeLessThan(80);

    await chips.first().click();
    await expect.poll(async () => ((await projectOf(page)).tracks.flatMap((t) => t.clips).find((c) => c.id === text.id) as unknown as { style: { color: string } }).style.color).toBe(first);
  });
});
