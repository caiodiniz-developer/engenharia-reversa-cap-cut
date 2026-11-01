import { useEffect, useMemo, useState } from 'react';
import { projectDuration, splitScript } from '@editor/core';
import { Modal } from '../components/controls';
import { Icon } from '../components/Icon';
import { useEditor } from '../store/editor';
import { toast } from '../store/toasts';

const num = (v: string) => Number(v.replace(',', '.'));

/** Cola um roteiro e distribui as falas como legendas, com tempo proporcional ao tamanho, no intervalo escolhido. */
export function ScriptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [script, setScript] = useState('');
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('10');

  useEffect(() => {
    if (!open) return;
    const st = useEditor.getState();
    const w = st.workArea;
    const total = projectDuration(st.project);
    setScript('');
    setStart(String(w ? w.start : 0));
    setEnd(String(w ? w.end : total > 0 ? total : 10));
  }, [open]);

  const parts = useMemo(() => splitScript(script), [script]);
  const span = num(end) - num(start);
  const each = parts.length ? span / parts.length : 0;
  const tooFast = parts.length > 0 && each < 0.3;
  const invalid = !(span > 0) || !parts.length;

  function run() {
    if (invalid) return;
    const n = useEditor.getState().scriptToCaptions(script, num(start), num(end));
    if (n > 0) {
      toast.success(n === 1 ? '1 legenda criada' : n + ' legendas criadas');
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Legendas a partir de um roteiro" width={520}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <p className="mb-3 text-2xs leading-relaxed text-mute">Cada linha e cada frase vira uma legenda; frases longas são quebradas. O tempo de cada fala é proporcional ao tamanho do texto. Não reconhece fala: você define o intervalo.</p>
        <label className="label" htmlFor="sc-text">
          Roteiro
        </label>
        <textarea id="sc-text" className="field mb-3 min-h-[140px] resize-y" autoFocus value={script} onChange={(e) => setScript(e.target.value)} placeholder={'Olá, pessoal!\nHoje vamos ver como editar um vídeo.'} data-testid="script-text" />
        <div className="mb-2 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="sc-start">
              Início (s)
            </label>
            <input id="sc-start" className="field" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} data-testid="script-start" />
          </div>
          <div>
            <label className="label" htmlFor="sc-end">
              Fim (s)
            </label>
            <input id="sc-end" className="field" inputMode="decimal" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="script-end" />
          </div>
        </div>
        <p className={`mb-4 text-2xs ${tooFast ? 'text-danger' : 'text-mute'}`} data-testid="script-summary" aria-live="polite">
          {parts.length === 0 ? 'Escreva ou cole o roteiro.' : parts.length + (parts.length === 1 ? ' legenda' : ' legendas') + (span > 0 ? ', cerca de ' + each.toFixed(1).replace('.', ',') + ' s cada.' : '. O fim precisa vir depois do início.') + (tooFast ? ' Rápido demais: aumente o intervalo.' : '')}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={invalid || tooFast} data-testid="script-run">
            <Icon name="captions" size={14} /> Criar legendas
          </button>
        </div>
      </form>
    </Modal>
  );
}
