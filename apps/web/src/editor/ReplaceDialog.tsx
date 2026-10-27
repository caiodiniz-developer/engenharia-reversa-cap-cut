import { useEffect, useState } from 'react';
import { Modal } from '../components/controls';
import { Icon } from '../components/Icon';
import { useEditor } from '../store/editor';
import { toast } from '../store/toasts';

/** Localizar e substituir em todos os textos e legendas do projeto (ou só nos selecionados). */
export function ReplaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [find, setFind] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [onlySelection, setOnlySelection] = useState(false);
  const selected = useEditor((s) => s.selection.length);
  const texts = useEditor((s) => s.project.tracks.flatMap((t) => t.clips).filter((c) => c.type === 'text' || c.type === 'caption').length);

  useEffect(() => {
    if (open) setOnlySelection(false);
  }, [open]);

  function run() {
    if (!find) return;
    const n = useEditor.getState().replaceAllText(find, replacement, { matchCase, onlySelection });
    if (n === 0) toast.info('Nada encontrado para trocar');
    else {
      toast.success(`${n} ${n === 1 ? 'ocorrência trocada' : 'ocorrências trocadas'}`);
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Localizar e substituir" width={440}>
      <p className="mb-3 text-2xs leading-relaxed text-mute">
        Procura nos {texts} {texts === 1 ? 'texto ou legenda' : 'textos e legendas'} do projeto. A busca é literal e, por padrão, não diferencia maiúsculas de minúsculas.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <label className="label" htmlFor="rep-find">
          Localizar
        </label>
        <input id="rep-find" className="field mb-3" autoFocus value={find} onChange={(e) => setFind(e.target.value)} />
        <label className="label" htmlFor="rep-with">
          Substituir por
        </label>
        <input id="rep-with" className="field mb-3" value={replacement} onChange={(e) => setReplacement(e.target.value)} />
        <label className="mb-1.5 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Diferenciar maiúsculas de minúsculas
        </label>
        <label className={`mb-4 flex items-center gap-2 text-xs ${selected ? '' : 'opacity-50'}`}>
          <input type="checkbox" checked={onlySelection} disabled={!selected} onChange={(e) => setOnlySelection(e.target.checked)} /> Só nos clipes selecionados ({selected})
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={!find} data-testid="replace-run">
            <Icon name="check" size={14} /> Substituir tudo
          </button>
        </div>
      </form>
    </Modal>
  );
}
