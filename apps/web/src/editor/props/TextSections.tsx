import { TEXT_ANIMATIONS, type CaptionClip, type Clip, type TextAnimationType, type TextClip, type TextStyle } from '@editor/core';
import { Check, ColorField, NumberField, Section, Select, TextInput } from '../../components/controls';
import { editCaptionText } from '../../lib/words';
import { useEditor } from '../../store/editor';

type T = TextClip | CaptionClip;

const FONTS = ['Arial', 'Arial Black', 'Verdana', 'Trebuchet MS', 'Tahoma', 'Georgia', 'Times New Roman', 'Courier New', 'Impact', 'Comic Sans MS'];
const ANIM_LABEL: Record<TextAnimationType, string> = { none: 'Nenhuma', fade: 'Aparecer', 'slide-up': 'Subir', 'slide-down': 'Descer', pop: 'Pop (zoom)' };

export function TextContentSection({ clip }: { clip: T }) {
  const patch = useEditor((s) => s.patchClip);
  return (
    <Section title={clip.type === 'caption' ? 'Legenda' : 'Texto'}>
      <TextInput
        label="Conteúdo"
        multiline
        value={clip.text}
        onChange={(v) =>
          patch(
            clip.id,
            (c) => {
              const x = c as T;
              return x.type === 'caption' ? { ...x, text: v, words: editCaptionText(v, x.words, x.duration) } : { ...x, text: v };
            },
            'Editar texto',
          )
        }
      />
    </Section>
  );
}

export function TextStyleSection({ clip }: { clip: T }) {
  const patch = useEditor((s) => s.patchClip);
  const st = clip.style;
  const set = (part: Partial<TextStyle>, label = 'Estilo do texto', key?: string) => patch(clip.id, (c) => ({ ...(c as T), style: { ...(c as T).style, ...part } }) as Clip, label, key ? `${key}:${clip.id}` : undefined);
  const commit = () => useEditor.getState().sealDrag();
  return (
    <Section title="Estilo">
      <Select label="Fonte" value={FONTS.includes(st.fontFamily) ? st.fontFamily : 'Arial'} options={FONTS.map((f) => ({ value: f, label: f }))} onChange={(v) => set({ fontFamily: v })} />
      <p className="-mt-1.5 mb-2 text-2xs text-mute">A exportação usa as fontes instaladas no servidor.</p>
      <NumberField label="Tamanho" value={st.fontSize} min={10} max={400} step={1} unit="px" onChange={(v) => set({ fontSize: v }, 'Tamanho do texto', 'fs')} onCommit={commit} />
      <div className="grid grid-cols-2 gap-x-3">
        <Check label="Negrito" checked={st.bold} onChange={(v) => set({ bold: v })} />
        <Check label="Itálico" checked={st.italic} onChange={(v) => set({ italic: v })} />
      </div>
      <Select
        label="Alinhamento"
        value={st.align}
        options={[
          { value: 'left', label: 'Esquerda' },
          { value: 'center', label: 'Centro' },
          { value: 'right', label: 'Direita' },
        ]}
        onChange={(v) => set({ align: v })}
      />
      <ColorField label="Cor" value={st.color} onChange={(v) => set({ color: v }, 'Cor do texto', 'color')} />
      <Check label="Degradê vertical" checked={!!st.gradientTo} onChange={(v) => set({ gradientTo: v ? '#ff3c8e' : undefined })} />
      {st.gradientTo && <ColorField label="Cor final" value={st.gradientTo} onChange={(v) => set({ gradientTo: v }, 'Degradê', 'grad')} />}
      <NumberField label="Largura máxima" value={st.maxWidth * 100} min={10} max={100} step={1} unit="%" onChange={(v) => set({ maxWidth: v / 100 }, 'Largura do texto', 'mw')} onCommit={commit} />

      <details className="mt-1" open={st.strokeWidth > 0}>
        <summary className="disclosure-summary">Contorno</summary>
        <div className="mt-2">
          <NumberField label="Espessura" value={st.strokeWidth} min={0} max={40} step={0.5} unit="px" onChange={(v) => set({ strokeWidth: v }, 'Contorno', 'sw')} onCommit={commit} />
          <ColorField label="Cor do contorno" value={st.strokeColor} onChange={(v) => set({ strokeColor: v }, 'Cor do contorno', 'sc')} />
        </div>
      </details>
      <details className="mt-1" open={st.shadowBlur > 0 || st.shadowX !== 0 || st.shadowY !== 0}>
        <summary className="disclosure-summary">Sombra</summary>
        <div className="mt-2">
          <ColorField label="Cor da sombra" value={st.shadowColor} onChange={(v) => set({ shadowColor: v }, 'Cor da sombra', 'shc')} />
          <NumberField label="Desfoque" value={st.shadowBlur} min={0} max={80} step={1} unit="px" onChange={(v) => set({ shadowBlur: v }, 'Sombra', 'shb')} onCommit={commit} />
          <NumberField label="Deslocamento X" value={st.shadowX} min={-40} max={40} step={1} unit="px" onChange={(v) => set({ shadowX: v }, 'Sombra', 'shx')} onCommit={commit} />
          <NumberField label="Deslocamento Y" value={st.shadowY} min={-40} max={40} step={1} unit="px" onChange={(v) => set({ shadowY: v }, 'Sombra', 'shy')} onCommit={commit} />
        </div>
      </details>
      <details className="mt-1" open={!!st.background}>
        <summary className="disclosure-summary">Fundo</summary>
        <div className="mt-2">
          <Check label="Caixa de fundo" checked={!!st.background} onChange={(v) => set({ background: v ? '#000000cc' : undefined })} />
          {st.background && <ColorField label="Cor do fundo" value={st.background.slice(0, 7)} onChange={(v) => set({ background: `${v}cc` }, 'Fundo', 'bg')} />}
        </div>
      </details>
    </Section>
  );
}

export function TextAnimationSection({ clip }: { clip: T }) {
  const patch = useEditor((s) => s.patchClip);
  const opts = TEXT_ANIMATIONS.map((a) => ({ value: a, label: ANIM_LABEL[a] }));
  const set = (key: 'animationIn' | 'animationOut', part: Partial<T['animationIn']>) => patch(clip.id, (c) => ({ ...(c as T), [key]: { ...(c as T)[key], ...part } }) as Clip, 'Animação do texto', `${key}:${clip.id}`);
  return (
    <Section title="Animação" defaultOpen={false}>
      <Select label="Entrada" value={clip.animationIn.type} options={opts} onChange={(v) => set('animationIn', { type: v })} />
      {clip.animationIn.type !== 'none' && <NumberField label="Duração da entrada" value={clip.animationIn.duration} min={0.1} max={Math.max(0.2, clip.duration / 2)} step={0.05} unit="s" onChange={(v) => set('animationIn', { duration: v })} onCommit={() => useEditor.getState().sealDrag()} />}
      <Select label="Saída" value={clip.animationOut.type} options={opts.filter((o) => o.value !== 'pop')} onChange={(v) => set('animationOut', { type: v })} />
      {clip.animationOut.type !== 'none' && <NumberField label="Duração da saída" value={clip.animationOut.duration} min={0.1} max={Math.max(0.2, clip.duration / 2)} step={0.05} unit="s" onChange={(v) => set('animationOut', { duration: v })} onCommit={() => useEditor.getState().sealDrag()} />}
    </Section>
  );
}

export function CaptionWordsSection({ clip }: { clip: CaptionClip }) {
  const patch = useEditor((s) => s.patchClip);
  const setWords = (words: CaptionClip['words'], label: string, key?: string) => patch(clip.id, (c) => ({ ...(c as CaptionClip), words, text: words.length ? words.map((w) => w.text).join(' ') : (c as CaptionClip).text }), label, key);
  const shift = (d: number) => setWords(clip.words.map((w) => ({ ...w, start: Math.max(0, +(w.start + d).toFixed(3)), end: Math.max(0.02, +(w.end + d).toFixed(3)) })), 'Sincronizar legenda', `shift:${clip.id}`);
  return (
    <Section title="Palavras e sincronização" defaultOpen={false}>
      <Check label="Destacar a palavra falada" checked={!!clip.highlightColor} onChange={(v) => patch(clip.id, (c) => ({ ...(c as CaptionClip), highlightColor: v ? '#ffd84d' : undefined }), 'Destaque de palavra')} />
      {clip.highlightColor && <ColorField label="Cor do destaque" value={clip.highlightColor} onChange={(v) => patch(clip.id, (c) => ({ ...(c as CaptionClip), highlightColor: v }), 'Cor do destaque', `hl:${clip.id}`)} />}
      <div className="mb-2 flex items-center gap-1">
        <span className="label !mb-0 flex-1">Deslocar tempos</span>
        <button type="button" className="btn !h-6 px-2 text-2xs" onClick={() => shift(-0.1)} disabled={!clip.words.length}>
          −0,1s
        </button>
        <button type="button" className="btn !h-6 px-2 text-2xs" onClick={() => shift(0.1)} disabled={!clip.words.length}>
          +0,1s
        </button>
      </div>
      {clip.words.length === 0 ? (
        <p className="text-2xs text-mute">Esta legenda não tem tempos por palavra. Editar o texto os recria.</p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-auto pr-1">
          {clip.words.map((w, i) => (
            <li key={i} className="grid grid-cols-[1fr_58px_58px] gap-1">
              <input className="field h-7" aria-label={`Palavra ${i + 1}`} value={w.text} onChange={(e) => setWords(clip.words.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)), 'Editar palavra', `w${i}:${clip.id}`)} />
              <input className="field h-7 px-1 text-right" type="number" step={0.05} min={0} aria-label={`Início da palavra ${i + 1}`} value={w.start} onChange={(e) => setWords(clip.words.map((x, j) => (j === i ? { ...x, start: Math.max(0, Number(e.target.value)) } : x)), 'Tempo da palavra', `ws${i}:${clip.id}`)} />
              <input className="field h-7 px-1 text-right" type="number" step={0.05} min={0} aria-label={`Fim da palavra ${i + 1}`} value={w.end} onChange={(e) => setWords(clip.words.map((x, j) => (j === i ? { ...x, end: Math.max(0, Number(e.target.value)) } : x)), 'Tempo da palavra', `we${i}:${clip.id}`)} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
