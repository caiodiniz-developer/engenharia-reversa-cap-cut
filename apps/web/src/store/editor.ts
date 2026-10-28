import { create } from 'zustand';
import {
  addClip,
  applyAnimation as coreApplyAnimation,
  clearAnimations as coreClearAnimations,
  closeGaps as coreCloseGaps,
  getAnimationPreset,
  addLut,
  addMarker,
  addMedia,
  addTrack,
  canRedo,
  canUndo,
  clipEnd,
  commit,
  createEffect,
  createHistory,
  deleteClips,
  duplicateClips,
  expandSelection,
  extractAudio,
  findClip,
  freezeFrame,
  groupClips,
  jumpTo,
  moveClips,
  moveTrack,
  newId,
  presetToEffects,
  projectDuration,
  redo,
  removeLut,
  removeMarker,
  updateMarker,
  removeTrack,
  removeTransition,
  round6,
  sealCoalescing,
  setReverse,
  setSettings,
  setSpeed,
  setTrackProps,
  setTransition,
  splitClips,
  TextClipSchema,
  CaptionClipSchema,
  MediaClipSchema,
  TimelineError,
  trimClip,
  undo,
  ungroupClips,
  unlinkClips,
  updateClip,
  upsertKeyframe,
  removeKeyframeAt,
  clampParams,
  neighborEdit,
  sequenceClips,
  setClipsDuration,
  mergeCaptions,
  shiftCaptions,
  fastCaptionIds,
  repeatClip,
  changeTextCase,
  replaceInText,
  duplicateTrack,
  positionFor,
  coverScale,
  markersToChapters,
  type TextCase,
  type PositionPreset,
  splitAtMarkers,
  copyAttributes,
  pasteAttributes,
  resetClipVisuals,
  type ClipAttributes,
  setWorkAreaEdge,
  clampWorkArea,
  type WorkArea,
  clipIdsAt,
  clipIdsBySide,
  clipIdsByKind,
  type ClipKindFilter,
  cuesToCaptionClips,
  type AnimatableProp,
  type CaptionClip,
  type Clip,
  type Cue,
  type History,
  type MediaAsset,
  type MediaClip,
  type Project,
  type ProjectSettings,
  type TextStyle,
  type TrackKind,
  type TransitionType,
} from '@editor/core';
import type { MediaItem, ProjectDoc } from '../api/types';
import { TRACK_DENSITIES, type TrackDensity } from '../editor/timeline/geometry';
import { toast } from './toasts';

export type PanelTab = 'media' | 'audio' | 'text' | 'effects' | 'transitions' | 'animations' | 'elements' | 'review' | 'storyboard' | 'ai';
/** Simulação de visão para checar o design (só no preview; a exportação não muda). */
export type VisionMode = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict' | 'offline';

export const MIN_ZOOM = 4;
export const MAX_ZOOM = 600;
const DENSITY_KEY = 'editor.timeline.density';
function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function readDensity(): TrackDensity {
  try {
    const v = localStorage.getItem(DENSITY_KEY);
    if (v === 'compact' || v === 'normal' || v === 'tall') return v;
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return 'normal';
}
/** Velocidades disponíveis para o preview. */
export const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function assetFromMedia(m: MediaItem): MediaAsset {
  return { id: m.id, name: m.name, kind: m.kind, duration: m.duration, width: m.width, height: m.height, fps: m.fps, hasAudio: m.hasAudio, size: m.size, mime: m.mime };
}

interface EditorState {
  projectId: string | null;
  serverRevision: number;
  history: History<Project>;
  project: Project;
  media: Record<string, MediaItem>;

  selection: string[];
  selectedTrackId: string | null;
  playhead: number;
  playing: boolean;
  volume: number;
  muted: boolean;
  loop: boolean;
  /** Velocidade de reprodução do preview (não altera o projeto nem a exportação). */
  rate: number;
  /** Trecho marcado com I/O: usado para exportar só uma parte (não é salvo no projeto). */
  workArea: WorkArea | null;
  /** Altura das faixas da timeline (preferência do navegador). */
  trackDensity: TrackDensity;
  /** Modo foco: esconde trilho, painel lateral e propriedades para sobrar só preview e timeline. */
  focusMode: boolean;
  /** Plataforma de destino escolhida na Revisão (null = nenhuma). Preferência do navegador. */
  platformId: string | null;
  /** Mostra no preview as zonas cobertas pela interface da plataforma escolhida. */
  showSafeZones: boolean;
  vision: VisionMode;
  /** Propriedades recolhidas em telas largas (preferência do navegador). */
  propsCollapsed: boolean;
  zoom: number;
  snapping: boolean;
  guides: boolean;
  panel: PanelTab;
  saveState: SaveState;
  lastSavedAt: number | null;
  clipboard: Clip[];
  /** Atributos visuais copiados com Ctrl+Alt+C. */
  attributes: ClipAttributes | null;

  load(doc: ProjectDoc, media: MediaItem[]): void;
  reset(): void;
  commitProject(label: string, project: Project, coalesceKey?: string): void;
  run(label: string, fn: (p: Project) => Project, opts?: { coalesceKey?: string; quiet?: boolean }): boolean;
  undo(): void;
  redo(): void;
  jumpHistory(index: number): void;
  sealDrag(): void;
  markSaved(revision: number): void;
  setSaveState(s: SaveState): void;
  setServerRevision(r: number): void;
  replaceProject(project: Project, revision: number): void;

  select(ids: string[], opts?: { additive?: boolean; single?: boolean }): void;
  selectTrack(id: string | null): void;
  setPlayhead(t: number): void;
  setPlaying(v: boolean): void;
  togglePlay(): void;
  stepFrames(n: number): void;
  /** Seleciona todos os clipes de um tipo (vídeo, imagem, áudio, texto, legenda). */
  selectByKind(kind: ClipKindFilter): void;
  /** Seleciona todos os clipes à direita (ou à esquerda) da cabeça de reprodução. */
  selectSide(side: 'after' | 'before'): void;
  /** Apara o início (ou o fim) dos clipes selecionados — ou dos que estão sob a cabeça — até a cabeça de reprodução. */
  trimToPlayhead(edge: 'start' | 'end'): void;
  /** Move a seleção em quadros (negativo = para trás). */
  nudgeSelection(frames: number): void;
  /** Ajusta o zoom para o projeto inteiro caber na largura da timeline. */
  fitTimeline(): void;
  /** Pula para o corte (borda de clipe ou marcador) seguinte/anterior. */
  jumpToEdit(dir: 1 | -1): void;
  setVolume(v: number): void;
  toggleMute(): void;
  toggleLoop(): void;
  setRate(r: number): void;
  /** Marca a entrada (start) ou a saída (end) do trecho na cabeça de reprodução. */
  markWorkArea(edge: 'start' | 'end'): void;
  clearWorkArea(): void;
  setTrackDensity(d: TrackDensity): void;
  cycleTrackDensity(): void;
  toggleFocusMode(): void;
  setPlatform(id: string | null): void;
  toggleSafeZones(): void;
  setVision(v: VisionMode): void;
  togglePropsCollapsed(): void;
  stepRate(dir: 1 | -1): void;
  setZoom(z: number): void;
  toggleSnapping(): void;
  toggleGuides(): void;
  setPanel(p: PanelTab): void;

  registerMedia(items: MediaItem[]): void;
  importMedia(item: MediaItem): void;
  removeMediaItem(id: string): void;
  /** Atualiza o nome de exibição de uma mídia (biblioteca e projeto). O servidor já foi avisado. */
  setMediaName(id: string, name: string): void;
  /** `overlay` coloca o clipe numa faixa nova acima das demais (formas, adesivos, legendas gráficas). */
  addToTimeline(mediaId: string, opts?: { at?: number; trackId?: string; overlay?: boolean }): void;

  splitAtPlayhead(): void;
  deleteSelection(ripple: boolean): void;
  duplicateSelection(): void;
  copySelection(): void;
  pasteClipboard(): void;
  moveSelection(ids: string[], delta: number, primaryId?: string, toTrackId?: string): boolean;
  trim(id: string, edge: 'start' | 'end', time: number): boolean;
  patchClip(id: string, fn: (c: Clip) => Clip, label: string, coalesceKey?: string): void;
  setSpeed(id: string, speed: number): void;
  toggleReverse(id: string): void;
  freeze(id: string): void;
  extractAudioOf(id: string): void;
  unlink(ids: string[]): void;
  group(ids: string[]): void;
  ungroup(ids: string[]): void;

  setTransition(clipId: string, type: TransitionType, duration: number): void;
  removeTransition(clipId: string): void;
  addEffect(clipId: string, type: string): void;
  addLutEffect(clipId: string, ref: string): void;
  importLut(name: string, cubeText: string): string | undefined;
  removeLut(id: string): void;
  setStabilize(clipId: string, smoothing: number): void;
  applyPreset(clipId: string, presetId: string): void;
  updateEffect(clipId: string, effectId: string, params: Record<string, number>): void;
  toggleEffect(clipId: string, effectId: string): void;
  removeEffect(clipId: string, effectId: string): void;

  applyAnimation(clipId: string, presetId: string, duration?: number): void;
  clearAnimations(clipId: string): void;
  closeGaps(trackId: string): void;
  /** Encosta os clipes selecionados em sequência, sem espaços entre eles. */
  sequenceSelection(): void;
  /** Dá a mesma duração (s) a todos os clipes selecionados. */
  setSelectionDuration(seconds: number): void;
  /** Desloca as legendas selecionadas (ou todas, sem seleção de legendas) por `delta` segundos. */
  shiftCaptionTimes(delta: number): void;
  /** Seleciona as legendas rápidas demais para ler (acima de 20 caracteres por segundo). */
  selectFastCaptions(): void;
  /** Junta as legendas selecionadas (mesma faixa) em uma só. */
  mergeSelectedCaptions(): void;
  /** Copia os marcadores como capítulos (m:ss Nome) para a área de transferência. */
  copyChapters(): Promise<void>;
  /** Define a velocidade de todos os clipes de mídia selecionados. */
  setSelectionSpeed(speed: number): void;
  /** Soma `delta` (ex.: 0,1) ao volume dos clipes selecionados (0 a 400%). */
  nudgeVolume(delta: number): void;
  /** Aplica fade de entrada e/ou saída (segundos; 0 remove) aos clipes de áudio/vídeo selecionados. */
  setFades(fadeIn: number | null, fadeOut: number | null): void;
  /** Alterna o mudo dos clipes selecionados. */
  toggleMuteSelection(): void;
  /** Ajusta o zoom e a rolagem para a seleção ocupar a largura da timeline. */
  zoomToSelection(): void;
  /** Liga/desliga um estado em todas as faixas de uma vez (se alguma está desligada, liga todas; senão desliga todas). */
  toggleAllTracks(prop: 'locked' | 'hidden' | 'muted'): void;
  /** Estica o fim dos clipes selecionados até a cabeça de reprodução (imagens, textos, legendas e vídeos com mídia sobrando). */
  extendToPlayhead(): void;
  /** Encosta os clipes visuais selecionados na borda/canto escolhido do quadro. */
  placeSelection(preset: PositionPreset): void;
  /** Escala os clipes de mídia selecionados para cobrir o quadro inteiro. */
  fillFrameSelection(): void;
  /** Gira os clipes visuais selecionados em graus (soma à rotação atual). */
  rotateSelection(deg: number): void;
  duplicateTrackById(id: string): void;
  /** Muda a caixa (maiúsculas, minúsculas, título, frase) dos textos e legendas selecionados. */
  changeCaseSelection(mode: TextCase): void;
  /** Localiza e substitui em todos os textos/legendas (ou só na seleção). Devolve quantas trocas fez. */
  replaceAllText(find: string, replacement: string, opts?: { matchCase?: boolean; onlySelection?: boolean }): number;
  /** Repete o clipe selecionado N vezes logo depois dele. */
  repeatSelection(times: number): void;
  copySelectionAttributes(): void;
  pasteSelectionAttributes(): void;
  resetSelectionVisuals(): void;
  /** Divide os clipes selecionados (ou os sob a cabeça) em cada marcador interno. */
  splitSelectionAtMarkers(): void;
  markBeats(times: number[]): void;
  setKeyframe(clipId: string, prop: AnimatableProp, value: number): void;
  removeKeyframe(clipId: string, prop: AnimatableProp): void;

  addText(text?: string, style?: Partial<TextStyle>): void;
  addCaptions(cues: Cue[]): void;
  addCaptionClips(clips: CaptionClip[], label?: string): void;

  addTrack(kind: TrackKind): void;
  removeTrack(id: string): void;
  patchTrack(id: string, patch: { name?: string; locked?: boolean; hidden?: boolean; muted?: boolean }): void;
  moveTrack(id: string, index: number): void;
  addMarkerAtPlayhead(): void;
  removeMarker(id: string): void;
  renameMarker(id: string, label: string): void;
  recolorMarker(id: string, color: string): void;
  setSettings(patch: Partial<ProjectSettings>): void;
  rename(name: string): void;
}

const emptyProject = (): Project => ({
  version: 1,
  id: '',
  name: '',
  settings: { width: 1920, height: 1080, fps: 30, sampleRate: 48000, background: '#000000' },
  media: {},
  tracks: [],
  markers: [],
  luts: {},
});

export const useEditor = create<EditorState>((set, get) => {
  const fps = () => get().project.settings.fps;
  const duration = () => projectDuration(get().project);

  return {
    projectId: null,
    serverRevision: 0,
    history: createHistory(emptyProject()),
    project: emptyProject(),
    media: {},
    selection: [],
    selectedTrackId: null,
    playhead: 0,
    playing: false,
    volume: 1,
    muted: false,
    loop: false,
    rate: 1,
    workArea: null,
    trackDensity: readDensity(),
    focusMode: false,
    platformId: readString('editor.review.platform'),
    showSafeZones: false,
    vision: 'normal',
    propsCollapsed: readFlag('editor.layout.propsCollapsed'),
    zoom: 60,
    snapping: true,
    guides: false,
    panel: 'media',
    saveState: 'saved',
    lastSavedAt: null,
    clipboard: [],
    attributes: null,

    load(doc, media) {
      set({
        projectId: doc.id,
        serverRevision: doc.revision,
        history: createHistory(doc.data),
        project: doc.data,
        media: Object.fromEntries(media.map((m) => [m.id, m])),
        selection: [],
        selectedTrackId: null,
        workArea: null,
        playhead: 0,
        playing: false,
        saveState: 'saved',
        lastSavedAt: Date.now(),
      });
    },

    reset() {
      const p = emptyProject();
      set({ projectId: null, history: createHistory(p), project: p, media: {}, selection: [], playhead: 0, playing: false, saveState: 'saved' });
    },

    commitProject(label, project, coalesceKey) {
      const history = commit(get().history, project, label, coalesceKey);
      if (history === get().history) return;
      // Remove da seleção clipes que deixaram de existir.
      const selection = get().selection.filter((id) => findClip(project, id));
      set({ history, project, selection, workArea: clampWorkArea(get().workArea, projectDuration(project)), saveState: get().saveState === 'conflict' ? 'conflict' : 'dirty' });
    },

    run(label, fn, opts) {
      try {
        get().commitProject(label, fn(get().project), opts?.coalesceKey);
        return true;
      } catch (e) {
        if (opts?.quiet && (e instanceof TimelineError || (e instanceof Error && e.name === 'ZodError'))) return false;
        if (e instanceof TimelineError) toast.error(e.message);
        else if (e instanceof Error && e.name === 'ZodError') toast.error('Valor inválido para esta propriedade');
        else throw e;
        return false;
      }
    },

    undo() {
      const h = undo(get().history);
      if (h === get().history) return;
      const project = h.entries[h.index]!.state;
      set({ history: h, project, selection: get().selection.filter((id) => findClip(project, id)), saveState: 'dirty' });
    },
    redo() {
      const h = redo(get().history);
      if (h === get().history) return;
      const project = h.entries[h.index]!.state;
      set({ history: h, project, selection: get().selection.filter((id) => findClip(project, id)), saveState: 'dirty' });
    },
    jumpHistory(index) {
      const h = jumpTo(get().history, index);
      if (h === get().history) return;
      const project = h.entries[h.index]!.state;
      set({ history: h, project, selection: get().selection.filter((id) => findClip(project, id)), saveState: 'dirty' });
    },
    sealDrag() {
      set({ history: sealCoalescing(get().history) });
    },
    markSaved(revision) {
      // Só marca como salvo se nada mudou desde o envio; senão continua "dirty".
      set({ serverRevision: revision, saveState: 'saved', lastSavedAt: Date.now() });
    },
    setSaveState(s) {
      set({ saveState: s });
    },
    setServerRevision(r) {
      set({ serverRevision: r });
    },
    replaceProject(project, revision) {
      set({ history: createHistory(project), project, serverRevision: revision, saveState: 'saved', selection: [] });
    },

    select(ids, opts) {
      const { project, selection } = get();
      const expanded = opts?.single ? ids : expandSelection(project, ids);
      if (opts?.additive) {
        const cur = new Set(selection);
        const allIn = expanded.every((id) => cur.has(id));
        for (const id of expanded) allIn ? cur.delete(id) : cur.add(id);
        set({ selection: [...cur] });
      } else set({ selection: expanded });
    },
    selectTrack(id) {
      set({ selectedTrackId: id });
    },
    setPlayhead(t) {
      set({ playhead: round6(Math.max(0, Math.min(t, Math.max(duration(), 0)))) });
    },
    setPlaying(v) {
      set({ playing: v });
    },
    togglePlay() {
      if (!get().playing && get().playhead >= duration() - 1e-3) set({ playhead: 0 });
      set({ playing: !get().playing });
    },
    stepFrames(n) {
      set({ playing: false });
      get().setPlayhead(get().playhead + n / fps());
    },
    selectByKind(kind) {
      const ids = clipIdsByKind(get().project, kind);
      const names = { video: 'vídeo', image: 'imagem', audio: 'áudio', text: 'texto', caption: 'legenda' };
      if (!ids.length) return toast.info('Não há clipes de ' + names[kind] + ' (em faixas desbloqueadas)');
      set({ selection: ids });
    },
    selectSide(side) {
      const ids = clipIdsBySide(get().project, get().playhead, side);
      if (!ids.length) return toast.info(side === 'after' ? 'Não há clipes à direita da cabeça de reprodução' : 'Não há clipes à esquerda da cabeça de reprodução');
      set({ selection: ids });
    },
    trimToPlayhead(edge) {
      const { project, selection, playhead } = get();
      const under = new Set(clipIdsAt(project, playhead));
      const picked = selection.filter((id) => under.has(id));
      const ids = picked.length ? picked : selection.length ? [] : [...under];
      if (!ids.length) return toast.info('Posicione a cabeça de reprodução sobre o clipe que deseja aparar');
      for (const id of ids) get().trim(id, edge, playhead);
      get().sealDrag();
    },
    nudgeSelection(frames) {
      const ids = get().selection;
      if (!ids.length) return;
      get().moveSelection(ids, frames / fps(), ids[0]);
      get().sealDrag();
    },
    fitTimeline() {
      const total = duration();
      if (total <= 0) return;
      const el = document.querySelector<HTMLElement>('[data-testid="timeline"]');
      get().setZoom(((el?.clientWidth ?? 900) - 220) / total);
    },
    jumpToEdit(dir) {
      const t = neighborEdit(get().project, get().playhead, dir, { markers: true });
      if (t === undefined) return;
      set({ playing: false });
      get().setPlayhead(t);
    },
    setVolume(v) {
      set({ volume: Math.max(0, Math.min(1, v)), muted: false });
    },
    toggleMute() {
      set({ muted: !get().muted });
    },
    markWorkArea(edge) {
      const area = setWorkAreaEdge(get().workArea, edge, get().playhead, duration());
      if (!area) return toast.info('Posicione a cabeça de reprodução dentro do projeto para marcar o trecho');
      set({ workArea: area });
    },
    setTrackDensity(d) {
      set({ trackDensity: d });
      try {
        localStorage.setItem(DENSITY_KEY, d);
      } catch {
        /* preferência é opcional */
      }
    },
    setPlatform(id) {
      set({ platformId: id, showSafeZones: id ? get().showSafeZones : false });
      try {
        if (id) localStorage.setItem('editor.review.platform', id);
        else localStorage.removeItem('editor.review.platform');
      } catch {
        /* preferência opcional */
      }
    },
    toggleSafeZones() {
      if (!get().platformId) return toast.info('Escolha uma plataforma na aba Revisão para ver as zonas seguras');
      set({ showSafeZones: !get().showSafeZones });
    },
    setVision(v) {
      set({ vision: v });
    },
    toggleFocusMode() {
      set({ focusMode: !get().focusMode });
    },
    togglePropsCollapsed() {
      const v = !get().propsCollapsed;
      set({ propsCollapsed: v });
      try {
        localStorage.setItem('editor.layout.propsCollapsed', v ? '1' : '0');
      } catch {
        /* preferência opcional */
      }
    },
    cycleTrackDensity() {
      const i = TRACK_DENSITIES.indexOf(get().trackDensity);
      get().setTrackDensity(TRACK_DENSITIES[(i + 1) % TRACK_DENSITIES.length]!);
    },
    clearWorkArea() {
      set({ workArea: null });
    },
    setRate(r) {
      set({ rate: Math.max(PLAYBACK_RATES[0]!, Math.min(PLAYBACK_RATES[PLAYBACK_RATES.length - 1]!, r)) });
    },
    stepRate(dir) {
      const cur = get().rate;
      const next = dir === 1 ? PLAYBACK_RATES.find((x) => x > cur + 1e-9) : [...PLAYBACK_RATES].reverse().find((x) => x < cur - 1e-9);
      if (next !== undefined) set({ rate: next });
    },
    toggleLoop() {
      set({ loop: !get().loop });
    },
    setZoom(z) {
      set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)) });
    },
    toggleSnapping() {
      set({ snapping: !get().snapping });
    },
    toggleGuides() {
      set({ guides: !get().guides });
    },
    setPanel(p) {
      set({ panel: p });
    },

    registerMedia(items) {
      set({ media: { ...get().media, ...Object.fromEntries(items.map((m) => [m.id, m])) } });
    },

    importMedia(item) {
      set({ media: { ...get().media, [item.id]: item } });
      // O ativo precisa estar no documento para que o servidor aceite a referência ao salvar.
      if (!get().project.media[item.id]) get().commitProject(`Importar ${item.name}`, addMedia(get().project, assetFromMedia(item)));
    },

    setMediaName(id, name) {
      const item = get().media[id];
      if (!item) return;
      set({ media: { ...get().media, [id]: { ...item, name } } });
      const asset = get().project.media[id];
      if (asset && asset.name !== name) get().run('Renomear mídia', (p) => ({ ...p, media: { ...p.media, [id]: { ...p.media[id]!, name } } }));
    },
    removeMediaItem(id) {
      const media = { ...get().media };
      delete media[id];
      set({ media });
      get().run('Remover mídia', (p) => {
        const m = { ...p.media };
        delete m[id];
        return {
          ...p,
          media: m,
          tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => !(c.type === 'media' && c.mediaId === id)) })),
        };
      });
    },

    addToTimeline(mediaId, opts) {
      const item = get().media[mediaId];
      if (!item) return;
      get().run(`Adicionar ${item.name}`, (p0) => {
        let p = p0.media[mediaId] ? p0 : addMedia(p0, assetFromMedia(item));
        const asset = p.media[mediaId]!;
        const kind: TrackKind = asset.kind === 'audio' ? 'audio' : 'video';
        const dur = asset.kind === 'image' ? 5 : asset.duration;
        let trackId = opts?.trackId;
        if (opts?.overlay && !trackId) {
          const r = addTrack(p, kind, { index: 0 });
          p = r.project;
          trackId = r.track.id;
        }
        if (!trackId) {
          const candidates = p.tracks.filter((t) => t.kind === kind && !t.locked);
          trackId = opts?.at === undefined ? candidates[candidates.length - 1]?.id : candidates.find((t) => !t.clips.some((c) => c.start < opts.at! + dur && clipEnd(c) > opts.at!))?.id;
        }
        if (!trackId) {
          const r = addTrack(p, kind);
          p = r.project;
          trackId = r.track.id;
        }
        const track = p.tracks.find((t) => t.id === trackId)!;
        const start = opts?.at ?? track.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0);
        const clip = MediaClipSchema.parse({ id: newId('clp'), type: 'media', mediaId, start: round6(start), duration: round6(dur) });
        set({ selection: [clip.id] });
        return addClip(p, trackId, clip);
      });
    },

    splitAtPlayhead() {
      const { project, selection, playhead } = get();
      const inside = (c: Clip) => playhead > c.start + 1e-6 && playhead < clipEnd(c) - 1e-6;
      let targets = selection.map((id) => findClip(project, id)?.clip).filter((c): c is Clip => !!c && inside(c));
      if (targets.length === 0) {
        targets = project.tracks.filter((t) => !t.locked && !t.hidden).flatMap((t) => t.clips.filter(inside));
      }
      if (targets.length === 0) return toast.info('Posicione a cabeça de reprodução sobre um clipe para dividir');
      const ids = expandSelection(project, targets.map((c) => c.id), { groups: false }).filter((id) => {
        const c = findClip(project, id)?.clip;
        return c && inside(c);
      });
      get().run('Dividir clipe', (p) => {
        const r = splitClips(p, ids, playhead);
        return r.project;
      });
    },

    deleteSelection(ripple) {
      const ids = get().selection;
      if (!ids.length) return;
      get().run(ripple ? 'Excluir e fechar espaço' : 'Excluir', (p) => deleteClips(p, ids, { ripple }));
      set({ selection: [] });
    },

    duplicateSelection() {
      const ids = get().selection;
      if (!ids.length) return;
      get().run('Duplicar', (p) => {
        const r = duplicateClips(p, ids);
        set({ selection: Object.values(r.newIds) });
        return r.project;
      });
    },

    copySelection() {
      const { project, selection } = get();
      const clips = selection.map((id) => findClip(project, id)?.clip).filter((c): c is Clip => !!c);
      if (!clips.length) return;
      set({ clipboard: JSON.parse(JSON.stringify(clips)) as Clip[] });
      toast.info(`${clips.length} clipe(s) copiado(s)`);
    },

    pasteClipboard() {
      const { clipboard, playhead } = get();
      if (!clipboard.length) return;
      const origin = Math.min(...clipboard.map((c) => c.start));
      get().run('Colar', (p0) => {
        let p = p0;
        const newIds: string[] = [];
        const linkMap = new Map<string, string>();
        for (const src of clipboard) {
          const copy = JSON.parse(JSON.stringify(src)) as Clip;
          copy.id = newId('clp');
          if (copy.linkId) copy.linkId = linkMap.get(copy.linkId) ?? (linkMap.set(copy.linkId, newId('lnk')), linkMap.get(copy.linkId)!);
          copy.groupId = undefined;
          if (copy.type === 'media') copy.transitionIn = undefined;
          copy.start = round6(playhead + (src.start - origin));
          const kind: TrackKind = copy.type === 'media' ? ((p.media[copy.mediaId]?.kind ?? 'video') === 'audio' ? 'audio' : 'video') : copy.type;
          let track = p.tracks.find((t) => t.kind === kind && !t.locked && !t.clips.some((c) => c.start < clipEnd(copy) && clipEnd(c) > copy.start));
          if (!track) {
            const r = addTrack(p, kind);
            p = r.project;
            track = r.track;
          }
          p = addClip(p, track.id, copy);
          newIds.push(copy.id);
        }
        set({ selection: newIds });
        return p;
      });
    },

    moveSelection(ids, delta, primaryId, toTrackId) {
      return get().run('Mover clipe', (p) => moveClips(p, ids, delta, { primaryId, toTrackId }), { coalesceKey: `move:${ids.join(',')}`, quiet: true });
    },

    trim(id, edge, time) {
      // Clipes ligados (vídeo + áudio extraído) são aparados juntos, num único passo de histórico.
      const ids = expandSelection(get().project, [id], { groups: false });
      return get().run('Ajustar duração', (p) => ids.reduce((acc, i) => trimClip(acc, i, edge, time), p), { coalesceKey: `trim:${ids.join(',')}:${edge}`, quiet: true });
    },

    patchClip(id, fn, label, coalesceKey) {
      get().run(label, (p) => updateClip(p, id, fn), { coalesceKey });
    },

    setSpeed(id, speed) {
      get().run('Alterar velocidade', (p) => setSpeed(p, id, speed), { coalesceKey: `speed:${id}` });
    },
    toggleReverse(id) {
      const c = findClip(get().project, id)?.clip;
      if (c?.type !== 'media') return;
      get().run('Reverter reprodução', (p) => setReverse(p, id, !(c as MediaClip).reverse));
    },
    freeze(id) {
      get().run('Congelar quadro', (p) => freezeFrame(p, id, get().playhead).project);
    },
    extractAudioOf(id) {
      get().run('Extrair áudio', (p) => {
        const r = extractAudio(p, id);
        set({ selection: [id, r.audioId] });
        return r.project;
      });
    },
    unlink(ids) {
      get().run('Desvincular áudio e vídeo', (p) => unlinkClips(p, ids));
    },
    group(ids) {
      get().run('Agrupar', (p) => groupClips(p, ids).project);
    },
    ungroup(ids) {
      get().run('Desagrupar', (p) => ungroupClips(p, ids));
    },

    setTransition(clipId, type, duration) {
      get().run('Aplicar transição', (p) => setTransition(p, clipId, type, duration));
    },
    removeTransition(clipId) {
      get().run('Remover transição', (p) => removeTransition(p, clipId));
    },

    addEffect(clipId, type) {
      get().patchClip(clipId, (c) => (c.type === 'media' ? { ...c, effects: [...c.effects, createEffect(type)] } : c), 'Adicionar efeito');
    },
    addLutEffect(clipId, ref) {
      get().patchClip(clipId, (c) => (c.type === 'media' ? { ...c, effects: [...c.effects, createEffect('lut', {}, ref)] } : c), 'Aplicar LUT');
    },
    importLut(name, cubeText) {
      let id: string | undefined;
      get().run('Importar LUT', (p) => {
        const r = addLut(p, name, cubeText);
        id = r.id;
        return r.project;
      });
      return id;
    },
    removeLut(id) {
      get().run('Remover LUT', (p) => ({
        ...removeLut(p, id),
        tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.type === 'media' ? { ...c, effects: c.effects.filter((e) => e.ref !== id) } : c)) })),
      }));
    },
    setStabilize(clipId, smoothing) {
      get().patchClip(clipId, (c) => (c.type === 'media' ? { ...c, stabilize: smoothing } : c), 'Estabilização', `stab:${clipId}`);
    },
    applyPreset(clipId, presetId) {
      get().patchClip(clipId, (c) => (c.type === 'media' ? { ...c, effects: [...c.effects, ...presetToEffects(presetId)] } : c), 'Aplicar preset');
    },
    updateEffect(clipId, effectId, params) {
      get().patchClip(
        clipId,
        (c) =>
          c.type === 'media'
            ? { ...c, effects: c.effects.map((e) => (e.id === effectId ? { ...e, params: { ...e.params, ...clampParams(e.type, params) } } : e)) }
            : c,
        'Ajustar efeito',
        `fx:${effectId}`,
      );
    },
    toggleEffect(clipId, effectId) {
      get().patchClip(clipId, (c) => (c.type === 'media' ? { ...c, effects: c.effects.map((e) => (e.id === effectId ? { ...e, enabled: !e.enabled } : e)) } : c), 'Ativar/desativar efeito');
    },
    removeEffect(clipId, effectId) {
      get().patchClip(clipId, (c) => (c.type === 'media' ? { ...c, effects: c.effects.filter((e) => e.id !== effectId) } : c), 'Remover efeito');
    },

    applyAnimation(clipId, presetId, duration) {
      const label = getAnimationPreset(presetId)?.label ?? presetId;
      get().patchClip(clipId, (c) => coreApplyAnimation(c, presetId, duration), `Animação: ${label}`);
    },
    clearAnimations(clipId) {
      get().patchClip(clipId, (c) => coreClearAnimations(c), 'Remover animações');
    },
    splitSelectionAtMarkers() {
      const { project, selection } = get();
      const ids = selection.length ? selection : project.tracks.filter((t) => !t.locked).flatMap((t) => t.clips.map((c) => c.id));
      if (!project.markers.length) return toast.info('Adicione marcadores (M) onde deseja dividir');
      const before = project.tracks.reduce((n, t) => n + t.clips.length, 0);
      const ok = get().run('Dividir nos marcadores', (p) => splitAtMarkers(p, ids));
      if (ok && get().project.tracks.reduce((n, t) => n + t.clips.length, 0) === before) toast.info('Nenhum marcador cai dentro dos clipes escolhidos');
    },
    copySelectionAttributes() {
      const { project, selection } = get();
      const id = selection[0];
      if (!id) return toast.info('Selecione o clipe de onde copiar os atributos');
      try {
        set({ attributes: copyAttributes(project, id) });
        toast.success('Atributos copiados (posição, escala, efeitos, keyframes)');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Não foi possível copiar os atributos');
      }
    },
    pasteSelectionAttributes() {
      const { attributes, selection } = get();
      if (!attributes) return toast.info('Copie os atributos de um clipe primeiro (Ctrl+Alt+C)');
      if (!selection.length) return toast.info('Selecione os clipes que receberão os atributos');
      get().run('Colar atributos', (p) => pasteAttributes(p, attributes, selection));
    },
    resetSelectionVisuals() {
      const ids = get().selection;
      if (!ids.length) return toast.info('Selecione os clipes que deseja redefinir');
      get().run('Redefinir transformação e efeitos', (p) => resetClipVisuals(p, ids));
    },
    repeatSelection(times) {
      const ids = get().selection;
      if (ids.length !== 1) return toast.info('Selecione um único clipe para repeti-lo');
      let created: string[] = [];
      const ok = get().run('Repetir clipe', (p) => {
        const r = repeatClip(p, ids[0]!, times);
        created = r.newIds;
        return r.project;
      });
      if (ok) set({ selection: [ids[0]!, ...created] });
    },
    changeCaseSelection(mode) {
      const ids = get().selection;
      if (!ids.length) return toast.info('Selecione textos ou legendas');
      get().run('Mudar caixa do texto', (p) => changeTextCase(p, ids, mode));
    },
    replaceAllText(find, replacement, opts) {
      if (!find) return 0;
      let count = 0;
      const ids = opts?.onlySelection ? get().selection : undefined;
      get().run('Localizar e substituir', (p) => {
        const r = replaceInText(p, find, replacement, { matchCase: opts?.matchCase, ids });
        count = r.count;
        return r.project;
      });
      return count;
    },
    duplicateTrackById(id) {
      let newId: string | null = null;
      const ok = get().run('Duplicar faixa', (p) => {
        const r = duplicateTrack(p, id);
        newId = r.track.id;
        return r.project;
      });
      if (ok && newId) set({ selectedTrackId: newId });
    },
    placeSelection(preset) {
      const { project, selection, media } = get();
      const frame = { width: project.settings.width, height: project.settings.height };
      const targets = selection.map((id) => findClip(project, id)?.clip).filter((c): c is MediaClip => c?.type === 'media' && !!media[c.mediaId] && media[c.mediaId]!.kind !== 'audio');
      if (!targets.length) return toast.info('Selecione um vídeo ou imagem para posicionar');
      get().run('Posicionar clipe', (p) =>
        targets.reduce((acc, c) => {
          const item = media[c.mediaId]!;
          const pos = positionFor(preset, { width: item.width, height: item.height }, frame, c.transform.scale);
          return updateClip(acc, c.id, (x) => ({ ...x, transform: { ...(x as MediaClip).transform, x: pos.x, y: pos.y } }) as Clip);
        }, p),
      );
    },
    fillFrameSelection() {
      const { project, selection, media } = get();
      const frame = { width: project.settings.width, height: project.settings.height };
      const targets = selection.map((id) => findClip(project, id)?.clip).filter((c): c is MediaClip => c?.type === 'media' && !!media[c.mediaId] && media[c.mediaId]!.kind !== 'audio');
      if (!targets.length) return toast.info('Selecione um vídeo ou imagem para preencher o quadro');
      get().run('Preencher o quadro', (p) =>
        targets.reduce((acc, c) => {
          const item = media[c.mediaId]!;
          return updateClip(acc, c.id, (x) => ({ ...x, transform: { ...(x as MediaClip).transform, scale: coverScale({ width: item.width, height: item.height }, frame), x: 0, y: 0 } }) as Clip);
        }, p),
      );
    },
    rotateSelection(deg) {
      const { project, selection } = get();
      const targets = selection.map((id) => findClip(project, id)?.clip).filter((c): c is Clip => !!c && c.type !== 'caption');
      if (!targets.length) return toast.info('Selecione um clipe visual para girar');
      get().run('Girar clipe', (p) =>
        targets.reduce((acc, c) => updateClip(acc, c.id, (x) => {
          const t = (x as MediaClip).transform;
          const rotation = ((((t.rotation + deg) % 360) + 540) % 360) - 180; // mantém entre -180 e 180
          return { ...x, transform: { ...t, rotation } } as Clip;
        }), p),
      );
    },
    extendToPlayhead() {
      const { project, selection, playhead } = get();
      const targets = selection.map((id) => findClip(project, id)?.clip).filter((c): c is Clip => !!c && playhead > clipEnd(c) + 1e-6);
      if (!targets.length) return toast.info('Posicione a cabeça de reprodução depois do fim do clipe selecionado');
      for (const c of targets) get().trim(c.id, 'end', playhead);
      get().sealDrag();
    },
    toggleAllTracks(prop) {
      const tracks = get().project.tracks.filter((t) => (prop === 'hidden' ? t.kind !== 'audio' : prop === 'muted' ? t.kind === 'video' || t.kind === 'audio' : true));
      if (!tracks.length) return;
      const on = tracks.some((t) => !t[prop]);
      const label = { locked: 'Bloquear faixas', hidden: 'Ocultar faixas', muted: 'Silenciar faixas' }[prop];
      get().run(on ? label : 'Desfazer: ' + label.toLowerCase(), (p) => tracks.reduce((acc, t) => setTrackProps(acc, t.id, { [prop]: on }), p));
    },
    zoomToSelection() {
      const { project, selection } = get();
      const clips = selection.map((id) => findClip(project, id)?.clip).filter((c): c is Clip => !!c);
      if (!clips.length) return toast.info('Selecione clipes para dar zoom neles');
      const start = Math.min(...clips.map((c) => c.start));
      const end = Math.max(...clips.map(clipEnd));
      const el = document.querySelector<HTMLElement>('[data-testid="timeline"]');
      const width = Math.max(200, (el?.clientWidth ?? 900) - 260);
      get().setZoom(width / Math.max(end - start, 0.25));
      get().setPlayhead(start);
      // a rolagem horizontal acompanha o início da seleção
      requestAnimationFrame(() => {
        const scroller = el?.querySelector<HTMLElement>('.overflow-auto');
        if (scroller) scroller.scrollLeft = Math.max(0, start * get().zoom - 24);
      });
    },
    nudgeVolume(delta) {
      const { project, selection } = get();
      const targets = selection.map((id) => findClip(project, id)?.clip).filter((c): c is MediaClip => c?.type === 'media');
      if (!targets.length) return toast.info('Selecione clipes de áudio ou vídeo');
      get().run('Ajustar volume', (p) =>
        targets.reduce((acc, c) => updateClip(acc, c.id, (x) => {
          const a = (x as MediaClip).audio;
          return { ...x, audio: { ...a, volume: Math.min(4, Math.max(0, round6(a.volume + delta))) } } as Clip;
        }), p),
      );
    },
    setFades(fadeIn, fadeOut) {
      const { project, selection } = get();
      const targets = selection.map((id) => findClip(project, id)?.clip).filter((c): c is MediaClip => c?.type === 'media');
      if (!targets.length) return toast.info('Selecione clipes de áudio ou vídeo');
      get().run('Ajustar fades', (p) =>
        targets.reduce((acc, c) => updateClip(acc, c.id, (x) => {
          const a = (x as MediaClip).audio;
          const half = x.duration / 2; // entrada + saída nunca passam do clipe
          return { ...x, audio: { ...a, fadeIn: fadeIn === null ? a.fadeIn : Math.min(fadeIn, half), fadeOut: fadeOut === null ? a.fadeOut : Math.min(fadeOut, half) } } as Clip;
        }), p),
      );
    },
    toggleMuteSelection() {
      const { project, selection } = get();
      const targets = selection.map((id) => findClip(project, id)?.clip).filter((c): c is MediaClip => c?.type === 'media');
      if (!targets.length) return toast.info('Selecione clipes de áudio ou vídeo');
      const mute = targets.some((c) => !c.audio.muted);
      get().run(mute ? 'Silenciar clipes' : 'Reativar o som dos clipes', (p) => targets.reduce((acc, c) => updateClip(acc, c.id, (x) => ({ ...x, audio: { ...(x as MediaClip).audio, muted: mute } }) as Clip), p));
    },
    setSelectionSpeed(speed) {
      const { project, selection } = get();
      const ids = selection.filter((id) => findClip(project, id)?.clip.type === 'media');
      if (!ids.length) return toast.info('Selecione clipes de vídeo ou áudio');
      get().run('Alterar velocidade', (p) => ids.reduce((acc, id) => setSpeed(acc, id, speed), p));
    },
    async copyChapters() {
      const { project } = get();
      if (project.markers.length < 1) return void toast.info('Adicione marcadores (M) para gerar os capítulos');
      const text = markersToChapters(project.markers);
      try {
        await navigator.clipboard.writeText(text);
        const n = text.split('\n').length;
        toast.success(n === 1 ? '1 capítulo copiado' : n + ' capítulos copiados');
      } catch {
        toast.error('Não foi possível copiar. Permita o acesso à área de transferência.');
      }
    },
    mergeSelectedCaptions() {
      const ids = get().selection;
      if (ids.length < 2) return toast.info('Selecione duas ou mais legendas da mesma faixa');
      let merged: string | null = null;
      const ok = get().run('Juntar legendas', (p) => {
        const r = mergeCaptions(p, ids);
        merged = r.mergedId;
        return r.project;
      });
      if (ok && merged) set({ selection: [merged] });
    },
    shiftCaptionTimes(delta) {
      const { project, selection } = get();
      const chosen = selection.filter((id) => findClip(project, id)?.clip.type === 'caption');
      if (!project.tracks.some((t) => t.kind === 'caption' && t.clips.length)) return toast.info('O projeto não tem legendas');
      get().run(delta > 0 ? 'Atrasar legendas' : 'Adiantar legendas', (p) => shiftCaptions(p, delta, chosen.length ? chosen : undefined));
    },
    selectFastCaptions() {
      const ids = fastCaptionIds(get().project);
      if (!ids.length) return toast.success('Nenhuma legenda passa de 20 caracteres por segundo');
      set({ selection: ids });
      toast.info(ids.length === 1 ? '1 legenda rápida demais selecionada' : ids.length + ' legendas rápidas demais selecionadas');
    },
    setSelectionDuration(seconds) {
      const ids = get().selection;
      if (!ids.length) return toast.info('Selecione os clipes que terão a nova duração');
      get().run('Definir duração', (p) => setClipsDuration(p, ids, seconds));
    },
    sequenceSelection() {
      const ids = get().selection;
      if (ids.length < 2) return toast.info('Selecione pelo menos dois clipes para colocá-los em sequência');
      get().run('Colocar clipes em sequência', (p) => sequenceClips(p, ids));
    },
    closeGaps(trackId) {
      get().run('Fechar espaços vazios', (p) => coreCloseGaps(p, trackId));
    },
    markBeats(times) {
      if (!times.length) return;
      get().run(`Marcar ${times.length} batidas`, (p) => times.reduce((acc, t, i) => addMarker(acc, t, `Batida ${i + 1}`, '#f5a623').project, p));
    },
    setKeyframe(clipId, prop, value) {
      const { playhead } = get();
      get().patchClip(
        clipId,
        (c) => {
          const local = round6(Math.max(0, Math.min(playhead - c.start, c.duration)));
          return { ...c, keyframes: { ...c.keyframes, [prop]: upsertKeyframe(c.keyframes[prop], local, value) } } as Clip;
        },
        'Keyframe',
        `kf:${clipId}:${prop}`,
      );
    },
    removeKeyframe(clipId, prop) {
      const { playhead } = get();
      get().patchClip(
        clipId,
        (c) => {
          const local = playhead - c.start;
          const next = removeKeyframeAt(c.keyframes[prop], local);
          const kf = { ...c.keyframes };
          if (next.length) kf[prop] = next;
          else delete kf[prop];
          return { ...c, keyframes: kf } as Clip;
        },
        'Remover keyframe',
      );
    },

    addText(text = 'Novo texto', style = {}) {
      const { playhead } = get();
      get().run('Adicionar texto', (p0) => {
        let p = p0;
        const dur = 3;
        let track = p.tracks.find((t) => t.kind === 'text' && !t.locked && !t.clips.some((c) => c.start < playhead + dur && clipEnd(c) > playhead));
        if (!track) {
          const r = addTrack(p, 'text');
          p = r.project;
          track = r.track;
        }
        const clip = TextClipSchema.parse({ id: newId('clp'), type: 'text', text, start: playhead, duration: dur, style });
        set({ selection: [clip.id] });
        return addClip(p, track.id, clip);
      });
    },

    addCaptions(cues) {
      get().addCaptionClips(cuesToCaptionClips(cues));
    },

    addCaptionClips(clips, label = 'Adicionar legendas') {
      get().run(label, (p0) => {
        // Todas as legendas entram numa faixa nova; consecutivas não podem se sobrepor.
        const r = addTrack(p0, 'caption');
        let p = r.project;
        let last = 0;
        for (const c of [...clips].sort((x, y) => x.start - y.start)) {
          const start = Math.max(c.start, last);
          const end = c.start + c.duration;
          if (end - start < 0.05) continue;
          const parsed = CaptionClipSchema.parse({ ...c, start: round6(start), duration: round6(end - start) });
          p = addClip(p, r.track.id, parsed);
          last = clipEnd(parsed);
        }
        return p;
      });
    },

    addTrack(kind) {
      get().run('Adicionar faixa', (p) => addTrack(p, kind).project);
    },
    removeTrack(id) {
      get().run('Remover faixa', (p) => removeTrack(p, id));
    },
    patchTrack(id, patch) {
      get().run('Alterar faixa', (p) => setTrackProps(p, id, patch));
    },
    moveTrack(id, index) {
      get().run('Reordenar faixa', (p) => moveTrack(p, id, index));
    },
    addMarkerAtPlayhead() {
      get().run('Adicionar marcador', (p) => addMarker(p, get().playhead, `Marcador ${p.markers.length + 1}`).project);
    },
    recolorMarker(id, color) {
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
      get().run('Mudar cor do marcador', (p) => updateMarker(p, id, { color }));
    },
    renameMarker(id, label) {
      get().run('Renomear marcador', (p) => updateMarker(p, id, { label: label.trim().slice(0, 80) }), { coalesceKey: `marker:${id}` });
    },
    removeMarker(id) {
      get().run('Remover marcador', (p) => removeMarker(p, id));
    },
    setSettings(patch) {
      get().run('Alterar configurações do projeto', (p) => setSettings(p, patch));
    },
    rename(name) {
      get().run('Renomear projeto', (p) => ({ ...p, name }), { coalesceKey: 'rename' });
    },
  };
});

export const selectDuration = (s: EditorState): number => projectDuration(s.project);
export const selectCanUndo = (s: EditorState): boolean => canUndo(s.history);
export const selectCanRedo = (s: EditorState): boolean => canRedo(s.history);
export const selectClips = (s: EditorState): Clip[] => s.selection.map((id) => findClip(s.project, id)?.clip).filter((c): c is Clip => !!c);

