import { useRef, useState } from 'react';
import { BUILTIN_LUTS, BUILTIN_PREFIX, EFFECTS, PRESETS, findClip, parseCube } from '@editor/core';
import { Empty } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';

const CATEGORY: Record<string, string> = { color: 'Cor', blur: 'Foco e desfoque', stylize: 'Estilo', key: 'Composição', look: 'Looks' };
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

type Tab = 'effects' | 'presets' | 'luts';
const TAB_LABEL: Record<Tab, string> = { effects: 'Efeitos', presets: 'Presets', luts: 'LUTs' };

export function EffectsPanel() {
  const selection = useEditor((s) => s.selection);
  const addEffect = useEditor((s) => s.addEffect);
  const applyPreset = useEditor((s) => s.applyPreset);
  const addLutEffect = useEditor((s) => s.addLutEffect);
  const importLut = useEditor((s) => s.importLut);
  const removeLut = useEditor((s) => s.removeLut);
  const luts = useEditor((s) => s.project.luts);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('effects');

  const targets = () => {
    const { project } = useEditor.getState();
    const ids = selection.filter((id) => findClip(project, id)?.clip.type === 'media' && findClip(project, id)?.track.kind === 'video');
    if (!ids.length) toast.info('Selecione um clipe de vídeo na timeline para aplicar o efeito');
    return ids;
  };

  async function onLutFile(file: File) {
    try {
      const text = await file.text();
      parseCube(text); // valida antes de guardar no projeto
      const id = importLut(file.name.replace(/\.cube$/i, ''), text);
      if (id) toast.success('LUT importada. Clique nela para aplicar ao clipe selecionado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Arquivo de LUT inválido');
    }
  }

  const categories = [...new Set(EFFECTS.filter((e) => e.type !== 'lut').map((e) => e.category))];

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-line p-2" role="tablist">
        {(['effects', 'presets', 'luts'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${tab === t ? 'bg-panel-3 text-ink' : 'text-mute hover:text-ink'}`}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {selection.length === 0 && <p className="mb-3 rounded-md bg-panel-2 px-3 py-2 text-2xs text-mute">Selecione um clipe de vídeo para aplicar.</p>}

        {tab === 'luts' && (
          <div>
            <input ref={fileRef} type="file" accept=".cube" className="sr-only" aria-label="Importar LUT .cube" data-testid="lut-input" onChange={(e) => e.target.files?.[0] && (void onLutFile(e.target.files[0]), (e.target.value = ''))} />
            <button type="button" className="btn mb-2 w-full" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={13} /> Importar LUT (.cube)
            </button>
            <p className="mb-3 text-2xs text-mute">LUTs 3D no formato .cube. As embutidas são geradas pelo próprio editor (sem material de terceiros); importe apenas LUTs que você tem licença para usar.</p>
            <h3 className="panel-title !px-0">Embutidas</h3>
            <ul className="mb-4 grid grid-cols-2 gap-2">
              {BUILTIN_LUTS.map((l) => (
                <li key={l.id}>
                  <button type="button" className="w-full card p-2 text-left text-xs font-medium hover:border-accent/60" onClick={() => targets().forEach((id) => addLutEffect(id, BUILTIN_PREFIX + l.id))}>
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
            {Object.values(luts).length > 0 && <h3 className="panel-title !px-0">Do projeto</h3>}
            <ul className="space-y-1" data-testid="project-luts">
              {Object.values(luts).map((l) => (
                <li key={l.id} className="flex items-center gap-1 card px-2 py-1.5">
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-xs" onClick={() => targets().forEach((id) => addLutEffect(id, l.id))}>
                    {l.name}
                  </button>
                  <button type="button" className="btn-icon !h-6 !w-6" aria-label={`Remover LUT ${l.name}`} onClick={() => removeLut(l.id)}>
                    <Icon name="x" size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'effects' &&
          categories.map((cat) => (
            <div key={cat} className="mb-4">
              <h3 className="panel-title !px-0">{CATEGORY[cat]}</h3>
              <ul className="grid grid-cols-2 gap-2">
                {EFFECTS.filter((e) => e.category === cat && e.type !== 'lut').map((e) => (
                  <li key={e.type}>
                    <button type="button" className="flex h-full w-full flex-col items-start gap-1 card p-2 text-left transition-colors hover:border-accent/60" title={DESCRIPTION[e.type]} onClick={() => targets().forEach((id) => addEffect(id, e.type))}>
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <Icon name="wand" size={13} className="text-accent" /> {e.label}
                      </span>
                      <span className="text-2xs leading-tight text-mute">{DESCRIPTION[e.type]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        {tab === 'presets' && (
          <ul className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <li key={p.id}>
                <button type="button" className="flex w-full flex-col items-start gap-1 card p-2 text-left hover:border-accent/60" onClick={() => targets().forEach((id) => applyPreset(id, p.id))}>
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
