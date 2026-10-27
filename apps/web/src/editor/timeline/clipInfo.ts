import type { Clip, MediaClip } from '@editor/core';

const t = (sec: number): string => {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest < 10 ? '0' : ''}${rest.toFixed(rest % 1 === 0 ? 0 : 1)}`;
};

/** Texto do tooltip de um clipe: nome, posição, duração e o que foi aplicado (velocidade, efeitos, som, fades…). */
export function clipTooltip(clip: Clip, name: string): string {
  const parts = [name, `início ${t(clip.start)}`, `duração ${t(clip.duration)}`];
  if (clip.type === 'media') {
    const m = clip as MediaClip;
    if (m.speed !== 1) parts.push(`velocidade ${String(m.speed).replace('.', ',')}×`);
    if (m.reverse) parts.push('invertido');
    if (m.freeze) parts.push('quadro congelado');
    const fx = m.effects.filter((e) => e.enabled).length;
    if (fx) parts.push(fx === 1 ? '1 efeito' : `${fx} efeitos`);
    if (m.stabilize > 0) parts.push('estabilizado');
    if (m.audio.muted) parts.push('sem som');
    else if (Math.abs(m.audio.volume - 1) > 1e-6) parts.push(`volume ${Math.round(m.audio.volume * 100)}%`);
    if (m.audio.fadeIn > 0 || m.audio.fadeOut > 0) parts.push(`fade ${t(m.audio.fadeIn)} / ${t(m.audio.fadeOut)}`);
    if (m.transitionIn) parts.push(`transição ${m.transitionIn.type}`);
  }
  const kf = Object.values(clip.keyframes).reduce((n, k) => n + (k?.length ?? 0), 0);
  if (kf) parts.push(kf === 1 ? '1 keyframe' : `${kf} keyframes`);
  return parts.join(' · ');
}
