import { Icon, type IconName } from '../components/Icon';
import { useReview } from '../lib/useReview';
import type { PanelTab } from '../store/editor';

export const TOOLS: Array<{ id: PanelTab; label: string; icon: IconName; title: string }> = [
  { id: 'media', label: 'Mídia', icon: 'film', title: 'Biblioteca de vídeos e imagens' },
  { id: 'audio', label: 'Áudio', icon: 'music', title: 'Músicas, gravação de voz e ritmo' },
  { id: 'text', label: 'Texto', icon: 'type', title: 'Títulos, legendas e modelos' },
  { id: 'effects', label: 'Efeitos', icon: 'wand', title: 'Efeitos, presets e LUTs' },
  { id: 'transitions', label: 'Transições', icon: 'shuffle', title: 'Transições entre clipes' },
  { id: 'animations', label: 'Animações', icon: 'zap', title: 'Animações prontas para o clipe' },
  { id: 'elements', label: 'Elementos', icon: 'shapes', title: 'Fundos e cores geradas' },
  { id: 'review', label: 'Revisão', icon: 'check', title: 'Qualidade, acessibilidade, plataformas, ritmo e listas' },
  { id: 'storyboard', label: 'Roteiro', icon: 'layout', title: 'Planos em ordem, montagem no ritmo e encaixe na duração' },
  { id: 'ai', label: 'IA', icon: 'sparkles', title: 'Ferramentas de inteligência artificial' },
];

/** Trilho vertical de ferramentas (ícone + rótulo), como nos editores de vídeo profissionais. */
export function ToolRail({ value, onChange }: { value: PanelTab; onChange: (t: PanelTab) => void }) {
  const { attention } = useReview();
  return (
    <nav className="flex w-[78px] shrink-0 flex-col items-stretch gap-0.5 overflow-y-auto border-r border-line bg-panel py-2" role="tablist" aria-label="Ferramentas" aria-orientation="vertical">
      {TOOLS.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="left-panel"
            title={t.title}
            data-testid={`tab-${t.id}`}
            onClick={() => onChange(t.id)}
            className={`group relative mx-1.5 flex flex-col items-center gap-1 rounded-lg px-0.5 py-2 text-[10px] font-medium transition-colors ${active ? 'bg-accent/12 text-accent' : 'text-mute hover:bg-panel-3 hover:text-ink'}`}
          >
            {active && <span className="absolute -left-1.5 top-2 h-[calc(100%-16px)] w-0.5 rounded-full bg-accent" />}
            <Icon name={t.icon} size={19} />
            {t.id === 'review' && attention > 0 && (
              <span className="absolute right-2 top-1 min-w-[15px] rounded-full bg-amber-500 px-1 text-center text-[9px] font-bold leading-[15px] text-black" data-testid="review-badge" aria-label={`${attention} ${attention === 1 ? 'ponto' : 'pontos'} de atenção na revisão`}>
                {attention > 99 ? '99+' : attention}
              </span>
            )}
            <span className="leading-none">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
