import { useEffect, useMemo, useState } from 'react';
import { findClip, type CaptionClip, type MediaClip, type TextClip } from '@editor/core';
import { ColorField, NumberField, Section, Select, Tabs, TextInput } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { ASPECTS, aspectLabel, formatDuration } from '../../lib/format';
import { useEditor } from '../../store/editor';
import { AnimationTab } from './AnimationTab';
import { AudioSection, EffectsSection, MaskSection, SpeedSection, StabilizeSection, TimingSection, TransitionSection } from './MediaSections';
import { CaptionWordsSection, TextAnimationSection, TextContentSection, TextStyleSection } from './TextSections';
import { TransformSection } from './TransformSection';

type MediaTab = 'video' | 'audio' | 'effects' | 'anim';
type TextTab = 'text' | 'style' | 'anim';

export function Properties() {
  const selection = useEditor((s) => s.selection);
  const project = useEditor((s) => s.project);
  const media = useEditor((s) => s.media);

  const clips = useMemo(() => selection.map((id) => findClip(project, id)).filter((x): x is NonNullable<typeof x> => !!x), [selection, project]);

  if (clips.length === 0) return <ProjectPanel />;

  const first = clips[0]!;
  const same = clips.filter((c) => c.clip.type === first.clip.type);
  const isMedia = first.clip.type === 'media';
  const m = isMedia ? media[(first.clip as MediaClip).mediaId] : undefined;
  const title = clips.length > 1 ? `${clips.length} clipes selecionados` : isMedia ? (m?.name ?? 'Mídia') : first.clip.type === 'text' ? 'Texto' : 'Legenda';
  const icon = isMedia ? (first.track.kind === 'audio' ? 'music' : 'film') : first.clip.type === 'text' ? 'type' : 'captions';

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="properties">
      <header className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
        {m?.urls.thumb && first.track.kind === 'video' ? (
          <img src={m.urls.thumb} alt="" className="h-9 w-14 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Icon name={icon} size={17} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xs font-semibold" title={title}>
            {title}
          </h2>
          <p className="text-2xs text-mute">
            {first.track.name} · {formatDuration(first.clip.duration)}
            {clips.length > 1 && same.length !== clips.length ? ` · editando ${same.length} do mesmo tipo` : ''}
          </p>
        </div>
      </header>

      {isMedia && <MediaProps key={first.clip.type} clips={same.map((c) => c.clip as MediaClip)} trackKind={first.track.kind} />}
      {first.clip.type === 'text' && <TextProps clips={same.map((c) => c.clip as TextClip)} />}
      {first.clip.type === 'caption' && <CaptionProps clips={same.map((c) => c.clip as CaptionClip)} />}
    </div>
  );
}

function Scroll({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-auto">{children}</div>;
}

function MediaProps({ clips, trackKind }: { clips: MediaClip[]; trackKind: string }) {
  const media = useEditor((s) => s.media);
  const clip = clips[0]!;
  const m = media[clip.mediaId];
  const visual = trackKind === 'video';
  const hasAudio = !!m?.hasAudio || m?.kind === 'audio';
  const [tab, setTab] = useState<MediaTab>(visual ? 'video' : 'audio');
  const effectCount = clip.effects.length;
  const kfCount = Object.values(clip.keyframes).reduce((n, k) => n + (k?.length ?? 0), 0);

  // Faixa de áudio não tem aba de vídeo/efeitos.
  useEffect(() => {
    if (!visual && (tab === 'video' || tab === 'effects')) setTab('audio');
  }, [visual, tab]);

  const tabs = [
    ...(visual ? [{ id: 'video' as const, label: 'Vídeo' }] : []),
    { id: 'audio' as const, label: 'Áudio' },
    ...(visual && m?.kind !== 'audio' ? [{ id: 'effects' as const, label: 'Efeitos', badge: effectCount }] : []),
    { id: 'anim' as const, label: 'Animação', badge: kfCount ? 1 : 0 },
  ];

  return (
    <>
      <Tabs label="Propriedades do clipe" tabs={tabs} value={tab} onChange={setTab} />
      <Scroll>
        {tab === 'video' && (
          <>
            <TimingSection clip={clip} />
            <TransformSection clips={clips} />
            <SpeedSection clip={clip} kind={m?.kind ?? 'video'} />
            <StabilizeSection clip={clip} kind={m?.kind ?? 'video'} />
            <MaskSection clip={clip} />
            <TransitionSection clip={clip} />
          </>
        )}
        {tab === 'audio' && (
          <>
            {!visual && <TimingSection clip={clip} />}
            {!visual && <SpeedSection clip={clip} kind={m?.kind ?? 'audio'} />}
            {hasAudio ? <AudioSection clip={clip} hasAudio /> : <p className="p-4 text-center text-2xs text-mute">Esta mídia não tem áudio.</p>}
          </>
        )}
        {tab === 'effects' && <EffectsSection clip={clip} />}
        {tab === 'anim' && <AnimationTab clip={clip} />}
      </Scroll>
    </>
  );
}

function TextProps({ clips }: { clips: TextClip[] }) {
  const clip = clips[0]!;
  const [tab, setTab] = useState<TextTab>('text');
  const kfCount = Object.values(clip.keyframes).reduce((n, k) => n + (k?.length ?? 0), 0);
  return (
    <>
      <Tabs
        label="Propriedades do texto"
        tabs={[
          { id: 'text', label: 'Texto' },
          { id: 'style', label: 'Estilo' },
          { id: 'anim', label: 'Animação', badge: kfCount ? 1 : 0 },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Scroll>
        {tab === 'text' && (
          <>
            <TextContentSection clip={clip} />
            <TimingSection clip={clip} />
            <TransformSection clips={clips} />
          </>
        )}
        {tab === 'style' && <TextStyleSection clip={clip} />}
        {tab === 'anim' && (
          <>
            <TextAnimationSection clip={clip} />
            <AnimationTab clip={clip} />
          </>
        )}
      </Scroll>
    </>
  );
}

function CaptionProps({ clips }: { clips: CaptionClip[] }) {
  const clip = clips[0]!;
  const [tab, setTab] = useState<TextTab>('text');
  const kfCount = Object.values(clip.keyframes).reduce((n, k) => n + (k?.length ?? 0), 0);
  return (
    <>
      <Tabs
        label="Propriedades da legenda"
        tabs={[
          { id: 'text', label: 'Legenda' },
          { id: 'style', label: 'Estilo' },
          { id: 'anim', label: 'Animação', badge: kfCount ? 1 : 0 },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Scroll>
        {tab === 'text' && (
          <>
            <TextContentSection clip={clip} />
            <CaptionWordsSection clip={clip} />
            <TimingSection clip={clip} />
          </>
        )}
        {tab === 'style' && (
          <>
            <TextStyleSection clip={clip} />
            <TransformSection clips={clips} />
          </>
        )}
        {tab === 'anim' && (
          <>
            <TextAnimationSection clip={clip} />
            <AnimationTab clip={clip} />
          </>
        )}
      </Scroll>
    </>
  );
}

/** Sem seleção: configurações do projeto. */
function ProjectPanel() {
  const project = useEditor((s) => s.project);
  const rename = useEditor((s) => s.rename);
  const setSettings = useEditor((s) => s.setSettings);
  const s = project.settings;
  const aspect = ASPECTS.find((a) => a.width === s.width && a.height === s.height)?.id ?? 'custom';
  const clipsTotal = project.tracks.reduce((n, t) => n + t.clips.length, 0);
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="project-settings">
      <header className="border-b border-line px-3 py-3">
        <h2 className="text-sm font-semibold">Projeto</h2>
        <p className="mt-0.5 text-2xs text-mute">Selecione um clipe na timeline para editar suas propriedades.</p>
      </header>
      <Scroll>
        <Section title="Geral" icon="pencil">
          <TextInput label="Nome" value={project.name} onChange={rename} />
        </Section>
        <Section title="Formato do vídeo" icon="layout">
          <Select
            label="Proporção"
            value={aspect}
            options={[...ASPECTS.map((a) => ({ value: a.id as string, label: a.label })), ...(aspect === 'custom' ? [{ value: 'custom', label: `Personalizado (${aspectLabel(s.width, s.height)})` }] : [])]}
            onChange={(v) => {
              const a = ASPECTS.find((x) => x.id === v);
              if (a) setSettings({ width: a.width, height: a.height });
            }}
          />
          <NumberField label="Largura" value={s.width} min={16} max={7680} step={2} unit="px" slider={false} onChange={(v) => setSettings({ width: Math.round(v / 2) * 2 })} />
          <NumberField label="Altura" value={s.height} min={16} max={7680} step={2} unit="px" slider={false} onChange={(v) => setSettings({ height: Math.round(v / 2) * 2 })} />
          <Select label="Quadros/s" value={String(s.fps)} options={[24, 25, 30, 50, 60].map((f) => ({ value: String(f), label: `${f} fps` }))} onChange={(v) => setSettings({ fps: Number(v) })} />
          <ColorField label="Cor de fundo" value={s.background} onChange={(v) => setSettings({ background: v })} />
        </Section>
        <Section title="Resumo" icon="info" defaultOpen={false}>
          <dl className="grid grid-cols-2 gap-y-1.5 text-xs text-mute">
            <dt>Faixas</dt>
            <dd className="text-right text-ink">{project.tracks.length}</dd>
            <dt>Clipes</dt>
            <dd className="text-right text-ink">{clipsTotal}</dd>
            <dt>Mídias</dt>
            <dd className="text-right text-ink">{Object.keys(project.media).length}</dd>
            <dt>Marcadores</dt>
            <dd className="text-right text-ink">{project.markers.length}</dd>
            <dt>LUTs importadas</dt>
            <dd className="text-right text-ink">{Object.keys(project.luts).length}</dd>
          </dl>
        </Section>
      </Scroll>
    </div>
  );
}
