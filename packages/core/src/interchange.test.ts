import { describe, expect, it } from 'vitest';
import { newId } from './ids';
import { addMedia, createProject } from './project';
import { CaptionClipSchema, TextClipSchema, type MediaAsset, type Project } from './schema';
import { addClip } from './ops/clips';
import { addMarker, addTrack } from './ops/tracks';
import { updateClip } from './ops/clips';
import { mediaClip, videoAsset } from './testing';
import { buildDescription, creditsList, csvField, scriptText, timelineCsv, toCsv, toEdl } from './interchange';
import type { MediaClip } from './schema';

const music: MediaAsset = { ...videoAsset('mus', 120), kind: 'audio', width: 0, height: 0, name: 'trilha, final.mp3' };

function project(): { p: Project; vid: string; aud: string } {
  let p = createProject('Meu filme', { fps: 30 });
  p = addMedia(addMedia(addMedia(p, { ...videoAsset('a', 20), name: 'cena a.mp4' }), { ...videoAsset('b', 20), name: 'cena b.mp4' }), music);
  const v = addTrack(p, 'video');
  const au = addTrack(v.project, 'audio');
  let q = addClip(au.project, v.track.id, mediaClip('a', 0, 5, { sourceIn: 2 }));
  q = addClip(q, v.track.id, mediaClip('b', 5, 4));
  q = addClip(q, au.track.id, mediaClip('mus', 0, 9));
  return { p: q, vid: v.track.id, aud: au.track.id };
}

describe('toEdl', () => {
  it('cabeçalho CMX 3600 e um evento por clipe de mídia, com entrada/saída de origem e de timeline', () => {
    const { p } = project();
    const lines = toEdl(p).split('\r\n');
    expect(lines[0]).toBe('TITLE: Meu filme');
    expect(lines[1]).toBe('FCM: NON-DROP FRAME');
    const events = lines.filter((l) => /^\d{3}  AX/.test(l));
    expect(events).toHaveLength(3);
    // clipe a (vídeo): origem 2–7 s, timeline 0–5 s; no empate de início a faixa A vem antes da V
    expect(events.find((e) => / V +C/.test(e))).toMatch(/^\d{3}  AX       V     C        00:00:02:00 00:00:07:00 00:00:00:00 00:00:05:00$/);
    expect(lines).toContain('* FROM CLIP NAME: cena a.mp4');
    expect(events.some((e) => / A +C/.test(e))).toBe(true);
  });

  it('velocidade vai em comentário e a saída de origem considera o fator', () => {
    const { p, vid } = project();
    const c = p.tracks.find((t) => t.id === vid)!.clips[0]!;
    const q = updateClip(p, c.id, (x) => ({ ...x, speed: 2, duration: 2.5 }) as MediaClip);
    const text = toEdl(q);
    expect(text).toContain('00:00:02:00 00:00:07:00 00:00:00:00 00:00:02:15'); // origem 2→7 (2,5 s × 2×), timeline 0→2,5 s
    expect(text).toContain('* VELOCIDADE: 200%');
  });

  it('ignora textos e legendas e numera os eventos em ordem de entrada na timeline', () => {
    const { p } = project();
    const tt = addTrack(p, 'text');
    const q = addClip(tt.project, tt.track.id, TextClipSchema.parse({ id: newId('clp'), type: 'text', start: 1, duration: 2, text: 'oi' }));
    const events = toEdl(q).split('\r\n').filter((l) => /^\d{3}  AX/.test(l));
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.slice(0, 3))).toEqual(['001', '002', '003']);
  });
});

describe('CSV', () => {
  it('csvField coloca aspas só quando precisa e dobra aspas internas', () => {
    expect(csvField('simples')).toBe('simples');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvField('linha\nnova')).toBe('"linha\nnova"');
    expect(csvField(3.5)).toBe('3.5');
  });

  it('toCsv junta linhas com CRLF', () => {
    expect(toCsv([['a', 'b'], [1, 'c,d']])).toBe('a,b\r\n1,"c,d"');
  });

  it('timelineCsv: cabeçalho, uma linha por clipe em ordem de início, decimais com vírgula', () => {
    const { p } = project();
    const rows = timelineCsv(p).split('\r\n');
    expect(rows[0]).toBe('Faixa,Tipo,Nome ou texto,Início (s),Fim (s),Duração (s),Velocidade,Volume (%)');
    expect(rows).toHaveLength(4);
    const a = rows.find((r) => r.includes('cena a.mp4'))!;
    expect(a).toBeTruthy();
    expect(rows.some((r) => r.includes('"trilha, final.mp3"'))).toBe(true); // vírgula no nome exige aspas
    expect(a).toMatch(/,1,100$/); // velocidade 1× e volume 100%
  });

  it('timelineCsv inclui texto e legenda com a quebra de linha trocada por barra', () => {
    const { p } = project();
    const tt = addTrack(p, 'text');
    const q = addClip(tt.project, tt.track.id, TextClipSchema.parse({ id: 'tx', type: 'text', start: 1.5, duration: 2, text: 'linha 1\nlinha 2' }));
    const csv = timelineCsv(q);
    expect(csv).toContain('linha 1 / linha 2');
    expect(csv).toContain('texto');
    expect(csv).toContain('1,5');
  });
});

describe('roteiro, créditos e descrição', () => {
  function withTexts(): Project {
    const { p } = project();
    const tt = addTrack(p, 'text');
    const tc = addTrack(tt.project, 'caption');
    let q = addClip(tc.project, tt.track.id, TextClipSchema.parse({ id: 't1', type: 'text', start: 0, duration: 2, text: 'Título' }));
    q = addClip(q, tc.track.id, CaptionClipSchema.parse({ id: 'c1', type: 'caption', start: 65, duration: 3, text: 'Segunda\nlinha' }));
    return q;
  }

  it('scriptText: ordem de aparição, intervalo m:ss e quebras de linha achatadas', () => {
    expect(scriptText(withTexts())).toBe('[0:00–0:02] Título\n[1:05–1:08] Segunda linha');
    expect(scriptText(project().p)).toBe('');
  });

  it('creditsList: primeira aparição, tempo total e usos, ordenado', () => {
    const { p, vid } = project();
    const again = addClip(p, vid, mediaClip('a', 9, 3));
    const list = creditsList(again);
    expect(list.map((c) => c.name).sort()).toEqual(['cena a.mp4', 'cena b.mp4', 'trilha, final.mp3']);
    expect(list.map((c) => c.firstAt)).toEqual([...list.map((c) => c.firstAt)].sort((x, y) => x - y)); // ordenado pela primeira aparição
    const a = list.find((c) => c.name === 'cena a.mp4')!;
    expect(a).toMatchObject({ firstAt: 0, total: 8, uses: 2, kind: 'video' });
  });

  it('buildDescription junta título, duração, capítulos e mídias; omite seções vazias', () => {
    const { p } = project();
    const bare = buildDescription(p, { title: 'Meu vídeo' });
    expect(bare.split('\n')[0]).toBe('Meu vídeo');
    expect(bare).toContain('Duração: 0:09');
    expect(bare).not.toContain('Capítulos');
    expect(bare).toContain('Mídias usadas');
    expect(bare).toContain('- cena b.mp4 (0:05)');

    let q = addMarker(p, 0, 'Abertura').project;
    q = addMarker(q, 30, 'Final').project;
    const full = buildDescription(q);
    expect(full).toContain('Capítulos\n0:00 Abertura\n0:30 Final');
    expect(full.split('\n')[0]).toBe('Meu filme');
  });
});
