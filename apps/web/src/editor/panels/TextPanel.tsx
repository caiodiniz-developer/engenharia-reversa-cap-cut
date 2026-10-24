import { useEffect, useRef, useState } from 'react';
import { captionClipsToCues, findClip, newId, parseSrt, parseVtt, toSrt, toVtt, type CaptionClip, type TextStyle } from '@editor/core';
import { Icon } from '../../components/Icon';
import { templates, type TextTemplate } from '../../lib/idb';
import { useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';

const PRESETS: Array<{ id: string; label: string; sample: string; style: Partial<TextStyle> }> = [
  { id: 'title', label: 'Título', sample: 'Título', style: { fontSize: 120, bold: true, shadowBlur: 10, shadowY: 4 } },
  { id: 'subtitle', label: 'Subtítulo', sample: 'Subtítulo', style: { fontSize: 64, bold: false } },
  { id: 'outline', label: 'Contorno', sample: 'Contorno', style: { fontSize: 96, strokeWidth: 8, strokeColor: '#000000' } },
  { id: 'neon', label: 'Neon', sample: 'Neon', style: { fontSize: 100, color: '#35d0c4', shadowColor: '#35d0c4', shadowBlur: 30 } },
  { id: 'box', label: 'Caixa', sample: 'Caixa', style: { fontSize: 72, background: '#000000cc' } },
  { id: 'gradient', label: 'Degradê', sample: 'Degradê', style: { fontSize: 110, color: '#ffb347', gradientTo: '#ff3c8e' } },
  { id: 'gold', label: 'Cinema', sample: 'Cinema', style: { fontSize: 90, color: '#ffe14d', strokeWidth: 6, strokeColor: '#000000' } },
];

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TextPanel() {
  const addText = useEditor((s) => s.addText);
  const addCaptions = useEditor((s) => s.addCaptions);
  const fileRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState<TextTemplate[]>([]);
  const [name, setName] = useState('');

  const reload = () => void templates.all().then(setList);
  useEffect(reload, []);

  async function importSubtitles(file: File) {
    try {
      const text = await file.text();
      const cues = /\.vtt$/i.test(file.name) || text.trimStart().startsWith('WEBVTT') ? parseVtt(text) : parseSrt(text);
      if (!cues.length) return toast.error('Nenhuma legenda encontrada no arquivo');
      addCaptions(cues);
      toast.success(`${cues.length} legendas importadas`);
    } catch (e) {
      toast.error(e instanceof Error ? `Arquivo inválido: ${e.message}` : 'Arquivo de legenda inválido');
    }
  }

  function exportSubtitles(kind: 'srt' | 'vtt') {
    const { project } = useEditor.getState();
    const caps = project.tracks.filter((t) => t.kind === 'caption' && !t.hidden).flatMap((t) => t.clips) as CaptionClip[];
    if (!caps.length) return toast.info('Não há legendas no projeto');
    const cues = captionClipsToCues(caps);
    const base = project.name.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'legendas';
    if (kind === 'srt') download(`${base}.srt`, toSrt(cues), 'application/x-subrip');
    else download(`${base}.vtt`, toVtt(cues), 'text/vtt');
  }

  async function saveTemplate() {
    const { project, selection } = useEditor.getState();
    const c = selection.map((id) => findClip(project, id)?.clip).find((x) => x && (x.type === 'text' || x.type === 'caption'));
    if (!c || (c.type !== 'text' && c.type !== 'caption')) return toast.info('Selecione um texto ou legenda para salvar o estilo');
    await templates.save({ id: newId('tpl'), name: name.trim() || 'Meu modelo', style: c.style as unknown as Record<string, unknown>, text: c.text });
    setName('');
    reload();
    toast.success('Modelo salvo neste navegador');
  }

  function applyTemplate(t: TextTemplate) {
    const s = useEditor.getState();
    const ids = s.selection.filter((id) => {
      const c = findClip(s.project, id)?.clip;
      return c?.type === 'text' || c?.type === 'caption';
    });
    if (!ids.length) return addText(t.text, t.style as Partial<TextStyle>);
    ids.forEach((id) => s.patchClip(id, (c) => (c.type === 'text' || c.type === 'caption' ? { ...c, style: { ...c.style, ...(t.style as Partial<TextStyle>) } } : c), 'Aplicar modelo de texto'));
  }

  return (
    <div className="h-full overflow-auto p-3">
      <h3 className="panel-title !px-0">Adicionar texto</h3>
      <ul className="grid grid-cols-2 gap-2">
        {PRESETS.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => addText(p.sample, p.style)} className="flex h-16 w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-bg px-1 hover:border-accent/60" aria-label={`Adicionar texto ${p.label}`}>
              <span
                className="max-w-full truncate"
                style={{
                  fontWeight: p.style.bold === false ? 400 : 800,
                  fontSize: 18,
                  color: p.style.gradientTo ? 'transparent' : (p.style.color ?? '#fff'),
                  backgroundImage: p.style.gradientTo ? `linear-gradient(${p.style.color},${p.style.gradientTo})` : undefined,
                  WebkitBackgroundClip: p.style.gradientTo ? 'text' : undefined,
                  textShadow: p.style.shadowBlur ? `0 0 ${p.style.shadowBlur / 2}px ${p.style.shadowColor ?? '#000'}` : p.style.strokeWidth ? '1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000' : undefined,
                  background: p.style.background ? p.style.background : undefined,
                  padding: p.style.background ? '2px 6px' : undefined,
                }}
              >
                {p.sample}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <h3 className="panel-title mt-4 !px-0">Legendas</h3>
      <input ref={fileRef} type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" className="sr-only" aria-label="Importar arquivo de legenda" data-testid="subtitle-input" onChange={(e) => e.target.files?.[0] && (void importSubtitles(e.target.files[0]), (e.target.value = ''))} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={13} /> Importar SRT/VTT
        </button>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" className="btn px-1" onClick={() => exportSubtitles('srt')}>
            .srt
          </button>
          <button type="button" className="btn px-1" onClick={() => exportSubtitles('vtt')}>
            .vtt
          </button>
        </div>
      </div>
      <p className="mt-2 text-2xs text-mute">Para gerar legendas automaticamente a partir da fala, use a aba IA.</p>

      <h3 className="panel-title mt-4 !px-0">Modelos de texto</h3>
      <div className="mb-2 flex gap-2">
        <input className="field" placeholder="Nome do modelo" aria-label="Nome do modelo" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="btn shrink-0" onClick={() => void saveTemplate()}>
          Salvar
        </button>
      </div>
      <p className="mb-2 text-2xs text-mute">Salva o estilo do texto selecionado, só neste navegador.</p>
      <ul className="space-y-1">
        {list.map((t) => (
          <li key={t.id} className="flex items-center gap-1 rounded-md border border-line bg-panel2 px-2 py-1.5">
            <button type="button" className="min-w-0 flex-1 truncate text-left text-xs" onClick={() => applyTemplate(t)} title="Aplicar ao texto selecionado (ou criar novo)">
              {t.name}
            </button>
            <button
              type="button"
              className="btn-icon !h-6 !w-6"
              aria-label={`Excluir modelo ${t.name}`}
              onClick={async () => {
                await templates.remove(t.id);
                reload();
              }}
            >
              <Icon name="x" size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
