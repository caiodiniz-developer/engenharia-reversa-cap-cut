/**
 * Plataformas de destino: formato ideal, duração recomendada e "zonas seguras" (áreas onde a interface do aplicativo
 * costuma cobrir o vídeo). Os valores são APROXIMAÇÕES práticas, não regras oficiais — os aplicativos mudam seus
 * layouts e limites com frequência. Ajuste aqui se a plataforma mudar.
 */

export interface Insets {
  /** Frações do quadro (0–1) que ficam cobertas pela interface em cada lado. */
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Platform {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Duração recomendada máxima, em segundos (0 = sem recomendação). */
  recommendedMaxSeconds: number;
  safe: Insets;
}

export const PLATFORMS: Platform[] = [
  { id: 'youtube', label: 'YouTube (horizontal)', width: 1920, height: 1080, recommendedMaxSeconds: 0, safe: { top: 0.05, bottom: 0.1, left: 0.05, right: 0.05 } },
  { id: 'shorts', label: 'YouTube Shorts', width: 1080, height: 1920, recommendedMaxSeconds: 60, safe: { top: 0.1, bottom: 0.22, left: 0.05, right: 0.13 } },
  { id: 'reels', label: 'Instagram Reels', width: 1080, height: 1920, recommendedMaxSeconds: 90, safe: { top: 0.12, bottom: 0.25, left: 0.05, right: 0.12 } },
  { id: 'tiktok', label: 'TikTok', width: 1080, height: 1920, recommendedMaxSeconds: 60, safe: { top: 0.1, bottom: 0.25, left: 0.05, right: 0.15 } },
  { id: 'stories', label: 'Stories', width: 1080, height: 1920, recommendedMaxSeconds: 60, safe: { top: 0.14, bottom: 0.2, left: 0.05, right: 0.05 } },
  { id: 'feed', label: 'Feed quadrado (1:1)', width: 1080, height: 1080, recommendedMaxSeconds: 60, safe: { top: 0.05, bottom: 0.08, left: 0.05, right: 0.05 } },
  { id: 'portrait', label: 'Feed retrato (4:5)', width: 1080, height: 1350, recommendedMaxSeconds: 60, safe: { top: 0.05, bottom: 0.1, left: 0.05, right: 0.05 } },
];

export const getPlatform = (id: string): Platform | undefined => PLATFORMS.find((p) => p.id === id);

/** O formato do projeto bate com o da plataforma (mesma proporção, tolerância de 1%)? */
export function matchesAspect(platform: Platform, width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const a = platform.width / platform.height;
  const b = width / height;
  return Math.abs(a - b) / a < 0.01;
}

/** Retângulo seguro em frações do quadro: { x, y, w, h }. */
export function safeRect(platform: Platform): { x: number; y: number; w: number; h: number } {
  const { top, bottom, left, right } = platform.safe;
  return { x: left, y: top, w: 1 - left - right, h: 1 - top - bottom };
}

/**
 * Um ponto (centro do clipe: x e y como deslocamento do centro, em frações do quadro, 0 = centro)
 * está dentro da zona segura da plataforma?
 */
export function isInsideSafe(platform: Platform, x: number, y: number): boolean {
  const r = safeRect(platform);
  const px = 0.5 + x;
  const py = 0.5 + y;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
