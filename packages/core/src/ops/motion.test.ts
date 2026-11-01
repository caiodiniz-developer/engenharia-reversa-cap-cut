import { describe, expect, it } from 'vitest';
import { evaluateKeyframes } from '../keyframes';
import { findClip } from '../project';
import type { MediaClip, Project } from '../schema';
import { TextClipSchema } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addTrack } from './tracks';
import * as ops from './motion';

function one(duration = 4, start = 0) {
  const { project, trackId } = fixtureProject();
  const c = mediaClip('m1', start, duration);
  return { p: addClip(project, trackId, c), id: c.id, trackId };
}
const clipOf = (p: Project, id: string) => findClip(p, id)!.clip as MediaClip;
const tr = (p: Project, id: string) => clipOf(p, id).transform;

describe('setOpacity', () => {
  it('vale para mídia e texto e recusa fora de 0–1', () => {
    const { p, id } = one();
    const tt = addTrack(p, 'text');
    const text = TextClipSchema.parse({ id: 'tx1', type: 'text', text: 'oi', start: 5, duration: 1 });
    const p2 = addClip(tt.project, tt.track.id, text);
    const out = ops.setOpacity(p2, [id, 'tx1'], 0.4);
    expect(tr(out, id).opacity).toBe(0.4);
    expect(findClip(out, 'tx1')!.clip).toMatchObject({ transform: { opacity: 0.4 } });
    expect(() => ops.setOpacity(p2, [id], 1.5)).toThrow();
  });
});

describe('nudgeClips', () => {
  it('acumula deslocamentos', () => {
    const { p, id } = one();
    const out = ops.nudgeClips(ops.nudgeClips(p, [id], 0.1, -0.2), [id], 0.05, 0.1);
    expect(tr(out, id).x).toBeCloseTo(0.15, 6);
    expect(tr(out, id).y).toBeCloseTo(-0.1, 6);
    expect(() => ops.nudgeClips(p, [id], Number.NaN, 0)).toThrow();
  });
});

describe('scaleClipsBy', () => {
  it('multiplica e respeita os limites', () => {
    const { p, id } = one();
    expect(tr(ops.scaleClipsBy(p, [id], 1.5), id).scale).toBe(1.5);
    expect(tr(ops.scaleClipsBy(ops.scaleClipsBy(p, [id], 1.5), [id], 2), id).scale).toBe(3);
    expect(tr(ops.scaleClipsBy(p, [id], 1000), id).scale).toBe(20);
    expect(tr(ops.scaleClipsBy(p, [id], 0.0001), id).scale).toBe(0.01);
    expect(() => ops.scaleClipsBy(p, [id], 0)).toThrow();
  });
});

describe('rotateClipsBy', () => {
  it('soma e normaliza para (-180, 180]', () => {
    const { p, id } = one();
    expect(tr(ops.rotateClipsBy(p, [id], 90), id).rotation).toBe(90);
    expect(tr(ops.rotateClipsBy(ops.rotateClipsBy(p, [id], 90), [id], 120), id).rotation).toBe(-150);
    expect(tr(ops.rotateClipsBy(p, [id], 360), id).rotation).toBe(0);
    expect(tr(ops.rotateClipsBy(p, [id], 180), id).rotation).toBe(180);
    expect(tr(ops.rotateClipsBy(p, [id], -90), id).rotation).toBe(-90);
  });
});

describe('flipClips', () => {
  it('alterna cada eixo de forma independente', () => {
    const { p, id } = one();
    const h = ops.flipClips(p, [id], 'h');
    expect(tr(h, id)).toMatchObject({ flipH: true, flipV: false });
    const hv = ops.flipClips(h, [id], 'v');
    expect(tr(hv, id)).toMatchObject({ flipH: true, flipV: true });
    expect(tr(ops.flipClips(hv, [id], 'h'), id)).toMatchObject({ flipH: false, flipV: true });
  });
});

describe('centerClips', () => {
  it('zera x e y e mantém o resto', () => {
    const { p, id } = one();
    const moved = ops.rotateClipsBy(ops.scaleClipsBy(ops.nudgeClips(p, [id], 0.3, -0.4), [id], 2), [id], 30);
    const out = ops.centerClips(moved, [id]);
    expect(tr(out, id)).toMatchObject({ x: 0, y: 0, scale: 2, rotation: 30 });
  });
});

describe('fillFrame', () => {
  it('mídia 1920×1080 em quadro vertical 1080×1920: cover amplia, contain mantém', () => {
    const { p, id } = one();
    const vertical: Project = { ...p, settings: { ...p.settings, width: 1080, height: 1920 } };
    const cover = ops.fillFrame(vertical, [id], 'cover');
    expect(tr(cover, id).scale).toBeCloseTo((1920 / 1080) / (1080 / 1920), 5); // ≈ 3,16
    expect(tr(ops.fillFrame(cover, [id], 'contain'), id).scale).toBe(1);
  });

  it('mesmo formato do quadro: cover = 1; sem dimensões da mídia falha', () => {
    const { p, id } = one();
    expect(tr(ops.fillFrame(p, [id], 'cover'), id).scale).toBe(1);
    const sem: Project = { ...p, media: { ...p.media, m1: { ...p.media.m1!, width: 0, height: 0 } } };
    expect(() => ops.fillFrame(sem, [id], 'cover')).toThrow(/tamanho/);
  });
});

describe('cropToAspect', () => {
  it('1:1 em 16:9 corta as laterais (21,875% de cada lado)', () => {
    const { p, id } = one();
    const crop = tr(ops.cropToAspect(p, [id], 1), id).crop;
    expect(crop.l).toBeCloseTo(0.21875, 5);
    expect(crop.r).toBeCloseTo(0.21875, 5);
    expect(crop.t).toBe(0);
  });

  it('proporção mais larga que a origem corta em cima e embaixo', () => {
    const { p, id } = one();
    const crop = tr(ops.cropToAspect(p, [id], 32 / 9), id).crop; // origem 16:9 → altura 50%
    expect(crop.t).toBeCloseTo(0.25, 5);
    expect(crop.b).toBeCloseTo(0.25, 5);
    expect(crop.l).toBe(0);
  });

  it('mesma proporção não corta nada e proporção absurda falha', () => {
    const { p, id } = one();
    expect(tr(ops.cropToAspect(p, [id], 16 / 9), id).crop).toEqual({ l: 0, r: 0, t: 0, b: 0 });
    expect(() => ops.cropToAspect(p, [id], 50)).toThrow();
  });
});

describe('kenBurns', () => {
  it('aproxima: escala sai de 1 e chega a 1,2 no fim', () => {
    const { p, id } = one(4);
    const out = ops.kenBurns(p, [id], { zoom: 1.2 });
    const k = clipOf(out, id).keyframes.scale!;
    expect(evaluateKeyframes(k, 0, 1)).toBe(1);
    expect(evaluateKeyframes(k, 4, 1)).toBe(1.2);
    expect(evaluateKeyframes(k, 2, 1)).toBeGreaterThan(1);
    expect(evaluateKeyframes(k, 2, 1)).toBeLessThan(1.2);
    expect(clipOf(out, id).keyframes.x).toBeUndefined();
  });

  it('afastar inverte e o deslize cria keyframes de x', () => {
    const { p, id } = one(4);
    const out = ops.kenBurns(p, [id], { zoom: 1.5, direction: 'out', pan: 0.1 });
    const k = clipOf(out, id).keyframes;
    expect(evaluateKeyframes(k.scale, 0, 1)).toBe(1.5);
    expect(evaluateKeyframes(k.scale, 4, 1)).toBe(1);
    expect(evaluateKeyframes(k.x, 4, 0)).toBe(0.1);
  });

  it('zoom menor ou igual a 1 e acima de 3 falham', () => {
    const { p, id } = one();
    expect(() => ops.kenBurns(p, [id], { zoom: 1 })).toThrow();
    expect(() => ops.kenBurns(p, [id], { zoom: 4 })).toThrow();
  });
});

describe('punchIn', () => {
  it('sobe até o pico e volta ao valor original', () => {
    const { p, id } = one(5);
    const out = ops.punchIn(p, id, 1, 1.5, 1);
    const k = clipOf(out, id).keyframes.scale!;
    expect(evaluateKeyframes(k, 0.5, 1)).toBe(1);
    expect(evaluateKeyframes(k, 1.35, 1)).toBeCloseTo(1.5, 6);
    expect(evaluateKeyframes(k, 2, 1)).toBe(1);
    expect(evaluateKeyframes(k, 4, 1)).toBe(1);
  });

  it('recusa zoom que não cabe no clipe, fator menor que 1 e tipo errado', () => {
    const { p, id } = one(2);
    expect(() => ops.punchIn(p, id, 1.8, 1.2, 1)).toThrow(/caber/);
    expect(() => ops.punchIn(p, id, 0, 0.9)).toThrow();
    expect(() => ops.punchIn(p, 'nao-existe', 0)).toThrow();
  });
});

describe('shakeClips', () => {
  it('fica dentro da intensidade, começa e termina na posição original', () => {
    const { p, id } = one(3);
    const out = ops.shakeClips(p, [id], 0.02, 5, 10);
    const k = clipOf(out, id).keyframes;
    expect(k.x![0]).toMatchObject({ time: 0, value: 0 });
    expect(k.x![k.x!.length - 1]).toMatchObject({ time: 3, value: 0 });
    expect(k.x!.length).toBe(31);
    expect(k.x!.every((f) => Math.abs(f.value) <= 0.02 + 1e-9)).toBe(true);
    expect(k.x!.some((f) => f.value !== 0)).toBe(true);
  });

  it('a mesma semente repete e outra semente difere', () => {
    const { p, id } = one(3);
    expect(ops.shakeClips(p, [id], 0.02, 5)).toEqual(ops.shakeClips(p, [id], 0.02, 5));
    expect(clipOf(ops.shakeClips(p, [id], 0.02, 6), id).keyframes.x).not.toEqual(clipOf(ops.shakeClips(p, [id], 0.02, 5), id).keyframes.x);
  });

  it('recusa intensidade/frequência inválidas', () => {
    const { p, id } = one(3);
    expect(() => ops.shakeClips(p, [id], 0)).toThrow();
    expect(() => ops.shakeClips(p, [id], 0.5)).toThrow();
    expect(() => ops.shakeClips(p, [id], 0.01, 1, 100)).toThrow();
  });
});

describe('fadeOpacity', () => {
  it('entra e sai: 0 nas pontas e o valor cheio no meio', () => {
    const { p, id } = one(4);
    const k = clipOf(ops.fadeOpacity(p, [id], 1, 1), id).keyframes.opacity!;
    expect(evaluateKeyframes(k, 0, 1)).toBe(0);
    expect(evaluateKeyframes(k, 1, 1)).toBe(1);
    expect(evaluateKeyframes(k, 2, 1)).toBe(1);
    expect(evaluateKeyframes(k, 4, 1)).toBe(0);
  });

  it('só entrada deixa o fim cheio e só saída começa cheio', () => {
    const { p, id } = one(4);
    const a = clipOf(ops.fadeOpacity(p, [id], 1, 0), id).keyframes.opacity!;
    expect(evaluateKeyframes(a, 4, 1)).toBe(1);
    const b = clipOf(ops.fadeOpacity(p, [id], 0, 1), id).keyframes.opacity!;
    expect(evaluateKeyframes(b, 0, 1)).toBe(1);
    expect(evaluateKeyframes(b, 4, 1)).toBe(0);
  });

  it('fades somados maiores que o clipe e fades zerados falham', () => {
    const { p, id } = one(2);
    expect(() => ops.fadeOpacity(p, [id], 1.5, 1)).toThrow();
    expect(() => ops.fadeOpacity(p, [id], 0, 0)).toThrow();
  });
});
