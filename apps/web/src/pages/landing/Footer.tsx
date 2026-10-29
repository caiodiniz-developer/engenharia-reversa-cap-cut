import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { NAV } from './content';
import { scrollToSection } from './scroll';

/** Chamada final para cadastro + rodapé com navegação. */
export function FinalCta() {
  return (
    <section className="px-5 pb-24" aria-labelledby="cta-title" data-testid="final-cta">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-line bg-panel px-6 py-14 text-center shadow-pop">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <h2 id="cta-title" className="relative text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Pronto para editar o seu próximo vídeo?
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-balance text-base text-mute">Crie sua conta em menos de um minuto e comece com um modelo de projeto ou do zero.</p>
        <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/login?modo=cadastro" className="btn btn-primary !h-12 px-7 text-[15px]" data-testid="cta-signup">
            Criar conta <Icon name="chevronRight" size={16} />
          </Link>
          <Link to="/login" className="btn !h-12 px-7 text-[15px]" data-testid="cta-login">
            Entrar
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-line px-5 py-10" data-testid="landing-footer">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
            <Icon name="play" size={14} />
          </span>
          <div>
            <p className="text-sm font-semibold">Editor de Vídeo</p>
            <p className="text-xs text-mute">Projeto independente de edição de vídeo no navegador.</p>
          </div>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-mute">
          {NAV.map((n) => (
            <button key={n.id} type="button" className="hover:text-ink" onClick={() => scrollToSection(n.id)}>
              {n.label}
            </button>
          ))}
          <Link to="/login" className="hover:text-ink">
            Entrar
          </Link>
          <Link to="/login?modo=cadastro" className="hover:text-ink">
            Criar conta
          </Link>
        </nav>
      </div>
    </footer>
  );
}
