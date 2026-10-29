import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useTheme } from '../../store/theme';
import { NAV } from './content';
import { scrollToSection } from './scroll';

/** Barra fixa no topo: marca, âncoras das seções, tema e acesso (entrar / criar conta). Vira menu em telas estreitas. */
export function LandingHeader({ scroller }: { scroller: React.RefObject<HTMLElement | null> }) {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  const [open, setOpen] = useState(false);
  const [raised, setRaised] = useState(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => setRaised(el.scrollTop > 8);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scroller]);

  const go = (id: string) => {
    setOpen(false);
    scrollToSection(id);
  };

  return (
    <header className={`sticky top-0 z-40 border-b transition-colors ${raised || open ? 'border-line bg-bg/85 backdrop-blur-md' : 'border-transparent bg-transparent'}`} data-testid="landing-header">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Editor de Vídeo — início">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-sm">
            <Icon name="play" size={16} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Editor de Vídeo</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Seções da página">
          {NAV.map((n) => (
            <button key={n.id} type="button" className="rounded-lg px-3 py-2 text-[13px] font-medium text-mute transition-colors hover:bg-panel-3 hover:text-ink" onClick={() => go(n.id)}>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn-icon !h-9 !w-9" aria-label={theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'} onClick={toggle} data-testid="landing-theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <Link to="/login" className="btn hidden !h-9 px-4 text-[13px] sm:inline-flex" data-testid="header-login">
            Entrar
          </Link>
          <Link to="/login?modo=cadastro" className="btn btn-primary !h-9 px-4 text-[13px]" data-testid="header-signup">
            Criar conta
          </Link>
          <button type="button" className="btn-icon !h-9 !w-9 md:hidden" aria-label="Abrir menu" aria-expanded={open} aria-controls="landing-menu" onClick={() => setOpen(!open)} data-testid="landing-menu-button">
            <Icon name={open ? 'x' : 'list'} />
          </button>
        </div>
      </div>

      {open && (
        <nav id="landing-menu" className="border-t border-line bg-bg/95 px-5 pb-4 pt-2 md:hidden" aria-label="Menu" data-testid="landing-menu">
          {NAV.map((n) => (
            <button key={n.id} type="button" className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-panel-3" onClick={() => go(n.id)}>
              {n.label}
            </button>
          ))}
          <Link to="/login" className="mt-1 block rounded-lg px-3 py-3 text-sm font-medium hover:bg-panel-3 sm:hidden">
            Entrar
          </Link>
        </nav>
      )}
    </header>
  );
}
