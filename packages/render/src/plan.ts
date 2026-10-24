import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  clipEnd,
  effectsToFfmpeg,
  projectDuration,
  type CaptionClip,
  type Clip,
  type MediaClip,
  type Project,
  type TextClip,
  type Transform,
} from '@editor/core';
import { audioChain } from './audio';
import { ffmpegPath } from './binaries';
import { isAnimated, keyframeExpr, num } from './expr';
import { measureText, renderTextPng } from './textimage';

export type VideoCodec = 'h264' | 'h265' | 'vp9';

export interface RenderOptions {
  /** Substitui a resolução do projeto (será arredondada para número par). */
  width?: number;
  height?: number;
  fps?: number;
  codec?: VideoCodec;
  /** 0 (melhor) a 51 (pior); padrão 20. */
  crf?: number;
  preset?: 'ultrafast' | 'veryfast' | 'fast' | 'medium' | 'slow';
  audioBitrate?: string;
  /** Exporta apenas o intervalo [start, end] da timeline (segundos). */
  range?: { start: number; end: number };
}

export interface RenderEnv {
  /** Caminho local do arquivo de uma mídia. */
  resolveMedia(mediaId: string): string;
  /** Diretório temporário exclusivo desta renderização. */
  tmpDir: string;
}

export interface RenderPlan {
  ffmpeg: string;
  args: string[];
  filterGraph: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  outputExt: string;
}

export class RenderError extends Error {}

const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2);
const hex = (c: string): string => `0x${c.replace('#', '').slice(0, 6)}`;
/** Suavização usada nas transições/animações de entrada (idêntica no preview). */
const easeExpr = (p: string): string => `(${p}*${p}*(3-2*${p}))`;

interface Layer {
  label: string;
  start: number;
  end: number;
  x: string;
  y: string;
}

export function codecArgs(codec: VideoCodec, crf: number, preset: string, audioBitrate: string): { args: string[]; ext: string } {
  switch (codec) {
    case 'h264':
      return { ext: 'mp4', args: ['-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', audioBitrate, '-movflags', '+faststart'] };
    case 'h265':
      return { ext: 'mp4', args: ['-c:v', 'libx265', '-preset', preset, '-crf', String(crf + 4), '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', '-c:a', 'aac', '-b:a', audioBitrate, '-movflags', '+faststart'] };
    case 'vp9':
      return { ext: 'webm', args: ['-c:v', 'libvpx-vp9', '-crf', String(crf + 10), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-pix_fmt', 'yuv420p', '-c:a', 'libopus', '-b:a', audioBitrate] };
  }
}

/** Converte o projeto em argumentos do FFmpeg + filter_complex (escrito em arquivo no tmpDir). */
export async function buildRenderPlan(
  project: Project,
  opts: RenderOptions,
  env: RenderEnv,
  outputPath: string,
): Promise<RenderPlan> {
  const total = projectDuration(project);
  if (total <= 0) throw new RenderError('O projeto está vazio: adicione clipes antes de exportar');

  const W = even(opts.width ?? project.settings.width);
  const H = even(opts.height ?? project.settings.height);
  const fps = opts.fps ?? project.settings.fps;
  const sr = project.settings.sampleRate;
  const frame = { width: W, height: H };

  await mkdir(env.tmpDir, { recursive: true });

  const inputs: string[][] = [];
  const filters: string[] = [];
  const addInput = (args: string[]): number => inputs.push(args) - 1;
  let uid = 0;
  const label = (p: string): string => `${p}${uid++}`;

  filters.push(`color=c=${hex(project.settings.background)}:s=${W}x${H}:r=${num(fps)}:d=${num(total)},format=yuv420p[base]`);

  const layers: Layer[] = [];
  const audioLabels: string[] = [];

  /**
   * Flip + escala. Escala estática vira um filtro scale. Escala animada não pode mudar o tamanho do quadro
   * no meio do fluxo (o overlay mantém o tamanho inicial), então o clipe é ampliado até a maior escala e o
   * filtro `perspective` (eval=frame) encolhe o conteúdo dentro de um quadro de tamanho fixo.
   * Devolve o filtro perspective, que deve rodar depois de format=rgba (bordas transparentes).
   */
  function transformChain(
    c: string[],
    clip: Clip,
    t: Transform,
    baseW: number,
    baseH: number,
    popIn: { duration: number } | null,
  ): string[] | null {
    const k = clip.keyframes;
    if (t.flipH) c.push('hflip');
    if (t.flipV) c.push('vflip');
    if (isAnimated(k.scale) || popIn) {
      const values = isAnimated(k.scale) ? k.scale!.map((kf) => kf.value) : [t.scale];
      const smax = Math.min(4, Math.max(0.05, ...values));
      c.push(`scale=${even(baseW * smax)}:${even(baseH * smax)}`);
      // r = fração do quadro ampliado ocupada pelo conteúdo no instante atual (lt = tempo local).
      const rAt = (lt: string) => {
        const base = keyframeExpr(k.scale, t.scale, lt);
        const pop = popIn ? `*(0.6+0.4*${easeExpr(`min(1,max(0,${lt}/${num(popIn.duration)}))`)})` : '';
        return `(min(${num(smax)},${base})/${num(smax)}${pop})`;
      };
      const r = rAt(`(on/${num(fps)})`);
      const corner = (i: number, sx: string, sy: string) => `x${i}='W/2*(1${sx}${r})':y${i}='H/2*(1${sy}${r})'`;
      const persp = `perspective=${corner(0, '-', '-')}:${corner(1, '+', '-')}:${corner(2, '-', '+')}:${corner(3, '+', '+')}:sense=destination:eval=frame:interpolation=linear`;
      // O perspective repete os pixels da borda fora do quadrilátero; o geq zera o alfa nessa região.
      const rg = rAt('T');
      const clipOutside = `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*lt(abs(X+0.5-W/2),W/2*${rg}+0.5)*lt(abs(Y+0.5-H/2),H/2*${rg}+0.5)'`;
      return [persp, clipOutside];
    }
    if (Math.abs(t.scale - 1) > 1e-9) c.push(`scale=${even(baseW * t.scale)}:${even(baseH * t.scale)}`);
    return null;
  }

  function alphaChain(c: string[], clip: Clip, t: Transform): void {
    const k = clip.keyframes;
    if (isAnimated(k.opacity)) {
      c.push(`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*clip(${keyframeExpr(k.opacity, t.opacity, 'T')},0,1)'`);
    } else if (t.opacity < 1) {
      c.push(`colorchannelmixer=aa=${num(t.opacity)}`);
    }
    if (isAnimated(k.rotation)) {
      c.push(`rotate=a='(${keyframeExpr(k.rotation, t.rotation, 't')})*PI/180':ow='hypot(iw,ih)':oh='hypot(iw,ih)':c=none`);
    } else if (Math.abs(t.rotation) > 1e-9) {
      c.push(`rotate=a=${num((t.rotation * Math.PI) / 180)}:ow='hypot(iw,ih)':oh='hypot(iw,ih)':c=none`);
    }
  }

  /** Posição do overlay: centro + deslocamento (animável), com tempo local = t - start. */
  function position(clip: Clip, t: Transform, start: number): { x: string; y: string } {
    const lt = `(t-${num(start)})`;
    const kx = keyframeExpr(clip.keyframes.x, t.x, lt);
    const ky = keyframeExpr(clip.keyframes.y, t.y, lt);
    return { x: `(W-w)/2+(${kx})*W`, y: `(H-h)/2+(${ky})*H` };
  }

  // ---- Efeitos de áudio de transição: crossfade em clipes com transitionIn ----
  const crossfadeOut = new Map<string, number>();
  const crossfadeIn = new Map<string, number>();
  for (const track of project.tracks) {
    const sorted = [...track.clips].sort((a, b) => a.start - b.start);
    sorted.forEach((c, i) => {
      if (c.type === 'media' && c.transitionIn && i > 0) {
        const prev = sorted[i - 1]!;
        const overlap = Math.max(0, clipEnd(prev) - c.start);
        crossfadeIn.set(c.id, Math.max(c.transitionIn.duration, overlap));
        crossfadeOut.set(prev.id, Math.max(crossfadeOut.get(prev.id) ?? 0, overlap));
      }
    });
  }

  function addMediaClip(clip: MediaClip, trackKind: string, hidden: boolean, muted: boolean): void {
    const asset = project.media[clip.mediaId];
    if (!asset) throw new RenderError(`Mídia ${clip.mediaId} não encontrada no projeto`);
    const file = env.resolveMedia(clip.mediaId);
    const dur = clip.duration;
    const isVisual = trackKind === 'video' && !hidden && asset.kind !== 'audio';
    const wantsAudio = asset.kind === 'video' && asset.hasAudio && !clip.freeze && !clip.audio.muted && !muted;

    if (!isVisual && !wantsAudio) return;

    let k: number;
    if (asset.kind === 'image') {
      k = addInput(['-loop', '1', '-framerate', num(fps), '-t', num(dur + 0.5), '-i', file]);
    } else if (clip.freeze) {
      k = addInput(['-ss', num(clip.sourceIn), '-t', '1', '-i', file]);
    } else {
      const used = dur * clip.speed;
      k = addInput(['-ss', num(clip.sourceIn), '-t', num(used + 0.1), '-i', file]);
    }

    if (isVisual) {
      const t = clip.transform;
      const c: string[] = ['setpts=PTS-STARTPTS'];
      if (clip.freeze) {
        c.push('trim=end_frame=1', 'setpts=PTS-STARTPTS', `tpad=stop_mode=clone:stop_duration=${num(dur)}`);
      } else if (asset.kind === 'video') {
        if (clip.reverse) c.push('reverse');
        if (Math.abs(clip.speed - 1) > 1e-9) c.push(`setpts=${num(1 / clip.speed)}*PTS`);
      }
      c.push(`fps=${num(fps)}`, `trim=duration=${num(dur)}`, 'setpts=PTS-STARTPTS');

      const cr = t.crop;
      let cw = asset.width;
      let ch = asset.height;
      if (cr.l || cr.t || cr.r || cr.b) {
        c.push(`crop=w=trunc(iw*${num(1 - cr.l - cr.r)}/2)*2:h=trunc(ih*${num(1 - cr.t - cr.b)}/2)*2:x=iw*${num(cr.l)}:y=ih*${num(cr.t)}`);
        cw = Math.floor((asset.width * (1 - cr.l - cr.r)) / 2) * 2;
        ch = Math.floor((asset.height * (1 - cr.t - cr.b)) / 2) * 2;
      }
      const fit = Math.min(W / cw, H / ch);
      const baseW = cw * fit;
      const baseH = ch * fit;
      // Ajusta ao quadro ("contain") antes de aplicar a escala do usuário.
      c.push(`scale=${even(baseW)}:${even(baseH)}`);
      const persp = transformChain(c, clip, t, even(baseW), even(baseH), null);

      const opaque = effectsToFfmpeg(clip.effects, { width: W, height: H }, false);
      if (opaque.length) c.push('format=rgb24', ...opaque);
      c.push('format=rgba');
      const keyed = effectsToFfmpeg(clip.effects, { width: W, height: H }, true);
      c.push(...keyed);
      if (persp) c.push(...persp);

      if (clip.mask) {
        const m = clip.mask;
        const inside =
          m.shape === 'ellipse'
            ? `lt(hypot((X/W-${num(m.cx)})/${num(m.w / 2)},(Y/H-${num(m.cy)})/${num(m.h / 2)}),1)`
            : `lt(abs(X/W-${num(m.cx)}),${num(m.w / 2)})*lt(abs(Y/H-${num(m.cy)}),${num(m.h / 2)})`;
        c.push(`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*${m.invert ? `(1-${inside})` : inside}'`);
      }
      alphaChain(c, clip, t);

      const pos = position(clip, t, clip.start);
      let { x, y } = pos;
      const tr = clip.transitionIn;
      if (tr) {
        const d = num(tr.duration);
        const P = `min(1,max(0,(t-${num(clip.start)})/${d}))`;
        const E = easeExpr(`(${P})`);
        if (tr.type === 'fade') c.push(`fade=t=in:st=0:d=${d}:alpha=1`);
        else if (tr.type === 'slide-left') x = `${x}+(1-${E})*W`;
        else if (tr.type === 'slide-right') x = `${x}-(1-${E})*W`;
        else if (tr.type === 'slide-up') y = `${y}+(1-${E})*H`;
        else if (tr.type === 'slide-down') y = `${y}-(1-${E})*H`;
        else if (tr.type === 'wipe-left' || tr.type === 'wipe-right') {
          const prog = `clip(T/${d},0,1)`;
          const cond = tr.type === 'wipe-right' ? `lt(X,W*${prog})` : `gt(X,W*(1-${prog}))`;
          c.push(`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(${cond},alpha(X,Y),0)'`);
        }
      }
      c.push(`setpts=PTS+${num(clip.start)}/TB`);
      const out = label('v');
      filters.push(`[${k}:v]${c.join(',')}[${out}]`);
      layers.push({ label: out, start: clip.start, end: clipEnd(clip), x, y });
    }

    if (wantsAudio) {
      const fades = {
        fadeIn: Math.max(clip.audio.fadeIn, crossfadeIn.get(clip.id) ?? 0),
        fadeOut: Math.max(clip.audio.fadeOut, crossfadeOut.get(clip.id) ?? 0),
      };
      const chain = audioChain(clip, sr, fades);
      const ms = Math.round(clip.start * 1000);
      chain.push(`adelay=delays=${ms}:all=1`);
      const out = label('a');
      filters.push(`[${k}:a]${chain.join(',')}[${out}]`);
      audioLabels.push(out);
    } else if (!isVisual) {
      // clipe só-áudio que não gera áudio (mudo): nada a fazer
    }
  }

  async function addTextClip(clip: TextClip | CaptionClip, idx: number): Promise<void> {
    const dur = clip.duration;
    const isCaption = clip.type === 'caption';
    const words = isCaption ? clip.words : undefined;
    const base = renderTextPng(clip.text, clip.style, frame, { words });
    const baseFile = path.join(env.tmpDir, `txt_${idx}.png`);
    await writeFile(baseFile, base.png);

    let k: number;
    if (isCaption && words && words.length > 0 && clip.highlightColor) {
      // Sequência concat: texto base com a palavra falada em destaque durante sua janela.
      const lines: string[] = ['ffconcat version 1.0'];
      let cursor = 0;
      const push = (file: string, d: number) => {
        if (d > 1e-4) lines.push(`file '${file.replace(/\\/g, '/')}'`, `duration ${num(d)}`);
      };
      for (let i = 0; i < words.length; i++) {
        const w = words[i]!;
        const ws = Math.min(Math.max(w.start, cursor), dur);
        const we = Math.min(Math.max(w.end, ws), dur);
        push(baseFile, ws - cursor);
        const hl = renderTextPng(clip.text, clip.style, frame, { words, highlightIndex: i, highlightColor: clip.highlightColor });
        const hlFile = path.join(env.tmpDir, `txt_${idx}_w${i}.png`);
        await writeFile(hlFile, hl.png);
        push(hlFile, we - ws);
        cursor = we;
      }
      push(baseFile, dur - cursor);
      lines.push(`file '${baseFile.replace(/\\/g, '/')}'`);
      const listFile = path.join(env.tmpDir, `txt_${idx}.ffconcat`);
      await writeFile(listFile, lines.join('\n'));
      k = addInput(['-f', 'concat', '-safe', '0', '-i', listFile]);
    } else {
      k = addInput(['-loop', '1', '-framerate', num(fps), '-t', num(dur + 0.5), '-i', baseFile]);
    }

    const { width: bw, height: bh } = measureText(clip.text, clip.style, frame, words);
    const t = clip.transform;
    const c: string[] = ['format=rgba', `fps=${num(fps)}`, `trim=duration=${num(dur)}`, 'setpts=PTS-STARTPTS'];
    const aIn = clip.animationIn;
    const aOut = clip.animationOut;
    const persp = transformChain(c, clip, t, bw, bh, aIn.type === 'pop' && aIn.duration > 0 ? { duration: aIn.duration } : null);
    if (persp) c.push(...persp);
    alphaChain(c, clip, t);
    if (aIn.type === 'fade' && aIn.duration > 0) c.push(`fade=t=in:st=0:d=${num(aIn.duration)}:alpha=1`);
    if (aOut.type === 'fade' && aOut.duration > 0) c.push(`fade=t=out:st=${num(Math.max(0, dur - aOut.duration))}:d=${num(aOut.duration)}:alpha=1`);
    c.push(`setpts=PTS+${num(clip.start)}/TB`);

    let { x, y } = position(clip, t, clip.start);
    const lt = `(t-${num(clip.start)})`;
    if ((aIn.type === 'slide-up' || aIn.type === 'slide-down') && aIn.duration > 0) {
      const E = easeExpr(`min(1,max(0,${lt}/${num(aIn.duration)}))`);
      y = `${y}${aIn.type === 'slide-up' ? '+' : '-'}(1-${E})*0.08*H`;
    }
    if ((aOut.type === 'slide-up' || aOut.type === 'slide-down') && aOut.duration > 0) {
      const E = easeExpr(`min(1,max(0,(${lt}-${num(dur - aOut.duration)})/${num(aOut.duration)}))`);
      y = `${y}${aOut.type === 'slide-up' ? '-' : '+'}${E}*0.08*H`;
    }
    const out = label('v');
    filters.push(`[${k}:v]${c.join(',')}[${out}]`);
    layers.push({ label: out, start: clip.start, end: clipEnd(clip), x, y });
  }

  // Camadas de baixo para cima: a faixa de índice 0 é a mais alta.
  let textIdx = 0;
  for (let ti = project.tracks.length - 1; ti >= 0; ti--) {
    const track = project.tracks[ti]!;
    const sorted = [...track.clips].sort((a, b) => a.start - b.start);
    for (const clip of sorted) {
      if (opts.range && (clipEnd(clip) <= opts.range.start || clip.start >= opts.range.end)) continue;
      if (clip.type === 'media') addMediaClip(clip, track.kind, track.hidden, track.muted);
      else if (!track.hidden) await addTextClip(clip, textIdx++);
    }
  }

  // Composição: sobrepõe cada camada na ordem.
  let current = 'base';
  layers.forEach((l, i) => {
    const out = i === layers.length - 1 ? 'vcomp' : `ov${i}`;
    filters.push(
      `[${current}][${l.label}]overlay=x='${l.x}':y='${l.y}':enable='between(t,${num(l.start)},${num(l.end)})':eof_action=pass:eval=frame[${out}]`,
    );
    current = out;
  });
  if (layers.length === 0) filters.push('[base]null[vcomp]');
  filters.push(`[vcomp]format=yuv420p[vout]`);

  if (audioLabels.length === 0) {
    filters.push(`anullsrc=r=${sr}:cl=stereo,atrim=duration=${num(total)}[aout]`);
  } else if (audioLabels.length === 1) {
    filters.push(`[${audioLabels[0]}]apad=whole_dur=${num(total)},atrim=duration=${num(total)}[aout]`);
  } else {
    filters.push(
      `${audioLabels.map((l) => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:normalize=0:dropout_transition=0,apad=whole_dur=${num(total)},atrim=duration=${num(total)}[aout]`,
    );
  }

  const filterGraph = filters.join(';\n');
  const scriptPath = path.join(env.tmpDir, 'filter_complex.txt');
  await writeFile(scriptPath, filterGraph);

  const codec = codecArgs(opts.codec ?? 'h264', opts.crf ?? 20, opts.preset ?? 'veryfast', opts.audioBitrate ?? '192k');
  const outRange = opts.range ? ['-ss', num(opts.range.start), '-t', num(opts.range.end - opts.range.start)] : ['-t', num(total)];
  const args = [
    '-y',
    '-hide_banner',
    '-nostats',
    '-loglevel',
    'error',
    '-progress',
    'pipe:1',
    ...inputs.flat(),
    '-filter_complex_script',
    scriptPath,
    '-map',
    '[vout]',
    '-map',
    '[aout]',
    '-r',
    num(fps),
    ...codec.args,
    ...outRange,
    outputPath,
  ];
  return { ffmpeg: ffmpegPath(), args, filterGraph, duration: opts.range ? opts.range.end - opts.range.start : total, width: W, height: H, fps, outputExt: codec.ext };
}
