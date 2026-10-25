import { useState } from 'react';
import { api, ApiError } from '../../api/client';
import type { MediaItem } from '../../api/types';
import { ColorField, NumberField, Segmented } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';

const SOLIDS = ['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#475569', '#fde68a'];
const SHAPE_LIST: Array<{ id: string; label: string; d: string }> = [
  { id: 'circle', label: 'Círculo', d: 'M50 8a42 42 0 1 0 .01 0z' },
  { id: 'square', label: 'Quadrado', d: 'M8 8h84v84H8z' },
  { id: 'rounded', label: 'Retângulo arredondado', d: 'M30 8h40a22 22 0 0 1 22 22v40a22 22 0 0 1-22 22H30A22 22 0 0 1 8 70V30A22 22 0 0 1 30 8z' },
  { id: 'triangle', label: 'Triângulo', d: 'M50 8l42 84H8z' },
  { id: 'star', label: 'Estrela', d: 'M50 12l11 28 30 2-23 19 8 29-26-16-26 16 8-29L9 42l30-2z' },
  { id: 'heart', label: 'Coração', d: 'M50 90C10 60 8 36 26 24c12-8 22-2 24 8 2-10 12-16 24-8 18 12 16 36-24 66z' },
  { id: 'arrow', label: 'Seta', d: 'M8 38h50V16l34 34-34 34V62H8z' },
  { id: 'line', label: 'Linha', d: 'M8 46h84v8H8z' },
];
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
  const stateOf = useEditor.getState;
  const [mode, setMode] = useState<'solid' | 'gradient' | 'shape'>('solid');
  const [shapeColor, setShapeColor] = useState('#ffffff');
  const [color, setColor] = useState('#3b82f6');
  const [color2, setColor2] = useState('#8b5cf6');
  const [angle, setAngle] = useState(135);
  const [busy, setBusy] = useState(false);

  async function create(spec: { kind: 'solid' | 'gradient' | 'shape'; shape?: string; color: string; color2?: string; angle?: number; name?: string }) {
    setBusy(true);
    try {
      const r = await api.post<{ media: MediaItem }>(`/api/projects/${projectId}/generated`, spec);
      importMedia(r.media);
      // Formas são sobreposições: vão para uma faixa nova no topo, a partir da cabeça de reprodução.
      if (spec.kind === 'shape') addToTimeline(r.media.id, { overlay: true, at: stateOf().playhead });
      else addToTimeline(r.media.id);
      toast.success(spec.kind === 'shape' ? 'Forma adicionada em uma nova faixa' : 'Fundo adicionado à biblioteca e à timeline');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível gerar o elemento');
    } finally {
      setBusy(false);
    }
  }

  const gradientCss = (a: string, b: string, angle: number) => `linear-gradient(${angle}deg, ${a}, ${b})`;

  return (
    <div className="h-full overflow-auto p-3" data-testid="elements-panel">
      <p className="mb-3 text-2xs leading-relaxed text-mute">Gere fundos e formas no servidor. Eles viram imagens normais: dá para animar, aplicar efeitos e usar em qualquer faixa.</p>
      <Segmented label="Tipo de elemento" value={mode} onChange={setMode} options={[{ value: 'solid', label: 'Cor sólida' }, { value: 'gradient', label: 'Degradê' }, { value: 'shape', label: 'Formas' }]} />

      {mode === 'shape' ? (
        <section className="mt-3">
          <ColorField label="Cor da forma" value={shapeColor} onChange={setShapeColor} />
          <ul className="mt-2 grid grid-cols-4 gap-2">
            {SHAPE_LIST.map((s) => (
              <li key={s.id}>
                <button type="button" disabled={busy} aria-label={`Forma ${s.label}`} title={s.label} className="card card-hover flex aspect-square w-full items-center justify-center p-2 disabled:opacity-40" onClick={() => void create({ kind: 'shape', shape: s.id, color: shapeColor })}>
                  <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
                    <path d={s.d} fill={shapeColor} stroke="rgb(var(--line))" strokeWidth="2" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-2xs leading-relaxed text-mute">A forma entra numa faixa nova, acima das outras, a partir da cabeça de reprodução. Use Escala e Posição nas propriedades para ajustar.</p>
        </section>
      ) : mode === 'solid' ? (
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
