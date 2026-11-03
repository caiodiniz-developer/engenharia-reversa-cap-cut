import { useEffect, useMemo, useState } from 'react';
import { findClip, rampResultDuration, rampSpeeds, type MediaClip } from '@editor/core';
import { Modal } from '../components/controls';
import { Icon } from '../components/Icon';
import { useEditor } from '../store/editor';

const fmtSpeed = (v: number) => v.toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + '×';
const fmtSec = (v: number) => v.toFixed(1).replace('.', ',') + ' s';
/** O controle desliza em potências de 2 (−3 a 4): 0,125× … 16×, com a mesma sensibilidade para ir e para voltar. */
const toSpeed = (exp: number) => Math.round(2 ** exp * 100) / 100;

/** Escolhe a velocidade inicial e a final de um clipe e quantos trechos formam a rampa, vendo o resultado antes de aplicar. */
export function RampDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const clip = useEditor((s) => {
    const c = s.selection.length === 1 ? findClip(s.project, s.selection[0]!)?.clip : undefined;
    return c?.type === 'media' ? c : undefined;
  });
  const [from, setFrom] = useState(-1.7);
  const [to, setTo] = useState(0);
  const [parts, setParts] = useState(6);
  const [smooth, setSmooth] = useState(true);

  useEffect(() => {
    if (open) {
      setFrom(-1.7);
      setTo(0);
      setParts(6);
      setSmooth(true);
    }
  }, [open]);

  const speeds = useMemo(() => rampSpeeds(toSpeed(from), toSpeed(to), parts, smooth), [from, to, parts, smooth]);
  const source = clip ? (clip as MediaClip).duration * (clip as MediaClip).speed : 0;
  const result = rampResultDuration(source, speeds);

  function apply() {
    if (useEditor.getState().applySpeedRamp({ from: toSpeed(from), to: toSpeed(to), parts, smooth })) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Rampa de velocidade" width={500}>
      {!clip ? (
        <p className="py-8 text-center text-xs text-mute" data-testid="ramp-empty">
          Selecione um único clipe de vídeo, imagem ou áudio na timeline para aplicar a rampa.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <p className="mb-3 text-2xs leading-relaxed text-mute">O clipe é dividido em trechos que cobrem partes iguais da mídia, cada um com a sua velocidade. A duração total muda e o resto da faixa anda junto.</p>
          <div className="mb-3 flex h-24 items-end gap-1 rounded-xl border border-line bg-bg p-2" role="img" aria-label="Velocidade de cada trecho" data-testid="ramp-bars">
            {speeds.map((v, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end" title={'Trecho ' + (i + 1) + ': ' + fmtSpeed(v)}>
                <div className={'rounded-sm transition-[height] duration-200 ' + (v < 1 ? 'bg-warn' : 'bg-accent')} style={{ height: Math.max(6, ((Math.log2(v) + 3.2) / 7.2) * 100) + '%' }} />
              </div>
            ))}
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ramp-from">
                Começa em <span className="tnum text-ink" data-testid="ramp-from-label">{fmtSpeed(toSpeed(from))}</span>
              </label>
              <input id="ramp-from" type="range" className="w-full accent-[rgb(var(--accent))]" min={-3} max={4} step={0.05} value={from} onChange={(e) => setFrom(Number(e.target.value))} data-testid="ramp-from" />
            </div>
            <div>
              <label className="label" htmlFor="ramp-to">
                Termina em <span className="tnum text-ink" data-testid="ramp-to-label">{fmtSpeed(toSpeed(to))}</span>
              </label>
              <input id="ramp-to" type="range" className="w-full accent-[rgb(var(--accent))]" min={-3} max={4} step={0.05} value={to} onChange={(e) => setTo(Number(e.target.value))} data-testid="ramp-to" />
            </div>
          </div>
          <div className="mb-3 grid items-end gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ramp-parts">
                Trechos <span className="tnum text-ink">{parts}</span>
              </label>
              <input id="ramp-parts" type="range" className="w-full accent-[rgb(var(--accent))]" min={3} max={12} step={1} value={parts} onChange={(e) => setParts(Number(e.target.value))} data-testid="ramp-parts" />
            </div>
            <label className="flex items-center gap-2 pb-1 text-xs">
              <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} data-testid="ramp-smooth" /> Curva suave nas pontas
            </label>
          </div>
          <p className="mb-4 rounded-lg bg-panel-2 px-3 py-2 text-xs" aria-live="polite" data-testid="ramp-summary">
            Duração do clipe: <strong>{fmtSec((clip as MediaClip).duration)}</strong> → <strong>{fmtSec(result)}</strong> ({result > (clip as MediaClip).duration ? 'fica mais longo' : result < (clip as MediaClip).duration ? 'fica mais curto' : 'sem mudança'})
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" data-testid="ramp-apply">
              <Icon name="gauge" size={14} /> Aplicar rampa
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
