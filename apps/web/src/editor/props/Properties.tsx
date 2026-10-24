import { useMemo } from 'react';
import { findClip, type CaptionClip, type MediaClip, type TextClip } from '@editor/core';
import { ColorField, NumberField, Section, Select, TextInput } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { ASPECTS, aspectLabel } from '../../lib/format';
import { useEditor } from '../../store/editor';
import { AudioSection, EffectsSection, MaskSection, SpeedSection, TimingSection, TransitionSection } from './MediaSections';
import { CaptionWordsSection, TextAnimationSection, TextContentSection, TextStyleSection } from './TextSections';
import { TransformSection } from './TransformSection';

export function Properties() {
  const selection = useEditor((s) => s.selection);
  const project = useEditor((s) => s.project);
  const media = useEditor((s) => s.media);

  const clips = useMemo(() => selection.map((id) => findClip(project, id)).filter((x): x is NonNullable<typeof x> => !!x), [selection, project]);

  if (clips.length === 0) return <ProjectSection />;

  const first = clips[0]!;
  const same = clips.filter((c) => c.clip.type === first.clip.type);
  const label = clips.length > 1 ? `${clips.length} clipes selecionados` : first.clip.type === 'media' ? (media[first.clip.mediaId]?.name ?? 'Mídia') : first.clip.type === 'text' ? 'Texto' : 'Legenda';

  return (
    <div className="h-full overflow-auto" data-testid="properties">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <Icon name={first.clip.type === 'media' ? 'film' : first.clip.type === 'text' ? 'type' : 'captions'} size={14} className="text-accent" />
        <h2 className="min-w-0 flex-1 truncate text-xs font-semibold" title={label}>
          {label}
        </h2>
        {clips.length > 1 && same.length !== clips.length && <span className="text-2xs text-mute">editando {same.length} do mesmo tipo</span>}
      </div>

      {first.clip.type === 'media' && <MediaProps clips={same.map((c) => c.clip as MediaClip)} trackKind={first.track.kind} />}
      {first.clip.type === 'text' && <TextProps clips={same.map((c) => c.clip as TextClip)} />}
      {first.clip.type === 'caption' && <CaptionProps clips={same.map((c) => c.clip as CaptionClip)} />}
    </div>
  );
}

function MediaProps({ clips, trackKind }: { clips: MediaClip[]; trackKind: string }) {
  const media = useEditor((s) => s.media);
  const clip = clips[0]!;
  const m = media[clip.mediaId];
  const visual = trackKind === 'video';
  return (
    <>
      <TimingSection clip={clip} />
      {visual && <TransformSection clips={clips} />}
      <SpeedSection clip={clip} kind={m?.kind ?? 'video'} />
      <AudioSection clip={clip} hasAudio={!!m?.hasAudio || m?.kind === 'audio'} />
      {visual && m?.kind !== 'audio' && <EffectsSection clip={clip} />}
      {visual && <MaskSection clip={clip} />}
      {visual && <TransitionSection clip={clip} />}
    </>
  );
}

function TextProps({ clips }: { clips: TextClip[] }) {
  const clip = clips[0]!;
  return (
    <>
      <TextContentSection clip={clip} />
      <TimingSection clip={clip} />
      <TextStyleSection clip={clip} />
      <TransformSection clips={clips} />
      <TextAnimationSection clip={clip} />
    </>
  );
}

function CaptionProps({ clips }: { clips: CaptionClip[] }) {
  const clip = clips[0]!;
  return (
    <>
      <TextContentSection clip={clip} />
      <CaptionWordsSection clip={clip} />
      <TimingSection clip={clip} />
      <TextStyleSection clip={clip} />
      <TransformSection clips={clips} />
      <TextAnimationSection clip={clip} />
    </>
  );
}

/** Sem seleção: configurações do projeto. */
function ProjectSection() {
  const project = useEditor((s) => s.project);
  const rename = useEditor((s) => s.rename);
  const setSettings = useEditor((s) => s.setSettings);
  const s = project.settings;
  const aspect = ASPECTS.find((a) => a.width === s.width && a.height === s.height)?.id ?? 'custom';
  return (
    <div className="h-full overflow-auto" data-testid="project-settings">
      <div className="border-b border-line px-3 py-2.5">
        <h2 className="text-xs font-semibold">Projeto</h2>
        <p className="mt-0.5 text-2xs text-mute">Selecione um clipe na timeline para editar suas propriedades.</p>
      </div>
      <Section title="Geral">
        <TextInput label="Nome" value={project.name} onChange={rename} />
      </Section>
      <Section title="Formato">
        <Select
          label="Proporção"
          value={aspect}
          options={[...ASPECTS.map((a) => ({ value: a.id as string, label: a.label })), ...(aspect === 'custom' ? [{ value: 'custom', label: `Personalizado (${aspectLabel(s.width, s.height)})` }] : [])]}
          onChange={(v) => {
            const a = ASPECTS.find((x) => x.id === v);
            if (a) setSettings({ width: a.width, height: a.height });
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Largura" value={s.width} min={16} max={7680} step={2} unit="px" slider={false} onChange={(v) => setSettings({ width: Math.round(v / 2) * 2 })} />
          <NumberField label="Altura" value={s.height} min={16} max={7680} step={2} unit="px" slider={false} onChange={(v) => setSettings({ height: Math.round(v / 2) * 2 })} />
        </div>
        <Select
          label="Quadros por segundo"
          value={String(s.fps)}
          options={[24, 25, 30, 50, 60].map((f) => ({ value: String(f), label: `${f} fps` }))}
          onChange={(v) => setSettings({ fps: Number(v) })}
        />
        <ColorField label="Cor de fundo" value={s.background} onChange={(v) => setSettings({ background: v })} />
      </Section>
      <Section title="Resumo" defaultOpen={false}>
        <dl className="grid grid-cols-2 gap-y-1 text-2xs text-mute">
          <dt>Faixas</dt>
          <dd className="text-right text-ink">{project.tracks.length}</dd>
          <dt>Clipes</dt>
          <dd className="text-right text-ink">{project.tracks.reduce((n, t) => n + t.clips.length, 0)}</dd>
          <dt>Mídias</dt>
          <dd className="text-right text-ink">{Object.keys(project.media).length}</dd>
          <dt>Marcadores</dt>
          <dd className="text-right text-ink">{project.markers.length}</dd>
        </dl>
      </Section>
    </div>
  );
}

