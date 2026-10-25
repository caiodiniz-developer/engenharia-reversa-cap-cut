import { useState } from 'react';
import { api, ApiError } from '../../api/client';
import type { MediaItem } from '../../api/types';
import { ColorField, NumberField, Segmented } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';

const SOLIDS = ['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#475569', '#fde68a'];
const GRADIENTS: Array<{ name: string; a: string; b: string; angle: number }> = [
  { name: 'Pôr do sol', a: '#ff9966', b: '#ff5e62', angle: 180 },
  { name: 'Oceano', a: '#2193b0', b: '#6dd5ed', angle: 135 },
  { name: 'Aurora', a: '#00c9ff', b: '#92fe9d', angle: 90 },
  { name: 'Ameixa', a: '#41295a', b: '#2f0743', angle: 180 },
  { name: 'Menta', a: '#00b09b', b: '#96c93d', angle: 135 },
  { name: 'Grafite', a: '#232526', b: '#414345', angle: 180 },
];

/** Fundos gerados no servidor (PNG) que entram na biblioteca como qualquer imagem. */
export function ElementsPanel({ projectId }: { projectId: string }) {
  const importMedia = useEditor((s) => s.importMedia);
  const addToTimeline = useEditor((s) => s.addToTimeline);
  const [mode, setMode] = useState<'solid' | 'gradient'>('solid');
  const [color, setColor] = useState('#3b82f6');
  const [color2, setColor2] = useState('#8b5cf6');
  const [angle, setAngle] = useState(135);
  const [busy, setBusy] = useState(false);

  async function create(spec: { kind: 'solid' | 'gradient'; color: string; color2?: string; angle?: number; name?: string }) {
    setBusy(true);
    try {
      const r = await api.post<{ media: MediaItem }>(`/api/projects/${projectId}/generated`, spec);
      importMedia(r.media);
      addToTimeline(r.media.id);
      toast.success('Fundo adicionado à biblioteca e à timeline');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível gerar o fundo');
    } finally {
      setBusy(false);
    }
  }

  const gradientCss = (a: string, b: string, angle: number) => `linear-gradient(${angle}deg, ${a}, ${b})`;

  return (
    <div className="h-full overflow-auto p-3" data-testid="elements-panel">
      <p className="mb-3 text-2xs leading-relaxed text-mute">Gere fundos com o tamanho do projeto. Eles viram imagens normais: dá para animar, aplicar efeitos e usar em qualquer faixa.</p>
      <Segmented label="Tipo de fundo" value={mode} onChange={setMode} options={[{ value: 'solid', label: 'Cor sólida' }, { value: 'gradient', label: 'Degradê' }]} />

      {mode === 'solid' ? (
        <section className="mt-3">
          <h3 className="mb-2 text-xs font-semibold">Cores rápidas</h3>
          <ul className="mb-3 grid grid-cols-6 gap-1.5">
            {SOLIDS.map((c) => (
              <li key={c}>
                <button type="button" aria-label={`Fundo ${c}`} disabled={busy} className="h-9 w-full rounded-lg border border-line transition-transform hover:scale-105 hover:border-accent disabled:opacity-40" style={{ background: c }} onClick={() => void create({ kind: 'solid', color: c })} />
              </li>
            ))}
          </ul>
          <h3 className="mb-2 text-xs font-semibold">Cor personalizada</h3>
          <ColorField label="Cor" value={color} onChange={setColor} />
          <button type="button" className="btn btn-primary mt-1 w-full" disabled={busy} onClick={() => void create({ kind: 'solid', color })}>
            <Icon name="plus" size={14} /> Adicionar fundo
          </button>
        </section>
      ) : (
        <section className="mt-3">
          <h3 className="mb-2 text-xs font-semibold">Degradês prontos</h3>
          <ul className="mb-4 grid grid-cols-2 gap-2">
            {GRADIENTS.map((g) => (
              <li key={g.name}>
                <button type="button" disabled={busy} aria-label={`Degradê ${g.name}`} className="card card-hover block w-full overflow-hidden p-1 text-left disabled:opacity-40" onClick={() => void create({ kind: 'gradient', color: g.a, color2: g.b, angle: g.angle, name: g.name })}>
                  <span className="block h-12 rounded-lg" style={{ background: gradientCss(g.a, g.b, g.angle) }} />
                  <span className="block px-1 pb-0.5 pt-1.5 text-xs font-medium">{g.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <h3 className="mb-2 text-xs font-semibold">Personalizado</h3>
          <div className="mb-2 h-14 rounded-lg border border-line" style={{ background: gradientCss(color, color2, angle) }} aria-label="Prévia do degradê" />
          <ColorField label="Cor inicial" value={color} onChange={setColor} />
          <ColorField label="Cor final" value={color2} onChange={setColor2} />
          <NumberField label="Ângulo" value={angle} onChange={setAngle} min={0} max={360} step={5} unit="°" />
          <button type="button" className="btn btn-primary mt-1 w-full" disabled={busy} onClick={() => void create({ kind: 'gradient', color, color2, angle })}>
            <Icon name="plus" size={14} /> Adicionar degradê
          </button>
        </section>
      )}
    </div>
  );
}
