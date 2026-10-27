import { POSITION_LABEL, POSITION_PRESETS } from '@editor/core';
import { Icon } from '../../components/Icon';
import { useEditor } from '../../store/editor';

/** Grade 3×3 para encostar o clipe em cantos/bordas, mais atalhos de preencher o quadro e girar. */
export function PositionGrid() {
  const place = useEditor((s) => s.placeSelection);
  const fill = useEditor((s) => s.fillFrameSelection);
  const rotate = useEditor((s) => s.rotateSelection);
  return (
    <div className="mb-3 flex items-center gap-3" data-testid="position-grid">
      <div className="grid shrink-0 grid-cols-3 gap-1 rounded-lg bg-panel-2 p-1" role="group" aria-label="Posição no quadro">
        {POSITION_PRESETS.map((p) => (
          <button key={p} type="button" className="group flex h-6 w-6 items-center justify-center rounded-md hover:bg-panel-3" title={POSITION_LABEL[p]} aria-label={`Posicionar: ${POSITION_LABEL[p]}`} onClick={() => place(p)}>
            <span className={`block rounded-[2px] bg-mute transition-colors group-hover:bg-accent ${p === 'center' ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5'}`} />
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <button type="button" className="btn h-7 justify-start px-2 text-2xs" onClick={fill} title="Escala o clipe até cobrir o quadro inteiro">
          <Icon name="maximize" size={13} /> Preencher quadro
        </button>
        <button type="button" className="btn h-7 justify-start px-2 text-2xs" onClick={() => rotate(90)} title="Girar 90° para a direita (Shift+R)">
          <Icon name="redo" size={13} /> Girar 90°
        </button>
      </div>
    </div>
  );
}
