import { useState } from 'react';
import { findClip, type CaptionClip, type Clip, type TextClip } from '@editor/core';
import { Icon } from '../../components/Icon';
import { getEngine } from '../../engine/registry';
import { dominantColors } from '../../lib/palette';
import { useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';

/** Lê as cores dominantes do quadro atual do preview e aplica a que o usuário escolher ao texto selecionado. */
export function FrameColors() {
  const [colors, setColors] = useState<string[]>([]);

  function read() {
    const canvas = getEngine()?.canvas;
    if (!canvas || !canvas.width || !canvas.height) return toast.error('O preview ainda não está pronto');
    const small = document.createElement('canvas');
    small.width = 64;
    small.height = Math.max(1, Math.round((64 * canvas.height) / canvas.width));
    const ctx = small.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, small.width, small.height);
    const found = dominantColors(ctx.getImageData(0, 0, small.width, small.height).data, 6);
    setColors(found);
    if (!found.length) toast.info('Não há cores no quadro atual (ele está vazio)');
  }

  function apply(color: string) {
    const st = useEditor.getState();
    const targets = st.selection.map((id) => findClip(st.project, id)?.clip).filter((c): c is TextClip | CaptionClip => c?.type === 'text' || c?.type === 'caption');
    if (!targets.length) return toast.info('Selecione um texto ou legenda para aplicar a cor');
    for (const c of targets) st.patchClip(c.id, (x) => ({ ...x, style: { ...(x as TextClip).style, color } }) as Clip, 'Cor do texto', `fcolor:${c.id}`);
    st.sealDrag();
  }

  return (
    <section className="mb-4" data-testid="frame-colors">
      <h3 className="panel-title !px-0">Cores do quadro</h3>
      <p className="mb-2 text-2xs leading-relaxed text-mute">Lê as cores que mais aparecem no quadro atual e aplica ao texto selecionado, para combinar com o vídeo.</p>
      <button type="button" className="btn w-full" onClick={read} data-testid="read-colors">
        <Icon name="eye" size={14} /> Ler cores do quadro
      </button>
      {colors.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {colors.map((c) => (
            <li key={c}>
              <button type="button" className="h-8 w-8 rounded-lg border border-line transition-transform hover:scale-110" style={{ background: c }} aria-label={`Usar a cor ${c}`} title={c} data-hex={c} data-testid="frame-color" onClick={() => apply(c)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
