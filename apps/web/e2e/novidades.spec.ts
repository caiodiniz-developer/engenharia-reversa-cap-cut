import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { clipsOf, makeMedia, near, newProject, previewPixel, projectOf, seek, signup, uploadAndWait, waitSaved, type Media } from './helpers';

let media: Media;
test.beforeAll(async () => {
  media = await makeMedia();
});

async function withClip(page: Page, file: string = media.red) {
  await signup(page);
  await newProject(page, 'Novidades');
  const card = await uploadAndWait(page, file);
  await card.dblclick();
  await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  const [c] = await clipsOf(page);
  await page.locator(`[data-clip-id="${c!.id}"]`).click();
  return c!;
}

test.describe('paleta de comandos e tema', () => {
  test('Ctrl+K abre a paleta, busca sem acento e executa o comando (dividir)', async ({ page }) => {
    await withClip(page);
    await seek(page, 2);
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox', { name: 'Buscar comandos' });
    await expect(input).toBeFocused();
    await input.fill('dividir');
    await expect(page.getByRole('option', { name: /Dividir clipe/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    await expect(input).toBeHidden();
  });

  test('a paleta navega com setas, mostra "nenhum resultado" e fecha com Esc', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('palette-button').click();
    const input = page.getByRole('combobox', { name: 'Buscar comandos' });
    await input.fill('animacoes');
    await expect(page.getByRole('option', { name: /Abrir painel: Animações/ })).toBeVisible();
    await input.fill('zzzz-nada');
    await expect(page.getByText(/Nenhum comando encontrado/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(input).toBeHidden();
    // abrir um painel pela paleta
    await page.keyboard.press('Control+k');
    await input.fill('abrir painel elementos');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('elements-panel')).toBeVisible();
  });

  test('o tema claro/escuro é aplicado, persiste ao recarregar e vale na tela de projetos', async ({ page }) => {
    await withClip(page);
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
    expect(await theme()).toBe('dark');
    await page.getByTestId('theme-toggle').click();
    expect(await theme()).toBe('light');
    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    expect(await theme()).toBe('light');
    await page.goto('/');
    expect(await theme()).toBe('light');
    await page.getByRole('button', { name: 'Mudar para o tema escuro' }).click();
    expect(await theme()).toBe('dark');
  });
});

test.describe('animações, elementos e áudio', () => {
  test('animação pronta "Aparecer": vira keyframes, aparece na aba e o preview começa transparente', async ({ page }) => {
    const c = await withClip(page);
    await page.getByTestId('tab-animations').click();
    await page.getByRole('button', { name: 'Animação Aparecer' }).click();
    const clip = (await projectOf(page)).tracks[0]!.clips[0] as unknown as { keyframes: { opacity: Array<{ time: number; value: number }> } };
    expect(clip.keyframes.opacity.map((k) => [k.time, k.value])).toEqual([[0, 0], [0.6, 1]]);

    await seek(page, 0);
    await expect.poll(async () => (await previewPixel(page))[0]! < 40, { timeout: 15_000 }).toBe(true);
    await seek(page, 2);
    await expect.poll(async () => near(await previewPixel(page), [255, 0, 0], 40), { timeout: 15_000 }).toBe(true);

    // a aba Animação das propriedades lista e permite editar
    const props = page.getByTestId('properties');
    await props.getByRole('tab', { name: /Animação/ }).click();
    await expect(page.getByTestId('animation-tab')).toContainText('Opacidade');
    const t2 = props.getByLabel('Opacidade: tempo do keyframe 2');
    await t2.fill('1.5');
    await expect.poll(async () => ((await projectOf(page)).tracks[0]!.clips[0] as unknown as { keyframes: { opacity: Array<{ time: number }> } }).keyframes.opacity[1]!.time).toBeCloseTo(1.5, 3);
    await props.getByRole('button', { name: 'Remover todos' }).click();
    await expect.poll(async () => Object.keys(((await projectOf(page)).tracks[0]!.clips[0] as unknown as { keyframes: object }).keyframes).length).toBe(0);
    expect(c.id).toBeTruthy();
  });

  test('entrada + saída convivem (Aparecer e Desaparecer) e o undo desfaz a última', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-animations').click();
    await page.getByRole('button', { name: 'Animação Aparecer' }).click();
    await page.getByRole('button', { name: 'Animação Desaparecer' }).click();
    const kf = async () => ((await projectOf(page)).tracks[0]!.clips[0] as unknown as { keyframes: { opacity: unknown[] } }).keyframes.opacity;
    expect(await kf()).toHaveLength(4);
    await page.keyboard.press('Control+z');
    expect(await kf()).toHaveLength(2);
  });

  test('fundo de cor sólida: gera a imagem no servidor, entra na biblioteca e na timeline', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Fundos');
    await page.getByTestId('tab-elements').click();
    await page.getByRole('button', { name: 'Fundo #3b82f6' }).click();
    await expect.poll(async () => (await clipsOf(page)).length, { timeout: 30_000 }).toBe(1);
    const proj = await projectOf(page);
    const asset = Object.values(proj.media)[0]!;
    expect(asset).toMatchObject({ kind: 'image', width: 1920, height: 1080 });
    await seek(page, 1);
    await expect.poll(async () => near(await previewPixel(page), [0x3b, 0x82, 0xf6], 30), { timeout: 20_000 }).toBe(true);
    // degradê pronto também
    await page.getByRole('radio', { name: 'Degradê' }).click();
    await page.getByRole('button', { name: 'Degradê Oceano' }).click();
    await expect.poll(async () => Object.keys((await projectOf(page)).media).length, { timeout: 30_000 }).toBe(2);
  });

  test('forma: gera o PNG transparente, entra numa faixa nova no topo e o preview mostra o fundo nos cantos', async ({ page }) => {
    await withClip(page, media.blue);
    await seek(page, 1);
    await page.getByTestId('tab-elements').click();
    await page.getByRole('radio', { name: 'Formas' }).click();
    await page.getByRole('button', { name: 'Forma Círculo' }).click();
    await expect.poll(async () => (await projectOf(page)).tracks.length, { timeout: 30_000 }).toBe(2);
    const proj = await projectOf(page);
    expect(proj.tracks[0]!.kind).toBe('video'); // faixa nova no topo
    expect(proj.tracks[0]!.clips[0]!.start).toBeCloseTo(1, 2);
    expect(Object.values(proj.media).some((m) => m.name.startsWith('Círculo'))).toBe(true);
    await seek(page, 1.5);
    await expect.poll(async () => near(await previewPixel(page), [255, 255, 255], 40), { timeout: 20_000 }).toBe(true);
    expect(near(await previewPixel(page, 0.03, 0.05), [0, 0, 255], 50)).toBe(true); // canto: vídeo azul por baixo
  });

  test('gravar voz: grava com o microfone, envia e coloca na faixa de áudio', async ({ page }) => {
    await signup(page);
    await newProject(page, 'Voz');
    await page.getByTestId('tab-audio').click();
    await page.getByTestId('rec-start').click();
    await expect(page.getByTestId('rec-time')).toBeVisible();
    await page.waitForTimeout(1800);
    await page.getByTestId('rec-stop').click();
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.track === 'audio').length, { timeout: 40_000 }).toBe(1);
    const audio = Object.values((await projectOf(page)).media)[0]!;
    expect(audio.kind).toBe('audio');
    expect(audio.name).toMatch(/^Gravação de voz/);
    await expect(page.getByTestId('audio-list')).toContainText('Gravação de voz');
  });
});

test.describe('timeline e preview', () => {
  test('o clipe de vídeo mostra a tira de quadros (miniaturas) do servidor', async ({ page }) => {
    await withClip(page, media.blue);
    await expect(page.locator('[data-clip-id] [style*="/film"]').first()).toBeVisible({ timeout: 20_000 });
  });

  test('fechar espaços vazios encosta os clipes da faixa', async ({ page }) => {
    await withClip(page);
    const [a] = await clipsOf(page);
    await page.evaluate((id) => {
      const s = window.__editor.getState() as unknown as { moveSelection(ids: string[], d: number, p: string): boolean };
      s.moveSelection([id], 5, id);
    }, a!.id);
    expect((await clipsOf(page))[0]!.start).toBe(5);
    const header = page.getByTestId('track-header-video');
    await header.hover();
    await header.getByRole('button', { name: 'Fechar espaços vazios da faixa' }).click();
    expect((await clipsOf(page))[0]!.start).toBe(0);
  });

  test('setas ↑/↓ saltam entre os cortes (bordas de clipes) e a paleta faz o mesmo', async ({ page }) => {
    await withClip(page);
    await seek(page, 2);
    await page.keyboard.press('s'); // divide em 2s: cortes em 0, 2 e a duração total
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    const head = () => page.evaluate(() => window.__editor.getState().playhead);
    await seek(page, 0);
    await page.keyboard.press('ArrowDown');
    expect(await head()).toBeCloseTo(2, 3);
    await page.keyboard.press('ArrowDown');
    expect(await head()).toBeGreaterThan(2);
    await page.keyboard.press('ArrowUp');
    expect(await head()).toBeCloseTo(2, 3);
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('corte anterior');
    await page.keyboard.press('Enter');
    expect(await head()).toBeCloseTo(0, 3);
  });

  test('Shift+Z ajusta o zoom para o projeto caber na timeline', async ({ page }) => {
    await withClip(page);
    const zoom = () => page.evaluate(() => window.__editor.getState().zoom);
    await page.getByRole('button', { name: 'Aumentar zoom' }).click();
    await page.getByRole('button', { name: 'Aumentar zoom' }).click();
    const before = await zoom();
    await page.keyboard.press('Shift+Z');
    const after = await zoom();
    expect(after).not.toBeCloseTo(before, 1);
    // o clipe inteiro cabe na largura visível da timeline
    const box = await page.locator('[data-clip-id]').first().boundingBox();
    const tl = await page.getByTestId('timeline').boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(tl!.x + tl!.width + 1);
  });

  test('Q/W apara início e fim até a cabeça de reprodução (e o undo desfaz)', async ({ page }) => {
    const c = await withClip(page);
    await seek(page, 2);
    await page.keyboard.press('w');
    await expect.poll(async () => (await clipsOf(page))[0]!.duration).toBeCloseTo(2, 3);
    await seek(page, 1);
    await page.keyboard.press('q');
    const [after] = await clipsOf(page);
    expect(after!.start).toBeCloseTo(1, 3);
    expect(after!.duration).toBeCloseTo(1, 3);
    expect(after!.sourceIn).toBeCloseTo(1, 3);
    await page.keyboard.press('Control+z');
    const [undone] = await clipsOf(page);
    expect(undone!.start).toBeCloseTo(0, 3);
    expect(c.id).toBe(undone!.id);
  });

  test('Alt+setas empurram a seleção por quadro e por segundo', async ({ page }) => {
    await withClip(page);
    const fps = await page.evaluate(() => window.__editor.getState().project.settings.fps);
    await page.keyboard.press('Alt+ArrowRight');
    await expect.poll(async () => (await clipsOf(page))[0]!.start).toBeCloseTo(1 / fps, 4);
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await expect.poll(async () => (await clipsOf(page))[0]!.start).toBeCloseTo(1 + 1 / fps, 4);
    await page.keyboard.press('Alt+ArrowLeft');
    await expect.poll(async () => (await clipsOf(page))[0]!.start).toBeCloseTo(1, 4);
  });

  test('a paleta seleciona os clipes à direita e à esquerda da cabeça', async ({ page }) => {
    await withClip(page);
    await seek(page, 2);
    await page.keyboard.press('s');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    await seek(page, 2);
    const sel = () => page.evaluate(() => window.__editor.getState().selection.length);
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('selecionar clipes a direita');
    await page.keyboard.press('Enter');
    expect(await sel()).toBe(1);
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('selecionar clipes a esquerda');
    await page.keyboard.press('Enter');
    const picked = await page.evaluate(() => window.__editor.getState().selection);
    const clips = await clipsOf(page);
    expect(picked).toEqual([clips[0]!.id]);
  });

  test('lista de marcadores: adiciona, renomeia, vai até o marcador e remove', async ({ page }) => {
    await withClip(page);
    await seek(page, 1);
    await page.keyboard.press('m');
    await seek(page, 3);
    await page.keyboard.press('m');
    await page.getByTestId('markers-button').click();
    const pop = page.getByTestId('markers-popover');
    await expect(pop.getByRole('listitem')).toHaveCount(2);

    await pop.getByRole('textbox').first().fill('Intro');
    await pop.getByRole('textbox').first().press('Enter');
    await expect.poll(async () => (await projectOf(page)).markers[0]!.label).toBe('Intro');

    await seek(page, 0);
    await pop.getByRole('button', { name: /Ir ao marcador Intro/ }).click();
    expect(await page.evaluate(() => window.__editor.getState().playhead)).toBeCloseTo(1, 3);

    await pop.getByRole('button', { name: /Remover marcador Intro/ }).click();
    await expect(pop.getByRole('listitem')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
  });

  test('velocidade do preview: ] aumenta, o botão alterna e a cabeça anda mais rápido', async ({ page }) => {
    await withClip(page);
    const rate = () => page.evaluate(() => window.__editor.getState().rate);
    expect(await rate()).toBe(1);
    await page.keyboard.press(']');
    expect(await rate()).toBe(1.25);
    await page.keyboard.press('[');
    await page.keyboard.press('[');
    expect(await rate()).toBe(0.75);
    // o botão percorre até o máximo e volta ao mínimo
    const btn = page.getByTestId('rate-button');
    for (let i = 0; i < 4; i++) await btn.click();
    expect(await rate()).toBe(2);
    await expect(btn).toHaveText('2×');

    // mede a razão entre o avanço da cabeça e o tempo real (imune à lentidão de inicialização)
    await seek(page, 0);
    await page.getByTestId('play-button').click();
    await expect.poll(async () => (await page.evaluate(() => window.__editor.getState().playhead)) > 0.2, { timeout: 15_000 }).toBe(true);
    const sample = () => page.evaluate(() => ({ t: window.__editor.getState().playhead, w: performance.now() / 1000 }));
    const s1 = await sample();
    await page.waitForTimeout(1000);
    const s2 = await sample();
    await page.getByTestId('play-button').click();
    const ratio = (s2.t - s1.t) / (s2.w - s1.w);
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(2.4);
    await btn.click();
    expect(await rate()).toBe(0.25);
  });

  test('copiar e colar atributos (Ctrl+Alt+C/V) e redefinir pela paleta', async ({ page }) => {
    const first = await withClip(page);
    await page.keyboard.press('Control+d');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    const second = (await clipsOf(page)).find((c) => c.id !== first.id)!;
    const scaleOf = async (id: string) => (await projectOf(page)).tracks.flatMap((t) => t.clips).find((c) => c.id === id) as unknown as { transform: { scale: number } };
    await page.evaluate((id) => {
      const s = window.__editor.getState() as unknown as { patchClip(id: string, fn: (c: { transform: object }) => object, label: string): void };
      s.patchClip(id, (c) => ({ ...c, transform: { ...c.transform, scale: 1.7 } }), 'teste');
    }, first.id);
    await page.locator(`[data-clip-id="${first.id}"]`).click();
    await page.keyboard.press('Control+Alt+c');
    await page.locator(`[data-clip-id="${second.id}"]`).click();
    expect((await scaleOf(second.id)).transform.scale).toBe(1);
    await page.keyboard.press('Control+Alt+v');
    await expect.poll(async () => (await scaleOf(second.id)).transform.scale).toBeCloseTo(1.7, 3);

    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('redefinir transformacao');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await scaleOf(second.id)).transform.scale).toBe(1);
    expect((await scaleOf(first.id)).transform.scale).toBeCloseTo(1.7, 3); // a origem não muda
  });

  test('colocar clipes em sequência e dividir nos marcadores pela paleta', async ({ page }) => {
    await withClip(page);
    await seek(page, 2);
    await page.keyboard.press('s');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    const [a, b] = await clipsOf(page);
    await page.evaluate((id) => {
      const s = window.__editor.getState() as unknown as { moveSelection(ids: string[], d: number, p: string): boolean };
      s.moveSelection([id], 3, id);
    }, b!.id);
    expect((await clipsOf(page))[1]!.start).toBeCloseTo(5, 3);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('colocar clipes selecionados em sequencia');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('combobox', { name: 'Buscar comandos' })).toBeHidden();
    await expect.poll(async () => (await clipsOf(page))[1]!.start).toBeCloseTo(a!.duration, 3);

    // marcadores em 0,5 e 1: divide o primeiro clipe em três
    await seek(page, 0.5);
    await page.keyboard.press('m');
    await seek(page, 1);
    await page.keyboard.press('m');
    await page.locator(`[data-clip-id="${a!.id}"]`).click();
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('dividir clipes nos marcadores');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(4);
  });

  test('timecode clicável: digitar 0:02, 00:00:01:15 e um valor inválido', async ({ page }) => {
    await withClip(page);
    const head = () => page.evaluate(() => window.__editor.getState().playhead);
    const fps = await page.evaluate(() => window.__editor.getState().project.settings.fps);
    await page.getByTestId('timecode').getByRole('button').click();
    const input = page.getByRole('textbox', { name: 'Ir para o tempo' });
    await input.fill('0:02');
    await input.press('Enter');
    expect(await head()).toBeCloseTo(2, 3);

    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('ir para o tempo');
    await page.keyboard.press('Enter');
    await page.getByRole('textbox', { name: 'Ir para o tempo' }).fill('00:00:01:15');
    await page.keyboard.press('Enter');
    expect(await head()).toBeCloseTo(1 + 15 / fps, 2);

    await page.getByTestId('timecode').getByRole('button').click();
    await page.getByRole('textbox', { name: 'Ir para o tempo' }).fill('abc');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Tempo inválido/)).toBeVisible();
    expect(await head()).toBeCloseTo(1 + 15 / fps, 2); // não se mexe
  });

  test('paleta: selecionar todos os textos / vídeos escolhe só o tipo pedido', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-text').click();
    await page.getByRole('button', { name: 'Adicionar texto Título' }).click();
    await expect.poll(async () => (await clipsOf(page)).length).toBe(2);
    const pick = async (query: string) => {
      await page.keyboard.press('Control+k');
      await page.getByRole('combobox', { name: 'Buscar comandos' }).fill(query);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('combobox', { name: 'Buscar comandos' })).toBeHidden();
      return page.evaluate(() => window.__editor.getState().selection);
    };
    const clips = await clipsOf(page);
    const text = clips.find((c) => c.type === 'text')!;
    const video = clips.find((c) => c.type === 'media')!;
    expect(await pick('selecionar todos os textos')).toEqual([text.id]);
    expect(await pick('selecionar todos os videos')).toEqual([video.id]);
  });

  test('barra de estado mostra formato, contagens, seleção, trecho e velocidade', async ({ page }) => {
    await withClip(page);
    const bar = page.getByTestId('status-bar');
    await expect(bar).toContainText('16:9');
    await expect(bar).toContainText('1 faixa · 1 clipe');
    await expect(page.getByTestId('status-selected')).toHaveText('1 selecionado');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('status-selected')).toHaveCount(0);
    await seek(page, 1);
    await page.keyboard.press('i');
    await expect(page.getByTestId('status-range')).toContainText('Trecho 0:01');
    await page.keyboard.press(']');
    await expect(bar).toContainText('Preview 1.25×');
    await page.keyboard.press('n');
    await expect(bar).toContainText('Ímã desligado');
  });

  test('altura das faixas alterna entre compacta, normal e alta e é lembrada ao recarregar', async ({ page }) => {
    await withClip(page);
    const lane = page.locator('[data-track-id]').first();
    const h = async () => (await lane.boundingBox())!.height;
    const btn = page.getByTestId('density-button');
    await expect(btn).toHaveText(/Normal/);
    const normal = await h();
    await btn.click();
    await expect(btn).toHaveText(/Alta/);
    expect(await h()).toBeGreaterThan(normal + 10);
    await btn.click();
    await expect(btn).toHaveText(/Compacta/);
    expect(await h()).toBeLessThan(normal - 10);
    await page.reload();
    await expect(page.getByTestId('density-button')).toHaveText(/Compacta/);
  });

  test('salvar o quadro atual gera um PNG válido', async ({ page }) => {
    await withClip(page);
    await seek(page, 1);
    await expect.poll(async () => near(await previewPixel(page), [255, 0, 0], 40), { timeout: 15_000 }).toBe(true);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-frame').click()]);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const bytes = await readFile((await download.path())!);
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(bytes.length).toBeGreaterThan(500);
  });

  test('o painel lateral recolhe e volta pelo trilho; a paleta também o reabre', async ({ page }) => {
    await withClip(page);
    await expect(page.getByTestId('file-input')).toBeAttached();
    await page.getByRole('button', { name: 'Recolher painel' }).click();
    await expect(page.getByTestId('file-input')).toHaveCount(0);
    await page.getByTestId('tab-media').click();
    await expect(page.getByTestId('file-input')).toBeAttached();
  });

  test('novas predefinições de texto: Terço inferior entra alinhado à esquerda e com fundo', async ({ page }) => {
    await withClip(page);
    await page.getByTestId('tab-text').click();
    await page.getByRole('button', { name: 'Adicionar texto Terço inferior' }).click();
    await expect.poll(async () => (await clipsOf(page)).filter((c) => c.type === 'text').length).toBe(1);
    const text = (await projectOf(page)).tracks.flatMap((t) => t.clips).find((c) => c.type === 'text') as unknown as { text: string; style: { align: string; background?: string; fontSize: number } };
    expect(text.text).toBe('Nome Sobrenome');
    expect(text.style).toMatchObject({ align: 'left', fontSize: 56 });
    expect(text.style.background).toBeTruthy();
  });

  test('propriedades em abas conforme o tipo do clipe', async ({ page }) => {
    await withClip(page);
    const props = page.getByTestId('properties');
    await expect(props.getByRole('tab')).toHaveText(['Vídeo', 'Áudio', 'Efeitos', 'Animação']);
    await page.getByTestId('tab-text').click();
    await page.getByRole('button', { name: 'Adicionar texto Título' }).click();
    await expect(props.getByRole('tab')).toHaveText(['Texto', 'Estilo', 'Animação']);
    await props.getByRole('tab', { name: 'Estilo' }).click();
    await expect(props.getByRole('combobox', { name: 'Fonte' })).toBeVisible();
  });
});

test.describe('versões do projeto', () => {
  test('salva um marco, apaga o clipe e restaura a versão (reversível)', async ({ page }) => {
    await withClip(page);
    await waitSaved(page);
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('versoes do projeto');
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Versões do projeto' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Nome da versão').fill('Marco A');
    await dialog.getByTestId('save-version').click();
    await expect(dialog.getByTestId('version-list')).toContainText('Marco A');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // apaga o clipe e confirma que o servidor tem o projeto vazio
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await clipsOf(page)).length).toBe(0);
    await waitSaved(page);

    // reabre pelo histórico e restaura o marco
    await page.getByRole('button', { name: 'Histórico de operações' }).click();
    await page.getByRole('button', { name: /Versões salvas do projeto/ }).click();
    await expect(dialog).toBeVisible();
    const row = dialog.getByRole('listitem').filter({ hasText: 'Marco A' });
    await row.getByRole('button', { name: /Restaurar revisão/ }).click();
    await row.getByRole('button', { name: /Confirmar restauração/ }).click();
    await expect.poll(async () => (await clipsOf(page)).length).toBe(1);
    // a restauração guardou o estado anterior (projeto vazio) como nova versão
    await expect(dialog.getByTestId('version-list')).toContainText('Antes de restaurar');
    await page.keyboard.press('Escape');
    // o servidor passa a ter o clipe de volta
    await waitSaved(page);
    await page.reload();
    await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  });
});

test.describe('tela de projetos', () => {
  test('modelo "Vertical curto" cria um projeto 9:16 já com título e faixa de legendas', async ({ page }) => {
    await signup(page);
    await page.getByRole('button', { name: 'Novo projeto' }).click();
    await page.getByRole('radio', { name: /Vertical curto/ }).click();
    await page.getByLabel('Nome').fill('Meu reel');
    await page.getByRole('button', { name: 'Criar e abrir' }).click();
    await expect(page.getByTestId('editor')).toBeVisible();
    const p = await projectOf(page);
    expect(p.settings).toMatchObject({ width: 1080, height: 1920 });
    expect(p.tracks.map((t) => t.kind).sort()).toEqual(['caption', 'text', 'video']);
    expect(p.tracks.find((t) => t.kind === 'text')!.clips[0]).toMatchObject({ text: 'Seu título aqui' });
    await waitSaved(page);
  });

  test('busca, renomear e duplicar projetos (com capa depois de ter mídia)', async ({ page }) => {
    await withClip(page, media.red);
    await waitSaved(page);
    await page.goto('/');
    const grid = page.getByTestId('project-grid');
    await expect(grid.getByRole('heading', { name: 'Novidades' })).toBeVisible();
    await expect(grid.locator('img').first()).toBeVisible(); // capa = miniatura da primeira mídia

    await page.getByRole('button', { name: 'Mais ações para Novidades' }).click({ force: true });
    await page.getByRole('menuitem', { name: 'Renomear Novidades' }).click();
    await page.getByLabel('Novo nome').fill('Projeto Alfa');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(grid.getByRole('heading', { name: 'Projeto Alfa' })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('button', { name: 'Mais ações para Projeto Alfa' }).click({ force: true });
    await page.getByRole('menuitem', { name: 'Duplicar Projeto Alfa' }).click();
    await expect(grid.getByRole('heading', { name: 'Projeto Alfa (cópia)' })).toBeVisible({ timeout: 30_000 });

    await page.getByLabel('Buscar projetos').fill('cópia');
    await expect(grid.getByRole('heading')).toHaveCount(1);
    await page.getByLabel('Buscar projetos').fill('xyz');
    await expect(page.getByText(/Nenhum projeto corresponde/)).toBeVisible();
  });
});
