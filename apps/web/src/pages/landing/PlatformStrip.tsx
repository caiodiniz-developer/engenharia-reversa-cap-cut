import { PLATFORMS } from '@editor/core';

const ratio = (w: number, h: number) => (w === h ? '1:1' : w / h > 1 ? '16:9' : h / w > 1.5 ? '9:16' : '4:5');

/** Formatos que o editor sabe conferir, lidos da própria lista de plataformas (sem duplicar dados). */
export function PlatformStrip() {
  return (
    <section aria-labelledby="plataformas-title" className="px-5 py-14" data-testid="platform-strip">
      <div className="mx-auto max-w-5xl text-center">
        <h2 id="plataformas-title" className="mb-2 text-lg font-semibold">
          Feito para publicar onde seu público está
        </h2>
        <p className="mx-auto mb-7 max-w-xl text-[13px] text-mute">A Revisão confere formato, duração e áreas cobertas pela interface de cada destino (valores aproximados).</p>
        <ul className="flex flex-wrap items-center justify-center gap-2.5">
          {PLATFORMS.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-2 text-[13px] font-medium" data-testid="platform-chip">
              {p.label}
              <span className="rounded-md bg-panel-3 px-1.5 py-0.5 font-mono text-[10px] text-mute">{ratio(p.width, p.height)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
