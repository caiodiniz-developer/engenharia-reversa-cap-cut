import { describe, expect, it } from 'vitest';
import { applyEffectsToPixels, createEffect, effectsToFfmpeg } from './effects';
import { addLut, createProject } from './project';
import { applyLut, BUILTIN_LUTS, builtinLut, identityLut, LutError, mixLut, parseCube, resolveLut, serializeCube, type Lut3D } from './lut';

/** LUT 2×2×2 que troca os canais R e B. */
function swapRB(): Lut3D {
  const id = identityLut(2);
  const data = new Float32Array(id.data.length);
  for (let i = 0; i < id.data.length; i += 3) {
    data[i] = id.data[i + 2]!;
    data[i + 1] = id.data[i + 1]!;
    data[i + 2] = id.data[i]!;
  }
  return { title: 'swap', size: 2, data };
}

describe('LUT 3D', () => {
  it('serializa e interpreta o formato .cube sem perdas', () => {
    const lut = swapRB();
    const back = parseCube(serializeCube(lut));
    expect(back.size).toBe(2);
    expect(Array.from(back.data)).toEqual(Array.from(lut.data));
  });

  it('interpola em trilinear: cantos exatos e pontos intermediários', () => {
    const px = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255, 128, 0, 0, 255]);
    applyLut(px, swapRB());
    expect(Array.from(px.slice(0, 3))).toEqual([0, 0, 255]);
    expect(Array.from(px.slice(4, 7))).toEqual([255, 0, 0]);
    expect(Array.from(px.slice(8, 11))).toEqual([0, 0, 128]);
  });

  it('LUT de identidade não altera os pixels; mix(0) = identidade e mix(1) = LUT', () => {
    const src = [10, 200, 90, 255, 250, 3, 77, 255];
    const a = new Uint8ClampedArray(src);
    applyLut(a, identityLut(9));
    expect(Array.from(a)).toEqual(src);
    const b = new Uint8ClampedArray([255, 0, 0, 255]);
    applyLut(b, mixLut(swapRB(), 0));
    expect(Array.from(b)).toEqual([255, 0, 0, 255]);
    const c = new Uint8ClampedArray([255, 0, 0, 255]);
    applyLut(c, mixLut(swapRB(), 0.5));
    expect(Array.from(c.slice(0, 3))).toEqual([128, 0, 128]);
  });

  it('rejeita arquivos inválidos com mensagens claras', () => {
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 0\n')).toThrow(/contém/);
    expect(() => parseCube('LUT_3D_SIZE 1\n')).toThrow(LutError);
    expect(() => parseCube('LUT_1D_SIZE 4\n')).toThrow(/1D/);
    expect(() => parseCube('LUT_3D_SIZE 2\nlixo aqui\n')).toThrow(/Linha inválida/);
    expect(() => parseCube('LUT_3D_SIZE 99\n')).toThrow(/inválido/);
  });

  it('respeita DOMAIN_MIN/MAX e ignora comentários', () => {
    const text = '# comentário\nTITLE "x"\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 2 2 2\nLUT_3D_SIZE 2\n' + Array.from({ length: 8 }, (_, i) => `${(i & 1) * 2} ${((i >> 1) & 1) * 2} ${((i >> 2) & 1) * 2}`).join('\n');
    const lut = parseCube(text);
    expect(Array.from(lut.data)).toEqual(Array.from(identityLut(2).data));
    expect(lut.title).toBe('x');
  });

  it('as LUTs embutidas existem, mudam a imagem e são determinísticas', () => {
    for (const { id } of BUILTIN_LUTS) {
      const lut = builtinLut(id)!;
      expect(lut.size).toBe(17);
      const px = new Uint8ClampedArray([180, 120, 60, 255]);
      applyLut(px, lut);
      expect(Array.from(px.slice(0, 3))).not.toEqual([180, 120, 60]);
      const again = new Uint8ClampedArray([180, 120, 60, 255]);
      applyLut(again, builtinLut(id)!);
      expect(Array.from(again)).toEqual(Array.from(px));
    }
    expect(builtinLut('nao-existe')).toBeUndefined();
  });

  it('resolveLut entende builtin:, LUTs do projeto e referências inválidas', () => {
    const { project, id } = addLut(createProject(), 'Troca', serializeCube(swapRB()));
    expect(resolveLut(project.luts, 'builtin:noir')?.title).toBe('Preto e branco contrastado');
    expect(resolveLut(project.luts, id)?.size).toBe(2);
    expect(resolveLut(project.luts, 'nada')).toBeUndefined();
    expect(resolveLut(project.luts, undefined)).toBeUndefined();
    expect(() => addLut(project, 'Ruim', 'LUT_3D_SIZE 2\n')).toThrow(LutError);
  });

  it('o efeito "lut" aplica a LUT no preview e gera lut3d trilinear na exportação', () => {
    const fx = createEffect('lut', { intensity: 1 }, 'builtin:noir');
    expect(fx.ref).toBe('builtin:noir');
    const px = new Uint8ClampedArray([200, 50, 50, 255]);
    applyEffectsToPixels(px, 1, 1, [fx], (ref) => resolveLut({}, ref));
    expect(px[0]).toBe(px[1]);
    expect(px[1]).toBe(px[2]);
    const noFile = effectsToFfmpeg([fx], { width: 10, height: 10 }, false);
    expect(noFile).toEqual([]);
    const withFile = effectsToFfmpeg([fx], { width: 10, height: 10, lutPath: () => 'C:\\tmp\\a b\\l.cube' }, false);
    expect(withFile).toEqual(["lut3d=file='C\\:/tmp/a b/l.cube':interp=trilinear"]);
  });
});
