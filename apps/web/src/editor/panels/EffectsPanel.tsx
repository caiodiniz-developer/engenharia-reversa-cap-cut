import { useState } from 'react';
import { EFFECTS, PRESETS, findClip } from '@editor/core';
import { Empty } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';

const CATEGORY: Record<string, string> = { color: 'Cor', blur: 'Foco e desfoque', stylize: 'Estilo', key: 'Composição' };
const DESCRIPTION: Record<string, string> = {
  brightness: 'Clareia ou escurece o clipe',
  contrast: 'Aumenta ou reduz a diferença entre claros e escuros',
  exposure: 'Ajuste de exposição em passos de EV',
  saturation: 'Intensidade das cores (0 = preto e branco)',
  temperature: 'Tom frio (azul) ou quente (laranja)',
  blur: 'Desfoque gaussiano',
  sharpen: 'Realça detalhes finos',
  vignette: 'Escurece as bordas do quadro',
  grain: 'Granulação de filme animada',
  aberration: 'Separa os canais de cor nas bordas',
  glitch: 'Distorção digital com separação de cores e ruído',
  chromakey: 'Remove uma cor (tela verde) e revela a camada abaixo',
};

export function EffectsPanel() {
  const selection = useEditor((s) => s.selection);
  const addEffect = useEditor((s) => s.addEffect);
  const applyPreset = useEditor((s) => s.applyPreset);
  const [tab, setTab] = useState<'effects' | 'presets'>('effects');

  const targets = () => {
    const { project } = useEditor.getState();
    const ids = selection.filter((id) => findClip(project, id)?.clip.type === 'media' && findClip(project, id)?.track.kind === 'video');
    if (!ids.length) toast.info('Selecione um clipe de vídeo na timeline para aplicar o efeito');
    return ids;
  };

  const categories = [...new Set(EFFECTS.map((e) => e.category))];

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-line p-2" role="tablist">
        {(['effects', 'presets'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${tab === t ? 'bg-panel2 text-ink' : 'text-mute hover:text-ink'}`}>
            {t === 'effects' ? 'Efeitos' : 'Presets'}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {selection.length === 0 && <p className="mb-3 rounded-md bg-panel2 px-3 py-2 text-2xs text-mute">Selecione um clipe de vídeo para aplicar.</p>}
        {tab === 'effects' ? (
          categories.map((cat) => (
            <div key={cat} className="mb-4">
              <h3 className="panel-title !px-0">{CATEGORY[cat]}</h3>
              <ul className="grid grid-cols-2 gap-2">
                {EFFECTS.filter((e) => e.category === cat).map((e) => (
                  <li key={e.type}>
                    <button type="button" className="flex h-full w-full flex-col items-start gap-1 rounded-lg border border-line bg-panel2 p-2 text-left transition-colors hover:border-accent/60" title={DESCRIPTION[e.type]} onClick={() => targets().forEach((id) => addEffect(id, e.type))}>
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <Icon name="wand" size={13} className="text-accent" /> {e.label}
                      </span>
                      <span className="text-2xs leading-tight text-mute">{DESCRIPTION[e.type]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <li key={p.id}>
                <button type="button" className="flex w-full flex-col items-start gap-1 rounded-lg border border-line bg-panel2 p-2 text-left hover:border-accent/60" onClick={() => targets().forEach((id) => applyPreset(id, p.id))}>
                  <span className="text-xs font-medium">{p.label}</span>
                  <span className="text-2xs text-mute">{p.effects.map((e) => EFFECTS.find((x) => x.type === e.type)?.label).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {tab === 'presets' && PRESETS.length === 0 && <Empty icon="sparkles" title="Sem presets" />}
      </div>
    </div>
  );
}
