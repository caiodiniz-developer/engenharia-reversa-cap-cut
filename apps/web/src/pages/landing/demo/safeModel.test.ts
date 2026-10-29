import { describe, expect, it } from 'vitest';
import { PLATFORMS } from '@editor/core';
import { captionVerdict, suggestedCaptionY } from './safeModel';

describe('demonstração das zonas seguras', () => {
  it('a posição sugerida fica dentro da zona segura em todas as plataformas', () => {
    for (const p of PLATFORMS) {
      const y = suggestedCaptionY(p.id);
      expect(captionVerdict(p.id, y).inside, p.id).toBe(true);
    }
  });

  it('a sugestão é a mais baixa possível: um pouco mais abaixo já cai fora', () => {
    for (const p of PLATFORMS) expect(captionVerdict(p.id, suggestedCaptionY(p.id) + 0.04).inside, p.id).toBe(false);
  });

  it('em plataformas verticais a base do quadro fica coberta e o centro é seguro', () => {
    for (const id of ['shorts', 'reels', 'tiktok', 'stories']) {
      expect(captionVerdict(id, 0).inside, id).toBe(true);
      const bottom = captionVerdict(id, 0.45);
      expect(bottom.inside, id).toBe(false);
      expect(bottom.overflow, id).toBeGreaterThan(0.1);
    }
  });

  it('o quanto passou da zona é zero dentro e cresce quanto mais longe', () => {
    expect(captionVerdict('tiktok', 0).overflow).toBe(0);
    expect(captionVerdict('tiktok', 0.48).overflow).toBeGreaterThan(captionVerdict('tiktok', 0.4).overflow);
  });

  it('plataforma desconhecida não acusa problema', () => {
    expect(captionVerdict('nao-existe', 0.4)).toEqual({ inside: true, overflow: 0 });
    expect(suggestedCaptionY('nao-existe')).toBe(0);
  });
});
