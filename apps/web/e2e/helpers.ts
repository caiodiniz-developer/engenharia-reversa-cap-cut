import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, type Page } from '@playwright/test';
import type { Project } from '@editor/core';

const execFileAsync = promisify(execFile);
const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../api');

/** Roda apps/api/scripts/media-tool.ts (FFmpeg/ffprobe do projeto) e devolve o JSON impresso. */
async function tool<T>(...args: string[]): Promise<T> {
  const { stdout } = await execFileAsync(process.execPath, ['--import', 'tsx', 'scripts/media-tool.ts', ...args], { cwd: API_DIR, maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(stdout.trim().split(/\r?\n/).pop()!) as T;
}

export const probeMedia = (file: string) => tool<{ duration: number; width: number; height: number; fps: number; hasAudio: boolean; videoCodec?: string }>('probe', file);
export const framePixel = (file: string, t: number, fx = 0.5, fy = 0.5) => tool<[number, number, number]>('pixel', file, String(t), String(fx), String(fy));

let counter = 0;
export const uniqueEmail = () => `e2e${Date.now()}_${counter++}@example.com`;
export const PASSWORD = 'senha-forte-123';

declare global {
  interface Window {
    __editor: { getState(): { project: Project; playhead: number; playing: boolean; saveState: string; selection: string[]; serverRevision: number; history: { entries: unknown[]; index: number } } };
  }
}

export async function signup(page: Page, name = 'Tester') {
  const email = uniqueEmail();
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).last().click();
  await expect(page.getByRole('heading', { name: 'Seus projetos' })).toBeVisible();
  return { email, password: PASSWORD };
}

export async function newProject(page: Page, name = 'Projeto E2E', aspect = '16:9') {
  await page.getByRole('button', { name: 'Novo projeto' }).click();
  await page.getByLabel('Nome').fill(name);
  await page.getByRole('radio', { name: aspect }).click();
  await page.getByRole('button', { name: 'Criar e abrir' }).click();
  await expect(page.getByTestId('editor')).toBeVisible();
}

export async function uploadAndWait(page: Page, file: string) {
  await page.getByTestId('file-input').setInputFiles(file);
  const name = path.basename(file);
  const card = page.getByRole('button', { name: new RegExp(`^${name.replace('.', '\\.')}`) });
  await expect(card).toBeVisible({ timeout: 60_000 });
  // Pronto = miniatura gerada (a mídia deixa de estar "Processando…").
  await expect(card.locator('img')).toBeVisible({ timeout: 60_000 });
  return card;
}

export const state = (page: Page) => page.evaluate(() => window.__editor.getState());
export const projectOf = (page: Page) => page.evaluate(() => window.__editor.getState().project);
export const clipsOf = (page: Page) =>
  page.evaluate(() =>
    window.__editor
      .getState()
      .project.tracks.flatMap((t) => t.clips.map((c) => ({ id: c.id, type: c.type, track: t.kind, start: c.start, duration: c.duration, sourceIn: (c as { sourceIn?: number }).sourceIn })))
      .sort((a, b) => a.start - b.start),
  );

/** Pixel central (ou em x,y relativos 0..1) do canvas de preview. */
export async function previewPixel(page: Page, fx = 0.5, fy = 0.5): Promise<[number, number, number]> {
  return page.evaluate(
    ([x, y]) => {
      const c = document.querySelector<HTMLCanvasElement>('[data-testid="preview-canvas"]')!;
      const d = c.getContext('2d')!.getImageData(Math.floor(c.width * x!), Math.floor(c.height * y!), 1, 1).data;
      return [d[0]!, d[1]!, d[2]!] as [number, number, number];
    },
    [fx, fy],
  );
}

export async function seek(page: Page, t: number) {
  await page.evaluate((time) => {
    const s = window.__editor.getState() as unknown as { setPlaying(v: boolean): void; setPlayhead(t: number): void };
    s.setPlaying(false);
    s.setPlayhead(time);
  }, t);
}

export async function waitSaved(page: Page) {
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved', { timeout: 20_000 });
}

export const near = (a: number[], b: number[], tol = 40) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);

export interface Media {
  red: string;
  blue: string;
  talk: string;
  dir: string;
}

/** Vídeos de teste determinísticos (gerados com o FFmpeg empacotado). */
export const makeMedia = () => tool<Media>('make');
