import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { clipsOf, makeMedia, near, newProject, previewPixel, projectOf, seek, signup, state, uploadAndWait, waitSaved, type Media } from './helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

async function withClip(page: Page, file: string = media.red) {
  await signup(page);
  await newProject(page, 'Recursos');
  const card = await uploadAndWait(page, file);
  await card.dblclick();
  await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  const [c] = await clipsOf(page);
  await page.locator(`[data-clip-id="${c!.id}"]`).click();
  return c!;
}

test.describe('propriedades, efeitos e transições', () => {
  test('aplica um efeito pelo painel e ajusta o parâmetro nas propriedades', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-effects').click();
    await page.getByRole('button', { name: /Saturação/ }).click();
    const props = page.getByTestId('properties');
    await props.getByRole('tab', { name: /Efeitos/ }).click();
    await expect(props).toContainText('Efeitos (1)');
    const field = props.getByRole('textbox', { name: 'Saturação' });
    await field.fill('0');
    await field.press('Enter');
    await seek(page, 1);
    await expect
      .poll(async () => {
        const [r, g, b] = await previewPixel(page);
        return Math.max(r, g, b) - Math.min(r, g, b) < 12;
      }, { timeout: 15_000 })
      .toBe(true);
    // desativar o efeito devolve o vermelho
    await props.getByRole('button', { name: 'Desativar Saturação' }).click();
    await expect.poll(async () => near(await previewPixel(page), [255, 0, 0], 50), { timeout: 15_000 }).toBe(true);
  });

  test('velocidade 2× reduz a duração do clipe na timeline', async ({ page }) => {
    const c = await withClip(page);
    await page.getByTestId('properties').getByRole('button', { name: '2×', exact: true }).click();
    await expect.poll(async () => (await clipsOf(page))[0]!.duration).toBeCloseTo(c.duration / 2, 1);
    await expect(page.locator('[data-clip-id]').first()).toContainText('2×');
  });

  test('keyframes animam a posição durante o tempo', async ({ page }) => {
    const c = await withClip(page);
    const props = page.getByTestId('properties');
    const scale = props.getByRole('textbox', { name: 'Escala' });
    await scale.fill('40');
    await scale.press('Enter');
    const x = props.getByRole('textbox', { name: 'Posição X' });
    const kf = props.getByRole('button', { name: /keyframe aqui/ }).first(); // o primeiro losango da seção Transformação é o da posição X
    await seek(page, 0);
    await x.fill('-30');
    await x.press('Enter');
    await kf.click();
    await seek(page, 3);
    await x.fill('30');
    await x.press('Enter');
    const proj = await projectOf(page);
    const clip = proj.tracks[0]!.clips[0] as unknown as { keyframes: { x: Array<{ time: number; value: number }> } };
    expect(clip.keyframes.x.length).toBeGreaterThanOrEqual(2);
    expect(c.id).toBe(proj.tracks[0]!.clips[0]!.id);

    await seek(page, 0.1);
    await expect.poll(async () => near(await previewPixel(page, 0.25, 0.5), [255, 0, 0], 60), { timeout: 15_000 }).toBe(true);
    expect(near(await previewPixel(page, 0.85, 0.5), [0, 0, 0], 30)).toBe(true);
    await seek(page, 2.9);
    await expect.poll(async () => near(await previewPixel(page, 0.85, 0.5), [255, 0, 0], 60), { timeout: 15_000 }).toBe(true);
    expect(near(await previewPixel(page, 0.15, 0.5), [0, 0, 0], 30)).toBe(true);
  });

  test('transição dissolver entre dois clipes cria a sobreposição e mistura as cores', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Transição');
    await (await uploadAndWait(page, media.red)).dblclick();
    await (await uploadAndWait(page, media.blue)).dblclick();
    const [a, b] = await clipsOf(page);
    await page.locator(`[data-clip-id="${b!.id}"]`).click();
    await page.getByTestId('tab-transitions').click();
    await page.getByRole('button', { name: /Dissolver/ }).click();
    const after = await clipsOf(page);
    expect(after[1]!.start).toBeLessThan(a!.duration - 0.5); // sobreposição de 0,6 s
    const overlapMid = after[1]!.start + 0.3;
    await seek(page, overlapMid);
    await expect
      .poll(async () => {
        const [r, , bl] = await previewPixel(page);
        return r > 60 && bl > 60;
      }, { timeout: 15_000 })
      .toBe(true);
    // remover pelas propriedades restaura a posição
    await page.getByTestId('properties').getByRole('combobox', { name: 'Tipo' }).selectOption('none');
    await expect.poll(async () => (await clipsOf(page))[1]!.start).toBeCloseTo(a!.duration, 2);
  });

  test('extrair áudio cria um clipe de áudio ligado ao vídeo', async ({ page }) => {
    const c = await withClip(page);
    await page.getByRole('button', { name: 'Extrair áudio do vídeo' }).click();
    const clips = await clipsOf(page);
    expect(clips.map((x) => x.track).sort()).toEqual(['audio', 'video']);
    await page.locator(`[data-clip-id="${c.id}"]`).click();
    expect((await state(page)).selection).toHaveLength(2); // seleção expandida pelo vínculo
    await page.getByRole('button', { name: 'Desvincular áudio e vídeo' }).click();
    await page.locator(`[data-clip-id="${c.id}"]`).click();
    expect((await state(page)).selection).toHaveLength(1);
  });
});

test.describe('texto e legendas', () => {
  test('adiciona um título, edita o conteúdo e ele aparece no preview', async ({ page }) => {
    await withClip(page, media.blue);
    await page.getByTestId('tab-text').click();
    await page.getByRole('button', { name: 'Adicionar texto Título' }).click();
    const props = page.getByTestId('properties');
    await props.getByLabel('Conteúdo').fill('OLÁ MUNDO');
    await props.getByLabel('Conteúdo').blur();
    await seek(page, 1);
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const c = document.querySelector<HTMLCanvasElement>('[data-testid="preview-canvas"]')!;
            const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i]! > 220 && d[i + 1]! > 220 && d[i + 2]! > 220) n++;
            return n;
          }),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(200);
    const p = await projectOf(page);
    expect(p.tracks.some((t) => t.kind === 'text')).toBe(true);
  });

  test('importa SRT, gera clipes de legenda e exporta de volta o mesmo conteúdo', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-text').click();
    const srt = '1\n00:00:00,500 --> 00:00:01,800\nPrimeira legenda\n\n2\n00:00:02,000 --> 00:00:03,200\nSegunda legenda\n';
    await page.getByTestId('subtitle-input').setInputFiles({ name: 'legendas.srt', mimeType: 'application/x-subrip', buffer: Buffer.from(srt) });
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.type === 'caption').length).toBe(2);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '.srt' }).click()]);
    const out = await readFile((await download.path())!, 'utf8');
    expect(out).toContain('00:00:00,500 --> 00:00:01,800');
    expect(out).toContain('Primeira legenda');
    expect(out).toContain('Segunda legenda');

    // edita o texto da primeira legenda e confere a atualização
    const cap = (await clipsOf(page)).find((c) => c.type === 'caption')!;
    await page.locator(`[data-clip-id="${cap.id}"]`).click();
    const txt = page.getByTestId('properties').getByLabel('Conteúdo');
    await txt.fill('Texto corrigido aqui');
    await txt.blur();
    const proj = await projectOf(page);
    const caption = proj.tracks.flatMap((t) => t.clips).find((c) => c.id === cap.id) as unknown as { text: string; words: unknown[] };
    expect(caption.text).toBe('Texto corrigido aqui');
    expect(caption.words).toHaveLength(3);
  });

  test('arquivo de legenda inválido mostra erro e não altera o projeto', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-text').click();
    await page.getByTestId('subtitle-input').setInputFiles({ name: 'x.srt', mimeType: 'text/plain', buffer: Buffer.from('isto não é legenda') });
    await expect(page.getByText('Nenhuma legenda encontrada')).toBeVisible();
    expect((await clipsOf(page)).filter((c) => c.type === 'caption')).toHaveLength(0);
  });
});

test.describe('IA e análises', () => {
  test('sem provedores configurados a IA avisa em vez de simular', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-ai').click();
    const panel = page.getByTestId('ai-panel');
    await expect(panel).toContainText('Transcrição indisponível');
    await panel.getByText('Assistente de edição').click();
    await expect(panel).toContainText('Assistente indisponível');
    await panel.getByText('Ainda não disponíveis').click();
    await expect(panel).toContainText('Remoção de fundo');
  });

  test('detecta silêncios e remove do clipe selecionado, encurtando a timeline', async ({ page }) => {
    await withClip(page, media.talk);
    await page.getByTestId('tab-ai').click();
    const panel = page.getByTestId('ai-panel');
    await panel.getByRole('button', { name: 'Detectar silêncios' }).click();
    await expect(panel.getByText(/1 silêncios/)).toBeVisible({ timeout: 60_000 });
    const before = (await clipsOf(page))[0]!.duration;
    await panel.getByRole('button', { name: 'Remover do clipe selecionado' }).click();
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    const clips = await clipsOf(page);
    const total = clips[clips.length - 1]!.start + clips[clips.length - 1]!.duration;
    expect(before - total).toBeGreaterThan(1.5);
    expect(total).toBeGreaterThan(1.7);
    expect(total).toBeLessThan(2.5);
    // desfaz de uma vez
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(1);
  });

  test('sugere melhores trechos e cria uma sequência editável', async ({ page }) => {
    // Áudio contínuo de 4 s: há trecho "com fala" longo o bastante para a heurística (mínimo de 2 s).
    await withClip(page, media.red);
    await page.getByTestId('tab-ai').click();
    const panel = page.getByTestId('ai-panel');
    await panel.getByLabel('Duração alvo (s)').fill('3');
    await panel.getByRole('button', { name: 'Sugerir trechos' }).click();
    await expect(panel.getByRole('button', { name: 'Criar sequência na timeline' })).toBeVisible({ timeout: 60_000 });
    await panel.getByRole('button', { name: 'Criar sequência na timeline' }).click();
    const tracks = (await projectOf(page)).tracks.filter((t) => t.kind === 'video');
    expect(tracks).toHaveLength(2);
    expect(tracks[0]!.clips.length).toBeGreaterThan(0);
  });
});

test.describe('resiliência', () => {
  test('conflito entre duas janelas: avisa e permite sobrescrever', async ({ page, context }) => {
    await withClip(page);
    await waitSaved(page);
    const url = page.url();
    const other = await context.newPage();
    await other.goto(url);
    await expect(other.getByTestId('editor')).toBeVisible();
    await expect.poll(async () => (await clipsOf(other)).length).toBe(1);

    await seek(page, 1);
    await page.keyboard.press('s');
    await waitSaved(page);

    await seek(other, 2);
    await other.keyboard.press('s');
    await expect(other.getByRole('alert')).toContainText('alterado em outra janela', { timeout: 20_000 });
    await other.getByRole('button', { name: 'Sobrescrever com minha versão' }).click();
    await waitSaved(other);
    await page.reload();
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    expect((await clipsOf(page))[1]!.start).toBeCloseTo(2, 1);
  });

  test('conflito: descartar minhas alterações recarrega a versão do servidor', async ({ page, context }) => {
    await withClip(page);
    await waitSaved(page);
    const other = await context.newPage();
    await other.goto(page.url());
    await expect.poll(async () => (await clipsOf(other)).length).toBe(1);
    await seek(page, 1);
    await page.keyboard.press('s');
    await waitSaved(page);
    await seek(other, 3);
    await other.keyboard.press('s');
    await expect(other.getByRole('alert')).toBeVisible({ timeout: 20_000 });
    await other.getByRole('button', { name: 'Descartar minhas alterações' }).click();
    await expect.poll(async () => (await clipsOf(other)).length).toBe(2);
    expect((await clipsOf(other))[1]!.start).toBeCloseTo(1, 1);
  });

  test('offline: mantém as edições e sincroniza ao reconectar', async ({ page, context }) => {
    await withClip(page);
    await waitSaved(page);
    await context.setOffline(true);
    await seek(page, 2);
    await page.keyboard.press('s');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'offline', { timeout: 20_000 });
    await context.setOffline(false);
    await waitSaved(page);
    await page.reload();
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
  });

  test('recupera o rascunho local quando o salvamento não chegou ao servidor', async ({ page }) => {
    await withClip(page);
    await waitSaved(page);
    await page.route('**/api/projects/*', (route) => (route.request().method() === 'PUT' ? route.abort() : route.continue()));
    await seek(page, 2);
    await page.keyboard.press('s');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    await page.waitForTimeout(1200); // o rascunho local é gravado em ~500 ms
    page.on('dialog', (d) => void d.accept());
    await page.unroute('**/api/projects/*');
    await page.route('**/api/projects/*', (route) => (route.request().method() === 'PUT' ? route.abort() : route.continue()));
    await page.reload();
    await expect(page.getByText('Recuperamos alterações não salvas')).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
  });
});

test.describe('interface', () => {
  test('atalhos: ? abre a lista e Esc fecha', async ({ page }) => {
    await withClip(page);
    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog', { name: 'Atalhos de teclado' });
    await expect(dialog).toContainText('Dividir clipe');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('faixa oculta some do preview; faixa bloqueada impede exclusão', async ({ page }) => {
    await withClip(page);
    await seek(page, 1);
    await expect.poll(async () => near(await previewPixel(page), [255, 0, 0], 50), { timeout: 15_000 }).toBe(true);
    await page.getByTestId('track-header-video').getByRole('button', { name: 'Ocultar faixa' }).click();
    await expect.poll(async () => near(await previewPixel(page), [0, 0, 0], 20), { timeout: 15_000 }).toBe(true);
    await page.getByTestId('track-header-video').getByRole('button', { name: 'Mostrar faixa' }).click();
    await page.getByTestId('track-header-video').getByRole('button', { name: 'Bloquear faixa' }).click();
    const [c] = await clipsOf(page);
    await page.locator(`[data-clip-id="${c!.id}"]`).click();
    await page.keyboard.press('Delete');
    await expect(page.getByText(/está bloqueada/)).toBeVisible();
    expect((await clipsOf(page)).length).toBe(1);
  });

  test('painéis redimensionáveis por teclado e layout persistido', async ({ page }) => {
    await withClip(page);
    const sep = page.getByRole('separator', { name: 'Redimensionar painel esquerdo' });
    const aside = page.getByRole('complementary', { name: 'Biblioteca e ferramentas' });
    const w0 = (await aside.boundingBox())!.width;
    await sep.focus();
    await sep.press('Shift+ArrowRight');
    expect((await aside.boundingBox())!.width).toBeGreaterThan(w0 + 20);
    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    expect((await aside.boundingBox())!.width).toBeGreaterThan(w0 + 20);
  });

  test('em tela estreita o painel de propriedades vira gaveta', async ({ page }) => {
    await withClip(page);
    await page.setViewportSize({ width: 900, height: 800 });
    await expect(page.getByRole('complementary', { name: 'Propriedades' })).toBeHidden();
    await page.getByRole('button', { name: 'Painel de propriedades' }).click();
    await expect(page.getByRole('complementary', { name: 'Propriedades' })).toBeVisible();
  });

  test('importar arquivo inválido mostra erro; remover mídia em uso pede confirmação', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('file-input').setInputFiles({ name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') });
    await expect(page.getByText('tipo de arquivo não suportado')).toBeVisible();
    const card = page.getByTestId('media-list').getByRole('button', { name: /^vermelho\.mp4/ });
    await card.hover();
    await page.getByRole('button', { name: 'Remover vermelho.mp4' }).click();
    await expect(page.getByText('Esta mídia está na timeline')).toBeVisible();
    await page.getByRole('button', { name: 'Remover', exact: true }).click();
    await expect.poll(async () => (await clipsOf(page)).length).toBe(0);
  });
});
