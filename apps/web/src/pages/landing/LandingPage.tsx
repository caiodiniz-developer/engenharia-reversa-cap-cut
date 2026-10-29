import { lazy, Suspense, useEffect, useRef } from 'react';
import { BackToTop } from './BackToTop';
import { DIFFERENTIALS, FEATURES } from './content';
import { Faq } from './Faq';
import { FeatureGrid } from './FeatureGrid';
import { FinalCta, LandingFooter } from './Footer';
import { Hero } from './Hero';
import { LandingHeader } from './LandingHeader';
import { Marquee } from './Marquee';
import { PlatformStrip } from './PlatformStrip';
import { ReviewShowcase } from './ReviewShowcase';
import { MobileCta } from './MobileCta';
import { ScrollProgress } from './ScrollProgress';
import { LandingSection } from './Section';
import { StatsStrip } from './StatsStrip';
import { Steps } from './Steps';

// O laboratório reutiliza o núcleo do editor (revisão, comandos, simulação): carrega sob demanda para a primeira dobra aparecer logo.
const LabSection = lazy(() => import('./LabSection').then((m) => ({ default: m.LabSection })));

function LabFallback() {
  return (
    <div className="mx-auto h-[520px] max-w-5xl animate-pulse rounded-3xl border border-line bg-panel/50" role="status" aria-label="Carregando as demonstrações" data-testid="lab-loading" />
  );
}

/** Página inicial para quem ainda não entrou: apresenta o editor e leva ao cadastro/login. */
export function LandingPage() {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Editor de Vídeo — edite, revise e exporte no navegador';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div ref={scroller} className="h-full overflow-y-auto overflow-x-hidden bg-bg text-[15px]" data-testid="landing">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">
        Pular para o conteúdo
      </a>
      <ScrollProgress container={scroller} />
      <LandingHeader scroller={scroller} />
      <main id="conteudo">
        <Hero />
        <StatsStrip />
        <PlatformStrip />
        <Marquee />
        <LandingSection id="recursos" eyebrow="Recursos" title="Tudo o que um vídeo precisa, em um só lugar" subtitle="Da primeira importação ao arquivo final, sem alternar entre programas.">
          <FeatureGrid items={FEATURES} testId="features" />
        </LandingSection>
        <LandingSection id="diferenciais" eyebrow="Diferenciais" title="Ferramentas que ajudam a decidir, não só a cortar" subtitle="Revise o projeto, confira as plataformas e entenda o ritmo da sua edição antes de publicar." tone="tinted">
          <FeatureGrid items={DIFFERENTIALS} testId="differentials" columns={4} />
          <ReviewShowcase />
        </LandingSection>
        <LandingSection id="experimente" eyebrow="Experimente agora" title="Teste as ferramentas sem criar conta" subtitle="Estas demonstrações rodam o mesmo código do editor, direto aqui na página.">
          <Suspense fallback={<LabFallback />}>
            <LabSection />
          </Suspense>
        </LandingSection>
        <LandingSection id="como-funciona" eyebrow="Como funciona" title="Do cadastro ao arquivo exportado em três passos">
          <Steps container={scroller} />
        </LandingSection>
        <LandingSection id="perguntas" eyebrow="Perguntas" title="Perguntas frequentes" tone="tinted">
          <Faq />
        </LandingSection>
        <FinalCta />
      </main>
      <LandingFooter />
      <BackToTop container={scroller} />
      <MobileCta container={scroller} />
    </div>
  );
}
