import { Modal } from '../components/controls';
import { Icon } from '../components/Icon';
import { NEWS } from '../lib/changelog';
import { buildExtraCommands } from './extraCommands';

const fmt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

/** O que chegou ao editor, do mais recente ao mais antigo. "Experimentar" fecha o diálogo e executa o comando. */
export function NewsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  function tryIt(id: string) {
    const c = buildExtraCommands().find((x) => x.id === id);
    onClose();
    // depois de fechar, para o foco voltar ao editor antes da ação
    if (c) setTimeout(() => c.run(), 0);
  }

  return (
    <Modal open={open} onClose={onClose} title="Novidades do editor" width={560}>
      <div className="space-y-5" data-testid="news">
        {NEWS.map((e) => (
          <section key={e.date} aria-labelledby={'news-' + e.date}>
            <h3 id={'news-' + e.date} className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
              {e.title}
              <span className="text-2xs font-normal text-mute">{fmt(e.date)}</span>
            </h3>
            <ul className="space-y-1.5">
              {e.items.map((i) => (
                <li key={i.text} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-xs leading-snug hover:bg-panel-2" data-testid="news-item">
                  <Icon name="sparkles" size={13} className="mt-0.5 shrink-0 text-accent" />
                  <span className="flex-1">{i.text}</span>
                  {i.command && (
                    <button type="button" className="btn !h-6 shrink-0 px-2 text-2xs" onClick={() => tryIt(i.command!)} data-testid="news-try">
                      Experimentar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" className="btn" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
